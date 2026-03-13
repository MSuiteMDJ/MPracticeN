/**
 * Authentication middleware
 * TODO: Implement proper JWT authentication
 * For now, uses demo user
 */
export function authenticate(req, res, next) {
  // TODO: Extract JWT from Authorization header
  // TODO: Verify JWT signature
  // TODO: Extract user ID from token
  
  // For development, use demo user
  req.userId = 'demo-user';
  req.userEmail = 'demo@example.com';
  
  next();
}

/**
 * Optional authentication
 * Doesn't fail if no auth provided
 */
export function optionalAuth(req, res, next) {
  try {
    authenticate(req, res, next);
  } catch (error) {
    req.userId = null;
    next();
  }
}
