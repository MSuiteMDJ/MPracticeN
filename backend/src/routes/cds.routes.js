import { Router } from 'express';
import multer from 'multer';
import { CSVProcessor } from '../services/csv-processor.js';
import { DeclarationStore } from '../services/declaration-store.js';
import { HMRCClient } from '../services/hmrc-client.js';
import { ensureDirectory, getUploadsRoot } from '../config/storage-paths.js';

const router = Router();

// File upload configuration
const uploadDir = ensureDirectory(getUploadsRoot());
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB
  }
});

const csvProcessor = new CSVProcessor();
const store = new DeclarationStore();

/**
 * POST /cds/import - Upload and process CSV files
 */
router.post('/import', upload.fields([
  { name: 'header', maxCount: 1 },
  { name: 'items', maxCount: 1 },
  { name: 'tax', maxCount: 1 }
]), async (req, res, next) => {
  try {
    const files = req.files;
    const userId = req.userId || 'demo-user'; // TODO: Get from auth middleware
    
    if (!files || !files.header) {
      return res.status(400).json({
        success: false,
        message: 'Header file is required'
      });
    }

    const headerFile = files.header[0];
    const itemsFile = files.items?.[0];
    const taxFile = files.tax?.[0];

    // Process CSV files
    const result = await csvProcessor.processFiles({
      header: headerFile.path,
      items: itemsFile?.path,
      tax: taxFile?.path
    }, userId);

    // Save to database
    const batch = store.saveBatch(
      userId,
      result.declarations,
      result.items,
      result.taxLines,
      result.errors,
      result.warnings,
      headerFile.originalname
    );

    res.json({
      success: true,
      batch: {
        batchId: batch.batchId,
        declarations: batch.declarations,
        items: batch.items,
        taxLines: batch.taxLines,
        documents: 0,
        errors: batch.errors
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /cds/declarations - List declarations
 */
router.get('/declarations', async (req, res, next) => {
  try {
    const userId = req.userId || 'demo-user';
    const filter = {
      mrn: req.query.mrn,
      status: req.query.status,
      batchId: req.query.batchId,
      client: req.query.client,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit
    };

    const declarations = store.getDeclarations(userId, filter);
    res.json({ declarations });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /cds/declarations/:id - Get single declaration
 */
router.get('/declarations/:id', async (req, res, next) => {
  try {
    const userId = req.userId || 'demo-user';
    const declaration = store.getDeclaration(userId, req.params.id);
    
    if (!declaration) {
      return res.status(404).json({
        success: false,
        message: 'Declaration not found'
      });
    }

    res.json(declaration);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /cds/declarations/:id - Delete declaration
 */
router.delete('/declarations/:id', async (req, res, next) => {
  try {
    const userId = req.userId || 'demo-user';
    const success = store.deleteDeclaration(userId, req.params.id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Declaration not found'
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /cds/declarations/:id/assign-client - Assign client to declaration
 */
router.post('/declarations/:id/assign-client', async (req, res, next) => {
  try {
    const userId = req.userId || 'demo-user';
    const { clientId, clientName } = req.body;
    
    const success = store.assignClient(userId, req.params.id, clientId, clientName);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Declaration not found'
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /cds/manifest/summary - Get statistics
 */
router.get('/manifest/summary', async (req, res, next) => {
  try {
    const userId = req.userId || 'demo-user';
    const summary = store.getSummary(userId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /cds/batches - Get import batches
 */
router.get('/batches', async (req, res, next) => {
  try {
    const userId = req.userId || 'demo-user';
    const batches = store.getBatches(userId);
    res.json({ batches });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /cds/batches/:batchId/errors - Get batch errors
 */
router.get('/batches/:batchId/errors', async (req, res, next) => {
  try {
    const errors = store.getBatchErrors(req.params.batchId);
    res.json({ errors });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /cds/hmrc/fetch/:mrn - Fetch declaration from HMRC API
 */
router.post('/hmrc/fetch/:mrn', async (req, res, next) => {
  try {
    const userId = req.userId || 'demo-user';
    const hmrcClient = new HMRCClient(userId);
    
    // Fetch from HMRC
    const declaration = await hmrcClient.getDeclaration(req.params.mrn);
    
    // Save to database
    const id = store.saveFromHMRC(userId, declaration);
    
    res.json({
      success: true,
      declaration_id: id,
      mrn: declaration.mrn,
      message: 'Declaration fetched from HMRC and saved'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /cds/hmrc/sync - Sync declarations from HMRC API
 */
router.post('/hmrc/sync', async (req, res, next) => {
  try {
    const userId = req.userId || 'demo-user';
    const hmrcClient = new HMRCClient(userId);
    
    const params = {
      from_date: req.body.from_date,
      to_date: req.body.to_date,
      eori: req.body.eori
    };
    
    // Fetch from HMRC
    const result = await hmrcClient.listDeclarations(params);
    
    // Save each declaration
    let savedCount = 0;
    for (const declaration of result.declarations || []) {
      store.saveFromHMRC(userId, declaration);
      savedCount++;
    }
    
    res.json({
      success: true,
      synced: savedCount,
      message: `Synced ${savedCount} declarations from HMRC`
    });
  } catch (error) {
    next(error);
  }
});

export default router;
