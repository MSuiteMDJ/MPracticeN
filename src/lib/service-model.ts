import type { Contact } from '@/types';

export type CanonicalClientType = 'COMPANY' | 'INDIVIDUAL' | 'SOLE_TRADER' | 'PARTNERSHIP' | 'LLP';
export type ServiceCategory =
  | 'COMPLIANCE'
  | 'TAX'
  | 'BOOKKEEPING'
  | 'PAYROLL'
  | 'ADVISORY'
  | 'SECRETARIAL'
  | 'FORMATION';
export type ComplianceType =
  | 'NONE'
  | 'STATUTORY_FILING'
  | 'TAX_RETURN'
  | 'REGISTRATION'
  | 'ADVISORY_ONLY';
export type BillingType = 'RECURRING' | 'ONE_TIME' | 'PROJECT';
export type BillingUnit =
  | 'PER_MONTH'
  | 'PER_QUARTER'
  | 'PER_YEAR'
  | 'PER_RETURN'
  | 'PER_HOUR'
  | 'FIXED_FEE';
export type Frequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'AD_HOC';
export type ServiceTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ServiceTaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type ServiceScheduleMode = 'PERIOD_END' | 'MANUAL_DUE';

export interface ServiceTemplateTask {
  id: string;
  title: string;
  daysBeforeDue: number;
  priority: ServiceTaskPriority;
}

export interface ServiceTemplateModel {
  serviceCode: string;
  displayName: string;
  description?: string;
  reportCategory?: string;
  category: ServiceCategory;
  complianceType: ComplianceType;
  createsCompliance: boolean;
  defaultFrequency: Frequency;
  billingType: BillingType;
  billingUnit: BillingUnit;
  clientTypes: CanonicalClientType[];
  taskTemplates: ServiceTemplateTask[];
}

export interface ClientServiceTaskInstance {
  id: string;
  title: string;
  daysBeforeDue: number;
  priority: ServiceTaskPriority;
  status: ServiceTaskStatus;
  dueDate?: string;
}

export interface ServiceComplianceDate {
  id: string;
  label: string;
  dueDate: string;
}

export interface ClientServiceEngagement {
  id: string;
  clientId: string;
  serviceCode: string;
  displayName: string;
  category: ServiceCategory;
  complianceType: ComplianceType;
  createsCompliance: boolean;
  frequency: Frequency;
  billingType: BillingType;
  billingUnit: BillingUnit;
  feeAmount: number;
  startDate: string;
  scheduleMode: ServiceScheduleMode;
  periodEndDate?: string;
  manualDueDate?: string;
  nextDue?: string;
  complianceDates: ServiceComplianceDate[];
  isActive: boolean;
  taskInstances: ClientServiceTaskInstance[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientServiceModel {
  id: string;
  clientId: string;
  clientName: string;
  serviceCode: string;
  displayName: string;
  category: ServiceCategory;
  complianceType: ComplianceType;
  frequency: Frequency;
  billingType: BillingType;
  billingUnit: BillingUnit;
  status: 'active' | 'attention' | 'pending';
  nextDue?: string;
  openTasks: number;
  overdueTasks: number;
  annualCost: number;
}

export interface AddClientServiceInput {
  clientId: string;
  serviceCode: string;
  feeAmount: number;
  startDate: string;
  frequency?: Frequency;
  periodEndDate?: string;
  manualDueDate?: string;
}

const TEMPLATE_STORAGE_KEY = 'm_practice_service_templates_v1';
const CLIENT_SERVICE_STORAGE_KEY = 'm_practice_client_services_v1';
const SERVICE_DATA_UPDATED_EVENT = 'm-practice-service-data-updated';
const SERVICE_API_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CDS_API_URL) ||
  'http://localhost:3003';

let clientServiceCache: ClientServiceEngagement[] | null = null;
let clientServiceLoadPromise: Promise<ClientServiceEngagement[]> | null = null;

function normalizeCanonicalClientType(value: string): CanonicalClientType | null {
  const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (
    normalized === 'COMPANY' ||
    normalized === 'INDIVIDUAL' ||
    normalized === 'SOLE_TRADER' ||
    normalized === 'PARTNERSHIP' ||
    normalized === 'LLP'
  ) {
    return normalized;
  }
  return null;
}

const DEFAULT_SERVICE_TEMPLATES: ServiceTemplateModel[] = [
  {
    serviceCode: 'ACCS',
    displayName: 'Statutory Accounts',
    description: 'Annual accounts preparation and filing support',
    reportCategory: 'Accounts & Compliance',
    category: 'COMPLIANCE',
    complianceType: 'STATUTORY_FILING',
    createsCompliance: true,
    defaultFrequency: 'ANNUAL',
    billingType: 'RECURRING',
    billingUnit: 'PER_YEAR',
    clientTypes: ['COMPANY', 'LLP', 'PARTNERSHIP', 'SOLE_TRADER'],
    taskTemplates: [
      { id: 'accs-1', title: 'Request records from client', daysBeforeDue: 60, priority: 'MEDIUM' },
      { id: 'accs-2', title: 'Draft statutory accounts', daysBeforeDue: 30, priority: 'HIGH' },
      { id: 'accs-3', title: 'Partner review and approval', daysBeforeDue: 14, priority: 'HIGH' },
      { id: 'accs-4', title: 'File accounts to Companies House', daysBeforeDue: 0, priority: 'URGENT' },
    ],
  },
  {
    serviceCode: 'CT600',
    displayName: 'Corporation Tax',
    description: 'CT600 preparation and submission workflow',
    reportCategory: 'Tax Returns',
    category: 'TAX',
    complianceType: 'TAX_RETURN',
    createsCompliance: true,
    defaultFrequency: 'ANNUAL',
    billingType: 'RECURRING',
    billingUnit: 'PER_YEAR',
    clientTypes: ['COMPANY', 'LLP'],
    taskTemplates: [
      { id: 'ct600-1', title: 'Collect year-end tax adjustments', daysBeforeDue: 45, priority: 'MEDIUM' },
      { id: 'ct600-2', title: 'Prepare CT600 draft', daysBeforeDue: 21, priority: 'HIGH' },
      { id: 'ct600-3', title: 'Client approval for submission', daysBeforeDue: 7, priority: 'HIGH' },
      { id: 'ct600-4', title: 'Submit CT600 to HMRC', daysBeforeDue: 0, priority: 'URGENT' },
    ],
  },
  {
    serviceCode: 'VAT',
    displayName: 'VAT Returns',
    description: 'VAT compliance management and filing cadence',
    reportCategory: 'Indirect Tax',
    category: 'COMPLIANCE',
    complianceType: 'TAX_RETURN',
    createsCompliance: true,
    defaultFrequency: 'QUARTERLY',
    billingType: 'RECURRING',
    billingUnit: 'PER_QUARTER',
    clientTypes: ['COMPANY', 'LLP', 'PARTNERSHIP', 'SOLE_TRADER'],
    taskTemplates: [
      { id: 'vat-1', title: 'Reconcile VAT control account', daysBeforeDue: 14, priority: 'MEDIUM' },
      { id: 'vat-2', title: 'Prepare VAT return', daysBeforeDue: 7, priority: 'HIGH' },
      { id: 'vat-3', title: 'Client approval and payment review', daysBeforeDue: 3, priority: 'HIGH' },
      { id: 'vat-4', title: 'File VAT return to HMRC', daysBeforeDue: 0, priority: 'URGENT' },
    ],
  },
  {
    serviceCode: 'PAYE',
    displayName: 'Payroll & RTI',
    description: 'Payroll processing and RTI submissions',
    reportCategory: 'Payroll',
    category: 'PAYROLL',
    complianceType: 'TAX_RETURN',
    createsCompliance: true,
    defaultFrequency: 'MONTHLY',
    billingType: 'RECURRING',
    billingUnit: 'PER_MONTH',
    clientTypes: ['COMPANY', 'LLP', 'PARTNERSHIP'],
    taskTemplates: [
      { id: 'paye-1', title: 'Collect payroll changes', daysBeforeDue: 6, priority: 'MEDIUM' },
      { id: 'paye-2', title: 'Run payroll and QA checks', daysBeforeDue: 3, priority: 'HIGH' },
      { id: 'paye-3', title: 'Submit RTI FPS/EPS', daysBeforeDue: 0, priority: 'URGENT' },
    ],
  },
  {
    serviceCode: 'BK',
    displayName: 'Bookkeeping',
    description: 'Transactional bookkeeping and reconciliations',
    reportCategory: 'Management Information',
    category: 'BOOKKEEPING',
    complianceType: 'NONE',
    createsCompliance: false,
    defaultFrequency: 'MONTHLY',
    billingType: 'RECURRING',
    billingUnit: 'PER_MONTH',
    clientTypes: ['COMPANY', 'LLP', 'PARTNERSHIP', 'SOLE_TRADER', 'INDIVIDUAL'],
    taskTemplates: [
      { id: 'bk-1', title: 'Post bank and purchase transactions', daysBeforeDue: 10, priority: 'MEDIUM' },
      { id: 'bk-2', title: 'Reconcile control accounts', daysBeforeDue: 5, priority: 'MEDIUM' },
      { id: 'bk-3', title: 'Publish monthly bookkeeping close', daysBeforeDue: 0, priority: 'HIGH' },
    ],
  },
  {
    serviceCode: 'CS01',
    displayName: 'Confirmation Statement',
    description: 'Companies House CS01 tracking and submission',
    reportCategory: 'Company Secretarial',
    category: 'SECRETARIAL',
    complianceType: 'STATUTORY_FILING',
    createsCompliance: true,
    defaultFrequency: 'ANNUAL',
    billingType: 'RECURRING',
    billingUnit: 'PER_YEAR',
    clientTypes: ['COMPANY', 'LLP'],
    taskTemplates: [
      { id: 'cs01-1', title: 'Review officer/shareholder changes', daysBeforeDue: 21, priority: 'MEDIUM' },
      { id: 'cs01-2', title: 'Prepare CS01 details', daysBeforeDue: 10, priority: 'HIGH' },
      { id: 'cs01-3', title: 'File confirmation statement', daysBeforeDue: 0, priority: 'URGENT' },
    ],
  },
  {
    serviceCode: 'ADV',
    displayName: 'Advisory Support',
    description: 'Ad hoc advisory and planning support',
    reportCategory: 'Advisory',
    category: 'ADVISORY',
    complianceType: 'ADVISORY_ONLY',
    createsCompliance: false,
    defaultFrequency: 'AD_HOC',
    billingType: 'PROJECT',
    billingUnit: 'PER_HOUR',
    clientTypes: ['COMPANY', 'INDIVIDUAL', 'SOLE_TRADER', 'PARTNERSHIP', 'LLP'],
    taskTemplates: [
      { id: 'adv-1', title: 'Scope advisory requirement', daysBeforeDue: 0, priority: 'MEDIUM' },
      { id: 'adv-2', title: 'Prepare advisory recommendations', daysBeforeDue: 0, priority: 'HIGH' },
      { id: 'adv-3', title: 'Issue advisory summary report', daysBeforeDue: 0, priority: 'MEDIUM' },
    ],
  },
];

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isDemoModeActive(): boolean {
  return isBrowser() && window.localStorage.getItem('demo_mode') === 'true';
}

function shouldUseBackendForServices(): boolean {
  if (!isBrowser() || isDemoModeActive()) return false;
  return Boolean(window.localStorage.getItem('auth_token'));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emitServiceDataUpdate(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(SERVICE_DATA_UPDATED_EVENT));
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return clone(fallback);
  const raw = window.localStorage.getItem(key);
  if (!raw) return clone(fallback);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return clone(fallback);
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
  emitServiceDataUpdate();
}

async function serviceRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = options.headers
    ? { ...(options.headers as Record<string, string>) }
    : {};

  if (!isFormData) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }
  headers.Accept = 'application/json';

  if (isBrowser()) {
    const authToken = window.localStorage.getItem('auth_token');
    if (authToken && !headers.Authorization) {
      headers.Authorization = `Bearer ${authToken}`;
    }
  }

  const response = await fetch(`${SERVICE_API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

type ServiceScheduleRule = {
  mode: ServiceScheduleMode;
  inputLabel: string;
  helperText: string;
};

export function getServiceScheduleRule(serviceCode: string): ServiceScheduleRule {
  const code = serviceCode.trim().toUpperCase();
  if (code === 'ACCS') {
    return {
      mode: 'PERIOD_END',
      inputLabel: 'Period End Date',
      helperText: 'Compliance due date will be calculated as 9 months after period end.',
    };
  }
  if (code === 'CT600') {
    return {
      mode: 'PERIOD_END',
      inputLabel: 'Accounting Period End Date',
      helperText: 'Payment due will be 9 months after period end and filing due will be 12 months after.',
    };
  }
  if (code === 'VAT') {
    return {
      mode: 'PERIOD_END',
      inputLabel: 'VAT Period End Date',
      helperText: 'VAT deadline will be calculated as 1 month and 7 days after period end.',
    };
  }
  if (code === 'PAYE') {
    return {
      mode: 'PERIOD_END',
      inputLabel: 'Payroll Period End Date',
      helperText: 'The next payroll due date will be derived from the payroll interval and period end date.',
    };
  }
  if (code === 'SA100') {
    return {
      mode: 'PERIOD_END',
      inputLabel: 'Tax Year End Date',
      helperText: 'Self Assessment filing due date will be calculated as 31 January following the tax year end.',
    };
  }
  if (code === 'BK') {
    return {
      mode: 'MANUAL_DUE',
      inputLabel: 'Bookkeeping Review Date',
      helperText: 'Set the next bookkeeping date directly.',
    };
  }
  if (code === 'CS01') {
    return {
      mode: 'MANUAL_DUE',
      inputLabel: 'Companies House Due Date',
      helperText: 'Set the next Companies House confirmation statement due date.',
    };
  }
  return {
    mode: 'MANUAL_DUE',
    inputLabel: 'Due Date',
    helperText: 'Set the next due date for this service.',
  };
}

function parseIsoDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(value: Date, months: number): Date {
  const next = new Date(value);
  next.setMonth(next.getMonth() + months);
  return next;
}

function computePayeDueDate(periodEnd: Date, frequency: Frequency): Date {
  if (frequency === 'WEEKLY') return addDays(periodEnd, 7);
  if (frequency === 'MONTHLY') return addDays(periodEnd, 22);
  if (frequency === 'QUARTERLY') return addDays(periodEnd, 22);
  if (frequency === 'ANNUAL') return addDays(periodEnd, 22);
  return addDays(periodEnd, 14);
}

function computeSa100DueDate(periodEnd: Date): Date {
  return new Date(periodEnd.getFullYear() + 1, 0, 31);
}

function deriveComplianceDates(
  serviceCode: string,
  frequency: Frequency,
  periodEndDate?: string,
  manualDueDate?: string
): { nextDue?: string; complianceDates: ServiceComplianceDate[]; taskAnchorDate?: string } {
  const code = serviceCode.trim().toUpperCase();
  const manualDue = parseIsoDate(manualDueDate);
  const periodEnd = parseIsoDate(periodEndDate);

  if (code === 'ACCS' && periodEnd) {
    const filingDue = addMonths(periodEnd, 9);
    const dueDate = toIsoDate(filingDue);
    return {
      nextDue: dueDate,
      taskAnchorDate: dueDate,
      complianceDates: [{ id: 'filing', label: 'Accounts filing due', dueDate }],
    };
  }

  if (code === 'CT600' && periodEnd) {
    const paymentDue = toIsoDate(addMonths(periodEnd, 9));
    const filingDue = toIsoDate(addMonths(periodEnd, 12));
    return {
      nextDue: paymentDue,
      taskAnchorDate: filingDue,
      complianceDates: [
        { id: 'payment', label: 'Corporation tax payment due', dueDate: paymentDue },
        { id: 'filing', label: 'CT600 filing due', dueDate: filingDue },
      ],
    };
  }

  if (code === 'VAT' && periodEnd) {
    const filingDue = toIsoDate(addDays(addMonths(periodEnd, 1), 7));
    return {
      nextDue: filingDue,
      taskAnchorDate: filingDue,
      complianceDates: [{ id: 'filing', label: 'VAT return due', dueDate: filingDue }],
    };
  }

  if (code === 'PAYE' && periodEnd) {
    const payrollDue = toIsoDate(computePayeDueDate(periodEnd, frequency));
    return {
      nextDue: payrollDue,
      taskAnchorDate: payrollDue,
      complianceDates: [{ id: 'filing', label: 'Payroll due', dueDate: payrollDue }],
    };
  }

  if (code === 'SA100' && periodEnd) {
    const filingDue = toIsoDate(computeSa100DueDate(periodEnd));
    return {
      nextDue: filingDue,
      taskAnchorDate: filingDue,
      complianceDates: [{ id: 'filing', label: 'Self Assessment filing due', dueDate: filingDue }],
    };
  }

  if (manualDue) {
    const dueDate = toIsoDate(manualDue);
    return {
      nextDue: dueDate,
      taskAnchorDate: dueDate,
      complianceDates: [{ id: 'due', label: 'Due date', dueDate }],
    };
  }

  return {
    nextDue: undefined,
    taskAnchorDate: undefined,
    complianceDates: [],
  };
}

function buildTaskInstances(
  engagementId: string,
  template: ServiceTemplateModel,
  taskAnchorDate?: string,
  existingTasks: ClientServiceTaskInstance[] = []
): ClientServiceTaskInstance[] {
  const anchorDate = parseIsoDate(taskAnchorDate);
  const existingByTitle = new Map(existingTasks.map((task) => [task.title, task]));

  return template.taskTemplates.map((task, index) => {
    const existing = existingByTitle.get(task.title);
    const dueDate = anchorDate ? toIsoDate(addDays(anchorDate, -task.daysBeforeDue)) : existing?.dueDate;
    return {
      id: existing?.id || `${engagementId}:${task.id || index + 1}`,
      title: task.title,
      daysBeforeDue: task.daysBeforeDue,
      priority: task.priority,
      status: existing?.status || 'TODO',
      dueDate,
    };
  });
}

function normalizeTemplate(template: ServiceTemplateModel): ServiceTemplateModel {
  const code = template.serviceCode.trim().toUpperCase();
  return {
    ...template,
    serviceCode: code,
    displayName: template.displayName.trim(),
    description: template.description?.trim() || undefined,
    reportCategory: template.reportCategory?.trim() || undefined,
    clientTypes: Array.from(
      new Set(
        (template.clientTypes || [])
          .map((type) => normalizeCanonicalClientType(String(type)))
          .filter((type): type is CanonicalClientType => Boolean(type))
      )
    ),
    taskTemplates: template.taskTemplates.map((task, index) => ({
      id: task.id || `${code.toLowerCase()}-${index + 1}`,
      title: task.title.trim(),
      daysBeforeDue: Number.isFinite(task.daysBeforeDue) ? task.daysBeforeDue : 0,
      priority: task.priority,
    })),
  };
}

function loadTemplateStore(): ServiceTemplateModel[] {
  const stored = readJson<ServiceTemplateModel[]>(TEMPLATE_STORAGE_KEY, []);
  if (stored.length === 0) {
    writeJson(TEMPLATE_STORAGE_KEY, DEFAULT_SERVICE_TEMPLATES);
    return clone(DEFAULT_SERVICE_TEMPLATES);
  }
  return stored.map(normalizeTemplate);
}

function saveTemplateStore(templates: ServiceTemplateModel[]): void {
  writeJson(TEMPLATE_STORAGE_KEY, templates.map(normalizeTemplate));
}

function normalizeClientServiceEngagement(service: ClientServiceEngagement): ClientServiceEngagement {
  const template =
    getServiceTemplates().find((item) => item.serviceCode === service.serviceCode) || null;
  const scheduleRule = getServiceScheduleRule(service.serviceCode);
  const scheduleMode =
    service.scheduleMode ||
    (service.periodEndDate
      ? 'PERIOD_END'
      : scheduleRule.mode === 'PERIOD_END'
        ? 'PERIOD_END'
        : 'MANUAL_DUE');
  const periodEndDate = service.periodEndDate || undefined;
  const manualDueDate =
    service.manualDueDate ||
    (scheduleMode === 'MANUAL_DUE' ? service.nextDue || undefined : undefined);
  const derived = deriveComplianceDates(
    service.serviceCode,
    service.frequency,
    periodEndDate,
    manualDueDate
  );

  return {
    ...service,
    scheduleMode,
    periodEndDate,
    manualDueDate,
    nextDue: derived.nextDue || service.nextDue,
    complianceDates:
      derived.complianceDates.length > 0 ? derived.complianceDates : service.complianceDates || [],
    taskInstances: template
      ? buildTaskInstances(service.id, template, derived.taskAnchorDate || service.nextDue, service.taskInstances || [])
      : service.taskInstances || [],
  };
}

function loadLocalClientServiceStore(): ClientServiceEngagement[] {
  const stored = readJson<ClientServiceEngagement[]>(CLIENT_SERVICE_STORAGE_KEY, []);
  const normalized = stored.map(normalizeClientServiceEngagement);
  if (JSON.stringify(stored) !== JSON.stringify(normalized)) {
    saveLocalClientServiceStore(normalized);
  }
  return normalized;
}

function saveLocalClientServiceStore(services: ClientServiceEngagement[]): void {
  writeJson(CLIENT_SERVICE_STORAGE_KEY, services);
}

function clearLocalClientServiceStore(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(CLIENT_SERVICE_STORAGE_KEY);
}

function filterClientServices(services: ClientServiceEngagement[], clientId?: string): ClientServiceEngagement[] {
  if (!clientId) return services;
  return services.filter((row) => row.clientId === clientId);
}

async function fetchBackendClientServiceStore(clientId?: string): Promise<ClientServiceEngagement[]> {
  const params = new URLSearchParams();
  if (clientId) params.set('clientId', clientId);
  const qs = params.toString();
  const response = await serviceRequest<{ services: ClientServiceEngagement[] }>(
    `/clients/services${qs ? `?${qs}` : ''}`
  );
  return (response.services || []).map(normalizeClientServiceEngagement);
}

async function syncLocalClientServicesToBackend(): Promise<void> {
  if (!shouldUseBackendForServices()) return;

  const localServices = loadLocalClientServiceStore();
  if (localServices.length === 0) return;

  const backendServices = await fetchBackendClientServiceStore();
  const backendIds = new Set(backendServices.map((service) => service.id));

  for (const service of localServices) {
    if (backendIds.has(service.id)) continue;
    await serviceRequest<{ service: ClientServiceEngagement }>('/clients/services', {
      method: 'POST',
      body: JSON.stringify(service),
    });
  }

  clearLocalClientServiceStore();
}

async function refreshClientServiceCache(force = false): Promise<ClientServiceEngagement[]> {
  if (!shouldUseBackendForServices()) {
    const localServices = loadLocalClientServiceStore();
    clientServiceCache = localServices;
    return localServices;
  }

  if (!force && clientServiceCache) {
    return clientServiceCache;
  }

  if (!force && clientServiceLoadPromise) {
    return clientServiceLoadPromise;
  }

  clientServiceLoadPromise = (async () => {
    await syncLocalClientServicesToBackend();
    const services = await fetchBackendClientServiceStore();
    clientServiceCache = services;
    clientServiceLoadPromise = null;
    return services;
  })();

  try {
    return await clientServiceLoadPromise;
  } catch (error) {
    clientServiceLoadPromise = null;
    throw error;
  }
}

function persistLocalClientServiceStore(services: ClientServiceEngagement[]): ClientServiceEngagement[] {
  const normalized = services.map(normalizeClientServiceEngagement);
  saveLocalClientServiceStore(normalized);
  clientServiceCache = normalized;
  return normalized;
}

function emitServiceDataRefresh(services: ClientServiceEngagement[]): ClientServiceEngagement[] {
  clientServiceCache = services.map(normalizeClientServiceEngagement);
  emitServiceDataUpdate();
  return clientServiceCache;
}

function annualMultiplier(unit: BillingUnit): number {
  if (unit === 'PER_MONTH') return 12;
  if (unit === 'PER_QUARTER') return 4;
  if (unit === 'PER_YEAR') return 1;
  if (unit === 'PER_RETURN') return 1;
  if (unit === 'PER_HOUR') return 1;
  return 1;
}

export function calculateAnnualCost(service: Pick<ClientServiceEngagement, 'feeAmount' | 'billingUnit'>): number {
  return Number((service.feeAmount * annualMultiplier(service.billingUnit)).toFixed(2));
}

export function mapContactTypeToCanonical(type: Contact['type']): CanonicalClientType {
  if (type === 'individual') return 'INDIVIDUAL';
  if (type === 'business') return 'COMPANY';
  if (type === 'agent') return 'COMPANY';
  return 'COMPANY';
}

export function getServiceTemplates(): ServiceTemplateModel[] {
  return loadTemplateStore();
}

export function upsertServiceTemplate(template: ServiceTemplateModel): ServiceTemplateModel {
  const normalized = normalizeTemplate(template);
  const templates = loadTemplateStore();
  const idx = templates.findIndex((item) => item.serviceCode === normalized.serviceCode);
  if (idx >= 0) {
    templates[idx] = normalized;
  } else {
    templates.push(normalized);
  }
  saveTemplateStore(templates);
  return normalized;
}

export function createServiceTemplate(template: ServiceTemplateModel): ServiceTemplateModel {
  const normalized = normalizeTemplate(template);
  const templates = loadTemplateStore();
  if (templates.some((item) => item.serviceCode === normalized.serviceCode)) {
    throw new Error(`Service template code ${normalized.serviceCode} already exists.`);
  }
  templates.push(normalized);
  saveTemplateStore(templates);
  return normalized;
}

export function updateServiceTemplate(serviceCode: string, patch: Partial<ServiceTemplateModel>): ServiceTemplateModel {
  const code = serviceCode.trim().toUpperCase();
  const templates = loadTemplateStore();
  const idx = templates.findIndex((item) => item.serviceCode === code);
  if (idx < 0) {
    throw new Error(`Service template ${code} not found.`);
  }
  const next = normalizeTemplate({
    ...templates[idx],
    ...patch,
    serviceCode: code,
  });
  templates[idx] = next;
  saveTemplateStore(templates);
  return next;
}

export async function getClientServiceEngagements(clientId?: string): Promise<ClientServiceEngagement[]> {
  const all = await refreshClientServiceCache();
  return filterClientServices(all, clientId);
}

export async function addClientServiceEngagement(input: AddClientServiceInput): Promise<ClientServiceEngagement> {
  const template = getServiceTemplates().find((item) => item.serviceCode === input.serviceCode.trim().toUpperCase());
  if (!template) {
    throw new Error(`Service template ${input.serviceCode} not found.`);
  }

  const now = new Date().toISOString();
  const engagementId = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const scheduleRule = getServiceScheduleRule(template.serviceCode);
  const scheduleMode = scheduleRule.mode;
  const periodEndDate = scheduleMode === 'PERIOD_END' ? input.periodEndDate : undefined;
  const manualDueDate = scheduleMode === 'MANUAL_DUE' ? input.manualDueDate : undefined;
  const frequency = input.frequency || template.defaultFrequency;
  const derived = deriveComplianceDates(template.serviceCode, frequency, periodEndDate, manualDueDate);
  const engagement: ClientServiceEngagement = {
    id: engagementId,
    clientId: input.clientId,
    serviceCode: template.serviceCode,
    displayName: template.displayName,
    category: template.category,
    complianceType: template.complianceType,
    createsCompliance: template.createsCompliance,
    frequency,
    billingType: template.billingType,
    billingUnit: template.billingUnit,
    feeAmount: Number.isFinite(input.feeAmount) ? Number(input.feeAmount) : 0,
    startDate: input.startDate,
    scheduleMode,
    periodEndDate,
    manualDueDate,
    nextDue: derived.nextDue,
    complianceDates: derived.complianceDates,
    isActive: true,
    taskInstances: buildTaskInstances(engagementId, template, derived.taskAnchorDate),
    createdAt: now,
    updatedAt: now,
  };

  const normalized = normalizeClientServiceEngagement(engagement);

  if (!shouldUseBackendForServices()) {
    const all = loadLocalClientServiceStore();
    all.push(normalized);
    persistLocalClientServiceStore(all);
    return normalized;
  }

  const response = await serviceRequest<{ service: ClientServiceEngagement }>('/clients/services', {
    method: 'POST',
    body: JSON.stringify(normalized),
  });
  const next = normalizeClientServiceEngagement(response.service || normalized);
  const cache = await refreshClientServiceCache();
  emitServiceDataRefresh([...cache.filter((row) => row.id !== next.id), next]);
  return next;
}

export async function updateClientServiceTaskStatus(
  clientServiceId: string,
  taskId: string,
  status: ServiceTaskStatus
): Promise<void> {
  if (!shouldUseBackendForServices()) {
    const all = loadLocalClientServiceStore();
    const row = all.find((item) => item.id === clientServiceId);
    if (!row) return;
    row.taskInstances = row.taskInstances.map((task) => (task.id === taskId ? { ...task, status } : task));
    row.updatedAt = new Date().toISOString();
    persistLocalClientServiceStore(all);
    return;
  }

  const response = await serviceRequest<{ service: ClientServiceEngagement }>(
    `/clients/services/${clientServiceId}/tasks/${taskId}`,
    {
      method: 'POST',
      body: JSON.stringify({ status }),
    }
  );
  const next = normalizeClientServiceEngagement(response.service);
  const cache = await refreshClientServiceCache();
  emitServiceDataRefresh(cache.map((row) => (row.id === clientServiceId ? next : row)));
}

export async function updateClientServiceEngagement(
  clientServiceId: string,
  patch: Partial<
    Pick<
      ClientServiceEngagement,
      'feeAmount' | 'nextDue' | 'isActive' | 'periodEndDate' | 'manualDueDate' | 'frequency'
    >
  >
): Promise<void> {
  const all = shouldUseBackendForServices()
    ? await refreshClientServiceCache()
    : loadLocalClientServiceStore();
  const row = all.find((item) => item.id === clientServiceId);
  if (!row) return;
  const template = getServiceTemplates().find((item) => item.serviceCode === row.serviceCode) || null;
  const nextRow: ClientServiceEngagement = clone(row);
  if (typeof patch.feeAmount === 'number' && Number.isFinite(patch.feeAmount)) nextRow.feeAmount = patch.feeAmount;
  if (typeof patch.frequency !== 'undefined') nextRow.frequency = patch.frequency;
  if (typeof patch.isActive === 'boolean') nextRow.isActive = patch.isActive;
  if (typeof patch.periodEndDate !== 'undefined') nextRow.periodEndDate = patch.periodEndDate;
  if (typeof patch.manualDueDate !== 'undefined') nextRow.manualDueDate = patch.manualDueDate;
  if (typeof patch.nextDue !== 'undefined') {
    if (nextRow.scheduleMode === 'PERIOD_END') nextRow.periodEndDate = patch.nextDue;
    else nextRow.manualDueDate = patch.nextDue;
  }
  const derived = deriveComplianceDates(
    nextRow.serviceCode,
    nextRow.frequency,
    nextRow.periodEndDate,
    nextRow.manualDueDate
  );
  nextRow.nextDue = derived.nextDue;
  nextRow.complianceDates = derived.complianceDates;
  if (template) {
    nextRow.taskInstances = buildTaskInstances(nextRow.id, template, derived.taskAnchorDate, nextRow.taskInstances);
  }
  nextRow.updatedAt = new Date().toISOString();

  if (!shouldUseBackendForServices()) {
    persistLocalClientServiceStore(all.map((item) => (item.id === clientServiceId ? nextRow : item)));
    return;
  }

  const response = await serviceRequest<{ service: ClientServiceEngagement }>(`/clients/services/${clientServiceId}`, {
    method: 'PATCH',
    body: JSON.stringify(nextRow),
  });
  const saved = normalizeClientServiceEngagement(response.service || nextRow);
  emitServiceDataRefresh(all.map((item) => (item.id === clientServiceId ? saved : item)));
}

export async function removeClientServiceEngagement(clientServiceId: string): Promise<void> {
  if (!shouldUseBackendForServices()) {
    const all = loadLocalClientServiceStore();
    persistLocalClientServiceStore(all.filter((row) => row.id !== clientServiceId));
    return;
  }

  await serviceRequest<{ success: boolean }>(`/clients/services/${clientServiceId}`, {
    method: 'DELETE',
  });
  const all = await refreshClientServiceCache();
  emitServiceDataRefresh(all.filter((row) => row.id !== clientServiceId));
}

export async function removeClientServiceEngagementsForClient(clientId: string): Promise<void> {
  const all = await getClientServiceEngagements();
  const targets = all.filter((row) => row.clientId === clientId);
  if (!shouldUseBackendForServices()) {
    persistLocalClientServiceStore(all.filter((row) => row.clientId !== clientId));
    return;
  }
  await Promise.all(targets.map((row) => serviceRequest<{ success: boolean }>(`/clients/services/${row.id}`, { method: 'DELETE' })));
  emitServiceDataRefresh(all.filter((row) => row.clientId !== clientId));
}

export function mapEngagementToServiceModel(
  engagement: ClientServiceEngagement,
  clientName: string
): ClientServiceModel {
  const openTasks = engagement.taskInstances.filter((task) => task.status !== 'DONE').length;
  const now = new Date();
  const overdueTasks = engagement.taskInstances.filter((task) => {
    if (task.status === 'DONE' || !task.dueDate) return false;
    const dueDate = parseIsoDate(task.dueDate);
    return Boolean(dueDate && dueDate < now);
  }).length;
  const status: ClientServiceModel['status'] = !engagement.isActive
    ? 'pending'
    : overdueTasks > 0 || openTasks > 0
      ? 'attention'
      : 'active';

  return {
    id: engagement.id,
    clientId: engagement.clientId,
    clientName,
    serviceCode: engagement.serviceCode,
    displayName: engagement.displayName,
    category: engagement.category,
    complianceType: engagement.complianceType,
    frequency: engagement.frequency,
    billingType: engagement.billingType,
    billingUnit: engagement.billingUnit,
    status,
    nextDue: engagement.nextDue,
    openTasks,
    overdueTasks,
    annualCost: calculateAnnualCost(engagement),
  };
}

export function subscribeToServiceDataUpdates(handler: () => void): () => void {
  if (!isBrowser()) return () => {};
  window.addEventListener(SERVICE_DATA_UPDATED_EVENT, handler);
  const storageHandler = (event: StorageEvent) => {
    if (event.key === TEMPLATE_STORAGE_KEY || event.key === CLIENT_SERVICE_STORAGE_KEY) {
      handler();
    }
  };
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(SERVICE_DATA_UPDATED_EVENT, handler);
    window.removeEventListener('storage', storageHandler);
  };
}
