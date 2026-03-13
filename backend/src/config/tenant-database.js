import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ensureDirectory, getDataRoot } from './storage-paths.js';

// Cache of tenant database connections
const tenantDbCache = new Map();

// Get tenant database directory
function getTenantDbDir() {
  return ensureDirectory(path.join(getDataRoot(), 'tenants'));
}

// Create new tenant database with schema
export function createTenantDatabase(companyId) {
  const dbDir = getTenantDbDir();
  const dbPath = path.join(dbDir, `tenant_${companyId}.db`);

  console.log(`📦 Creating tenant database: ${dbPath}`);

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Create tenant schema (from existing database.js)
  const schema = `
    -- Users table (tenant-specific user settings)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- HMRC Credentials (per tenant)
    CREATE TABLE IF NOT EXISTS user_hmrc_credentials (
      user_id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      client_secret TEXT NOT NULL,
      environment TEXT DEFAULT 'sandbox',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- HMRC Tokens
    CREATE TABLE IF NOT EXISTS hmrc_tokens (
      user_id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      token_type TEXT DEFAULT 'bearer',
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Declarations
    CREATE TABLE IF NOT EXISTS declarations (
      id TEXT PRIMARY KEY,
      mrn TEXT NOT NULL,
      declarant_eori TEXT,
      importer_eori TEXT,
      declaration_type TEXT,
      acceptance_date TEXT,
      total_packages INTEGER,
      total_gross_mass REAL,
      total_duty REAL,
      total_vat REAL,
      currency TEXT DEFAULT 'GBP',
      status TEXT DEFAULT 'pending',
      client_id TEXT,
      client_name TEXT,
      batch_id TEXT,
      source TEXT DEFAULT 'csv',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Declaration Items
    CREATE TABLE IF NOT EXISTS declaration_items (
      id TEXT PRIMARY KEY,
      declaration_id TEXT NOT NULL,
      item_number INTEGER,
      commodity_code TEXT,
      description TEXT,
      quantity REAL,
      net_mass REAL,
      gross_mass REAL,
      statistical_value REAL,
      origin_country TEXT,
      procedure_code TEXT,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id) ON DELETE CASCADE
    );

    -- Item Taxes
    CREATE TABLE IF NOT EXISTS item_taxes (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      tax_type TEXT,
      tax_rate REAL,
      tax_amount REAL,
      FOREIGN KEY (item_id) REFERENCES declaration_items(id) ON DELETE CASCADE
    );

    -- Import Batches
    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      filename TEXT,
      record_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'processing',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );

    -- Import Errors
    CREATE TABLE IF NOT EXISTS import_errors (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      row_number INTEGER,
      error_type TEXT,
      error_message TEXT,
      raw_data TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES import_batches(id) ON DELETE CASCADE
    );

    -- Clients
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      eori TEXT,
      vat_number TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Claims
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      declaration_id TEXT,
      claim_type TEXT,
      claim_amount REAL,
      status TEXT DEFAULT 'draft',
      submitted_date TEXT,
      approved_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (declaration_id) REFERENCES declarations(id)
    );

    -- Company Settings
    CREATE TABLE IF NOT EXISTS company_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_declarations_mrn ON declarations(mrn);
    CREATE INDEX IF NOT EXISTS idx_declarations_client ON declarations(client_id);
    CREATE INDEX IF NOT EXISTS idx_declarations_batch ON declarations(batch_id);
    CREATE INDEX IF NOT EXISTS idx_items_declaration ON declaration_items(declaration_id);
    CREATE INDEX IF NOT EXISTS idx_taxes_item ON item_taxes(item_id);
    CREATE INDEX IF NOT EXISTS idx_errors_batch ON import_errors(batch_id);
    CREATE INDEX IF NOT EXISTS idx_claims_client ON claims(client_id);
    CREATE INDEX IF NOT EXISTS idx_claims_declaration ON claims(declaration_id);
  `;

  db.exec(schema);
  console.log(`✅ Tenant database created: tenant_${companyId}.db`);

  return db;
}

// Get tenant database connection (cached)
export function getTenantDatabase(companyId) {
  if (!companyId) {
    throw new Error('Company ID is required to access tenant database');
  }

  // Check cache first
  if (tenantDbCache.has(companyId)) {
    return tenantDbCache.get(companyId);
  }

  const dbDir = getTenantDbDir();
  const dbPath = path.join(dbDir, `tenant_${companyId}.db`);

  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Tenant database not found for company: ${companyId}`);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Cache connection
  tenantDbCache.set(companyId, db);

  return db;
}

// Close all tenant database connections
export function closeAllTenantDatabases() {
  for (const [companyId, db] of tenantDbCache.entries()) {
    try {
      db.close();
      console.log(`Closed tenant database: ${companyId}`);
    } catch (err) {
      console.error(`Error closing tenant database ${companyId}:`, err);
    }
  }
  tenantDbCache.clear();
}

// List all tenant databases
export function listTenantDatabases() {
  const dbDir = getTenantDbDir();
  const files = fs.readdirSync(dbDir);
  return files
    .filter(f => f.startsWith('tenant_') && f.endsWith('.db'))
    .map(f => f.replace('tenant_', '').replace('.db', ''));
}
