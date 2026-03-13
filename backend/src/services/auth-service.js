import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { queryAuth, getAuthDb } from '../config/auth-database.js';
import { createTenantDatabase } from '../config/tenant-database.js';
import { assignUserRole, getRoleDefinitions, getUserAccessProfile, normalizeRoleKey } from './rbac-service.js';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_in_production';
const JWT_EXPIRES_IN = '24h';

function buildAuthTokenPayload(input) {
  return {
    user_id: input.user_id,
    company_id: input.company_id,
    email: input.email,
    role: normalizeRoleKey(input.role),
  };
}

async function buildAuthUserResponse(user) {
  const access = await getUserAccessProfile(user.id, user.company_id);
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    company_id: user.company_id,
    company_name: user.company_name,
    role: access.role,
    role_name: access.role_name,
    permissions: access.permissions,
  };
}

// Helper to create slug from company name
function createSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

// Register new company and admin user
export async function registerCompany(data) {
  const company_name = String(data?.company_name || '').trim();
  const first_name = String(data?.first_name || '').trim();
  const last_name = String(data?.last_name || '').trim();
  const email = String(data?.email || '').trim().toLowerCase();
  const password = String(data?.password || '');

  // Validate input
  if (!company_name || !email || !password || !first_name || !last_name) {
    throw new Error('All fields are required');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const { useSQLite } = getAuthDb();

  // Check if email already exists
  const existingUserSql = useSQLite
    ? 'SELECT id FROM users WHERE email = ?'
    : 'SELECT id FROM users WHERE email = $1';
  
  const existingUsers = await queryAuth(existingUserSql, [email]);
  const userExists = useSQLite ? existingUsers.length > 0 : existingUsers.rows.length > 0;

  if (userExists) {
    throw new Error('Email already registered');
  }

  // Generate IDs
  const companyId = randomUUID();
  const userId = randomUUID();
  const slug = createSlug(company_name);
  if (!slug) {
    throw new Error('Company name is invalid');
  }
  const databaseName = `tenant_${companyId}`;

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    // Create company
    const createCompanySql = useSQLite
      ? 'INSERT INTO companies (id, name, slug, database_name) VALUES (?, ?, ?, ?)'
      : 'INSERT INTO companies (id, name, slug, database_name) VALUES ($1, $2, $3, $4)';
    
    await queryAuth(createCompanySql, [companyId, company_name, slug, databaseName]);

    // Create tenant database
    createTenantDatabase(companyId);

    // Create admin user
    const createUserSql = useSQLite
      ? 'INSERT INTO users (id, company_id, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)'
      : 'INSERT INTO users (id, company_id, email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5, $6, $7)';
    
    await queryAuth(createUserSql, [
      userId,
      companyId,
      email,
      passwordHash,
      first_name,
      last_name,
      'admin'
    ]);
    await assignUserRole(userId, companyId, 'admin');

    // Generate JWT token
    const token = jwt.sign(buildAuthTokenPayload({
      user_id: userId,
      company_id: companyId,
      email,
      role: 'admin',
    }), JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const userResponse = await buildAuthUserResponse({
      id: userId,
      email,
      first_name,
      last_name,
      company_id: companyId,
      company_name,
    });

    return {
      success: true,
      company_id: companyId,
      user_id: userId,
      token,
      user: userResponse,
    };
  } catch (error) {
    console.error('Registration error:', error);
    throw new Error('Failed to register company: ' + error.message);
  }
}

// Login user
export async function loginUser(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');

  if (!normalizedEmail || !normalizedPassword) {
    throw new Error('Email and password are required');
  }

  const { useSQLite } = getAuthDb();

  // Get user with company info
  const getUserSql = useSQLite
    ? `SELECT u.*, c.name as company_name, c.is_active as company_active
       FROM users u
       JOIN companies c ON u.company_id = c.id
       WHERE u.email = ?`
    : `SELECT u.*, c.name as company_name, c.is_active as company_active
       FROM users u
       JOIN companies c ON u.company_id = c.id
       WHERE u.email = $1`;

  const result = await queryAuth(getUserSql, [normalizedEmail]);
  const user = useSQLite ? result[0] : result.rows[0];

  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (!user.is_active || !user.company_active) {
    throw new Error('Account is inactive');
  }

  // Verify password
  const passwordMatch = await bcrypt.compare(normalizedPassword, user.password_hash);
  if (!passwordMatch) {
    throw new Error('Invalid email or password');
  }

  // Update last login
  const updateLoginSql = useSQLite
    ? 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    : 'UPDATE users SET last_login = NOW() WHERE id = $1';
  
  await queryAuth(updateLoginSql, [user.id]);

  // Generate JWT token
  const access = await getUserAccessProfile(user.id, user.company_id);
  const token = jwt.sign(
    buildAuthTokenPayload({
      user_id: user.id,
      company_id: user.company_id,
      email: user.email,
      role: access.role,
    }),
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    success: true,
    token,
    user: await buildAuthUserResponse(user),
  };
}

// Invite user to company
export async function inviteUser(inviterUserId, email, role = 'user') {
  const { useSQLite } = getAuthDb();

  // Get inviter's company
  const getInviterSql = useSQLite
    ? 'SELECT company_id, role FROM users WHERE id = ?'
    : 'SELECT company_id, role FROM users WHERE id = $1';
  
  const inviterResult = await queryAuth(getInviterSql, [inviterUserId]);
  const inviter = useSQLite ? inviterResult[0] : inviterResult.rows[0];

  if (!inviter) {
    throw new Error('Inviter not found');
  }

  if (normalizeRoleKey(inviter.role) !== 'admin') {
    throw new Error('Only admins can invite users');
  }

  const normalizedRole = normalizeRoleKey(role);

  // Check if email already exists
  const checkEmailSql = useSQLite
    ? 'SELECT id FROM users WHERE email = ?'
    : 'SELECT id FROM users WHERE email = $1';
  
  const existingResult = await queryAuth(checkEmailSql, [email]);
  const exists = useSQLite ? existingResult.length > 0 : existingResult.rows.length > 0;

  if (exists) {
    throw new Error('User with this email already exists');
  }

  // Create invitation
  const invitationId = randomUUID();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const createInviteSql = useSQLite
    ? 'INSERT INTO invitations (id, company_id, email, role, token, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
    : 'INSERT INTO invitations (id, company_id, email, role, token, expires_at, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)';
  
  await queryAuth(createInviteSql, [
    invitationId,
    inviter.company_id,
    email,
    normalizedRole,
    token,
    expiresAt.toISOString(),
    inviterUserId
  ]);

  return {
    success: true,
    invitation_id: invitationId,
    invitation_link: `${process.env.FRONTEND_URL || 'http://localhost:3002'}/accept-invite?token=${token}`
  };
}

// Accept invitation
export async function acceptInvitation(token, first_name, last_name, password) {
  if (!token || !first_name || !last_name || !password) {
    throw new Error('All fields are required');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const { useSQLite } = getAuthDb();

  // Get invitation
  const getInviteSql = useSQLite
    ? `SELECT i.*, c.name as company_name
       FROM invitations i
       JOIN companies c ON i.company_id = c.id
       WHERE i.token = ? AND i.accepted_at IS NULL`
    : `SELECT i.*, c.name as company_name
       FROM invitations i
       JOIN companies c ON i.company_id = c.id
       WHERE i.token = $1 AND i.accepted_at IS NULL`;
  
  const inviteResult = await queryAuth(getInviteSql, [token]);
  const invitation = useSQLite ? inviteResult[0] : inviteResult.rows[0];

  if (!invitation) {
    throw new Error('Invalid or expired invitation');
  }

  // Check expiration
  if (new Date(invitation.expires_at) < new Date()) {
    throw new Error('Invitation has expired');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const userId = randomUUID();

  try {
    // Create user
    const createUserSql = useSQLite
      ? 'INSERT INTO users (id, company_id, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)'
      : 'INSERT INTO users (id, company_id, email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5, $6, $7)';
    
    await queryAuth(createUserSql, [
      userId,
      invitation.company_id,
      invitation.email,
      passwordHash,
      first_name,
      last_name,
      normalizeRoleKey(invitation.role)
    ]);
    await assignUserRole(userId, invitation.company_id, invitation.role);

    // Mark invitation as accepted
    const updateInviteSql = useSQLite
      ? 'UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = ?'
      : 'UPDATE invitations SET accepted_at = NOW() WHERE id = $1';
    
    await queryAuth(updateInviteSql, [invitation.id]);

    // Generate JWT token
    const jwtToken = jwt.sign(
      buildAuthTokenPayload({
        user_id: userId,
        company_id: invitation.company_id,
        email: invitation.email,
        role: invitation.role,
      }),
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const userResponse = await buildAuthUserResponse({
      id: userId,
      email: invitation.email,
      first_name,
      last_name,
      company_id: invitation.company_id,
      company_name: invitation.company_name,
    });

    return {
      success: true,
      token: jwtToken,
      user: userResponse,
    };
  } catch (error) {
    console.error('Accept invitation error:', error);
    throw new Error('Failed to accept invitation: ' + error.message);
  }
}

// Verify JWT token
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

// Get user by ID
export async function getUserById(userId) {
  const { useSQLite } = getAuthDb();

  const getUserSql = useSQLite
    ? `SELECT u.*, c.name as company_name
       FROM users u
       JOIN companies c ON u.company_id = c.id
       WHERE u.id = ?`
    : `SELECT u.*, c.name as company_name
       FROM users u
       JOIN companies c ON u.company_id = c.id
       WHERE u.id = $1`;
  
  const result = await queryAuth(getUserSql, [userId]);
  const user = useSQLite ? result[0] : result.rows[0];

  if (!user) {
    throw new Error('User not found');
  }

  return buildAuthUserResponse(user);
}

// Get all team members for a company
export async function getTeamMembers(companyId) {
  const { useSQLite } = getAuthDb();

  const getUsersSql = useSQLite
    ? `SELECT id, email, first_name, last_name, role, created_at, last_login
       FROM users
       WHERE company_id = ?
       ORDER BY created_at ASC`
    : `SELECT id, email, first_name, last_name, role, created_at, last_login
       FROM users
       WHERE company_id = $1
       ORDER BY created_at ASC`;
  
  const result = await queryAuth(getUsersSql, [companyId]);
  const users = useSQLite ? result : result.rows;
  return Promise.all(users.map(async (user) => ({
    ...user,
    ...(await getUserAccessProfile(user.id, companyId)),
  })));
}

// Get pending invitations for a company
export async function getPendingInvitations(companyId) {
  const { useSQLite } = getAuthDb();

  const getInvitesSql = useSQLite
    ? `SELECT id, email, role, token, created_at, expires_at
       FROM invitations
       WHERE company_id = ? AND accepted_at IS NULL
       ORDER BY created_at DESC`
    : `SELECT id, email, role, token, created_at, expires_at
       FROM invitations
       WHERE company_id = $1 AND accepted_at IS NULL
       ORDER BY created_at DESC`;
  
  const result = await queryAuth(getInvitesSql, [companyId]);
  const invitations = useSQLite ? result : result.rows;

  // Add invitation link to each
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
  return invitations.map(inv => ({
    ...inv,
    role: normalizeRoleKey(inv.role),
    invitation_link: `${frontendUrl}/accept-invite?token=${inv.token}`
  }));
}

// Delete invitation
export async function deleteInvitation(invitationId, companyId) {
  const { useSQLite } = getAuthDb();

  // Verify invitation belongs to company
  const checkSql = useSQLite
    ? 'SELECT id FROM invitations WHERE id = ? AND company_id = ?'
    : 'SELECT id FROM invitations WHERE id = $1 AND company_id = $2';
  
  const checkResult = await queryAuth(checkSql, [invitationId, companyId]);
  const exists = useSQLite ? checkResult.length > 0 : checkResult.rows.length > 0;

  if (!exists) {
    throw new Error('Invitation not found');
  }

  const deleteSql = useSQLite
    ? 'DELETE FROM invitations WHERE id = ?'
    : 'DELETE FROM invitations WHERE id = $1';
  
  await queryAuth(deleteSql, [invitationId]);
  return { success: true };
}

export async function updateUserRole(targetUserId, companyId, role) {
  const normalizedRole = normalizeRoleKey(role);
  await assignUserRole(targetUserId, companyId, normalizedRole);
  return getUserById(targetUserId);
}

export function listAvailableRoles() {
  return getRoleDefinitions();
}
