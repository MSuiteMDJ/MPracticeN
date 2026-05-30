import { Router } from 'express';
import {
  listAccountsSets,
  getAccountsSet,
  createAccountsSet,
  updateSection,
  validateAccountsSet,
  generateOutputs,
  deleteAccountsSet,
} from '../services/accounts-production-service.js';

const router = Router();

// List all accounts sets for the current user
router.get('/', (req, res, next) => {
  try {
    const sets = listAccountsSets(req.userId);
    res.json({ accountsSets: sets });
  } catch (err) { next(err); }
});

// Create a new accounts set
router.post('/', (req, res, next) => {
  try {
    const set = createAccountsSet(req.userId, req.body || {});
    res.status(201).json({ accountsSet: set });
  } catch (err) { next(err); }
});

// Get a single accounts set
router.get('/:id', (req, res, next) => {
  try {
    const set = getAccountsSet(req.params.id, req.userId);
    if (!set) return res.status(404).json({ message: 'Accounts set not found' });
    res.json({ accountsSet: set });
  } catch (err) { next(err); }
});

// Delete an accounts set
router.delete('/:id', (req, res, next) => {
  try {
    const ok = deleteAccountsSet(req.params.id, req.userId);
    if (!ok) return res.status(404).json({ message: 'Accounts set not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Update a section (auto-save)
router.patch('/:id/sections/:sectionKey', (req, res, next) => {
  try {
    const { id, sectionKey } = req.params;
    const data = req.body?.data ?? req.body;
    const updated = updateSection(id, req.userId, sectionKey, data);
    if (!updated) return res.status(404).json({ message: 'Accounts set not found' });
    res.json(updated);
  } catch (err) { next(err); }
});

// Validate accounts set
router.post('/:id/validate', (req, res, next) => {
  try {
    const result = validateAccountsSet(req.params.id, req.userId);
    if (!result) return res.status(404).json({ message: 'Accounts set not found' });
    res.json(result);
  } catch (err) { next(err); }
});

// Generate HTML + PDF outputs
router.post('/:id/outputs', (req, res, next) => {
  try {
    const result = generateOutputs(req.params.id, req.userId);
    if (!result) return res.status(404).json({ message: 'Accounts set not found' });
    res.json(result);
  } catch (err) { next(err); }
});

// Serve generated HTML output
router.get('/:id/outputs/html/:filename', (req, res, next) => {
  try {
    const set = getAccountsSet(req.params.id, req.userId);
    if (!set || !set.outputs?.html) return res.status(404).json({ message: 'Output not found' });
    res.type('html').send(set.outputs.html);
  } catch (err) { next(err); }
});

// Serve generated PDF (returns HTML as PDF placeholder — real PDF generation can be added later)
router.get('/:id/outputs/pdf/:filename', (req, res, next) => {
  try {
    const set = getAccountsSet(req.params.id, req.userId);
    if (!set || !set.outputs?.html) return res.status(404).json({ message: 'Output not found' });
    // Return HTML with PDF content-disposition as a placeholder
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="statutory-accounts.html"`);
    res.send(set.outputs.html);
  } catch (err) { next(err); }
});

export default router;
