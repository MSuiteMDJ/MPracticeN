import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..', '..');

// Project root is the folder that contains both the frontend and the `backend`
// directory. All local data lives in a single `data` folder at this root so the
// app is fully portable ("same place as root").
const projectRoot = path.resolve(backendRoot, '..');

function normalize(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getBackendRoot() {
  return backendRoot;
}

export function getProjectRoot() {
  return projectRoot;
}

// Resolve a configurable path. Absolute values are honoured as-is (used by the
// packaged Electron app, which points data at a folder next to the executable).
// Relative values resolve against the project root.
export function resolveProjectPath(value, fallbackRelativePath) {
  const configured = normalize(value);
  if (!configured) {
    return path.resolve(projectRoot, fallbackRelativePath);
  }
  return path.isAbsolute(configured)
    ? path.normalize(configured)
    : path.resolve(projectRoot, configured);
}

export function getDataRoot() {
  return resolveProjectPath(process.env.DATA_DIR, 'data');
}

export function getUploadsRoot() {
  return resolveProjectPath(process.env.UPLOAD_DIR, path.join('data', 'uploads'));
}

export function getDefaultDatabasePath() {
  return resolveProjectPath(process.env.DATABASE_PATH, path.join('data', 'arcanus.db'));
}

export function ensureDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
  return directoryPath;
}
