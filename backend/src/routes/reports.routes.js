import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../config/database.js';

const router = Router();

function getReportOrNull(reportId, userId) {
  const report = storage.reports.get(reportId);
  if (!report || report.user_id !== userId) return null;
  return report;
}

function mapStoredReport(report) {
  return {
    report_id: report.id,
    client_id: report.client_id,
    title: report.title,
    report_type: report.report_type,
    template_file: report.template_file,
    format: report.format || 'HTML',
    generated_at: report.generated_at || report.created_at,
    created_at: report.created_at,
    updated_at: report.updated_at || report.created_at,
    metadata: report.metadata || {},
  };
}

function getReportsForUser(userId, query = {}) {
  const clientId = String(query.clientId || query.client_id || '').trim();
  const reportType = String(query.reportType || query.report_type || '').trim();

  return Array.from(storage.reports.values())
    .filter((report) => report.user_id === userId)
    .filter((report) => (clientId ? report.client_id === clientId : true))
    .filter((report) => (reportType ? report.report_type === reportType : true))
    .sort(
      (left, right) =>
        Date.parse(right.generated_at || right.created_at || '') -
        Date.parse(left.generated_at || left.created_at || '')
    );
}

router.get('/', async (req, res, next) => {
  try {
    const reports = getReportsForUser(req.userId, req.query).map(mapStoredReport);
    res.json({ reports });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const reports = getReportsForUser(req.userId, req.query);
    const reportsByType = reports.reduce((acc, report) => {
      const key = String(report.report_type || 'general');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    res.json({
      totalReports: reports.length,
      reportsByType,
      recentReports: reports.slice(0, 10).map(mapStoredReport),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/client/:clientId', async (req, res, next) => {
  try {
    const client = storage.clients.get(req.params.clientId);
    if (!client || client.user_id !== req.userId) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const html = String(req.body?.html || '').trim();
    if (!html) {
      return res.status(400).json({ success: false, message: 'html is required' });
    }

    const now = new Date().toISOString();
    const report = {
      id: uuidv4(),
      client_id: req.params.clientId,
      user_id: req.userId,
      title: String(req.body?.title || `${client.name || client.company_name || 'Client'} Report`).trim(),
      report_type: String(req.body?.reportType || req.body?.report_type || 'client_report').trim(),
      template_file: String(req.body?.templateFile || req.body?.template_file || '').trim() || undefined,
      format: String(req.body?.format || 'HTML').trim().toUpperCase(),
      html_content: html,
      metadata: typeof req.body?.metadata === 'object' && req.body?.metadata ? req.body.metadata : {},
      generated_at: req.body?.generatedAt || now,
      created_at: now,
      updated_at: now,
    };

    storage.reports.set(report.id, report);
    res.json({ success: true, report: mapStoredReport(report) });
  } catch (error) {
    next(error);
  }
});

router.get('/:reportId/preview', async (req, res, next) => {
  try {
    const report = getReportOrNull(req.params.reportId, req.userId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.type('html').send(report.html_content || '');
  } catch (error) {
    next(error);
  }
});

router.get('/:reportId/download', async (req, res, next) => {
  try {
    const report = getReportOrNull(req.params.reportId, req.userId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const safeTitle = String(report.title || 'report')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle || 'report'}.html"`);
    res.send(report.html_content || '');
  } catch (error) {
    next(error);
  }
});

router.delete('/:reportId', async (req, res, next) => {
  try {
    const report = getReportOrNull(req.params.reportId, req.userId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    storage.reports.delete(report.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
