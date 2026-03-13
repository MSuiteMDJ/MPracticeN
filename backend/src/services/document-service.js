import { v4 as uuidv4 } from 'uuid';
import { storage } from '../config/database.js';

function buildVersionFromDocument(document) {
  const createdAt = document.updated_at || document.created_at || new Date().toISOString();

  return {
    id: uuidv4(),
    document_id: document.id,
    client_id: document.client_id,
    user_id: document.user_id,
    version: Number(document.version || 1),
    file_path: document.file_path,
    file_name: document.file_name,
    file_size: document.file_size,
    mime_type: document.mime_type,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function sortVersionsDescending(left, right) {
  const versionGap = Number(right.version || 0) - Number(left.version || 0);
  if (versionGap !== 0) return versionGap;
  return Date.parse(right.created_at || '') - Date.parse(left.created_at || '');
}

export function ensureDocumentVersionSeed(document) {
  if (!document) return [];

  const existingVersions = Array.from(storage.documentVersions.values())
    .filter((version) => version.document_id === document.id)
    .sort(sortVersionsDescending);

  if (existingVersions.length > 0) {
    return existingVersions;
  }

  const seededVersion = buildVersionFromDocument(document);
  storage.documentVersions.set(seededVersion.id, seededVersion);

  const nextDocument = {
    ...document,
    current_version_id: document.current_version_id || seededVersion.id,
    version: Number(document.version || 1),
    version_count: Number(document.version_count || 1),
  };
  storage.documents.set(document.id, nextDocument);

  return [seededVersion];
}

export function mapStoredDocumentVersion(version) {
  return {
    version_id: version.id,
    document_id: version.document_id,
    client_id: version.client_id,
    version: Number(version.version || 1),
    file_path: version.file_path,
    file_name: version.file_name,
    file_size: version.file_size,
    mime_type: version.mime_type,
    created_at: version.created_at,
    updated_at: version.updated_at || version.created_at,
  };
}

export function mapStoredDocument(document) {
  const versions = ensureDocumentVersionSeed(document);
  const currentVersion = versions.find((version) => version.id === document.current_version_id) || versions[0] || null;

  return {
    document_id: document.id,
    client_id: document.client_id,
    document_type: document.document_type,
    category: document.category,
    version: Number(document.version || currentVersion?.version || 1),
    version_count: versions.length || Number(document.version_count || 1),
    current_version_id: document.current_version_id || currentVersion?.id,
    file_path: document.file_path,
    linked_mrn: document.linked_mrn,
    created_at: document.created_at,
    updated_at: document.updated_at || document.created_at,
    file_name: document.file_name,
    file_size: document.file_size,
    mime_type: document.mime_type,
    is_archived: Boolean(document.is_archived),
  };
}

export function getDocumentOrNull(documentId, userId) {
  const document = storage.documents.get(documentId);
  if (!document || document.user_id !== userId) return null;
  return document;
}

export function listDocumentVersions(document) {
  return ensureDocumentVersionSeed(document)
    .slice()
    .sort(sortVersionsDescending)
    .map(mapStoredDocumentVersion);
}

export function createDocumentRecord({ clientId, userId, documentType, category, file }) {
  const now = new Date().toISOString();
  const documentId = uuidv4();
  const versionId = uuidv4();

  const version = {
    id: versionId,
    document_id: documentId,
    client_id: clientId,
    user_id: userId,
    version: 1,
    file_path: file.path,
    file_name: file.originalname,
    file_size: file.size,
    mime_type: file.mimetype,
    created_at: now,
    updated_at: now,
  };

  const document = {
    id: documentId,
    client_id: clientId,
    user_id: userId,
    document_type: documentType,
    category,
    version: 1,
    version_count: 1,
    current_version_id: versionId,
    file_path: file.path,
    file_name: file.originalname,
    file_size: file.size,
    mime_type: file.mimetype,
    is_archived: false,
    created_at: now,
    updated_at: now,
  };

  storage.documentVersions.set(version.id, version);
  storage.documents.set(document.id, document);

  return {
    document,
    version,
  };
}

export function addDocumentVersion(document, { file, documentType, category }) {
  const existingVersions = ensureDocumentVersionSeed(document);
  const nextVersionNumber = existingVersions.reduce((max, version) => Math.max(max, Number(version.version || 0)), 0) + 1;
  const now = new Date().toISOString();

  const version = {
    id: uuidv4(),
    document_id: document.id,
    client_id: document.client_id,
    user_id: document.user_id,
    version: nextVersionNumber,
    file_path: file.path,
    file_name: file.originalname,
    file_size: file.size,
    mime_type: file.mimetype,
    created_at: now,
    updated_at: now,
  };

  const nextDocument = {
    ...document,
    document_type: String(documentType || document.document_type || 'general'),
    category: String(category || document.category || 'General'),
    version: nextVersionNumber,
    version_count: existingVersions.length + 1,
    current_version_id: version.id,
    file_path: file.path,
    file_name: file.originalname,
    file_size: file.size,
    mime_type: file.mimetype,
    updated_at: now,
  };

  storage.documentVersions.set(version.id, version);
  storage.documents.set(document.id, nextDocument);

  return {
    document: nextDocument,
    version,
  };
}

export function deleteDocumentRecord(documentId) {
  storage.documents.delete(documentId);
  Array.from(storage.documentVersions.values())
    .filter((version) => version.document_id === documentId)
    .forEach((version) => {
      storage.documentVersions.delete(version.id);
    });
}
