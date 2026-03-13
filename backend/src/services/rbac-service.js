import { randomUUID } from 'crypto';
import { getAuthDb, queryAuth } from '../config/auth-database.js';

const PERMISSION_DEFINITIONS = [
  ['clients.read', 'clients', 'read', 'View clients'],
  ['clients.write', 'clients', 'write', 'Manage clients'],
  ['services.read', 'services', 'read', 'View services'],
  ['services.write', 'services', 'write', 'Manage services'],
  ['compliance.read', 'compliance', 'read', 'View compliance'],
  ['compliance.write', 'compliance', 'write', 'Manage compliance'],
  ['companies_house.read', 'companies_house', 'read', 'View Companies House data'],
  ['companies_house.write', 'companies_house', 'write', 'Refresh Companies House data'],
  ['contacts.read', 'contacts', 'read', 'View contacts'],
  ['contacts.write', 'contacts', 'write', 'Manage contacts'],
  ['documents.read', 'documents', 'read', 'View documents'],
  ['documents.write', 'documents', 'write', 'Manage documents'],
  ['reports.read', 'reports', 'read', 'View reports'],
  ['reports.write', 'reports', 'write', 'Manage reports'],
  ['templates.read', 'templates', 'read', 'View document templates'],
  ['templates.write', 'templates', 'write', 'Manage document templates'],
  ['settings.read', 'settings', 'read', 'View practice settings'],
  ['settings.write', 'settings', 'write', 'Manage practice settings'],
  ['team.read', 'team', 'read', 'View team members'],
  ['team.write', 'team', 'write', 'Manage team members'],
  ['audit.read', 'audit', 'read', 'View audit logs'],
  ['audit.write', 'audit', 'write', 'Manage audit configuration'],
  ['hmrc.read', 'hmrc', 'read', 'View HMRC integrations'],
  ['hmrc.write', 'hmrc', 'write', 'Manage HMRC integrations'],
  ['declarations.read', 'declarations', 'read', 'View declarations'],
  ['declarations.write', 'declarations', 'write', 'Manage declarations'],
  ['claims.read', 'claims', 'read', 'View claims'],
  ['claims.write', 'claims', 'write', 'Manage claims'],
  ['analysis.read', 'analysis', 'read', 'View analysis'],
  ['analysis.write', 'analysis', 'write', 'Manage analysis'],
  ['onboarding.read', 'onboarding', 'read', 'View onboarding'],
  ['onboarding.write', 'onboarding', 'write', 'Manage onboarding'],
];

const ROLE_DEFINITIONS = [
  {
    code: 'admin',
    name: 'Admin',
    description: 'Full practice access including settings and team management.',
    permissions: PERMISSION_DEFINITIONS.map(([code]) => code),
  },
  {
    code: 'manager',
    name: 'Manager',
    description: 'Operational manager with full client workflow access except core settings and team administration.',
    permissions: [
      'clients.read', 'clients.write',
      'services.read', 'services.write',
      'compliance.read', 'compliance.write',
      'companies_house.read', 'companies_house.write',
      'contacts.read', 'contacts.write',
      'documents.read', 'documents.write',
      'reports.read', 'reports.write',
      'templates.read', 'templates.write',
      'settings.read',
      'team.read',
      'audit.read',
      'hmrc.read',
      'declarations.read',
      'claims.read', 'claims.write',
      'analysis.read',
      'onboarding.read', 'onboarding.write',
    ],
  },
  {
    code: 'staff',
    name: 'Staff',
    description: 'Day-to-day practice user with client workflow access.',
    permissions: [
      'clients.read', 'clients.write',
      'services.read', 'services.write',
      'compliance.read', 'compliance.write',
      'companies_house.read',
      'contacts.read', 'contacts.write',
      'documents.read', 'documents.write',
      'reports.read', 'reports.write',
      'templates.read',
      'settings.read',
      'audit.read',
      'onboarding.read', 'onboarding.write',
    ],
  },
  {
    code: 'read_only',
    name: 'Read-only',
    description: 'Read-only access across operational modules.',
    permissions: [
      'clients.read',
      'services.read',
      'compliance.read',
      'companies_house.read',
      'contacts.read',
      'documents.read',
      'reports.read',
      'templates.read',
      'settings.read',
      'audit.read',
      'onboarding.read',
    ],
  },
];

const ROLE_NAME_LOOKUP = ROLE_DEFINITIONS.reduce((acc, role) => {
  acc[role.code] = role.name;
  return acc;
}, {});

function dbBoolean(value, useSQLite) {
  return useSQLite ? (value ? 1 : 0) : value;
}

export function normalizeRoleKey(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'staff';
  if (normalized === 'user') return 'staff';
  if (normalized === 'readonly' || normalized === 'read-only' || normalized === 'read only') return 'read_only';
  if (ROLE_DEFINITIONS.some((role) => role.code === normalized)) return normalized;
  return 'staff';
}

export function getRoleDefinitions() {
  return ROLE_DEFINITIONS.map((role) => ({
    code: role.code,
    name: role.name,
    description: role.description,
    permissions: [...role.permissions],
    modules: Array.from(new Set(
      role.permissions.map((permission) => String(permission).split('.')[0]).filter(Boolean)
    )).sort(),
  }));
}

function getRoleDefinition(roleCode) {
  return ROLE_DEFINITIONS.find((role) => role.code === normalizeRoleKey(roleCode)) || ROLE_DEFINITIONS[2];
}

function mapPermissionRows(rows, useSQLite) {
  return (useSQLite ? rows : rows.rows).map((row) => row.code);
}

export async function ensureRbacSeedData() {
  const { useSQLite } = getAuthDb();

  for (const [code, moduleName, action, label] of PERMISSION_DEFINITIONS) {
    const selectSql = useSQLite
      ? 'SELECT id FROM permissions WHERE code = ?'
      : 'SELECT id FROM permissions WHERE code = $1';
    const existing = await queryAuth(selectSql, [code]);
    const found = useSQLite ? existing[0] : existing.rows[0];
    if (!found) {
      const insertSql = useSQLite
        ? 'INSERT OR IGNORE INTO permissions (id, code, module, action, label) VALUES (?, ?, ?, ?, ?)'
        : 'INSERT INTO permissions (id, code, module, action, label) VALUES ($1, $2, $3, $4, $5)';
      await queryAuth(insertSql, [randomUUID(), code, moduleName, action, label]);
    }
  }

  for (const role of ROLE_DEFINITIONS) {
    const selectRoleSql = useSQLite
      ? 'SELECT id FROM roles WHERE code = ?'
      : 'SELECT id FROM roles WHERE code = $1';
    const existingRole = await queryAuth(selectRoleSql, [role.code]);
    let roleId = useSQLite ? existingRole[0]?.id : existingRole.rows[0]?.id;

    if (!roleId) {
      const attemptedRoleId = randomUUID();
      const insertRoleSql = useSQLite
        ? 'INSERT OR IGNORE INTO roles (id, code, name, description, is_system) VALUES (?, ?, ?, ?, ?)'
        : 'INSERT INTO roles (id, code, name, description, is_system) VALUES ($1, $2, $3, $4, $5)';
      await queryAuth(insertRoleSql, [
        attemptedRoleId,
        role.code,
        role.name,
        role.description,
        dbBoolean(true, useSQLite),
      ]);
      const refreshedRole = await queryAuth(selectRoleSql, [role.code]);
      roleId = useSQLite ? refreshedRole[0]?.id : refreshedRole.rows[0]?.id;
    }

    for (const permissionCode of role.permissions) {
      const selectPermissionSql = useSQLite
        ? 'SELECT id FROM permissions WHERE code = ?'
        : 'SELECT id FROM permissions WHERE code = $1';
      const permissionResult = await queryAuth(selectPermissionSql, [permissionCode]);
      const permissionId = useSQLite ? permissionResult[0]?.id : permissionResult.rows[0]?.id;
      if (!permissionId) continue;

      const selectLinkSql = useSQLite
        ? 'SELECT role_id FROM role_permissions WHERE role_id = ? AND permission_id = ?'
        : 'SELECT role_id FROM role_permissions WHERE role_id = $1 AND permission_id = $2';
      const existingLink = await queryAuth(selectLinkSql, [roleId, permissionId]);
      const hasLink = useSQLite ? Boolean(existingLink[0]) : existingLink.rows.length > 0;
      if (!hasLink) {
        const insertLinkSql = useSQLite
          ? 'INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)'
          : 'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)';
        await queryAuth(insertLinkSql, [roleId, permissionId]);
      }
    }
  }

  const usersSql = useSQLite
    ? 'SELECT id, company_id, role FROM users'
    : 'SELECT id, company_id, role FROM users';
  const users = await queryAuth(usersSql);
  const userRows = useSQLite ? users : users.rows;

  for (const user of userRows) {
    await assignUserRole(user.id, user.company_id, user.role);
  }
}

export async function assignUserRole(userId, companyId, roleCode) {
  const { useSQLite } = getAuthDb();
  const normalizedRole = normalizeRoleKey(roleCode);

  const roleSql = useSQLite
    ? 'SELECT id FROM roles WHERE code = ?'
    : 'SELECT id FROM roles WHERE code = $1';
  const roleResult = await queryAuth(roleSql, [normalizedRole]);
  const roleId = useSQLite ? roleResult[0]?.id : roleResult.rows[0]?.id;
  if (!roleId) {
    throw new Error(`Role not found: ${normalizedRole}`);
  }

  const updateUserSql = useSQLite
    ? 'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    : 'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2';
  await queryAuth(updateUserSql, [normalizedRole, userId]);

  const existingAssignmentSql = useSQLite
    ? 'SELECT id FROM user_roles WHERE user_id = ? AND company_id = ? AND is_primary = 1'
    : 'SELECT id FROM user_roles WHERE user_id = $1 AND company_id = $2 AND is_primary = true';
  const existingAssignment = await queryAuth(existingAssignmentSql, [userId, companyId]);
  const assignmentId = useSQLite ? existingAssignment[0]?.id : existingAssignment.rows[0]?.id;

  if (assignmentId) {
    const updateAssignmentSql = useSQLite
      ? 'UPDATE user_roles SET role_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      : 'UPDATE user_roles SET role_id = $1, updated_at = NOW() WHERE id = $2';
    await queryAuth(updateAssignmentSql, [roleId, assignmentId]);
    return;
  }

  const insertAssignmentSql = useSQLite
    ? 'INSERT OR IGNORE INTO user_roles (id, user_id, company_id, role_id, is_primary) VALUES (?, ?, ?, ?, ?)'
    : 'INSERT INTO user_roles (id, user_id, company_id, role_id, is_primary) VALUES ($1, $2, $3, $4, $5)';
  await queryAuth(insertAssignmentSql, [
    randomUUID(),
    userId,
    companyId,
    roleId,
    dbBoolean(true, useSQLite),
  ]);
}

export async function getUserAccessProfile(userId, companyId) {
  const { useSQLite } = getAuthDb();

  const roleSql = useSQLite
    ? `SELECT r.code, r.name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ? AND ur.company_id = ? AND ur.is_primary = 1
       ORDER BY ur.created_at DESC
       LIMIT 1`
    : `SELECT r.code, r.name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND ur.company_id = $2 AND ur.is_primary = true
       ORDER BY ur.created_at DESC
       LIMIT 1`;
  const roleResult = await queryAuth(roleSql, [userId, companyId]);
  const roleRow = useSQLite ? roleResult[0] : roleResult.rows[0];

  if (roleRow) {
    const permissionSql = useSQLite
      ? `SELECT p.code
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE ur.user_id = ? AND ur.company_id = ? AND ur.is_primary = 1`
      : `SELECT p.code
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE ur.user_id = $1 AND ur.company_id = $2 AND ur.is_primary = true`;
    const permissionsResult = await queryAuth(permissionSql, [userId, companyId]);
    return {
      role: roleRow.code,
      role_name: roleRow.name,
      permissions: mapPermissionRows(permissionsResult, useSQLite),
    };
  }

  const fallbackRoleSql = useSQLite
    ? 'SELECT role FROM users WHERE id = ?'
    : 'SELECT role FROM users WHERE id = $1';
  const fallbackRoleResult = await queryAuth(fallbackRoleSql, [userId]);
  const fallbackRoleRow = useSQLite ? fallbackRoleResult[0] : fallbackRoleResult.rows[0];
  const fallbackRole = normalizeRoleKey(fallbackRoleRow?.role);
  const fallbackDefinition = getRoleDefinition(fallbackRole);
  return {
    role: fallbackRole,
    role_name: ROLE_NAME_LOOKUP[fallbackRole],
    permissions: fallbackDefinition.permissions,
  };
}

export function hasPermission(permissionList, permissionCode) {
  return Array.isArray(permissionList) && permissionList.includes(permissionCode);
}

export function getPermissionForModule(moduleName, action) {
  return `${moduleName}.${action}`;
}
