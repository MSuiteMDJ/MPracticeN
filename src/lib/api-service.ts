/**
 * API Service Layer
 * Mock implementation until backend is ready
 */

import type { CDSDeclaration, CDSDeclarationFilter } from '@/types';
import type { C285Claim, C285ClaimFilter, C285ClaimListResponse } from '@/types';
import { IdentityErrors, isIdentityError, getIdentityErrorMessage } from './identity-errors';
import type { ManifestSummary, ImportBatch, ManifestDeclaration } from '@/types/manifest';
import type {
  OnboardingSummary,
  OnboardingClientEntry,
  ClientDocument as ClientDocumentDto,
  ClientDocumentVersion as ClientDocumentVersionDto,
  DocumentTemplate as DocumentTemplateDto,
} from '@/types/onboarding';

// In-memory storage (will be replaced with real API calls)
let declarations: CDSDeclaration[] = [];
let claims: C285Claim[] = [];

// Helper functions for data seeding
export function addClaim(claim: C285Claim): void {
  claims.push(claim);
}

// ============================================
// API REQUEST CONFIGURATION
// ============================================

/**
 * User context for API requests
 * This should be set by the auth system when user logs in
 */
interface UserContext {
  user_id: string;
  user_type: 'SELF' | 'AGENT';
  entity_id?: string; // For SELF users
  declarant_name: string;
  declarant_capacity: 'importer' | 'agent' | 'duty_representative' | 'employee_of_importer';
  declarant_organisation_name?: string;
}

let currentUserContext: UserContext | null = null;

/**
 * Set the current user context for API requests
 * This should be called after login with user information
 */
export function setUserContext(context: UserContext): void {
  currentUserContext = context;
}

/**
 * Get the current user context
 */
export function getUserContext(): UserContext | null {
  return currentUserContext;
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext(): void {
  currentUserContext = null;
}

/**
 * Handle API errors with identity validation support
 */
function handleAPIError(error: unknown): never {
  // Check if it's an identity validation error
  if (isIdentityError(error)) {
    throw new Error(getIdentityErrorMessage(error.code));
  }

  // Handle standard errors
  if (error instanceof Error) {
    throw error;
  }

  throw new Error('An unexpected error occurred');
}

const CDS_API_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CDS_API_URL) ||
  'http://localhost:3003';

async function cdsRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = options.headers
    ? { ...(options.headers as Record<string, string>) }
    : {};

  if (!isFormData) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }
  headers['Accept'] = 'application/json';
  if (typeof window !== 'undefined') {
    const authToken = window.localStorage.getItem('auth_token');
    if (authToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
  }
  if (currentUserContext) {
    headers['x-user-id'] = currentUserContext.user_id;
  }

  const response = await fetch(`${CDS_API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });

  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      const parsed = JSON.parse(raw);
      message = parsed?.message || parsed?.error || raw;
    } catch {
      // leave raw text as-is
    }
    throw new Error(message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

async function cdsBlobRequest(path: string, options: RequestInit = {}): Promise<Blob> {
  const headers: Record<string, string> = options.headers
    ? { ...(options.headers as Record<string, string>) }
    : {};

  if (typeof window !== 'undefined') {
    const authToken = window.localStorage.getItem('auth_token');
    if (authToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
  }
  if (currentUserContext) {
    headers['x-user-id'] = currentUserContext.user_id;
  }

  const response = await fetch(`${CDS_API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });

  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      const parsed = JSON.parse(raw);
      message = parsed?.message || parsed?.error || raw;
    } catch {
      // leave raw text as-is
    }
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.blob();
}

export interface CompaniesHouseSearchResult {
  companyNumber: string;
  companyName: string;
  companyStatus: string;
  companyType: string;
  dateOfCreation: string;
  addressSnippet: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  fullAddress: string;
}

export interface CompaniesHouseProfileAddress {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  fullAddress: string;
}

export interface CompaniesHouseCompanyProfile {
  companyNumber: string;
  companyName: string;
  companyStatus: string;
  companyType: string;
  sicCodes: string[];
  dateOfCreation: string;
  jurisdiction: string;
  accounts: Record<string, unknown> | null;
  confirmationStatement: Record<string, unknown> | null;
  hasCharges: boolean;
  canFile: boolean;
  hasInsolvencyHistory: boolean;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  fullAddress: string;
}

export interface CompaniesHouseOfficer {
  name: string;
  displayName: string;
  role: string;
  status: 'active' | 'resigned';
  dateOfBirth: string;
  appointedOn: string;
  resignedOn: string;
  nationality: string;
  countryOfResidence: string;
  occupation: string;
  identityVerificationDueFrom: string;
  identityVerificationDueBy: string;
  address: CompaniesHouseProfileAddress;
}

export interface RelatedClientCreatePayload {
  name: string;
  address?: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
  country?: string;
  date_of_birth?: string;
  party_roles?: string[];
  party_status?: 'current' | 'former';
}

export interface ClientDataTransferRecord extends Record<string, unknown> {
  type?: string;
  name?: string;
  client_ref?: string;
}

export interface ClientRelationshipTransferRecord {
  company_client_ref: string;
  party_client_ref: string;
  party_roles?: string[];
  party_status?: 'current' | 'former';
}

export interface ClientDataExportPayload {
  version: number;
  exported_at: string;
  clients: ClientDataTransferRecord[];
  relationships?: ClientRelationshipTransferRecord[];
}

export interface ClientDataImportResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  relationship_links: number;
  errors: string[];
}

export interface AuditEventRecord {
  id: string;
  actor?: string;
  module: string;
  entity_type: string;
  entity_id: string;
  entity_label?: string;
  client_id?: string;
  action: string;
  detail?: string;
  changes: Array<{
    field: string;
    from: string;
    to: string;
  }>;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CompaniesHousePsc {
  name: string;
  displayName: string;
  status: 'active' | 'ceased';
  kind: string;
  dateOfBirth: string;
  notifiedOn: string;
  ceasedOn: string;
  nationality: string;
  countryOfResidence: string;
  natureOfControl: string[];
  identityVerificationDueFrom: string;
  identityVerificationDueBy: string;
  address: CompaniesHouseProfileAddress;
}

export interface CompaniesHouseFilingHistoryItem {
  transactionId: string;
  date: string;
  category: string;
  type: string;
  description: string;
  pages: number;
  actionDate: string;
  metadataUrl: string;
  filingUrl: string;
}

export interface CompaniesHouseProfileResponse {
  success: boolean;
  profile: {
    company: CompaniesHouseCompanyProfile;
    compliance: {
      accounts: Record<string, unknown> | null;
      confirmationStatement: Record<string, unknown> | null;
    };
    officers: {
      total: number;
      active: number;
      resigned: number;
      items: CompaniesHouseOfficer[];
    };
    psc: {
      total: number;
      active: number;
      ceased: number;
      items: CompaniesHousePsc[];
    };
    charges: {
      total: number;
      satisfiedCount: number;
      partSatisfiedCount: number;
      items: Record<string, unknown>[];
    };
    filingHistory: {
      selectedCategory: string;
      total: number;
      startIndex: number;
      itemsPerPage: number;
      items: CompaniesHouseFilingHistoryItem[];
    };
  };
}

export const companiesHouseAPI = {
  async searchCompanies(query: string, itemsPerPage = 20): Promise<{
    success: boolean;
    query: string;
    totalResults: number;
    itemsPerPage: number;
    results: CompaniesHouseSearchResult[];
  }> {
    const params = new URLSearchParams({
      q: query,
      items_per_page: String(itemsPerPage),
    });
    return cdsRequest(`/companies-house/search?${params.toString()}`);
  },

  async getCompanyProfile(
    companyNumber: string,
    options: { category?: string; itemsPerPage?: number } = {}
  ): Promise<CompaniesHouseProfileResponse> {
    const safeNumber = String(companyNumber || '').trim();
    if (!safeNumber) {
      throw new Error('Company number is required.');
    }

    const params = new URLSearchParams();
    if (options.category) params.set('category', options.category);
    if (options.itemsPerPage) params.set('items_per_page', String(options.itemsPerPage));

    const qs = params.toString();
    return cdsRequest(
      `/companies-house/company/${encodeURIComponent(safeNumber)}/profile${qs ? `?${qs}` : ''}`
    );
  },
};

/**
 * CDS Declaration API
 */
export const cdsAPI = {
  async importDeclarations(files: { header: File; items?: File; tax?: File }) {
    const formData = new FormData();
    formData.append('header', files.header);
    if (files.items) formData.append('items', files.items);
    if (files.tax) formData.append('tax', files.tax);

    const response = await fetch(`${CDS_API_BASE}/cds/import`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Upload failed');
    }
    return response.json();
  },

  async getDeclarations(filter?: CDSDeclarationFilter & Record<string, any>) {
    const params = new URLSearchParams();
    if (filter?.mrn) params.set('mrn', filter.mrn);
    if (filter?.client) params.set('client', filter.client);
    if (filter?.status && typeof filter.status === 'string') params.set('status', filter.status);
    if (filter?.batchId) params.set('batchId', filter.batchId);
    if (typeof filter?.hasIssues === 'boolean') params.set('hasIssues', String(filter.hasIssues));
    if (filter?.startDate) params.set('startDate', filter.startDate);
    if (filter?.endDate) params.set('endDate', filter.endDate);
    const qs = params.toString();
    return cdsRequest<{ declarations: ManifestDeclaration[] }>(
      `/cds/declarations${qs ? `?${qs}` : ''}`
    );
  },

  async getDeclaration(id: string): Promise<CDSDeclaration> {
    return cdsRequest<CDSDeclaration>(`/cds/declarations/${id}`);
  },

  async deleteDeclaration(id: string) {
    return cdsRequest<{ success: boolean }>(`/cds/declarations/${id}`, {
      method: 'DELETE',
    });
  },

  async assignClient(id: string, payload: { clientId: string; clientName: string }) {
    return cdsRequest(`/cds/declarations/${id}/assign-client`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getStats(): Promise<ManifestSummary> {
    return cdsRequest<ManifestSummary>('/cds/manifest/summary');
  },

  async getBatches(): Promise<{ batches: ImportBatch[] }> {
    return cdsRequest('/cds/batches');
  },
};

export const onboardingAPI = {
  async getClients(): Promise<{ clients: OnboardingClientEntry[] }> {
    if (shouldUseBackendForPracticeClients()) {
      await syncLocalPracticeClientsToBackend();
      return cdsRequest<{ clients: OnboardingClientEntry[] }>('/clients/onboarding/summary');
    }

    if (!currentUserContext) {
      throw new Error('User context not set. Please log in again.');
    }

    const response = await contactsAPI.getContacts({
      type: ['business', 'individual'],
      sort_by: 'name',
      sort_order: 'asc',
      limit: 5000,
    });

    const onboardingClients: OnboardingClientEntry[] = response.contacts.map((contact) => {
      const hasVat = !!contact.vat_number;
      const hasAddress = !!(contact.address && contact.city && contact.postcode);
      const completedItems = [true, true, hasVat, hasAddress];
      const progress = Math.round((completedItems.filter(Boolean).length / completedItems.length) * 100);

      let status: OnboardingClientEntry['status'];
      if (progress < 30) status = 'not_started';
      else if (progress < 60) status = 'info_submitted';
      else if (progress < 80) status = 'documents_pending';
      else if (progress < 100) status = 'verification_required';
      else if (progress === 100 && !contact.total_claims) status = 'ready_for_services';
      else status = 'live';

      const missingItems: string[] = [];
      if (!hasVat) missingItems.push('VAT Number');
      if (!hasAddress) missingItems.push('Complete Address');

      return {
        clientId: contact.id,
        clientRef: contact.client_ref,
        name: contact.name,
        contact: contact.contact_person || contact.email,
        eori: contact.eori,
        vat: contact.vat_number,
        status,
        progress,
        missingItems,
        missingKeys: [],
        checklist: [],
      };
    });

    return { clients: onboardingClients.filter((client) => client.status !== 'live') };
  },
  async getClientSummary(clientId: string): Promise<OnboardingSummary> {
    return cdsRequest(`/clients/${clientId}/onboarding`);
  },
  async updateClientSummary(
    clientId: string,
    payload: Partial<Pick<OnboardingSummary, 'status' | 'progress'> & { missingFields: string[] }>
  ) {
    return cdsRequest(`/clients/${clientId}/onboarding`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async recalculate(clientId: string) {
    return cdsRequest(`/clients/${clientId}/onboarding/recalculate`, { method: 'POST' });
  },
  async sendReminder(clientId: string): Promise<{ success: boolean; recipient: string; message_id: string }> {
    return cdsRequest(`/clients/${clientId}/onboarding/send-reminder`, { method: 'POST' });
  },
  async listDocuments(clientId: string): Promise<{ documents: ClientDocumentDto[] }> {
    return cdsRequest(`/clients/${clientId}/documents`);
  },
  async listDocumentVersions(documentId: string): Promise<{ versions: ClientDocumentVersionDto[] }> {
    return cdsRequest(`/documents/${documentId}/versions`);
  },
  async uploadDocument(
    clientId: string,
    payload: { file: File; documentType: string; category?: string }
  ) {
    const form = new FormData();
    form.append('file', payload.file);
    form.append('documentType', payload.documentType);
    if (payload.category) form.append('category', payload.category);
    return fetch(`${CDS_API_BASE}/clients/${clientId}/documents/upload`, {
      method: 'POST',
      body: form,
      headers:
        typeof window !== 'undefined' && window.localStorage.getItem('auth_token')
          ? {
              Authorization: `Bearer ${window.localStorage.getItem('auth_token')}`,
            }
          : undefined,
    }).then((r) => r.json());
  },
  async uploadDocumentVersion(
    documentId: string,
    payload: { file: File; documentType?: string; category?: string }
  ) {
    const form = new FormData();
    form.append('file', payload.file);
    if (payload.documentType) form.append('documentType', payload.documentType);
    if (payload.category) form.append('category', payload.category);
    return fetch(`${CDS_API_BASE}/documents/${documentId}/versions`, {
      method: 'POST',
      body: form,
      headers:
        typeof window !== 'undefined' && window.localStorage.getItem('auth_token')
          ? {
              Authorization: `Bearer ${window.localStorage.getItem('auth_token')}`,
            }
          : undefined,
    }).then((r) => r.json());
  },
  async deleteDocument(documentId: string) {
    return cdsRequest(`/clients/documents/${documentId}`, { method: 'DELETE' });
  },
  async listTemplates(): Promise<{ templates: DocumentTemplateDto[] }> {
    return cdsRequest('/document-templates');
  },
  async createTemplate(payload: {
    name: string;
    category?: string;
    content: string;
    placeholders?: string[];
  }) {
    return cdsRequest('/document-templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async updateTemplate(templateId: string, payload: Partial<DocumentTemplateDto>) {
    return cdsRequest(`/document-templates/${templateId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  async deleteTemplate(templateId: string) {
    return cdsRequest(`/document-templates/${templateId}`, { method: 'DELETE' });
  },
};

export interface PracticeDocumentRecord {
  document_id: string;
  client_id: string;
  document_type: string;
  category?: string;
  version: number;
  version_count?: number;
  current_version_id?: string;
  file_path: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
  updated_at?: string;
  is_archived?: boolean;
}

export interface PracticeDocumentVersionRecord {
  version_id: string;
  document_id: string;
  client_id: string;
  version: number;
  file_path: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
  updated_at?: string;
}

export interface PracticeReportRecord {
  report_id: string;
  client_id: string;
  title: string;
  report_type: string;
  template_file?: string;
  format: string;
  generated_at: string;
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

export const documentsAPI = {
  async listDocuments(filter?: {
    clientId?: string;
    category?: string;
    search?: string;
    includeArchived?: boolean;
  }): Promise<{ documents: PracticeDocumentRecord[] }> {
    const params = new URLSearchParams();
    if (filter?.clientId) params.set('clientId', filter.clientId);
    if (filter?.category) params.set('category', filter.category);
    if (filter?.search) params.set('search', filter.search);
    if (typeof filter?.includeArchived === 'boolean') {
      params.set('includeArchived', String(filter.includeArchived));
    }
    const query = params.toString();
    return cdsRequest(`/documents${query ? `?${query}` : ''}`);
  },
  async getStats(filter?: { clientId?: string }) {
    const params = new URLSearchParams();
    if (filter?.clientId) params.set('clientId', filter.clientId);
    const query = params.toString();
    return cdsRequest(`/documents/stats${query ? `?${query}` : ''}`);
  },
  async uploadDocument(payload: {
    clientId: string;
    file: File;
    documentType: string;
    category?: string;
  }) {
    const form = new FormData();
    form.append('clientId', payload.clientId);
    form.append('file', payload.file);
    form.append('documentType', payload.documentType);
    if (payload.category) form.append('category', payload.category);
    return cdsRequest('/documents/upload', {
      method: 'POST',
      body: form,
    });
  },
  async previewDocument(documentId: string): Promise<Blob> {
    return cdsBlobRequest(`/documents/${documentId}/preview`);
  },
  async listDocumentVersions(documentId: string): Promise<{ versions: PracticeDocumentVersionRecord[] }> {
    return cdsRequest(`/documents/${documentId}/versions`);
  },
  async uploadDocumentVersion(documentId: string, payload: { file: File; documentType?: string; category?: string }) {
    const form = new FormData();
    form.append('file', payload.file);
    if (payload.documentType) form.append('documentType', payload.documentType);
    if (payload.category) form.append('category', payload.category);
    return cdsRequest(`/documents/${documentId}/versions`, {
      method: 'POST',
      body: form,
    });
  },
  async downloadDocument(documentId: string): Promise<Blob> {
    return cdsBlobRequest(`/documents/${documentId}/download`);
  },
  async archiveDocument(documentId: string) {
    return cdsRequest(`/documents/${documentId}/archive`, { method: 'POST' });
  },
  async restoreDocument(documentId: string) {
    return cdsRequest(`/documents/${documentId}/restore`, { method: 'POST' });
  },
  async deleteDocument(documentId: string) {
    return cdsRequest(`/documents/${documentId}`, { method: 'DELETE' });
  },
  async emailGeneratedDocument(payload: {
    clientId: string;
    html: string;
    templateName: string;
    category?: string;
    recipients?: string[];
  }): Promise<{ success: boolean; recipients: string[]; message_id: string; attachment_name: string }> {
    return cdsRequest(`/clients/${payload.clientId}/documents/send-generated`, {
      method: 'POST',
      body: JSON.stringify({
        html: payload.html,
        templateName: payload.templateName,
        category: payload.category,
        recipients: payload.recipients,
      }),
    });
  },
};

export const reportsAPI = {
  async listReports(filter?: { clientId?: string; reportType?: string }): Promise<{ reports: PracticeReportRecord[] }> {
    const params = new URLSearchParams();
    if (filter?.clientId) params.set('clientId', filter.clientId);
    if (filter?.reportType) params.set('reportType', filter.reportType);
    const query = params.toString();
    return cdsRequest(`/reports${query ? `?${query}` : ''}`);
  },
  async getStats(filter?: { clientId?: string }) {
    const params = new URLSearchParams();
    if (filter?.clientId) params.set('clientId', filter.clientId);
    const query = params.toString();
    return cdsRequest(`/reports/stats${query ? `?${query}` : ''}`);
  },
  async createClientReport(payload: {
    clientId: string;
    title: string;
    reportType: string;
    templateFile?: string;
    html: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; report: PracticeReportRecord }> {
    return cdsRequest(`/reports/client/${payload.clientId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async previewReport(reportId: string): Promise<Blob> {
    return cdsBlobRequest(`/reports/${reportId}/preview`);
  },
  async downloadReport(reportId: string): Promise<Blob> {
    return cdsBlobRequest(`/reports/${reportId}/download`);
  },
  async deleteReport(reportId: string) {
    return cdsRequest(`/reports/${reportId}`, { method: 'DELETE' });
  },
};

/**
 * C285 Claims API
 */
export const claimsAPI = {
  /**
   * Get all claims with filtering
   */
  async getClaims(filter?: C285ClaimFilter): Promise<C285ClaimListResponse> {
    await delay(300);

    // Validate user context
    if (!currentUserContext) {
      throw new Error('User context not set. Please log in again.');
    }

    const userId = currentUserContext.user_id;

    // Filter claims by current user
    const userClaims = claims.filter((c) => (c as any).created_by === userId);
    let filtered = [...userClaims];

    // Apply filters
    if (filter) {
      if (filter.mrn) {
        filtered = filtered.filter((c) => c.mrn?.includes(filter.mrn!));
      }
      if (filter.trader_eori) {
        filtered = filtered.filter((c) => c.trader_eori === filter.trader_eori);
      }
      if (filter.status) {
        filtered = filtered.filter((c) => filter.status!.includes(c.status));
      }
      if (filter.reason) {
        filtered = filtered.filter((c) => filter.reason!.includes(c.reason));
      }
      if (filter.min_amount) {
        filtered = filtered.filter((c) => c.total_claim_amount >= filter.min_amount!);
      }
      if (filter.max_amount) {
        filtered = filtered.filter((c) => c.total_claim_amount <= filter.max_amount!);
      }
    }

    // Sort
    if (filter?.sort_by) {
      filtered.sort((a, b) => {
        const aVal = a[filter.sort_by as keyof C285Claim] as string | number | undefined;
        const bVal = b[filter.sort_by as keyof C285Claim] as string | number | undefined;
        const order = filter.sort_order === 'desc' ? -1 : 1;
        if (aVal === undefined || bVal === undefined) return 0;
        return aVal > bVal ? order : -order;
      });
    }

    // Paginate
    const limit = filter?.limit || 50;
    const offset = filter?.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);

    const total_value = filtered.reduce((sum, c) => sum + c.total_claim_amount, 0);
    const pending_value = filtered
      .filter((c) => c.status === 'submitted' || c.status === 'under_review')
      .reduce((sum, c) => sum + c.total_claim_amount, 0);
    const approved_value = filtered
      .filter((c) => c.status === 'approved' || c.status === 'paid')
      .reduce((sum, c) => sum + c.total_claim_amount, 0);

    return {
      claims: paginated,
      total_count: filtered.length,
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
      has_more: offset + limit < filtered.length,
      summary: {
        total_value,
        pending_value,
        approved_value,
      },
    };
  },

  /**
   * Get single claim by ID
   */
  async getClaim(id: string): Promise<C285Claim | null> {
    await delay(200);
    return claims.find((c) => c.id === id) || null;
  },

  /**
   * Create new claim
   */
  async createClaim(
    claim: Omit<C285Claim, 'id' | 'created_at' | 'updated_at'>
  ): Promise<C285Claim> {
    await delay(300);

    try {
      // Validate user context exists
      if (!currentUserContext) {
        throw new Error('User context not set. Please log in again.');
      }

      // Validate identity based on user type
      if (currentUserContext.user_type === 'SELF') {
        // SELF users can only submit for their own entity
        if (!currentUserContext.entity_id) {
          throw new Error('Entity ID not configured. Please complete your profile in Settings.');
        }

        if (claim.claimant_id !== currentUserContext.entity_id) {
          throw IdentityErrors.SELF_CLAIMANT_MISMATCH;
        }

        if (claim.claimant_type !== 'self_entity') {
          throw IdentityErrors.SELF_CLAIMANT_MISMATCH;
        }
      } else if (currentUserContext.user_type === 'AGENT') {
        // AGENT users must select a contact
        if (!claim.claimant_id) {
          throw IdentityErrors.AGENT_NO_CONTACT_SELECTED;
        }

        if (claim.claimant_type !== 'contact') {
          throw new Error('Agent users must submit claims for contacts');
        }
      }

      // Inject declarant information from user context
      // Strip any declarant fields from the payload and replace with user context
      const claimWithDeclarant: C285Claim = {
        ...claim,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),

        // Inject declarant info from user context (cannot be overridden)
        declarant_id: currentUserContext.user_id,
        declarant_name: currentUserContext.declarant_name,
        declarant_capacity: currentUserContext.declarant_capacity,

        // Ensure identity fields are set
        identity_source: 'SETTINGS',
        identity_locked_at: new Date().toISOString(),
      };

      claims.push(claimWithDeclarant);
      return claimWithDeclarant;
    } catch (error) {
      handleAPIError(error);
    }
  },

  /**
   * Update claim
   */
  async updateClaim(id: string, updates: Partial<C285Claim>): Promise<C285Claim | null> {
    await delay(300);

    const index = claims.findIndex((c) => c.id === id);
    if (index === -1) return null;

    claims[index] = {
      ...claims[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return claims[index];
  },

  /**
   * Delete claim
   */
  async deleteClaim(id: string): Promise<{ success: boolean }> {
    await delay(200);
    const index = claims.findIndex((c) => c.id === id);
    if (index !== -1) {
      claims.splice(index, 1);
      return { success: true };
    }
    return { success: false };
  },

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    by_status: Record<string, number>;
    by_reason: Record<string, number>;
    total_claimed: number;
    total_approved: number;
  }> {
    await delay(200);

    // Validate user context
    if (!currentUserContext) {
      throw new Error('User context not set. Please log in again.');
    }

    const userId = currentUserContext.user_id;

    // Filter claims by current user
    const userClaims = claims.filter((c) => (c as any).created_by === userId);

    const by_status: Record<string, number> = {};
    const by_reason: Record<string, number> = {};
    let total_claimed = 0;
    let total_approved = 0;

    userClaims.forEach((c) => {
      by_status[c.status] = (by_status[c.status] || 0) + 1;
      by_reason[c.reason] = (by_reason[c.reason] || 0) + 1;
      total_claimed += c.total_claim_amount || 0;
      if (c.status === 'approved' || c.status === 'paid') {
        total_approved += c.total_claim_amount || 0;
      }
    });

    return {
      total: userClaims.length,
      by_status,
      by_reason,
      total_claimed,
      total_approved,
    };
  },
};

/**
 * Utility function to simulate API delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clear all data (for testing)
 */
export function clearAllData(): void {
  declarations = [];
  claims = [];
}

/**
 * Get data counts (for debugging)
 */
export function getDataCounts(): { declarations: number; claims: number } {
  return {
    declarations: declarations.length,
    claims: claims.length,
  };
}

/**
 * Refund Analysis API
 */
export const analysisAPI = {
  /**
   * Analyze declarations for overpayments
   */
  async analyzeDeclarations(declaration_ids?: string[]): Promise<{
    success: boolean;
    analyzed: number;
    claims_generated: number;
  }> {
    await delay(1000);

    // This will be implemented with the refund calculator
    // For now, return mock response
    return {
      success: true,
      analyzed: declaration_ids?.length || declarations.length,
      claims_generated: 0,
    };
  },
};

/**
 * Contact API
 */
import type { Contact, ContactFilter, ContactListResponse } from '@/types';
import { getDefaultPortfolio, getPortfolios } from './portfolio-model';

export type ContactUpdateSection = 'identity' | 'engagement' | 'aml' | 'tax' | 'ops';

// In-memory storage for contacts with localStorage persistence
const CONTACTS_STORAGE_KEY = 'practice_contacts';
const CLIENT_REF_PATTERN = /^(\d+)([A-Z])(\d{3})([A-Z]*)$/;
const CLIENT_REF_COUNTER_WIDTH = 3;

function isClientReferenceType(type: Contact['type'] | undefined): boolean {
  return type === 'business' || type === 'individual';
}

function hasClientReference(contact: Partial<Contact>): boolean {
  return typeof contact.client_ref === 'string' && contact.client_ref.trim().length > 0;
}

function firstAlphanumericInitial(value: string): string | null {
  const match = String(value || '')
    .toUpperCase()
    .match(/[A-Z0-9]/);
  return match?.[0] ?? null;
}

function deriveClientReferenceInitial(contact: {
  name: string;
  type?: Contact['type'];
}): string {
  const normalizedName = String(contact.name || '').trim();

  if (contact.type === 'individual') {
    const tokens = normalizedName.split(/\s+/).filter(Boolean);
    const surname = tokens[tokens.length - 1] || normalizedName;
    return firstAlphanumericInitial(surname) || firstAlphanumericInitial(normalizedName) || 'X';
  }

  return firstAlphanumericInitial(normalizedName) || 'X';
}

function parseClientReference(clientRef: string): {
  portfolioCode: number;
  initial: string;
  index: number;
  suffix: string;
} | null {
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

function getNextClientReferenceIndex(
  existingContacts: Contact[],
  portfolioCode: number,
  initial: string,
  createdBy?: string
): number {
  let maxIndex = 0;

  existingContacts.forEach((contact) => {
    if (createdBy && contact.created_by !== createdBy) return;
    if (!hasClientReference(contact)) return;

    const parsed = parseClientReference(contact.client_ref as string);
    if (!parsed || parsed.suffix) return;
    if (parsed.portfolioCode !== portfolioCode || parsed.initial !== initial) return;

    if (parsed.index > maxIndex) {
      maxIndex = parsed.index;
    }
  });

  return maxIndex + 1;
}

function generateClientReference(
  input: Partial<Contact>,
  existingContacts: Contact[],
  createdBy?: string
): string | undefined {
  if (!isClientReferenceType(input.type)) return undefined;

  const snapshot = resolvePortfolioSnapshot(input);
  const initial = deriveClientReferenceInitial({
    name: input.name || '',
    type: input.type,
  });
  const nextIndex = getNextClientReferenceIndex(
    existingContacts,
    snapshot.portfolio_code ?? 1,
    initial,
    createdBy
  );

  return `${snapshot.portfolio_code}${initial}${String(nextIndex).padStart(CLIENT_REF_COUNTER_WIDTH, '0')}`;
}

function resolvePortfolioSnapshot(input: Partial<Contact>): Pick<Contact, 'portfolio_id' | 'portfolio_code' | 'portfolio_name'> {
  const portfolios = getPortfolios();
  const byId = input.portfolio_id
    ? portfolios.find((portfolio) => portfolio.id === input.portfolio_id)
    : undefined;
  const byCode =
    byId || (typeof input.portfolio_code === 'number'
      ? portfolios.find((portfolio) => portfolio.code === input.portfolio_code)
      : undefined);
  const fallback = byCode || byId || getDefaultPortfolio();

  return {
    portfolio_id: fallback.id,
    portfolio_code: fallback.code,
    portfolio_name: fallback.name,
  };
}

// Load contacts from localStorage on initialization
const loadContactsFromStorage = (): Contact[] => {
  try {
    const stored = localStorage.getItem(CONTACTS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as Contact[];
    if (!Array.isArray(parsed)) return [];
    let changed = false;
    const hydrated = parsed.map((contact) => {
      if (!contact || typeof contact !== 'object') return contact;
      if (
        contact.portfolio_id &&
        typeof contact.portfolio_code === 'number' &&
        contact.portfolio_name
      ) {
        return contact;
      }
      changed = true;
      return {
        ...contact,
        ...resolvePortfolioSnapshot(contact),
      };
    });

    hydrated
      .map((contact, index) => ({ contact, index }))
      .filter(
        ({ contact }) =>
          Boolean(contact && typeof contact === 'object') &&
          isClientReferenceType((contact as Contact).type) &&
          !hasClientReference(contact as Contact)
      )
      .sort((a, b) => {
        const aMs = Date.parse(String((a.contact as Contact).created_at || ''));
        const bMs = Date.parse(String((b.contact as Contact).created_at || ''));
        const aSafe = Number.isFinite(aMs) ? aMs : a.index;
        const bSafe = Number.isFinite(bMs) ? bMs : b.index;
        return aSafe - bSafe;
      })
      .forEach(({ index }) => {
        const nextContact = hydrated[index] as Contact;
        const generated = generateClientReference(nextContact, hydrated as Contact[]);
        if (!generated) return;
        hydrated[index] = {
          ...nextContact,
          client_ref: generated,
        };
        changed = true;
      });

    if (changed) {
      localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(hydrated));
    }
    return hydrated;
  } catch (error) {
    console.error('Failed to load contacts from storage:', error);
    return [];
  }
};

// Save contacts to localStorage
const saveContactsToStorage = (contactsToSave: Contact[]) => {
  try {
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contactsToSave));
  } catch (error) {
    console.error('Failed to save contacts to storage:', error);
  }
};

const contacts: Contact[] = loadContactsFromStorage();

// Helper function for data seeding
export function addContact(contact: Contact): void {
  const withPortfolio = {
    ...contact,
    ...resolvePortfolioSnapshot(contact),
  };
  const withReference =
    isClientReferenceType(withPortfolio.type) && !hasClientReference(withPortfolio)
      ? {
          ...withPortfolio,
          client_ref: generateClientReference(withPortfolio, contacts) || withPortfolio.client_ref,
        }
      : withPortfolio;

  contacts.push(withReference);
  saveContactsToStorage(contacts);
}

function isDemoModeActive(): boolean {
  return typeof window !== 'undefined' && window.localStorage.getItem('demo_mode') === 'true';
}

function shouldUseBackendForPracticeClients(): boolean {
  if (isDemoModeActive()) return false;
  if (typeof window === 'undefined') return false;
  return Boolean(window.localStorage.getItem('auth_token'));
}

function isPracticeClientType(type: Contact['type'] | undefined): boolean {
  return type === 'business' || type === 'individual';
}

type BackendClientRecord = Record<string, any>;

function formatIndividualDisplayName(rawName: string): string {
  const normalized = String(rawName || '').trim();
  if (!normalized || !normalized.includes(',')) return normalized;

  const commaIndex = normalized.indexOf(',');
  const lastName = normalized.slice(0, commaIndex).trim();
  const givenNames = normalized.slice(commaIndex + 1).trim();

  return [givenNames, lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function mapBackendClientToContact(client: BackendClientRecord): Contact {
  const address = String(client.address || client.address_line1 || '').trim();
  const addressLine2 = String(client.address_line_2 || client.address_line2 || '').trim();
  const email = String(client.email || client.primary_contact_email || '').trim();
  const phone = String(client.phone || client.primary_contact_phone || '').trim();
  const contactPerson = String(client.contact_person || client.primary_contact_name || '').trim();
  const type = client.type === 'individual' ? 'individual' : 'business';
  const rawName = String(client.name || client.company_name || '').trim();

  return {
    ...client,
    id: String(client.id),
    type,
    name: type === 'individual' ? formatIndividualDisplayName(rawName) : rawName,
    contact_person: contactPerson || undefined,
    portfolio_id: client.portfolio_id || 'portfolio-default',
    portfolio_code: Number.isFinite(client.portfolio_code) ? client.portfolio_code : 1,
    portfolio_name: client.portfolio_name || 'Main',
    client_ref: client.client_ref || undefined,
    related_to_client_id: client.related_to_client_id || undefined,
    related_to_client_ref: client.related_to_client_ref || undefined,
    related_to_client_name: client.related_to_client_name || undefined,
    party_roles: Array.isArray(client.party_roles) ? client.party_roles : undefined,
    party_status: client.party_status || undefined,
    email,
    phone,
    address,
    address_line_2: addressLine2 || undefined,
    city: client.city || undefined,
    postcode: client.postcode || undefined,
    country: client.country || undefined,
    eori: client.eori || undefined,
    vat_number: client.vat_number || undefined,
    company_number: client.company_number || undefined,
    legal_entity_type: client.legal_entity_type || undefined,
    registered_address_line_1: client.registered_address_line_1 || undefined,
    registered_address_line_2: client.registered_address_line_2 || undefined,
    registered_city: client.registered_city || undefined,
    registered_postcode: client.registered_postcode || undefined,
    registered_country: client.registered_country || undefined,
    company_country_of_establishment: client.company_country_of_establishment || undefined,
    date_of_birth: client.date_of_birth || undefined,
    national_id_passport: client.national_id_passport || undefined,
    preferred_contact_method: client.preferred_contact_method || undefined,
    alternative_email: client.alternative_email || undefined,
    has_deferment_account: client.has_deferment_account,
    deferment_account_number: client.deferment_account_number || undefined,
    bank_account_name: client.bank_account_name || undefined,
    bank_account_number: client.bank_account_number || undefined,
    bank_sort_code: client.bank_sort_code || undefined,
    bank_iban: client.bank_iban || undefined,
    bank_swift: client.bank_swift || undefined,
    allows_agent_refund: client.allows_agent_refund,
    authority_signed: client.authority_signed,
    authority_date: client.authority_date || undefined,
    authority_document_id: client.authority_document_id || undefined,
    engagement_letter_sent_date: client.engagement_letter_sent_date || undefined,
    engagement_letter_signed_date: client.engagement_letter_signed_date || undefined,
    engagement_type: client.engagement_type || undefined,
    acting_as_agent: client.acting_as_agent,
    hmrc_agent_authorised: client.hmrc_agent_authorised,
    hmrc_agent_reference: client.hmrc_agent_reference || undefined,
    government_gateway_username: client.government_gateway_username || undefined,
    government_gateway_password: client.government_gateway_password || undefined,
    auth_code_delivery_contact: client.auth_code_delivery_contact || undefined,
    companies_house_auth_code: client.companies_house_auth_code || undefined,
    directors_ch_verification_no: client.directors_ch_verification_no || undefined,
    professional_clearance_received: client.professional_clearance_received,
    previous_accountant: client.previous_accountant || undefined,
    take_on_completed: client.take_on_completed,
    aml_risk_rating: client.aml_risk_rating || undefined,
    aml_review_date: client.aml_review_date || undefined,
    risk_review_frequency: client.risk_review_frequency || undefined,
    id_verified: client.id_verified,
    id_verification_method: client.id_verification_method || undefined,
    source_of_funds_checked: client.source_of_funds_checked,
    beneficial_owner_verified: client.beneficial_owner_verified,
    psc_verified: client.psc_verified,
    pep_flag: client.pep_flag,
    ongoing_monitoring_flag: client.ongoing_monitoring_flag,
    assigned_reviewer: client.assigned_reviewer || undefined,
    aml_notes: client.aml_notes || undefined,
    utr: client.utr || undefined,
    paye_reference: client.paye_reference || undefined,
    accounts_reference_date: client.accounts_reference_date || undefined,
    corporation_tax_reference: client.corporation_tax_reference || undefined,
    vat_stagger: client.vat_stagger || undefined,
    vat_frequency: client.vat_frequency || undefined,
    vat_scheme: client.vat_scheme || undefined,
    mtd_enabled: client.mtd_enabled,
    ni_number: client.ni_number || undefined,
    self_assessment_utr: client.self_assessment_utr || undefined,
    billing_model: client.billing_model || undefined,
    monthly_fee: client.monthly_fee,
    credit_terms: client.credit_terms || undefined,
    payment_method: client.payment_method || undefined,
    direct_debit_mandate_signed: client.direct_debit_mandate_signed,
    last_fee_review_date: client.last_fee_review_date || undefined,
    client_manager: client.client_manager || undefined,
    partner: client.partner || undefined,
    internal_rating: client.internal_rating || undefined,
    sector: client.sector || undefined,
    year_end: client.year_end || undefined,
    software_used: client.software_used || undefined,
    payroll_frequency: client.payroll_frequency || undefined,
    notes: client.notes || undefined,
    field_statuses: client.field_statuses || {},
    created_from_claim: client.created_from_claim,
    created_at: client.created_at || new Date().toISOString(),
    updated_at: client.updated_at || new Date().toISOString(),
    created_by: client.created_by || client.user_id || currentUserContext?.user_id || 'system',
    total_claims: client.total_claims || 0,
    last_used: client.last_used || undefined,
  };
}

function mapContactToBackendClientPayload(
  data: Partial<Contact>
): Record<string, unknown> {
  const normalized = {
    ...data,
    ...resolvePortfolioSnapshot(data),
  };

  return {
    ...normalized,
    type: normalized.type === 'individual' ? 'individual' : 'business',
    name: normalized.name,
    company_name: normalized.name,
    contact_person: normalized.contact_person,
    primary_contact_name: normalized.contact_person || normalized.name,
    email: normalized.email,
    primary_contact_email: normalized.email,
    phone: normalized.phone,
    primary_contact_phone: normalized.phone,
    address: normalized.address,
    address_line1: normalized.address,
    address_line2: normalized.address_line_2,
    address_line_1: normalized.address,
    address_line_2: normalized.address_line_2,
    related_to_client_id: normalized.related_to_client_id,
    related_to_client_ref: normalized.related_to_client_ref,
    related_to_client_name: normalized.related_to_client_name,
    party_roles: normalized.party_roles,
    party_status: normalized.party_status,
  };
}

async function fetchPracticeClientsFromBackend(): Promise<Contact[]> {
  const response = await cdsRequest<{ clients: BackendClientRecord[] }>('/clients');
  return (response.clients || []).map(mapBackendClientToContact);
}

function getLocalPracticeContactsForUser(userId: string): Contact[] {
  return contacts.filter(
    (contact) => contact.created_by === userId && isPracticeClientType(contact.type)
  );
}

function removeLocalContactsById(ids: string[]): void {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  const remaining = contacts.filter((contact) => !idSet.has(contact.id));
  contacts.splice(0, contacts.length, ...remaining);
  saveContactsToStorage(contacts);
}

function isSamePracticeClient(left: Contact, right: Contact): boolean {
  const leftCompany = String(left.company_number || '').trim().toLowerCase();
  const rightCompany = String(right.company_number || '').trim().toLowerCase();
  if (leftCompany && rightCompany && leftCompany === rightCompany) return true;

  const leftRef = String(left.client_ref || '').trim().toLowerCase();
  const rightRef = String(right.client_ref || '').trim().toLowerCase();
  if (leftRef && rightRef && leftRef === rightRef) return true;

  const leftName = String(left.name || '').trim().toLowerCase();
  const rightName = String(right.name || '').trim().toLowerCase();
  const leftEmail = String(left.email || '').trim().toLowerCase();
  const rightEmail = String(right.email || '').trim().toLowerCase();

  return Boolean(leftName && rightName && leftName === rightName && leftEmail === rightEmail);
}

let practiceClientSyncPromise: Promise<void> | null = null;

async function syncLocalPracticeClientsToBackend(): Promise<void> {
  if (!shouldUseBackendForPracticeClients() || !currentUserContext) return;
  if (practiceClientSyncPromise) return practiceClientSyncPromise;

  practiceClientSyncPromise = (async () => {
    const localPracticeClients = getLocalPracticeContactsForUser(currentUserContext.user_id);
    if (localPracticeClients.length === 0) return;

    const backendClients = await fetchPracticeClientsFromBackend();
    const migratedIds: string[] = [];

    for (const localClient of localPracticeClients) {
      const duplicate = backendClients.find((backendClient) =>
        isSamePracticeClient(localClient, backendClient)
      );

      if (duplicate) {
        migratedIds.push(localClient.id);
        continue;
      }

      const response = await cdsRequest<{ client: BackendClientRecord }>('/clients', {
        method: 'POST',
        body: JSON.stringify(mapContactToBackendClientPayload(localClient)),
      });
      backendClients.push(mapBackendClientToContact(response.client));
      migratedIds.push(localClient.id);
    }

    removeLocalContactsById(migratedIds);
  })().finally(() => {
    practiceClientSyncPromise = null;
  });

  return practiceClientSyncPromise;
}

export const contactsAPI = {
  /**
   * Get all contacts with filtering
   */
  async getContacts(filter?: ContactFilter): Promise<ContactListResponse> {
    await delay(300);

    try {
      // Validate user context exists
      if (!currentUserContext) {
        throw new Error('User context not set. Please log in again.');
      }

      // SELF users cannot access contacts
      if (currentUserContext.user_type === 'SELF') {
        // Return empty list for SELF users
        return {
          contacts: [],
          total_count: 0,
          page: 1,
          page_size: filter?.limit || 50,
          has_more: false,
        };
      }

      const userId = currentUserContext.user_id;
      const requestedTypes = filter?.type
        ? Array.isArray(filter.type)
          ? filter.type
          : [filter.type]
        : null;
      const includePracticeClients =
        !requestedTypes || requestedTypes.some((type) => isPracticeClientType(type));
      const includeLocalContacts =
        !requestedTypes || requestedTypes.some((type) => !isPracticeClientType(type));

      if (includePracticeClients && shouldUseBackendForPracticeClients()) {
        await syncLocalPracticeClientsToBackend();
      }

      const localContacts = contacts.filter(
        (contact) =>
          contact.created_by === userId &&
          (includeLocalContacts || !isPracticeClientType(contact.type)) &&
          (!shouldUseBackendForPracticeClients() || !isPracticeClientType(contact.type))
      );
      const practiceClients =
        includePracticeClients && shouldUseBackendForPracticeClients()
          ? await fetchPracticeClientsFromBackend()
          : [];

      let filtered = [...practiceClients, ...localContacts];

      // Apply filters
      if (filter) {
        if (filter.search) {
          const search = filter.search.toLowerCase();
          filtered = filtered.filter(
            (c) =>
              c.name.toLowerCase().includes(search) ||
              c.email.toLowerCase().includes(search) ||
              c.eori?.toLowerCase().includes(search)
          );
        }

        if (filter.type) {
          const types = Array.isArray(filter.type) ? filter.type : [filter.type];
          filtered = filtered.filter((c) => types.includes(c.type));
        }

        if (filter.has_eori !== undefined) {
          filtered = filtered.filter((c) => (filter.has_eori ? !!c.eori : !c.eori));
        }

        if (filter.has_vat !== undefined) {
          filtered = filtered.filter((c) => (filter.has_vat ? !!c.vat_number : !c.vat_number));
        }

        if (filter.has_bank_details !== undefined) {
          filtered = filtered.filter((c) =>
            filter.has_bank_details
              ? !!(c.bank_account_number && c.bank_sort_code)
              : !(c.bank_account_number && c.bank_sort_code)
          );
        }

        if (filter.allows_agent_refund !== undefined) {
          filtered = filtered.filter((c) => c.allows_agent_refund === filter.allows_agent_refund);
        }

        // Sorting
        if (filter.sort_by) {
          filtered.sort((a, b) => {
            let aVal: string | number, bVal: string | number;

            switch (filter.sort_by) {
              case 'name':
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
                break;
              case 'created_at':
                aVal = new Date(a.created_at).getTime();
                bVal = new Date(b.created_at).getTime();
                break;
              case 'last_used':
                aVal = a.last_used ? new Date(a.last_used).getTime() : 0;
                bVal = b.last_used ? new Date(b.last_used).getTime() : 0;
                break;
              case 'total_claims':
                aVal = a.total_claims || 0;
                bVal = b.total_claims || 0;
                break;
              default:
                return 0;
            }

            if (filter.sort_order === 'desc') {
              return bVal > aVal ? 1 : -1;
            }
            return aVal > bVal ? 1 : -1;
          });
        }
      }

      // Pagination
      const limit = filter?.limit || 50;
      const offset = filter?.offset || 0;
      const paginated = filtered.slice(offset, offset + limit);

      return {
        contacts: paginated,
        total_count: filtered.length,
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
        has_more: offset + limit < filtered.length,
      };
    } catch (error) {
      handleAPIError(error);
    }
  },

  /**
   * Get contact by ID
   */
  async getContact(id: string): Promise<Contact | null> {
    await delay(200);
    const localContact = contacts.find((contact) => contact.id === id) || null;
    if (localContact) return localContact;
    if (!shouldUseBackendForPracticeClients()) return null;
    await syncLocalPracticeClientsToBackend();

    try {
      const client = await cdsRequest<BackendClientRecord>(`/clients/${id}`);
      return mapBackendClientToContact(client);
    } catch (error) {
      if (error instanceof Error && /404/.test(error.message)) {
        return null;
      }
      throw error;
    }
  },

  async exportClientData(): Promise<ClientDataExportPayload> {
    return cdsRequest<ClientDataExportPayload>('/clients/export');
  },

  async importClientData(payload: ClientDataExportPayload): Promise<ClientDataImportResult> {
    return cdsRequest<ClientDataImportResult>('/clients/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async exportClientDataCsv(): Promise<Blob> {
    return cdsBlobRequest('/clients/export.csv', {
      headers: {
        Accept: 'text/csv',
      },
    });
  },

  async importClientDataCsv(file: File): Promise<ClientDataImportResult> {
    const formData = new FormData();
    formData.append('file', file);

    return cdsRequest<ClientDataImportResult>('/clients/import.csv', {
      method: 'POST',
      body: formData,
    });
  },

  async getRelatedClients(parentClientId: string): Promise<Contact[]> {
    if (!shouldUseBackendForPracticeClients()) return [];
    const response = await cdsRequest<{ clients: BackendClientRecord[] }>(`/clients/${parentClientId}/related-clients`);
    return (response.clients || []).map(mapBackendClientToContact);
  },

  async createRelatedClient(
    parentClientId: string,
    data: RelatedClientCreatePayload
  ): Promise<{ client: Contact; created: boolean }> {
    const response = await cdsRequest<{ client: BackendClientRecord; created: boolean }>(`/clients/${parentClientId}/related-clients`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    return {
      client: mapBackendClientToContact(response.client),
      created: Boolean(response.created),
    };
  },

  async getAuditEvents(clientId: string): Promise<AuditEventRecord[]> {
    if (!shouldUseBackendForPracticeClients()) return [];
    const response = await cdsRequest<{ events: AuditEventRecord[] }>(
      `/audit?client_id=${encodeURIComponent(clientId)}&limit=200`
    );
    return Array.isArray(response.events) ? response.events : [];
  },

  /**
   * Create new contact
   */
  async createContact(
    data: Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'created_by'>
  ): Promise<Contact> {
    await delay(300);

    try {
      // Validate user context exists
      if (!currentUserContext) {
        throw new Error('User context not set. Please log in again.');
      }

      // SELF users cannot create contacts
      if (currentUserContext.user_type === 'SELF') {
        throw IdentityErrors.SELF_CANNOT_CREATE_CONTACTS;
      }

      if (isPracticeClientType(data.type) && shouldUseBackendForPracticeClients()) {
        const existingPracticeClients = await fetchPracticeClientsFromBackend();
        const generatedClientRef = hasClientReference(data)
          ? data.client_ref?.trim()
          : generateClientReference(
              {
                ...data,
                ...resolvePortfolioSnapshot(data),
              },
              existingPracticeClients,
              currentUserContext.user_id
            );
        const response = await cdsRequest<{ client: BackendClientRecord }>('/clients', {
          method: 'POST',
          body: JSON.stringify({
            ...mapContactToBackendClientPayload({
              ...data,
              client_ref: generatedClientRef,
            }),
          }),
        });
        return mapBackendClientToContact(response.client);
      }

      const contact: Contact = {
        ...data,
        ...resolvePortfolioSnapshot(data),
        client_ref: hasClientReference(data)
          ? data.client_ref?.trim()
          : generateClientReference(data, contacts, currentUserContext.user_id),
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: currentUserContext.user_id,
        total_claims: 0,
      };

      contacts.push(contact);
      saveContactsToStorage(contacts);
      return contact;
    } catch (error) {
      handleAPIError(error);
    }
  },

  /**
   * Update contact
   */
  async updateContact(id: string, data: Partial<Contact>): Promise<Contact> {
    await delay(300);

    try {
      // Validate user context exists
      if (!currentUserContext) {
        throw new Error('User context not set. Please log in again.');
      }

      // SELF users cannot update contacts
      if (currentUserContext.user_type === 'SELF') {
        throw IdentityErrors.SELF_CANNOT_CREATE_CONTACTS;
      }

      const index = contacts.findIndex((contact) => contact.id === id);
      if (index !== -1) {
        contacts[index] = {
          ...contacts[index],
          ...data,
          id,
          updated_at: new Date().toISOString(),
        };

        saveContactsToStorage(contacts);
        return contacts[index];
      }

      if (shouldUseBackendForPracticeClients()) {
        const response = await cdsRequest<{ client: BackendClientRecord }>(`/clients/${id}`, {
          method: 'PUT',
          body: JSON.stringify(mapContactToBackendClientPayload(data)),
        });
        return mapBackendClientToContact(response.client);
      }

      throw new Error('Contact not found');
    } catch (error) {
      handleAPIError(error);
    }
  },

  /**
   * Update one workflow section of a contact record.
   * The current mock implementation reuses updateContact with a section-scoped patch payload.
   */
  async updateContactSection(
    id: string,
    _section: ContactUpdateSection,
    data: Partial<Contact>
  ): Promise<Contact> {
    return contactsAPI.updateContact(id, data);
  },

  /**
   * Delete contact
   */
  async deleteContact(id: string): Promise<void> {
    await delay(200);

    try {
      // Validate user context exists
      if (!currentUserContext) {
        throw new Error('User context not set. Please log in again.');
      }

      // SELF users cannot delete contacts
      if (currentUserContext.user_type === 'SELF') {
        throw IdentityErrors.SELF_CANNOT_CREATE_CONTACTS;
      }

      const index = contacts.findIndex((contact) => contact.id === id);
      if (index !== -1) {
        contacts.splice(index, 1);
        saveContactsToStorage(contacts);
        return;
      }

      if (shouldUseBackendForPracticeClients()) {
        await cdsRequest(`/clients/${id}`, { method: 'DELETE' });
        return;
      }

      throw new Error('Contact not found');
    } catch (error) {
      handleAPIError(error);
    }
  },

  /**
   * Record contact usage (when used in a claim)
   */
  async recordContactUsage(id: string): Promise<void> {
    const contact = contacts.find((c) => c.id === id);
    if (contact) {
      contact.total_claims = (contact.total_claims || 0) + 1;
      contact.last_used = new Date().toISOString();
    }
  },
};
