import { verifyToken } from '../services/auth-service.js';
import { getPermissionForModule, getUserAccessProfile, normalizeRoleKey } from '../services/rbac-service.js';
import { getTenantDatabase } from '../config/tenant-database.js';

// Middleware to extract JWT and attach tenant database to request
export async function tenantMiddleware(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify and decode token
    const decoded = verifyToken(token);

    // Attach user info to request
    const access = await getUserAccessProfile(decoded.user_id, decoded.company_id);

    req.user = {
      id: decoded.user_id,
      email: decoded.email,
      company_id: decoded.company_id,
      role: access.role,
      role_name: access.role_name,
      permissions: access.permissions,
    };
    // Backward-compatible aliases used by legacy route handlers.
    req.userId = decoded.user_id;
    req.companyId = decoded.company_id;

    // Attach tenant database connection
    try {
      req.tenantDb = getTenantDatabase(decoded.company_id);
    } catch (error) {
      console.error('Failed to get tenant database:', error);
      return res.status(500).json({ error: 'Failed to access company database' });
    }

    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware to check if user is admin
export function requireAdmin(req, res, next) {
  if (normalizeRoleKey(req.user?.role) !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function requirePermission(permissionCode) {
  return (req, res, next) => {
    if (normalizeRoleKey(req.user?.role) === 'admin') {
      return next();
    }
    if (!Array.isArray(req.user?.permissions) || !req.user.permissions.includes(permissionCode)) {
      return res.status(403).json({ error: `Missing permission: ${permissionCode}` });
    }
    next();
  };
}

export function requireModuleAccess(moduleName) {
  return (req, res, next) => {
    const method = String(req.method || 'GET').toUpperCase();
    const action = method === 'GET' || method === 'HEAD' || method === 'OPTIONS' ? 'read' : 'write';
    return requirePermission(getPermissionForModule(moduleName, action))(req, res, next);
  };
}
