import express from 'express';
import {
  registerCompany,
  loginUser,
  inviteUser,
  acceptInvitation,
  getUserById,
  getTeamMembers,
  getPendingInvitations,
  deleteInvitation,
  updateUserRole,
  listAvailableRoles,
} from '../services/auth-service.js';
import { tenantMiddleware, requireAdmin } from '../middleware/tenant.js';
import { getAuthDb, queryAuth } from '../config/auth-database.js';

const router = express.Router();

// Register new company and admin user
router.post('/register', async (req, res) => {
  try {
    const company_name = String(req.body?.company_name || '').trim();
    const first_name = String(req.body?.first_name || '').trim();
    const last_name = String(req.body?.last_name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!company_name || !first_name || !last_name || !email || !password) {
      return res.status(400).json({
        error: 'company_name, first_name, last_name, email and password are required',
      });
    }

    const result = await registerCompany({
      company_name,
      first_name,
      last_name,
      email,
      password,
    });
    res.status(201).json(result);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await loginUser(email, password);
    res.json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Get current user info
router.get('/me', tenantMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/roles', tenantMiddleware, requireAdmin, async (req, res) => {
  try {
    res.json({ success: true, roles: listAvailableRoles() });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update current user profile
router.put('/profile', tenantMiddleware, async (req, res) => {
  try {
    const { first_name, last_name } = req.body || {};
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { useSQLite } = getAuthDb();
    const sql = useSQLite
      ? 'UPDATE users SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      : 'UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), updated_at = NOW() WHERE id = $3';
    await queryAuth(sql, [first_name || null, last_name || null, userId]);

    const updated = await getUserById(userId);
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Invite user to company (admin only)
router.post('/invite', tenantMiddleware, requireAdmin, async (req, res) => {
  try {
    const { email, role } = req.body;
    const result = await inviteUser(req.user.id, email, role);
    res.json(result);
  } catch (error) {
    console.error('Invite error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Accept invitation
router.post('/accept-invite', async (req, res) => {
  try {
    const { token, first_name, last_name, password } = req.body;
    const result = await acceptInvitation(token, first_name, last_name, password);
    res.json(result);
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get team members (admin only)
router.get('/team', tenantMiddleware, requireAdmin, async (req, res) => {
  try {
    const users = await getTeamMembers(req.user.company_id);
    res.json({ success: true, users });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get pending invitations (admin only)
router.get('/invitations', tenantMiddleware, requireAdmin, async (req, res) => {
  try {
    const invitations = await getPendingInvitations(req.user.company_id);
    res.json({ success: true, invitations });
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete invitation (admin only)
router.delete('/invitations/:id', tenantMiddleware, requireAdmin, async (req, res) => {
  try {
    await deleteInvitation(req.params.id, req.user.company_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete invitation error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.patch('/team/:id/role', tenantMiddleware, requireAdmin, async (req, res) => {
  try {
    const targetUserId = String(req.params.id || '').trim();
    const nextRole = String(req.body?.role || '').trim();
    if (!targetUserId || !nextRole) {
      return res.status(400).json({ error: 'User id and role are required' });
    }

    const { useSQLite } = getAuthDb();
    const scopeSql = useSQLite
      ? 'SELECT id FROM users WHERE id = ? AND company_id = ?'
      : 'SELECT id FROM users WHERE id = $1 AND company_id = $2';
    const scopeResult = await queryAuth(scopeSql, [targetUserId, req.user.company_id]);
    const scopedUser = useSQLite ? scopeResult[0] : scopeResult.rows[0];
    if (!scopedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await updateUserRole(targetUserId, req.user.company_id, nextRole);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
