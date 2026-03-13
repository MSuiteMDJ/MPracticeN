import { v4 as uuidv4 } from 'uuid';
import { storage } from '../config/database.js';

function normalizeValue(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function buildAuditChanges(previous = {}, next = {}, fields = []) {
  return fields
    .map((field) => {
      const from = normalizeValue(previous?.[field]);
      const to = normalizeValue(next?.[field]);
      if (from === to) return null;
      return { field, from, to };
    })
    .filter(Boolean);
}

export function recordAuditEvent(userId, input) {
  const timestamp = new Date().toISOString();
  const event = {
    id: uuidv4(),
    user_id: userId,
    actor: userId,
    module: String(input?.module || 'general').trim(),
    entity_type: String(input?.entityType || 'record').trim(),
    entity_id: String(input?.entityId || '').trim(),
    entity_label: String(input?.entityLabel || '').trim() || undefined,
    client_id: String(input?.clientId || '').trim() || undefined,
    action: String(input?.action || 'updated').trim(),
    detail: String(input?.detail || '').trim() || undefined,
    changes: Array.isArray(input?.changes)
      ? input.changes
          .map((change) =>
            change && change.field
              ? {
                  field: String(change.field).trim(),
                  from: normalizeValue(change.from),
                  to: normalizeValue(change.to),
                }
              : null
          )
          .filter(Boolean)
      : [],
    metadata: input?.metadata && typeof input.metadata === 'object' ? input.metadata : undefined,
    created_at: timestamp,
  };

  storage.auditEvents.set(event.id, event);
  return event;
}

export function listAuditEvents(userId, filters = {}) {
  const limit = Number.parseInt(String(filters.limit || 200), 10);
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 200;

  return Array.from(storage.auditEvents.values())
    .filter((event) => event.user_id === userId)
    .filter((event) => (filters.module ? event.module === filters.module : true))
    .filter((event) => (filters.entityType ? event.entity_type === filters.entityType : true))
    .filter((event) => (filters.entityId ? event.entity_id === filters.entityId : true))
    .filter((event) => (filters.clientId ? event.client_id === filters.clientId : true))
    .sort((left, right) => Date.parse(right.created_at || '') - Date.parse(left.created_at || ''))
    .slice(0, normalizedLimit);
}
