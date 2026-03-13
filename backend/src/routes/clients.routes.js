import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { parse as parseCsv } from 'csv-parse/sync';
import { storage } from '../config/database.js';
import { ensureDirectory, getUploadsRoot } from '../config/storage-paths.js';
import { HMRCClient } from '../services/hmrc-client.js';
import { DeclarationStore } from '../services/declaration-store.js';
import { validateClient, checkCDSStatus, getClientsNeedingAttention } from '../services/client-validator.js';
import { buildAuditChanges, recordAuditEvent } from '../services/audit-service.js';
import {
  createDocumentRecord,
  deleteDocumentRecord,
  mapStoredDocument,
} from '../services/document-service.js';
import { loadEmailSettings, sendEmail, validateEmailSettings } from '../services/email-service.js';
import { renderHtmlToPdfBuffer } from '../services/pdf-service.js';

const router = Router();
const store = new DeclarationStore();
const uploadDir = ensureDirectory(getUploadsRoot());
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  },
});

const CLIENT_REF_PATTERN = /^(\d+)([A-Z])(\d{3})([A-Z]*)$/;
const CLIENT_REF_COUNTER_WIDTH = 3;
const ONBOARDING_FIELDS = [
  { key: 'company_name', label: 'Client details' },
  { key: 'primary_contact_name', label: 'Primary contact' },
  { key: 'primary_contact_email', label: 'Email address' },
  { key: 'address_bundle', label: 'Registered address' },
  { key: 'vat_number', label: 'VAT number' },
];
const CLIENT_TRANSFER_FIELDS = [
  'type',
  'name',
  'contact_person',
  'email',
  'alternative_email',
  'phone',
  'address',
  'address_line_2',
  'city',
  'postcode',
  'country',
  'client_ref',
  'company_number',
  'legal_entity_type',
  'registered_address_line_1',
  'registered_address_line_2',
  'registered_city',
  'registered_postcode',
  'registered_country',
  'company_country_of_establishment',
  'date_of_birth',
  'preferred_contact_method',
  'vat_number',
  'utr',
  'corporation_tax_reference',
  'paye_reference',
  'ni_number',
  'self_assessment_utr',
  'vat_scheme',
  'vat_frequency',
  'vat_stagger',
  'mtd_enabled',
  'accounts_reference_date',
  'bank_account_name',
  'bank_account_number',
  'bank_sort_code',
  'bank_iban',
  'bank_swift',
  'engagement_letter_sent_date',
  'engagement_letter_signed_date',
  'engagement_type',
  'acting_as_agent',
  'hmrc_agent_authorised',
  'hmrc_agent_reference',
  'professional_clearance_received',
  'previous_accountant',
  'take_on_completed',
  'aml_risk_rating',
  'aml_review_date',
  'risk_review_frequency',
  'id_verified',
  'source_of_funds_checked',
  'beneficial_owner_verified',
  'psc_verified',
  'assigned_reviewer',
  'billing_model',
  'monthly_fee',
  'payment_method',
  'client_manager',
  'partner',
  'sector',
  'internal_rating',
  'year_end',
  'software_used',
  'payroll_frequency',
  'notes',
  'portfolio_id',
  'portfolio_code',
  'portfolio_name',
  'field_statuses',
];
const CLIENT_TRANSFER_BOOLEAN_FIELDS = new Set([
  'acting_as_agent',
  'hmrc_agent_authorised',
  'professional_clearance_received',
  'take_on_completed',
  'id_verified',
  'source_of_funds_checked',
  'beneficial_owner_verified',
  'psc_verified',
  'mtd_enabled',
]);
const CLIENT_TRANSFER_NUMBER_FIELDS = new Set(['monthly_fee', 'portfolio_code']);
const CLIENT_AUDIT_FIELDS = [
  'name',
  'contact_person',
  'email',
  'phone',
  'address',
  'vat_number',
  'company_number',
  'utr',
  'engagement_letter_sent_date',
  'engagement_letter_signed_date',
  'government_gateway_username',
  'companies_house_auth_code',
  'client_manager',
  'partner',
  'billing_model',
  'monthly_fee',
];
const SERVICE_AUDIT_FIELDS = [
  'displayName',
  'serviceCode',
  'frequency',
  'billingType',
  'billingUnit',
  'feeAmount',
  'startDate',
  'periodEndDate',
  'manualDueDate',
  'nextDue',
  'isActive',
];

function loadCompanySettings(db) {
  const rows = db.prepare('SELECT key, value FROM company_settings').all();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

function parseRecipientList(input) {
  if (Array.isArray(input)) {
    return input
      .map((value) => String(value || '').trim())
      .filter(Boolean);
  }

  return String(input || '')
    .split(/[;,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function isClientReferenceType(type) {
  return type === 'business' || type === 'individual';
}

function hasClientReference(client) {
  return typeof client?.client_ref === 'string' && client.client_ref.trim().length > 0;
}

function firstAlphanumericInitial(value) {
  const match = String(value || '')
    .toUpperCase()
    .match(/[A-Z0-9]/);
  return match?.[0] || null;
}

function deriveClientReferenceInitial(client) {
  const normalizedName = String(client?.name || client?.company_name || '').trim();

  if (client?.type === 'individual') {
    const tokens = normalizedName.split(/\s+/).filter(Boolean);
    const surname = tokens[tokens.length - 1] || normalizedName;
    return firstAlphanumericInitial(surname) || firstAlphanumericInitial(normalizedName) || 'X';
  }

  return firstAlphanumericInitial(normalizedName) || 'X';
}

function parseClientReference(clientRef) {
  const match = String(clientRef || '').toUpperCase().match(CLIENT_REF_PATTERN);
  if (!match) return null;

  const portfolioCode = Number.parseInt(match[1], 10);
  const initial = match[2];
  const index = Number.parseInt(match[3], 10);
  const suffix = match[4] || '';

  if (!Number.isFinite(portfolioCode) || !Number.isFinite(index)) {
    return null;
  }

  return { portfolioCode, initial, index, suffix };
}

function formatClientReferenceBase(parsedRef) {
  return `${parsedRef.portfolioCode}${parsedRef.initial}${String(parsedRef.index).padStart(CLIENT_REF_COUNTER_WIDTH, '0')}`;
}

function alphaSuffixToNumber(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return 0;

  let result = 0;
  for (const char of normalized) {
    const code = char.charCodeAt(0);
    if (code < 65 || code > 90) return 0;
    result = result * 26 + (code - 64);
  }
  return result;
}

function numberToAlphaSuffix(value) {
  let current = Number.parseInt(String(value || 0), 10);
  if (!Number.isFinite(current) || current <= 0) return 'A';

  let suffix = '';
  while (current > 0) {
    const remainder = (current - 1) % 26;
    suffix = String.fromCharCode(65 + remainder) + suffix;
    current = Math.floor((current - 1) / 26);
  }
  return suffix;
}

function getNextRelatedClientReference(parentClientRef, userId, existingClients = Array.from(storage.clients.values())) {
  const parsedParent = parseClientReference(parentClientRef);
  if (!parsedParent || parsedParent.suffix) {
    throw new Error('Parent client reference is invalid for related client generation');
  }

  const baseRef = formatClientReferenceBase(parsedParent);
  let maxSuffix = 0;

  existingClients.forEach((client) => {
    if (client.user_id !== userId) return;
    if (!hasClientReference(client)) return;

    const parsed = parseClientReference(client.client_ref);
    if (!parsed || !parsed.suffix) return;
    if (formatClientReferenceBase(parsed) !== baseRef) return;

    const suffixIndex = alphaSuffixToNumber(parsed.suffix);
    if (suffixIndex > maxSuffix) {
      maxSuffix = suffixIndex;
    }
  });

  return `${baseRef}${numberToAlphaSuffix(maxSuffix + 1)}`;
}

function getNextClientReferenceIndex(existingClients, portfolioCode, initial, userId) {
  let maxIndex = 0;

  existingClients.forEach((client) => {
    if (client.user_id !== userId) return;
    if (!hasClientReference(client)) return;

    const parsed = parseClientReference(client.client_ref);
    if (!parsed || parsed.suffix) return;
    if (parsed.portfolioCode !== portfolioCode || parsed.initial !== initial) return;

    if (parsed.index > maxIndex) {
      maxIndex = parsed.index;
    }
  });

  return maxIndex + 1;
}

function generateClientReference(input, userId, existingClients = Array.from(storage.clients.values())) {
  if (!isClientReferenceType(input?.type)) return undefined;

  const portfolioCode = Number.isFinite(input?.portfolio_code) ? input.portfolio_code : 1;
  const initial = deriveClientReferenceInitial(input);
  const nextIndex = getNextClientReferenceIndex(existingClients, portfolioCode, initial, userId);

  return `${portfolioCode}${initial}${String(nextIndex).padStart(CLIENT_REF_COUNTER_WIDTH, '0')}`;
}

function getClientClaimCount(clientId) {
  return Array.from(storage.claims?.values() || []).filter((claim) => claim.client_id === clientId).length;
}

function normalizeClientRecord(input, userId, existing = {}) {
  const now = new Date().toISOString();
  const merged = { ...existing, ...input };
  const type = merged.type === 'individual' ? 'individual' : 'business';
  const name = String(merged.name || merged.company_name || existing.name || existing.company_name || '').trim();
  const addressLine1 = String(merged.address_line1 || merged.address || existing.address_line1 || existing.address || '').trim();
  const addressLine2 = String(merged.address_line2 || merged.address_line_2 || existing.address_line2 || existing.address_line_2 || '').trim();
  const contactName = String(
    merged.primary_contact_name || merged.contact_person || existing.primary_contact_name || existing.contact_person || ''
  ).trim();
  const contactEmail = String(merged.primary_contact_email || merged.email || existing.primary_contact_email || existing.email || '').trim();
  const contactPhone = String(merged.primary_contact_phone || merged.phone || existing.primary_contact_phone || existing.phone || '').trim();

  const normalized = {
    ...existing,
    ...merged,
    id: existing.id || merged.id || uuidv4(),
    user_id: userId,
    created_by: userId,
    type,
    name,
    company_name: name,
    address: addressLine1,
    address_line1: addressLine1,
    address_line2: addressLine2,
    address_line_2: addressLine2,
    city: String(merged.city || existing.city || '').trim(),
    postcode: String(merged.postcode || existing.postcode || '').trim(),
    country: String(merged.country || existing.country || 'GB').trim(),
    contact_person: contactName,
    primary_contact_name: contactName,
    email: contactEmail,
    primary_contact_email: contactEmail,
    phone: contactPhone,
    primary_contact_phone: contactPhone,
    eori: String(merged.eori || existing.eori || '').trim() || undefined,
    vat_number: String(merged.vat_number || existing.vat_number || '').trim() || undefined,
    company_number: String(merged.company_number || existing.company_number || '').trim() || undefined,
    portfolio_id: merged.portfolio_id || existing.portfolio_id || 'portfolio-default',
    portfolio_code: Number.isFinite(merged.portfolio_code) ? merged.portfolio_code : existing.portfolio_code || 1,
    portfolio_name: merged.portfolio_name || existing.portfolio_name || 'Main',
    related_to_client_id: String(merged.related_to_client_id || existing.related_to_client_id || '').trim() || undefined,
    related_to_client_ref: String(merged.related_to_client_ref || existing.related_to_client_ref || '').trim() || undefined,
    related_to_client_name: String(merged.related_to_client_name || existing.related_to_client_name || '').trim() || undefined,
    party_roles: Array.isArray(merged.party_roles)
      ? Array.from(new Set(merged.party_roles.map((role) => String(role || '').trim()).filter(Boolean)))
      : Array.isArray(existing.party_roles)
        ? Array.from(new Set(existing.party_roles.map((role) => String(role || '').trim()).filter(Boolean)))
        : [],
    party_status: String(merged.party_status || existing.party_status || '').trim() || undefined,
    cds_agreement: Boolean(merged.cds_agreement ?? existing.cds_agreement ?? false),
    cds_agreement_date: merged.cds_agreement_date || existing.cds_agreement_date,
    agent_authority_expiry: merged.agent_authority_expiry || existing.agent_authority_expiry,
    bank_account_name: merged.bank_account_name || existing.bank_account_name,
    bank_account_number: merged.bank_account_number || existing.bank_account_number,
    bank_sort_code: merged.bank_sort_code || existing.bank_sort_code,
    bank_iban: merged.bank_iban || existing.bank_iban,
    bank_swift: merged.bank_swift || existing.bank_swift,
    field_statuses:
      merged.field_statuses && typeof merged.field_statuses === 'object'
        ? merged.field_statuses
        : existing.field_statuses || {},
    created_at: existing.created_at || merged.created_at || now,
    updated_at: now,
    total_claims: getClientClaimCount(existing.id || merged.id || ''),
  };

  if (!hasClientReference(normalized)) {
    normalized.client_ref = generateClientReference(normalized, userId);
  } else {
    normalized.client_ref = String(normalized.client_ref).trim();
  }

  return normalized;
}

function getClientOrNull(clientId, userId) {
  const client = storage.clients.get(clientId);
  if (!client || client.user_id !== userId) return null;
  return client;
}

function pickClientTransferFields(client) {
  return CLIENT_TRANSFER_FIELDS.reduce((acc, field) => {
    if (client[field] !== undefined) {
      acc[field] = client[field];
    }
    return acc;
  }, {});
}

function csvEscape(value) {
  const normalized = value === undefined || value === null ? '' : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function serializeClientTransferCsv(clients) {
  const header = CLIENT_TRANSFER_FIELDS.join(',');
  const rows = clients.map((client) =>
    CLIENT_TRANSFER_FIELDS.map((field) => {
      const value = client[field];
      if (value === undefined || value === null) return '';
      if (typeof value === 'object') {
        return csvEscape(JSON.stringify(value));
      }
      return csvEscape(value);
    }).join(',')
  );

  return [header, ...rows].join('\n');
}

function parseImportedClientField(field, rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return undefined;

  if (CLIENT_TRANSFER_BOOLEAN_FIELDS.has(field)) {
    if (value.toLowerCase() === 'true' || value.toLowerCase() === 'yes' || value === '1') return true;
    if (value.toLowerCase() === 'false' || value.toLowerCase() === 'no' || value === '0') return false;
    return undefined;
  }

  if (CLIENT_TRANSFER_NUMBER_FIELDS.has(field)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (field === 'field_statuses') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  return value;
}

function importClientTransferRecords(records, userId) {
  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    relationship_links: 0,
    errors: [],
  };

  const savedClientsByRef = new Map(
    Array.from(storage.clients.values())
      .filter((client) => client.user_id === userId)
      .map((client) => [String(client.client_ref || '').trim(), client])
      .filter(([clientRef]) => Boolean(clientRef))
  );

  for (const rawClient of records) {
    const payload = pickClientTransferFields(rawClient || {});
    const clientName = String(payload.name || '').trim();
    if (!clientName) {
      results.skipped += 1;
      continue;
    }

    const importedClientRef = String(payload.client_ref || '').trim();
    const companyNumber = String(payload.company_number || '').trim().toLowerCase();
    const email = String(payload.email || '').trim().toLowerCase();

    const exactNameMatches = Array.from(storage.clients.values()).filter((client) => {
      if (client.user_id !== userId) return false;
      if (String(client.name || '').trim().toLowerCase() !== clientName.toLowerCase()) return false;
      if (payload.type && String(client.type || '').trim() !== String(payload.type).trim()) return false;
      return true;
    });

    const existing =
      (importedClientRef ? savedClientsByRef.get(importedClientRef) : null) ||
      Array.from(storage.clients.values()).find((client) => {
        if (client.user_id !== userId) return false;
        if (companyNumber && String(client.company_number || '').trim().toLowerCase() === companyNumber) return true;
        return Boolean(email) && String(client.email || '').trim().toLowerCase() === email && String(client.name || '').trim().toLowerCase() === clientName.toLowerCase();
      }) ||
      (exactNameMatches.length === 1 ? exactNameMatches[0] : null);

    const conflictingRef =
      importedClientRef &&
      Array.from(storage.clients.values()).find((client) => {
        return (
          client.user_id === userId &&
          String(client.client_ref || '').trim() === importedClientRef &&
          (!existing || client.id !== existing.id)
        );
      });

    if (conflictingRef) {
      results.errors.push(`Skipped ${clientName}: client ref ${importedClientRef} already belongs to another client.`);
      results.skipped += 1;
      continue;
    }

    const savedClient = normalizeClientRecord(
      {
        ...(existing || {}),
        ...payload,
        client_ref: existing?.client_ref || importedClientRef || undefined,
      },
      userId,
      existing || {}
    );
    storage.clients.set(savedClient.id, savedClient);

    if (savedClient.client_ref) {
      savedClientsByRef.set(savedClient.client_ref, savedClient);
    }

    if (existing) {
      results.updated += 1;
    } else {
      results.created += 1;
    }
  }

  return results;
}

function getChecklistState(client, onboardingState) {
  if (Array.isArray(onboardingState?.missingFields)) {
    const manualMissing = new Set(onboardingState.missingFields);
    return ONBOARDING_FIELDS.map((item) => ({
      key: item.key,
      label: item.label,
      completed: !manualMissing.has(item.key),
    }));
  }

  return ONBOARDING_FIELDS.map((item) => {
    let completed = false;

    if (item.key === 'address_bundle') {
      completed = Boolean(client.address_line1 && client.city && client.postcode);
    } else {
      completed = Boolean(client[item.key]);
    }

    return {
      key: item.key,
      label: item.label,
      completed,
    };
  });
}

function deriveOnboardingStatus(progress, client) {
  if (progress < 25) return 'not_started';
  if (progress < 50) return 'info_submitted';
  if (progress < 75) return 'documents_pending';
  if (progress < 100) return 'verification_required';
  return getClientClaimCount(client.id) > 0 ? 'live' : 'ready_for_services';
}

function buildOnboardingSummary(client) {
  const onboardingState = storage.onboarding.get(client.id) || {};
  const checklist = getChecklistState(client, onboardingState);
  const missingItems = checklist.filter((item) => !item.completed).map((item) => item.label);
  const missingKeys = checklist.filter((item) => !item.completed).map((item) => item.key);
  const derivedProgress = checklist.length
    ? Math.round((checklist.filter((item) => item.completed).length / checklist.length) * 100)
    : 0;

  return {
    clientId: client.id,
    clientRef: client.client_ref,
    name: client.name || client.company_name,
    contact: client.primary_contact_name || client.contact_person || client.primary_contact_email || client.email,
    eori: client.eori,
    vat: client.vat_number,
    status: onboardingState.status || deriveOnboardingStatus(onboardingState.progress ?? derivedProgress, client),
    progress: onboardingState.progress ?? derivedProgress,
    missingItems,
    missingKeys,
    checklist,
  };
}

function mapStoredService(service) {
  return {
    ...service,
    user_id: undefined,
  };
}

function normalizeServiceTask(task, index) {
  return {
    id: String(task?.id || `task-${index + 1}`),
    title: String(task?.title || '').trim(),
    daysBeforeDue: Number.isFinite(task?.daysBeforeDue) ? Number(task.daysBeforeDue) : 0,
    priority: String(task?.priority || 'MEDIUM').trim().toUpperCase(),
    status: String(task?.status || 'TODO').trim().toUpperCase(),
    dueDate: typeof task?.dueDate === 'string' && task.dueDate.trim() ? task.dueDate.trim() : undefined,
  };
}

function normalizeComplianceDate(item, index) {
  return {
    id: String(item?.id || `deadline-${index + 1}`),
    label: String(item?.label || `Due date ${index + 1}`).trim(),
    dueDate: String(item?.dueDate || '').trim(),
  };
}

function normalizeServiceRecord(input, userId, existing = {}) {
  const now = new Date().toISOString();
  const merged = { ...existing, ...input };

  return {
    ...existing,
    ...merged,
    id: String(existing.id || merged.id || uuidv4()),
    user_id: userId,
    clientId: String(merged.clientId || existing.clientId || '').trim(),
    serviceCode: String(merged.serviceCode || existing.serviceCode || '').trim().toUpperCase(),
    displayName: String(merged.displayName || existing.displayName || '').trim(),
    category: String(merged.category || existing.category || 'ADVISORY').trim().toUpperCase(),
    complianceType: String(merged.complianceType || existing.complianceType || 'NONE').trim().toUpperCase(),
    createsCompliance: Boolean(merged.createsCompliance ?? existing.createsCompliance ?? false),
    frequency: String(merged.frequency || existing.frequency || 'MONTHLY').trim().toUpperCase(),
    billingType: String(merged.billingType || existing.billingType || 'RECURRING').trim().toUpperCase(),
    billingUnit: String(merged.billingUnit || existing.billingUnit || 'PER_MONTH').trim().toUpperCase(),
    feeAmount: Number.isFinite(merged.feeAmount) ? Number(merged.feeAmount) : Number(existing.feeAmount || 0),
    startDate: String(merged.startDate || existing.startDate || '').trim(),
    scheduleMode: String(merged.scheduleMode || existing.scheduleMode || 'MANUAL_DUE').trim().toUpperCase(),
    periodEndDate:
      typeof merged.periodEndDate === 'string' && merged.periodEndDate.trim() ? merged.periodEndDate.trim() : undefined,
    manualDueDate:
      typeof merged.manualDueDate === 'string' && merged.manualDueDate.trim() ? merged.manualDueDate.trim() : undefined,
    nextDue: typeof merged.nextDue === 'string' && merged.nextDue.trim() ? merged.nextDue.trim() : undefined,
    complianceDates: Array.isArray(merged.complianceDates)
      ? merged.complianceDates.map(normalizeComplianceDate).filter((item) => item.dueDate)
      : Array.isArray(existing.complianceDates)
        ? existing.complianceDates.map(normalizeComplianceDate).filter((item) => item.dueDate)
        : [],
    isActive: Boolean(merged.isActive ?? existing.isActive ?? true),
    taskInstances: Array.isArray(merged.taskInstances)
      ? merged.taskInstances.map(normalizeServiceTask).filter((task) => task.title)
      : Array.isArray(existing.taskInstances)
        ? existing.taskInstances.map(normalizeServiceTask).filter((task) => task.title)
        : [],
    createdAt: existing.createdAt || merged.createdAt || now,
    updatedAt: now,
  };
}

function getServiceOrNull(serviceId, userId) {
  const service = storage.services.get(serviceId);
  if (!service || service.user_id !== userId) return null;
  return service;
}

function normalizeIndividualName(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized.includes(',')) return normalized;

  const commaIndex = normalized.indexOf(',');
  const lastName = normalized.slice(0, commaIndex).trim();
  const givenNames = normalized.slice(commaIndex + 1).trim();
  return [givenNames, lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function normalizePartyIdentity({ name, dateOfBirth, address, postcode }) {
  return {
    normalizedName: normalizeIndividualName(name),
    normalizedDob: String(dateOfBirth || '').trim(),
    normalizedAddress: String(address || '').trim().toLowerCase(),
    normalizedPostcode: String(postcode || '').trim().toLowerCase(),
  };
}

function findMatchingPartyClient(userId, input) {
  const target = normalizePartyIdentity(input);
  if (!target.normalizedName) return null;

  return Array.from(storage.clients.values()).find((client) => {
    if (client.user_id !== userId) return false;
    if (client.type !== 'individual') return false;

    const candidate = normalizePartyIdentity({
      name: client.name,
      dateOfBirth: client.date_of_birth,
      address: client.address,
      postcode: client.postcode,
    });

    if (candidate.normalizedName !== target.normalizedName) return false;
    if (target.normalizedDob && candidate.normalizedDob) {
      return candidate.normalizedDob === target.normalizedDob;
    }
    if (target.normalizedPostcode && candidate.normalizedPostcode) {
      return (
        candidate.normalizedPostcode === target.normalizedPostcode &&
        (!target.normalizedAddress || !candidate.normalizedAddress || candidate.normalizedAddress === target.normalizedAddress)
      );
    }
    return true;
  }) || null;
}

function mapRelatedClientForCompany(relationship, client) {
  return {
    ...client,
    party_roles: Array.isArray(relationship.party_roles) ? relationship.party_roles : [],
    party_status: relationship.party_status || undefined,
    related_to_client_id: relationship.company_client_id,
    related_to_client_ref: relationship.company_client_ref,
    related_to_client_name: relationship.company_client_name,
  };
}

router.post('/', async (req, res, next) => {
  try {
    const client = normalizeClientRecord(req.body || {}, req.userId);
    const validation = validateClient(client);

    storage.clients.set(client.id, client);
    recordAuditEvent(req.userId, {
      module: 'clients',
      entityType: 'client',
      entityId: client.id,
      entityLabel: client.name || client.company_name,
      clientId: client.id,
      action: 'created',
      detail: 'Client created',
      changes: buildAuditChanges({}, client, CLIENT_AUDIT_FIELDS),
    });

    res.json({
      success: true,
      client,
      validation,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/export', async (req, res, next) => {
  try {
    const clients = Array.from(storage.clients.values())
      .filter((client) => client.user_id === req.userId)
      .map((client) => pickClientTransferFields(client));

    const clientRefSet = new Set(
      Array.from(storage.clients.values())
        .filter((client) => client.user_id === req.userId)
        .map((client) => String(client.client_ref || '').trim())
        .filter(Boolean)
    );

    const relationships = Array.from(storage.clientRelationships.values())
      .filter((relationship) => relationship.user_id === req.userId)
      .filter(
        (relationship) =>
          clientRefSet.has(String(relationship.company_client_ref || '').trim()) &&
          clientRefSet.has(String(relationship.party_client_ref || '').trim())
      )
      .map((relationship) => ({
        company_client_ref: relationship.company_client_ref,
        party_client_ref: relationship.party_client_ref,
        party_roles: Array.isArray(relationship.party_roles) ? relationship.party_roles : [],
        party_status: relationship.party_status || 'current',
      }));

    res.json({
      version: 1,
      exported_at: new Date().toISOString(),
      clients,
      relationships,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/import', async (req, res, next) => {
  try {
    const importedClients = Array.isArray(req.body?.clients) ? req.body.clients : [];
    const importedRelationships = Array.isArray(req.body?.relationships) ? req.body.relationships : [];
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      relationship_links: 0,
      errors: [],
    };

    const savedClientsByRef = new Map(
      Array.from(storage.clients.values())
        .filter((client) => client.user_id === req.userId)
        .map((client) => [String(client.client_ref || '').trim(), client])
        .filter(([clientRef]) => Boolean(clientRef))
    );

    for (const rawClient of importedClients) {
      const payload = pickClientTransferFields(rawClient || {});
      const clientName = String(payload.name || '').trim();
      if (!clientName) {
        results.skipped += 1;
        continue;
      }

      const importedClientRef = String(payload.client_ref || '').trim();
      const companyNumber = String(payload.company_number || '').trim().toLowerCase();
      const email = String(payload.email || '').trim().toLowerCase();

      const exactNameMatches = Array.from(storage.clients.values()).filter((client) => {
        if (client.user_id !== req.userId) return false;
        if (String(client.name || '').trim().toLowerCase() !== clientName.toLowerCase()) return false;
        if (payload.type && String(client.type || '').trim() !== String(payload.type).trim()) return false;
        return true;
      });

      const existing =
        (importedClientRef ? savedClientsByRef.get(importedClientRef) : null) ||
        Array.from(storage.clients.values()).find((client) => {
          if (client.user_id !== req.userId) return false;
          if (companyNumber && String(client.company_number || '').trim().toLowerCase() === companyNumber) return true;
          return Boolean(email) && String(client.email || '').trim().toLowerCase() === email && String(client.name || '').trim().toLowerCase() === clientName.toLowerCase();
        }) ||
        (exactNameMatches.length === 1 ? exactNameMatches[0] : null);

      const conflictingRef =
        importedClientRef &&
        Array.from(storage.clients.values()).find((client) => {
          return (
            client.user_id === req.userId &&
            String(client.client_ref || '').trim() === importedClientRef &&
            (!existing || client.id !== existing.id)
          );
        });

      if (conflictingRef) {
        results.errors.push(`Skipped ${clientName}: client ref ${importedClientRef} already belongs to another client.`);
        results.skipped += 1;
        continue;
      }

      const savedClient = normalizeClientRecord(
        {
          ...(existing || {}),
          ...payload,
          client_ref: existing?.client_ref || importedClientRef || undefined,
        },
        req.userId,
        existing || {}
      );
      storage.clients.set(savedClient.id, savedClient);

      if (savedClient.client_ref) {
        savedClientsByRef.set(savedClient.client_ref, savedClient);
      }

      if (existing) {
        results.updated += 1;
      } else {
        results.created += 1;
      }
    }

    for (const rawRelationship of importedRelationships) {
      const companyClientRef = String(rawRelationship?.company_client_ref || '').trim();
      const partyClientRef = String(rawRelationship?.party_client_ref || '').trim();
      if (!companyClientRef || !partyClientRef) continue;

      const companyClient = savedClientsByRef.get(companyClientRef);
      const partyClient = savedClientsByRef.get(partyClientRef);
      if (!companyClient || !partyClient) continue;

      const existingRelationship = Array.from(storage.clientRelationships.values()).find((relationship) => {
        return (
          relationship.user_id === req.userId &&
          relationship.company_client_id === companyClient.id &&
          relationship.party_client_id === partyClient.id
        );
      });

      const relationshipId = existingRelationship?.id || uuidv4();
      storage.clientRelationships.set(relationshipId, {
        id: relationshipId,
        user_id: req.userId,
        company_client_id: companyClient.id,
        company_client_ref: companyClient.client_ref,
        company_client_name: companyClient.name || companyClient.company_name,
        party_client_id: partyClient.id,
        party_client_ref: partyClient.client_ref,
        party_roles: Array.isArray(rawRelationship?.party_roles)
          ? Array.from(new Set(rawRelationship.party_roles.map((role) => String(role || '').trim()).filter(Boolean)))
          : existingRelationship?.party_roles || [],
        party_status:
          String(rawRelationship?.party_status || '').trim() || existingRelationship?.party_status || 'current',
        created_at: existingRelationship?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      results.relationship_links += existingRelationship ? 0 : 1;
    }

    res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/export.csv', async (req, res, next) => {
  try {
    const clients = Array.from(storage.clients.values())
      .filter((client) => client.user_id === req.userId)
      .map((client) => pickClientTransferFields(client));
    const csv = serializeClientTransferCsv(clients);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="client-data-export-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

router.post('/import.csv', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required',
      });
    }

    const raw = fs.readFileSync(req.file.path, 'utf8');
    const records = parseCsv(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }).map((record) =>
      CLIENT_TRANSFER_FIELDS.reduce((acc, field) => {
        const parsed = parseImportedClientField(field, record[field]);
        if (parsed !== undefined) {
          acc[field] = parsed;
        }
        return acc;
      }, {})
    );

    const result = importClientTransferRecords(records, req.userId);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  } finally {
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // ignore temp file cleanup errors
      }
    }
  }
});

router.get('/:id/related-clients', async (req, res, next) => {
  try {
    const client = getClientOrNull(req.params.id, req.userId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const relatedClients = Array.from(storage.clientRelationships.values())
      .filter((relationship) => relationship.user_id === req.userId)
      .filter((relationship) => relationship.company_client_id === req.params.id)
      .map((relationship) => {
        const partyClient = getClientOrNull(relationship.party_client_id, req.userId);
        if (!partyClient) return null;
        return mapRelatedClientForCompany(relationship, partyClient);
      })
      .filter(Boolean)
      .sort((left, right) => {
        const leftTime = Date.parse(left.created_at || '');
        const rightTime = Date.parse(right.created_at || '');
        return (Number.isFinite(leftTime) ? leftTime : 0) - (Number.isFinite(rightTime) ? rightTime : 0);
      });

    res.json({ clients: relatedClients });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/related-clients', async (req, res, next) => {
  try {
    const parentClient = getClientOrNull(req.params.id, req.userId);

    if (!parentClient) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    if (!parentClient.client_ref) {
      return res.status(400).json({
        success: false,
        message: 'Parent client reference is required before adding linked parties',
      });
    }

    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Party name is required',
      });
    }

    const partyRoles = Array.isArray(req.body?.party_roles)
      ? Array.from(new Set(req.body.party_roles.map((role) => String(role || '').trim()).filter(Boolean)))
      : [];
    const partyStatus = String(req.body?.party_status || '').trim() || 'current';
    const dateOfBirth = String(req.body?.date_of_birth || '').trim() || undefined;
    const matchedPartyClient = findMatchingPartyClient(req.userId, {
      name,
      dateOfBirth,
      address: req.body?.address,
      postcode: req.body?.postcode,
    });
    const relatedPartyClient = matchedPartyClient
      ? normalizeClientRecord(
          {
            ...matchedPartyClient,
            date_of_birth: matchedPartyClient.date_of_birth || dateOfBirth,
            address: matchedPartyClient.address || String(req.body?.address || '').trim(),
            address_line1: matchedPartyClient.address_line1 || String(req.body?.address || '').trim(),
            address_line2: matchedPartyClient.address_line2 || String(req.body?.address_line2 || '').trim() || undefined,
            city: matchedPartyClient.city || String(req.body?.city || '').trim() || undefined,
            postcode: matchedPartyClient.postcode || String(req.body?.postcode || '').trim() || undefined,
            country: matchedPartyClient.country || String(req.body?.country || parentClient.country || 'GB').trim(),
          },
          req.userId,
          matchedPartyClient
        )
      : normalizeClientRecord(
          {
            type: 'individual',
            name,
            contact_person: name,
            email: '',
            phone: '',
            date_of_birth: dateOfBirth,
            address: String(req.body?.address || '').trim(),
            address_line1: String(req.body?.address || '').trim(),
            address_line2: String(req.body?.address_line2 || '').trim() || undefined,
            city: String(req.body?.city || '').trim() || undefined,
            postcode: String(req.body?.postcode || '').trim() || undefined,
            country: String(req.body?.country || parentClient.country || 'GB').trim(),
            portfolio_id: parentClient.portfolio_id,
            portfolio_code: parentClient.portfolio_code,
            portfolio_name: parentClient.portfolio_name,
            client_ref: getNextRelatedClientReference(parentClient.client_ref, req.userId),
          },
          req.userId
        );

    const existingRelationship = Array.from(storage.clientRelationships.values()).find((relationship) => {
      return (
        relationship.user_id === req.userId &&
        relationship.company_client_id === parentClient.id &&
        relationship.party_client_id === relatedPartyClient.id
      );
    });

    if (!storage.clients.has(relatedPartyClient.id)) {
      storage.clients.set(relatedPartyClient.id, relatedPartyClient);
    }

    const relationshipId = existingRelationship?.id || uuidv4();
    const nextRelationship = {
      id: relationshipId,
      user_id: req.userId,
      company_client_id: parentClient.id,
      company_client_ref: parentClient.client_ref,
      company_client_name: parentClient.name || parentClient.company_name,
      party_client_id: relatedPartyClient.id,
      party_client_ref: relatedPartyClient.client_ref,
      party_roles: Array.from(
        new Set([...(existingRelationship?.party_roles || []), ...partyRoles].map((role) => String(role || '').trim()).filter(Boolean))
      ),
      party_status:
        existingRelationship?.party_status === 'current' || partyStatus === 'current'
          ? 'current'
          : partyStatus,
      created_at: existingRelationship?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    storage.clientRelationships.set(relationshipId, nextRelationship);

    res.json({
      success: true,
      created: !existingRelationship,
      client: mapRelatedClientForCompany(nextRelationship, relatedPartyClient),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { filter } = req.query;

    let clients = Array.from(storage.clients.values()).filter((client) => client.user_id === req.userId);

    if (filter === 'missing_data') {
      clients = clients.filter((client) => validateClient(client).completeness < 100);
    } else if (filter === 'cds_agreements') {
      clients = clients.filter((client) => {
        const status = checkCDSStatus(client);
        return status.status === 'expiring' || status.status === 'expired';
      });
    } else if (filter === 'alerts') {
      clients = clients.filter((client) => checkCDSStatus(client).alert !== null);
    }

    clients = clients.map((client) => ({
      ...client,
      total_claims: getClientClaimCount(client.id),
      validation: validateClient(client),
      cds_status: checkCDSStatus(client),
    }));

    res.json({ clients });
  } catch (error) {
    next(error);
  }
});

router.get('/alerts', async (req, res, next) => {
  try {
    const alerts = getClientsNeedingAttention(req.userId);
    res.json(alerts);
  } catch (error) {
    next(error);
  }
});

router.get('/onboarding/summary', async (req, res, next) => {
  try {
    const clients = Array.from(storage.clients.values())
      .filter((client) => client.user_id === req.userId)
      .map((client) => buildOnboardingSummary(client))
      .filter((summary) => summary.status !== 'live');

    res.json({ clients });
  } catch (error) {
    next(error);
  }
});

router.get('/services', async (req, res, next) => {
  try {
    const clientId = String(req.query?.clientId || '').trim();
    const services = Array.from(storage.services.values())
      .filter((service) => service.user_id === req.userId)
      .filter((service) => (clientId ? service.clientId === clientId : true))
      .sort((left, right) => Date.parse(right.updatedAt || right.createdAt || '') - Date.parse(left.updatedAt || left.createdAt || ''))
      .map(mapStoredService);

    res.json({ services });
  } catch (error) {
    next(error);
  }
});

router.post('/services', async (req, res, next) => {
  try {
    const clientId = String(req.body?.clientId || '').trim();
    const client = getClientOrNull(clientId, req.userId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const service = normalizeServiceRecord(req.body || {}, req.userId);
    storage.services.set(service.id, service);
    recordAuditEvent(req.userId, {
      module: 'services',
      entityType: 'service',
      entityId: service.id,
      entityLabel: service.displayName || service.serviceCode,
      clientId: client.id,
      action: 'created',
      detail: `Service added to ${client.name || client.company_name}`,
      changes: buildAuditChanges({}, service, SERVICE_AUDIT_FIELDS),
      metadata: {
        client_ref: client.client_ref,
        service_code: service.serviceCode,
      },
    });

    res.json({
      success: true,
      service: mapStoredService(service),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/services/:serviceId', async (req, res, next) => {
  try {
    const existing = getServiceOrNull(req.params.serviceId, req.userId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    const nextClientId = String(req.body?.clientId || existing.clientId || '').trim();
    const client = getClientOrNull(nextClientId, req.userId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const service = normalizeServiceRecord({ ...existing, ...req.body, id: existing.id }, req.userId, existing);
    storage.services.set(service.id, service);
    recordAuditEvent(req.userId, {
      module: 'services',
      entityType: 'service',
      entityId: service.id,
      entityLabel: service.displayName || service.serviceCode,
      clientId: client.id,
      action: 'updated',
      detail: `Service updated for ${client.name || client.company_name}`,
      changes: buildAuditChanges(existing, service, Array.from(new Set([...SERVICE_AUDIT_FIELDS, ...Object.keys(req.body || {})]))),
      metadata: {
        client_ref: client.client_ref,
        service_code: service.serviceCode,
      },
    });

    res.json({
      success: true,
      service: mapStoredService(service),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/services/:serviceId/tasks/:taskId', async (req, res, next) => {
  try {
    const existing = getServiceOrNull(req.params.serviceId, req.userId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    const status = String(req.body?.status || '').trim().toUpperCase();
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Task status is required',
      });
    }

    const taskExists = existing.taskInstances.some((task) => task.id === req.params.taskId);
    if (!taskExists) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    const service = normalizeServiceRecord(
      {
        ...existing,
        taskInstances: existing.taskInstances.map((task) =>
          task.id === req.params.taskId ? { ...task, status } : task
        ),
      },
      req.userId,
      existing
    );
    storage.services.set(service.id, service);
    const updatedTask = service.taskInstances.find((task) => task.id === req.params.taskId);
    const previousTask = existing.taskInstances.find((task) => task.id === req.params.taskId);
    recordAuditEvent(req.userId, {
      module: 'services',
      entityType: 'service_task',
      entityId: `${service.id}:${req.params.taskId}`,
      entityLabel: updatedTask?.title || req.params.taskId,
      clientId: service.clientId,
      action: 'status_changed',
      detail: `Task status updated for ${service.displayName || service.serviceCode}`,
      changes: buildAuditChanges(previousTask || {}, updatedTask || {}, ['status']),
      metadata: {
        service_id: service.id,
        service_code: service.serviceCode,
      },
    });

    res.json({
      success: true,
      service: mapStoredService(service),
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/services/:serviceId', async (req, res, next) => {
  try {
    const existing = getServiceOrNull(req.params.serviceId, req.userId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    storage.services.delete(req.params.serviceId);
    recordAuditEvent(req.userId, {
      module: 'services',
      entityType: 'service',
      entityId: existing.id,
      entityLabel: existing.displayName || existing.serviceCode,
      clientId: existing.clientId,
      action: 'deleted',
      detail: 'Service deleted',
      changes: buildAuditChanges(existing, {}, SERVICE_AUDIT_FIELDS),
      metadata: {
        service_code: existing.serviceCode,
      },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/documents/:documentId', async (req, res, next) => {
  try {
    const document = storage.documents.get(req.params.documentId);

    if (!document || document.user_id !== req.userId) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    deleteDocumentRecord(req.params.documentId);
    recordAuditEvent(req.userId, {
      module: 'documents',
      entityType: 'document',
      entityId: document.id,
      entityLabel: document.file_name || document.document_type,
      clientId: document.client_id,
      action: 'deleted',
      detail: 'Client document deleted',
      metadata: {
        document_type: document.document_type,
        category: document.category,
      },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const client = getClientOrNull(req.params.id, req.userId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const declarations = store.getDeclarations(req.userId, {
      client: req.params.id,
    });

    const contacts = Array.from(storage.contacts.values()).filter((contact) => contact.client_id === req.params.id);

    res.json({
      ...client,
      total_claims: getClientClaimCount(client.id),
      validation: validateClient(client),
      cds_status: checkCDSStatus(client),
      declarations_count: declarations.length,
      contacts_count: contacts.length,
      declarations: declarations.slice(0, 10),
      contacts,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = getClientOrNull(req.params.id, req.userId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const client = normalizeClientRecord({ ...existing, ...req.body, id: req.params.id }, req.userId, existing);
    const validation = validateClient(client);

    storage.clients.set(client.id, client);
    recordAuditEvent(req.userId, {
      module: 'clients',
      entityType: 'client',
      entityId: client.id,
      entityLabel: client.name || client.company_name,
      clientId: client.id,
      action: 'updated',
      detail: 'Client updated',
      changes: buildAuditChanges(existing, client, Array.from(new Set([...CLIENT_AUDIT_FIELDS, ...Object.keys(req.body || {})]))),
    });

    res.json({
      success: true,
      client,
      validation,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const client = getClientOrNull(req.params.id, req.userId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const claims = Array.from(storage.claims?.values() || []).filter((claim) => claim.client_id === req.params.id);

    if (claims.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete client with ${claims.length} existing claims`,
      });
    }

    recordAuditEvent(req.userId, {
      module: 'clients',
      entityType: 'client',
      entityId: client.id,
      entityLabel: client.name || client.company_name,
      clientId: client.id,
      action: 'deleted',
      detail: 'Client deleted',
      changes: buildAuditChanges(client, {}, CLIENT_AUDIT_FIELDS),
    });

    storage.clients.delete(req.params.id);
    storage.onboarding.delete(req.params.id);
    Array.from(storage.services.entries())
      .filter(([, service]) => service.clientId === req.params.id && service.user_id === req.userId)
      .forEach(([serviceId]) => {
        storage.services.delete(serviceId);
      });

    Array.from(storage.documents.entries())
      .filter(([, document]) => document.client_id === req.params.id && document.user_id === req.userId)
      .forEach(([documentId]) => {
        storage.documents.delete(documentId);
      });
    Array.from(storage.reports.entries())
      .filter(([, report]) => report.client_id === req.params.id && report.user_id === req.userId)
      .forEach(([reportId]) => {
        storage.reports.delete(reportId);
      });
    Array.from(storage.clientRelationships.entries())
      .filter(([, relationship]) => {
        return (
          relationship.user_id === req.userId &&
          (relationship.company_client_id === req.params.id || relationship.party_client_id === req.params.id)
        );
      })
      .forEach(([relationshipId]) => {
        storage.clientRelationships.delete(relationshipId);
      });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/onboarding', async (req, res, next) => {
  try {
    const client = getClientOrNull(req.params.id, req.userId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    res.json(buildOnboardingSummary(client));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/services', async (req, res, next) => {
  try {
    const client = getClientOrNull(req.params.id, req.userId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const services = Array.from(storage.services.values())
      .filter((service) => service.clientId === req.params.id && service.user_id === req.userId)
      .sort((left, right) => Date.parse(right.updatedAt || right.createdAt || '') - Date.parse(left.updatedAt || left.createdAt || ''))
      .map(mapStoredService);

    res.json({ services });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/onboarding', async (req, res, next) => {
  try {
    const client = getClientOrNull(req.params.id, req.userId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const existing = storage.onboarding.get(req.params.id) || {};
    const nextState = {
      ...existing,
      ...(req.body?.status ? { status: req.body.status } : {}),
      ...(typeof req.body?.progress === 'number' ? { progress: req.body.progress } : {}),
      ...(Array.isArray(req.body?.missingFields) ? { missingFields: req.body.missingFields } : {}),
      updated_at: new Date().toISOString(),
    };

    storage.onboarding.set(req.params.id, nextState);
    res.json(buildOnboardingSummary(client));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/onboarding/recalculate', async (req, res, next) => {
  try {
    const client = getClientOrNull(req.params.id, req.userId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    storage.onboarding.delete(req.params.id);
    res.json(buildOnboardingSummary(client));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/onboarding/send-reminder', async (req, res, next) => {
  try {
    const client = getClientOrNull(req.params.id, req.userId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const companySettings = loadCompanySettings(req.tenantDb);
    const emailSettings = loadEmailSettings(companySettings);
    const validation = validateEmailSettings(emailSettings);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Email settings are incomplete',
        missing_fields: validation.missing,
      });
    }

    const recipient = String(
      client.primary_contact_email ||
      client.email ||
      client.alternative_email ||
      ''
    ).trim();

    if (!recipient) {
      return res.status(400).json({
        success: false,
        message: 'Client has no email address to send a reminder to',
      });
    }

    const summary = buildOnboardingSummary(client);
    const practiceName = companySettings.company_name || emailSettings.email_from_name || 'Your Practice';
    const senderName = [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ').trim() || req.user?.email || practiceName;
    const missingItems = summary.missingItems?.length
      ? summary.missingItems.map((item) => `<li>${item}</li>`).join('')
      : '<li>No outstanding items listed.</li>';
    const checklistText = summary.missingItems?.length
      ? summary.missingItems.map((item) => `- ${item}`).join('\n')
      : '- No outstanding items listed.';
    const clientName = summary.name || client.name || client.company_name || 'your record';
    const clientRef = client.client_ref ? ` (${client.client_ref})` : '';

    const subject = `${practiceName} onboarding reminder for ${clientName}${clientRef}`;
    const text = [
      `Hello,`,
      '',
      `This is a reminder from ${practiceName} that we still need the following onboarding items for ${clientName}${clientRef}:`,
      '',
      checklistText,
      '',
      `Current onboarding progress: ${summary.progress}%`,
      '',
      `If you have already sent these items, please let us know.`,
      '',
      `Regards,`,
      senderName,
      practiceName,
      companySettings.company_phone || '',
      companySettings.company_email || '',
    ].filter(Boolean).join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin: 0 0 16px;">Onboarding reminder for ${clientName}${clientRef}</h2>
        <p style="margin: 0 0 12px;">This is a reminder from <strong>${practiceName}</strong> that we still need the following onboarding items:</p>
        <ul style="margin: 0 0 16px 20px; padding: 0;">
          ${missingItems}
        </ul>
        <p style="margin: 0 0 12px;"><strong>Current onboarding progress:</strong> ${summary.progress}%</p>
        <p style="margin: 0 0 16px;">If you have already sent these items, please let us know.</p>
        <p style="margin: 0;">
          Regards,<br />
          ${senderName}<br />
          ${practiceName}
        </p>
      </div>
    `;

    const result = await sendEmail(emailSettings, {
      to: recipient,
      subject,
      text,
      html,
    });

    recordAuditEvent(req.userId, {
      module: 'onboarding',
      entityType: 'client',
      entityId: client.id,
      entityLabel: client.name || client.company_name,
      clientId: client.id,
      action: 'reminder_sent',
      detail: `Onboarding reminder sent to ${recipient}`,
      metadata: {
        recipient,
        message_id: result.messageId,
        progress: summary.progress,
        missing_items: summary.missingItems,
      },
    });

    res.json({
      success: true,
      recipient,
      message_id: result.messageId,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/documents/send-generated', async (req, res, next) => {
  try {
    const client = getClientOrNull(req.params.id, req.userId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const documentHtml = String(req.body?.html || '').trim();
    const templateName = String(req.body?.templateName || 'Generated Document').trim() || 'Generated Document';
    const category = String(req.body?.category || 'general').trim() || 'general';

    if (!documentHtml) {
      return res.status(400).json({
        success: false,
        message: 'Generated document content is required',
      });
    }

    const companySettings = loadCompanySettings(req.tenantDb);
    const emailSettings = loadEmailSettings(companySettings);
    const validation = validateEmailSettings(emailSettings);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Email settings are incomplete',
        missing_fields: validation.missing,
      });
    }

    const recipients = parseRecipientList(req.body?.recipients);
    const fallbackRecipient = String(
      client.primary_contact_email ||
      client.email ||
      client.alternative_email ||
      ''
    ).trim();
    const finalRecipients = recipients.length > 0 ? recipients : (fallbackRecipient ? [fallbackRecipient] : []);

    if (finalRecipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Client has no email address to send this document to',
      });
    }

    const practiceName = companySettings.company_name || emailSettings.email_from_name || 'Your Practice';
    const senderName = [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ').trim() || req.user?.email || practiceName;
    const clientName = String(client.name || client.company_name || 'client').trim();
    const clientRef = client.client_ref ? ` (${client.client_ref})` : '';
    const safeTemplateSlug = templateName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'generated-document';
    const attachmentName = `${safeTemplateSlug}-${new Date().toISOString().slice(0, 10)}.pdf`;
    const pdfBuffer = await renderHtmlToPdfBuffer(documentHtml, {
      baseUrl: process.env.FRONTEND_URL || 'http://localhost:3002',
    });
    const subject = `${practiceName} ${templateName} for ${clientName}${clientRef}`;
    const text = [
      `Hello,`,
      '',
      `Please find attached your ${templateName} for ${clientName}${clientRef}.`,
      '',
      `If you have any questions, please let us know.`,
      '',
      `Regards,`,
      senderName,
      practiceName,
      companySettings.company_phone || '',
      companySettings.company_email || '',
    ].filter(Boolean).join('\n');
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin: 0 0 16px;">${templateName}</h2>
        <p style="margin: 0 0 12px;">Please find attached your <strong>${templateName}</strong> for ${clientName}${clientRef}.</p>
        <p style="margin: 0 0 16px;">If you have any questions, please let us know.</p>
        <p style="margin: 0;">
          Regards,<br />
          ${senderName}<br />
          ${practiceName}
        </p>
      </div>
    `;

    const result = await sendEmail(emailSettings, {
      to: finalRecipients,
      subject,
      text,
      html,
      attachments: [
        {
          filename: attachmentName,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    recordAuditEvent(req.userId, {
      module: 'documents',
      entityType: 'client',
      entityId: client.id,
      entityLabel: clientName,
      clientId: client.id,
      action: 'document_emailed',
      detail: `${templateName} emailed to ${finalRecipients.join(', ')}`,
      metadata: {
        recipients: finalRecipients,
        message_id: result.messageId,
        template_name: templateName,
        category,
        attachment_name: attachmentName,
      },
    });

    res.json({
      success: true,
      recipients: finalRecipients,
      message_id: result.messageId,
      attachment_name: attachmentName,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/documents', async (req, res, next) => {
  try {
    const client = getClientOrNull(req.params.id, req.userId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const documents = Array.from(storage.documents.values())
      .filter((document) => document.client_id === req.params.id && document.user_id === req.userId)
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
      .map(mapStoredDocument);

    res.json({ documents });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/documents/upload', upload.single('file'), async (req, res, next) => {
  try {
    const client = getClientOrNull(req.params.id, req.userId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required',
      });
    }

    const { document } = createDocumentRecord({
      clientId: req.params.id,
      userId: req.userId,
      documentType: String(req.body?.documentType || req.body?.document_type || 'general'),
      category: String(req.body?.category || 'General'),
      file: req.file,
    });
    recordAuditEvent(req.userId, {
      module: 'documents',
      entityType: 'document',
      entityId: document.id,
      entityLabel: document.file_name || document.document_type,
      clientId: client.id,
      action: 'uploaded',
      detail: `Document uploaded for ${client.name || client.company_name}`,
      metadata: {
        document_type: document.document_type,
        category: document.category,
        file_name: document.file_name,
        version: 1,
      },
    });

    res.json({
      success: true,
      document: mapStoredDocument(document),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/sync-cds', async (req, res, next) => {
  try {
    const client = getClientOrNull(req.params.id, req.userId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    if (!client.eori) {
      return res.status(400).json({
        success: false,
        message: 'Client EORI required for CDS sync',
      });
    }

    const hmrcClient = new HMRCClient(req.userId);
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    const result = await hmrcClient.listDeclarations({
      eori: client.eori,
      from_date: fiveYearsAgo.toISOString().split('T')[0],
      to_date: new Date().toISOString().split('T')[0],
    });

    let savedCount = 0;
    for (const declaration of result.declarations || []) {
      const id = store.saveFromHMRC(req.userId, declaration);
      const savedDeclaration = storage.declarations.get(id);
      if (savedDeclaration) {
        savedDeclaration.client_id = client.id;
        savedDeclaration.client_name = client.company_name;
        savedCount += 1;
      }
    }

    const updatedClient = {
      ...client,
      total_claims: getClientClaimCount(client.id),
    };

    storage.clients.set(client.id, updatedClient);

    res.json({
      success: true,
      synced: savedCount,
      client: client.company_name,
      eori: client.eori,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/snapshot', async (req, res, next) => {
  try {
    const client = getClientOrNull(req.params.id, req.userId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const declarations = store.getDeclarations(req.userId, {
      client: req.params.id,
    });

    const claims = Array.from(storage.claims?.values() || []).filter((claim) => claim.client_id === req.params.id);
    const validation = validateClient(client);
    const cdsStatus = checkCDSStatus(client);

    const snapshot = {
      client_name: client.company_name,
      eori: client.eori,
      vat_number: client.vat_number,
      completeness: validation.completeness,
      missing_fields: validation.issues,
      bank_details_complete: Boolean(client.bank_account_number && client.bank_sort_code),
      cds_status: cdsStatus.status,
      cds_alert: cdsStatus.alert,
      agent_authority_days_remaining: cdsStatus.daysUntilExpiry,
      total_declarations: declarations.length,
      total_claims: claims.length,
      total_claimed: claims.reduce((sum, claim) => sum + (claim.total_claim_amount || 0), 0),
      total_paid: claims
        .filter((claim) => claim.status === 'paid')
        .reduce((sum, claim) => sum + (claim.paid_amount || 0), 0),
    };

    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/contacts', async (req, res, next) => {
  try {
    const client = getClientOrNull(req.params.id, req.userId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const contact = {
      id: uuidv4(),
      client_id: req.params.id,
      user_id: req.userId,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      role: req.body.role,
      address: req.body.address,
      notes: req.body.notes,
      created_at: new Date().toISOString(),
    };

    storage.contacts.set(contact.id, contact);

    res.json({
      success: true,
      contact,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
