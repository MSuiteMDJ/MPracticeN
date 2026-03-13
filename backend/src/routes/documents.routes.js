import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { storage } from '../config/database.js';
import { ensureDirectory, getUploadsRoot } from '../config/storage-paths.js';
import {
  addDocumentVersion,
  createDocumentRecord,
  deleteDocumentRecord,
  getDocumentOrNull,
  listDocumentVersions,
  mapStoredDocument,
} from '../services/document-service.js';
import { recordAuditEvent } from '../services/audit-service.js';

const router = Router();
const uploadDir = ensureDirectory(getUploadsRoot());
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  },
});

function filterDocumentsForUser(userId, query = {}) {
  const search = String(query.search || '').trim().toLowerCase();
  const category = String(query.category || '').trim();
  const clientId = String(query.clientId || query.client_id || '').trim();
  const includeArchived = String(query.includeArchived || '').trim().toLowerCase() === 'true';

  return Array.from(storage.documents.values())
    .filter((document) => document.user_id === userId)
    .filter((document) => (clientId ? document.client_id === clientId : true))
    .filter((document) => (category ? document.category === category : true))
    .filter((document) => (includeArchived ? true : !document.is_archived))
    .filter((document) => {
      if (!search) return true;
      const haystack = [
        document.file_name,
        document.document_type,
        document.category,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return haystack.includes(search);
    })
    .sort(
      (left, right) =>
        Date.parse(right.updated_at || right.created_at || '') -
        Date.parse(left.updated_at || left.created_at || '')
    );
}

router.get('/', async (req, res, next) => {
  try {
    const documents = filterDocumentsForUser(req.userId, req.query).map(mapStoredDocument);
    res.json({ documents });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const documents = filterDocumentsForUser(req.userId, {
      ...req.query,
      includeArchived: 'true',
    });
    const activeDocuments = documents.filter((document) => !document.is_archived);
    const documentsByCategory = activeDocuments.reduce((acc, document) => {
      const key = String(document.category || 'General');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const recentUploads = activeDocuments.slice(0, 10).map(mapStoredDocument);

    res.json({
      totalDocuments: activeDocuments.length,
      totalSize: activeDocuments.reduce((sum, document) => sum + Number(document.file_size || 0), 0),
      documentsByCategory,
      recentUploads,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    const clientId = String(req.body?.clientId || req.body?.client_id || '').trim();
    if (!clientId) {
      return res.status(400).json({ success: false, message: 'clientId is required' });
    }

    const client = storage.clients.get(clientId);
    if (!client || client.user_id !== req.userId) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }

    const { document } = createDocumentRecord({
      clientId,
      userId: req.userId,
      documentType: String(req.body?.documentType || req.body?.document_type || 'general'),
      category: String(req.body?.category || 'General'),
      file: req.file,
    });

    recordAuditEvent(req.userId, {
      module: 'documents',
      entityType: 'document',
      entityId: document.id,
      entityLabel: document.file_name || document.document_type,
      clientId,
      action: 'uploaded',
      detail: `Document uploaded for ${client.name || client.company_name}`,
      metadata: {
        document_type: document.document_type,
        category: document.category,
        file_name: document.file_name,
        version: 1,
      },
    });

    res.json({ success: true, document: mapStoredDocument(document) });
  } catch (error) {
    next(error);
  }
});

router.get('/:documentId/versions', async (req, res, next) => {
  try {
    const document = getDocumentOrNull(req.params.documentId, req.userId);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    res.json({ versions: listDocumentVersions(document) });
  } catch (error) {
    next(error);
  }
});

router.post('/:documentId/versions', upload.single('file'), async (req, res, next) => {
  try {
    const document = getDocumentOrNull(req.params.documentId, req.userId);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }

    const { document: nextDocument, version } = addDocumentVersion(document, {
      file: req.file,
      documentType: req.body?.documentType || req.body?.document_type,
      category: req.body?.category,
    });

    recordAuditEvent(req.userId, {
      module: 'documents',
      entityType: 'document',
      entityId: nextDocument.id,
      entityLabel: nextDocument.file_name || nextDocument.document_type,
      clientId: nextDocument.client_id,
      action: 'version_uploaded',
      detail: `Document version ${version.version} uploaded`,
      metadata: {
        document_type: nextDocument.document_type,
        category: nextDocument.category,
        file_name: version.file_name,
        version: version.version,
      },
    });

    res.json({
      success: true,
      document: mapStoredDocument(nextDocument),
      version: listDocumentVersions(nextDocument)[0],
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:documentId/download', async (req, res, next) => {
  try {
    const document = getDocumentOrNull(req.params.documentId, req.userId);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (!document.file_path || !fs.existsSync(document.file_path)) {
      return res.status(404).json({ success: false, message: 'Document file not found' });
    }

    const filePath = path.resolve(document.file_path);
    res.download(filePath, document.file_name || path.basename(filePath));
  } catch (error) {
    next(error);
  }
});

router.get('/:documentId/preview', async (req, res, next) => {
  try {
    const document = getDocumentOrNull(req.params.documentId, req.userId);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (!document.file_path || !fs.existsSync(document.file_path)) {
      return res.status(404).json({ success: false, message: 'Document file not found' });
    }

    const filePath = path.resolve(document.file_path);
    if (document.mime_type) {
      res.type(document.mime_type);
    }
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

router.post('/:documentId/archive', async (req, res, next) => {
  try {
    const document = getDocumentOrNull(req.params.documentId, req.userId);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const nextDocument = {
      ...document,
      is_archived: true,
      updated_at: new Date().toISOString(),
    };
    storage.documents.set(document.id, nextDocument);
    res.json({ success: true, document: mapStoredDocument(nextDocument) });
  } catch (error) {
    next(error);
  }
});

router.post('/:documentId/restore', async (req, res, next) => {
  try {
    const document = getDocumentOrNull(req.params.documentId, req.userId);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const nextDocument = {
      ...document,
      is_archived: false,
      updated_at: new Date().toISOString(),
    };
    storage.documents.set(document.id, nextDocument);
    res.json({ success: true, document: mapStoredDocument(nextDocument) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:documentId', async (req, res, next) => {
  try {
    const document = getDocumentOrNull(req.params.documentId, req.userId);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    deleteDocumentRecord(document.id);
    recordAuditEvent(req.userId, {
      module: 'documents',
      entityType: 'document',
      entityId: document.id,
      entityLabel: document.file_name || document.document_type,
      clientId: document.client_id,
      action: 'deleted',
      detail: 'Document deleted',
      metadata: {
        document_type: document.document_type,
        category: document.category,
      },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
