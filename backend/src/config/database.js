import fs from 'fs';
import path from 'path';
import { ensureDirectory, getDataRoot } from './storage-paths.js';

/**
 * File-backed runtime storage for development.
 * Keeps the existing Map-based API but persists to disk.
 */

const STORAGE_KEYS = [
  'users',
  'credentials',
  'tokens',
  'declarations',
  'items',
  'taxes',
  'batches',
  'errors',
  'clients',
  'contacts',
  'claims',
  'opportunities',
  'documents',
  'documentVersions',
  'reports',
  'auditEvents',
  'settings',
  'onboarding',
  'services',
  'companiesHouseCredentials',
  'clientRelationships',
];

const dataRoot = ensureDirectory(getDataRoot());
const storageFilePath = path.join(dataRoot, 'runtime-storage.json');

let storageRef = null;
let persistTimer = null;

function readPersistedStorage() {
  try {
    if (!fs.existsSync(storageFilePath)) return {};
    const raw = fs.readFileSync(storageFilePath, 'utf8');
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('[database] Failed to read persisted runtime storage:', error?.message || error);
    return {};
  }
}

function persistStorageNow() {
  if (!storageRef) return;
  try {
    const payload = {};
    for (const key of STORAGE_KEYS) {
      payload[key] = Array.from(storageRef[key].entries());
    }
    const tempPath = `${storageFilePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(payload), 'utf8');
    fs.renameSync(tempPath, storageFilePath);
  } catch (error) {
    console.warn('[database] Failed to persist runtime storage:', error?.message || error);
  }
}

function schedulePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistStorageNow();
  }, 120);
}

class PersistentMap extends Map {
  set(key, value) {
    const result = super.set(key, value);
    schedulePersist();
    return result;
  }

  delete(key) {
    const result = super.delete(key);
    if (result) schedulePersist();
    return result;
  }

  clear() {
    if (this.size > 0) {
      super.clear();
      schedulePersist();
    }
  }
}

const persisted = readPersistedStorage();

const storage = {};
for (const key of STORAGE_KEYS) {
  const entries = Array.isArray(persisted[key]) ? persisted[key] : [];
  storage[key] = new PersistentMap(entries);
}
storageRef = storage;

// Helper to execute queries
const db = {
  prepare: (query) => ({
    run: (...params) => {
      // Simple in-memory implementation
      return { changes: 1 };
    },
    get: (...params) => {
      // Return mock data for now
      return null;
    },
    all: (...params) => {
      // Return empty array for now
      return [];
    }
  }),
  transaction: (fn) => fn,
  exec: (sql) => {
    // No-op for schema creation
  }
};

// Export storage for direct access
export { storage };

console.log(`✅ File-backed runtime storage initialized: ${storageFilePath}`);

export default db;
