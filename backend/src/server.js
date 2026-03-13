import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cdsRoutes from './routes/cds.routes.js';
import hmrcRoutes from './routes/hmrc.routes.js';
import clientsRoutes from './routes/clients.routes.js';
import claimsRoutes from './routes/claims.routes.js';
import analysisRoutes from './routes/analysis.routes.js';
import authRoutes from './routes/auth.routes.js';
import companiesHouseRoutes from './routes/companies-house.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import documentsRoutes from './routes/documents.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import auditRoutes from './routes/audit.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requireModuleAccess, tenantMiddleware } from './middleware/tenant.js';
import { initAuthDatabase } from './config/auth-database.js';
import { getDefaultDatabasePath, getUploadsRoot } from './config/storage-paths.js';
import { buildOpenApiSpec } from './docs/openapi.js';
import { ensureRbacSeedData } from './services/rbac-service.js';
import './config/database.js'; // Initialize database

dotenv.config();

// Initialize auth database
await initAuthDatabase();
await ensureRbacSeedData();

const app = express();
const PORT = process.env.PORT || 3003;
const uploadsPath = getUploadsRoot();
const databasePath = getDefaultDatabasePath();
const serverUrl = `http://localhost:${PORT}`;
const openApiSpec = buildOpenApiSpec(serverUrl);
const authDbMode = process.env.AUTH_DB_HOST && process.env.NODE_ENV === 'production'
  ? 'postgres'
  : 'sqlite';

function renderSwaggerHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>M Practice API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #0b0f19; }
      #swagger-ui { max-width: 1200px; margin: 0 auto; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/api-docs.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: false,
      });
    </script>
  </body>
</html>`;
}

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3002',
    process.env.CORS_ORIGIN
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    auth_db_mode: authDbMode,
  });
});

// OpenAPI + Swagger docs
app.get('/api-docs.json', (req, res) => {
  res.json(openApiSpec);
});

app.get('/api-docs', (req, res) => {
  res.type('html').send(renderSwaggerHtml());
});

// Auth Routes (no authentication required)
app.use('/auth', authRoutes);
app.use('/companies-house', tenantMiddleware, requireModuleAccess('companies_house'), companiesHouseRoutes);

// API Routes (require authentication + tenant isolation)
app.use('/cds', tenantMiddleware, requireModuleAccess('declarations'), cdsRoutes);
app.use('/hmrc', tenantMiddleware, requireModuleAccess('hmrc'), hmrcRoutes);
app.use('/clients', tenantMiddleware, requireModuleAccess('clients'), clientsRoutes);
app.use('/claims', tenantMiddleware, requireModuleAccess('claims'), claimsRoutes);
app.use('/analysis', tenantMiddleware, requireModuleAccess('analysis'), analysisRoutes);
app.use('/settings', tenantMiddleware, requireModuleAccess('settings'), settingsRoutes);
app.use('/documents', tenantMiddleware, requireModuleAccess('documents'), documentsRoutes);
app.use('/reports', tenantMiddleware, requireModuleAccess('reports'), reportsRoutes);
app.use('/audit', tenantMiddleware, requireModuleAccess('audit'), auditRoutes);

// Onboarding routes (from existing frontend)
app.get('/onboarding/clients', tenantMiddleware, requireModuleAccess('onboarding'), (req, res) => {
  res.json({ clients: [] }); // TODO: Implement
});

app.get('/clients/:clientId/onboarding', tenantMiddleware, requireModuleAccess('onboarding'), (req, res) => {
  res.json({ 
    status: 'pending',
    progress: 0,
    missingFields: []
  }); // TODO: Implement
});

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║          M Practice Manager - CDS Backend Service           ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌍 CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:3002'}`);
  console.log(`📁 Upload directory: ${uploadsPath}`);
  console.log(`💾 Database: ${databasePath}`);
  console.log(`🔐 Auth DB mode: ${authDbMode}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('');
  console.log('  Authentication:');
  console.log('    POST /auth/register');
  console.log('    POST /auth/login');
  console.log('    GET  /auth/me');
  console.log('    POST /auth/invite');
  console.log('    POST /auth/accept-invite');
  console.log('');
  console.log('  CDS & Declarations:');
  console.log('    POST /cds/import');
  console.log('    GET  /cds/declarations');
  console.log('    GET  /cds/declarations/:id');
  console.log('    POST /cds/hmrc/fetch/:mrn');
  console.log('');
  console.log('  HMRC Integration:');
  console.log('    POST /hmrc/credentials');
  console.log('    GET  /hmrc/credentials');
  console.log('    POST /hmrc/test');
  console.log('');
  console.log('  Client Management:');
  console.log('    POST /clients');
  console.log('    GET  /clients');
  console.log('    GET  /clients/:id');
  console.log('    POST /clients/:id/sync-cds');
  console.log('    GET  /clients/alerts');
  console.log('');
  console.log('  Companies House:');
  console.log('    POST /companies-house/credentials');
  console.log('    GET  /companies-house/credentials');
  console.log('    DELETE /companies-house/credentials');
  console.log('    GET  /companies-house/search?q=<query>&items_per_page=20');
  console.log('    GET  /companies-house/company/:companyNumber');
  console.log('    GET  /companies-house/company/:companyNumber/profile');
  console.log('    GET  /companies-house/company/:companyNumber/officers');
  console.log('    GET  /companies-house/company/:companyNumber/psc');
  console.log('    GET  /companies-house/company/:companyNumber/filing-history');
  console.log('    GET  /companies-house/company/:companyNumber/charges');
  console.log('');
  console.log('  Claims Management:');
  console.log('    POST /claims');
  console.log('    GET  /claims');
  console.log('    GET  /claims/dashboard');
  console.log('    GET  /claims/:id/compliance');
  console.log('    POST /claims/:id/submit');
  console.log('');
  console.log('  Refund Analysis:');
  console.log('    POST /analysis/run');
  console.log('    GET  /analysis/opportunities');
  console.log('    GET  /analysis/summary');
  console.log('');
  console.log('  API Documentation:');
  console.log('    GET  /api-docs');
  console.log('    GET  /api-docs.json');
  console.log('');
  console.log('Ready to accept requests! 🎉');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});
