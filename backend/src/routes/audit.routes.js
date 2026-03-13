import { Router } from 'express';
import { listAuditEvents } from '../services/audit-service.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const events = listAuditEvents(req.userId, {
      module: String(req.query?.module || '').trim() || undefined,
      entityType: String(req.query?.entity_type || '').trim() || undefined,
      entityId: String(req.query?.entity_id || '').trim() || undefined,
      clientId: String(req.query?.client_id || '').trim() || undefined,
      limit: req.query?.limit,
    });

    res.json({ events });
  } catch (error) {
    next(error);
  }
});

export default router;
