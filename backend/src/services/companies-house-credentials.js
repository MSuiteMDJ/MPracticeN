import crypto from 'crypto';
import { storage } from '../config/database.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionSecret() {
  return process.env.COMPANIES_HOUSE_ENCRYPTION_KEY || process.env.JWT_SECRET || 'm-practice-dev-secret';
}

function getCipherKey() {
  return crypto.createHash('sha256').update(getEncryptionSecret()).digest();
}

function encryptApiKey(apiKey) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptApiKey(payload) {
  const [ivHex, authTagHex, encryptedHex] = String(payload || '').split(':');
  if (!ivHex || !authTagHex || !encryptedHex) return '';

  const decipher = crypto.createDecipheriv(ALGORITHM, getCipherKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function getCredentialCollection() {
  if (!storage.companiesHouseCredentials) {
    storage.companiesHouseCredentials = new Map();
  }
  return storage.companiesHouseCredentials;
}

export function saveCompaniesHouseCredential(userId, apiKey) {
  const credentials = getCredentialCollection();
  const key = String(apiKey || '').trim();
  if (!key) {
    throw new Error('API key is required');
  }

  const encryptedApiKey = encryptApiKey(key);
  const id = `ch-cred-${Date.now()}`;

  for (const [, credential] of credentials) {
    if (credential.user_id === userId) {
      credential.is_active = false;
    }
  }

  credentials.set(id, {
    id,
    user_id: userId,
    encrypted_api_key: encryptedApiKey,
    is_active: true,
    created_at: new Date().toISOString(),
  });

  return {
    id,
    user_id: userId,
    key_masked: `${key.slice(0, 4)}...${key.slice(-4)}`,
  };
}

export function getCompaniesHouseCredential(userId) {
  const credentials = getCredentialCollection();
  const credential = Array.from(credentials.values()).find(
    (item) => item.user_id === userId && item.is_active
  );

  if (!credential) return null;

  try {
    const apiKey = decryptApiKey(credential.encrypted_api_key);
    if (!apiKey) return null;
    return {
      id: credential.id,
      apiKey,
      key_masked: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`,
      created_at: credential.created_at,
    };
  } catch (error) {
    return null;
  }
}

export function deleteCompaniesHouseCredential(userId) {
  const credentials = getCredentialCollection();
  for (const [id, credential] of credentials) {
    if (credential.user_id === userId) {
      credentials.delete(id);
    }
  }
  return { success: true };
}
