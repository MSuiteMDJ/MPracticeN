import type { SystemSettings } from '@/contexts/SettingsContext';
import type { ClientServiceEngagement } from '@/lib/service-model';
import type { Contact } from '@/types';
import { buildPracticeAddress, getPracticeAddressParts } from '@/lib/practice-settings';

export type PracticeTemplateCategory =
  | 'onboarding'
  | 'engagement'
  | 'compliance'
  | 'correspondence'
  | 'reporting';

export interface PracticeTemplateDefinition {
  id: string;
  filename: string;
  name: string;
  description: string;
  category: PracticeTemplateCategory;
  placeholders: string[];
}

export interface PracticeTemplateSection {
  title: string;
  description: string;
  categories: PracticeTemplateCategory[];
  icon: string;
}

export type PracticeTemplateData = Record<string, string | number | undefined>;

const NO_DATA = 'No Data';

const PREVIEW_PRACTICE_SETTINGS: Partial<SystemSettings> = {
  fullName: 'Jordan Blake',
  email: 'practice@example.co.uk',
  phone: '0207 000 1000',
  address: '18 Market Street',
  address_line_2: 'Suite 4',
  city: 'Bristol',
  postcode: 'BS1 4DJ',
  country: 'England',
  companyName: 'Example Practice LLP',
};

const PREVIEW_SAMPLE_CLIENT: Contact = {
  id: 'preview-client-001',
  type: 'business',
  name: 'Example Trading Limited',
  contact_person: 'Avery Collins',
  client_ref: 'PX001',
  email: 'finance@exampletrading.co.uk',
  phone: '0117 555 0198',
  address: '42 Kingsway',
  address_line_2: 'Temple Quarter',
  city: 'Bristol',
  postcode: 'BS1 6AA',
  country: 'England',
  company_number: '08123456',
  legal_entity_type: 'ltd',
  registered_address_line_1: '42 Kingsway',
  registered_address_line_2: 'Temple Quarter',
  registered_city: 'Bristol',
  registered_postcode: 'BS1 6AA',
  registered_country: 'England',
  bank_account_name: 'Example Trading Limited',
  bank_account_number: '12345678',
  bank_sort_code: '20-00-00',
  engagement_letter_sent_date: '2026-01-12',
  engagement_letter_signed_date: '2026-01-15',
  acting_as_agent: true,
  hmrc_agent_authorised: true,
  hmrc_agent_reference: '64-8-32145',
  professional_clearance_received: true,
  previous_accountant: 'Example Previous Accountants Ltd',
  take_on_completed: true,
  aml_risk_rating: 'low',
  aml_review_date: '2027-01-31',
  risk_review_frequency: 'annual',
  id_verified: true,
  source_of_funds_checked: true,
  beneficial_owner_verified: true,
  assigned_reviewer: 'Jamie Carter',
  utr: '4757421224',
  paye_reference: '120/BB97423',
  corporation_tax_reference: '4757421224',
  vat_number: '317838283',
  vat_frequency: 'quarterly',
  vat_scheme: 'invoice',
  mtd_enabled: true,
  billing_model: 'monthly_dd',
  monthly_fee: 146,
  payment_method: 'Direct Debit',
  direct_debit_mandate_signed: true,
  client_manager: 'Jamie Carter',
  partner: 'Jordan Blake',
  internal_rating: 'A',
  sector: 'Wholesale',
  year_end: '2026-02-28',
  software_used: 'xero',
  payroll_frequency: 'monthly',
  notes: 'Preview-only demonstration client for template rendering.',
  created_at: '2026-01-10T09:00:00.000Z',
  updated_at: '2026-03-11T09:00:00.000Z',
  created_by: 'Jordan Blake',
};

const PREVIEW_SAMPLE_SERVICES: ClientServiceEngagement[] = [
  {
    id: 'service-accounts',
    clientId: PREVIEW_SAMPLE_CLIENT.id,
    serviceCode: 'ACCS',
    displayName: 'Annual Accounts',
    category: 'COMPLIANCE',
    complianceType: 'STATUTORY_FILING',
    createsCompliance: true,
    frequency: 'ANNUAL',
    billingType: 'RECURRING',
    billingUnit: 'FIXED_FEE',
    feeAmount: 950,
    startDate: '2026-01-12',
    scheduleMode: 'PERIOD_END',
    periodEndDate: '2026-02-28',
    nextDue: '2026-11-30',
    complianceDates: [],
    isActive: true,
    taskInstances: [],
    createdAt: '2026-01-12T09:00:00.000Z',
    updatedAt: '2026-01-12T09:00:00.000Z',
  },
  {
    id: 'service-vat',
    clientId: PREVIEW_SAMPLE_CLIENT.id,
    serviceCode: 'VAT',
    displayName: 'VAT Returns',
    category: 'COMPLIANCE',
    complianceType: 'TAX_RETURN',
    createsCompliance: true,
    frequency: 'QUARTERLY',
    billingType: 'RECURRING',
    billingUnit: 'FIXED_FEE',
    feeAmount: 200,
    startDate: '2026-01-12',
    scheduleMode: 'PERIOD_END',
    periodEndDate: '2026-03-31',
    nextDue: '2026-05-07',
    complianceDates: [],
    isActive: true,
    taskInstances: [],
    createdAt: '2026-01-12T09:00:00.000Z',
    updatedAt: '2026-01-12T09:00:00.000Z',
  },
  {
    id: 'service-payroll',
    clientId: PREVIEW_SAMPLE_CLIENT.id,
    serviceCode: 'PAYE',
    displayName: 'Monthly Payroll',
    category: 'PAYROLL',
    complianceType: 'TAX_RETURN',
    createsCompliance: true,
    frequency: 'MONTHLY',
    billingType: 'RECURRING',
    billingUnit: 'FIXED_FEE',
    feeAmount: 75,
    startDate: '2026-01-12',
    scheduleMode: 'MANUAL_DUE',
    nextDue: '2026-04-19',
    complianceDates: [],
    isActive: true,
    taskInstances: [],
    createdAt: '2026-01-12T09:00:00.000Z',
    updatedAt: '2026-01-12T09:00:00.000Z',
  },
];

export const PRACTICE_TEMPLATE_LIBRARY: PracticeTemplateDefinition[] = [
  {
    id: 'client_onboarding_pack',
    filename: 'client_onboarding_pack.html',
    name: 'Client Onboarding Pack',
    description: 'Welcome pack covering setup, responsibilities, contacts, and next steps.',
    category: 'onboarding',
    placeholders: ['practice.name', 'client.name', 'client.reference', 'service_rows'],
  },
  {
    id: 'engagement_letter',
    filename: 'agent_client_engagement_letter.html',
    name: 'Professional Engagement Letter',
    description: 'Formal engagement letter for accountancy, tax, and compliance services.',
    category: 'engagement',
    placeholders: ['practice.name', 'client.name', 'service_rows', 'services.total_annual_fee'],
  },
  {
    id: 'authority_letter',
    filename: 'agent_authority_letter.html',
    name: 'Letter of Authority',
    description: 'Client authority for the practice to liaise with HMRC, Companies House, and third parties.',
    category: 'engagement',
    placeholders: ['client.name', 'client.company_number', 'practice.name', 'today'],
  },
  {
    id: 'fee_schedule',
    filename: 'fee_schedule.html',
    name: 'Fee Schedule',
    description: 'Detailed schedule of recurring and annual service fees for the client.',
    category: 'correspondence',
    placeholders: ['client.name', 'service_rows', 'services.total_annual_fee', 'services.total_monthly_fee'],
  },
  {
    id: 'deadline_reminder',
    filename: 'deadline_reminder.html',
    name: 'Deadline Reminder',
    description: 'Reminder letter for the next filing or service deadline and required actions.',
    category: 'compliance',
    placeholders: ['deadline.type', 'deadline.due_date', 'deadline.days_remaining', 'deadline.action_items'],
  },
  {
    id: 'accounts_cover_letter',
    filename: 'accounts_cover_letter.html',
    name: 'Accounts Approval Letter',
    description: 'Cover letter for draft accounts and corporation tax return approval.',
    category: 'compliance',
    placeholders: ['client.name', 'client.year_end', 'deadline.due_date', 'practice.contact'],
  },
  {
    id: 'vat_return_summary',
    filename: 'vat_return_summary.html',
    name: 'VAT Return Summary',
    description: 'Client-ready summary of VAT return period, key figures, and approval action.',
    category: 'compliance',
    placeholders: ['vat.period', 'vat.due_date', 'vat.net_amount', 'client.vat_number'],
  },
  {
    id: 'client_report',
    filename: 'client_report.html',
    name: 'Client Report',
    description: 'Branded summary of client details, fees, services, and Companies House snapshot.',
    category: 'reporting',
    placeholders: ['client_name', 'company_number', 'annual_fee', 'service_rows'],
  },
  {
    id: 'companies_house_report',
    filename: 'companies_house_report.html',
    name: 'Companies House Report',
    description: 'Formatted overview of Companies House profile, filing, officers, and PSC data.',
    category: 'reporting',
    placeholders: ['company_name', 'company_number', 'company_status', 'filings_rows'],
  },
];

export const PRACTICE_TEMPLATE_SECTIONS: PracticeTemplateSection[] = [
  {
    title: 'Client Setup',
    description: 'Welcome, onboarding, and core engagement documents for new clients.',
    categories: ['onboarding', 'engagement'],
    icon: '👥',
  },
  {
    title: 'Compliance & Correspondence',
    description: 'Approval letters, reminders, and fee schedules used during delivery.',
    categories: ['compliance', 'correspondence'],
    icon: '📋',
  },
  {
    title: 'Reports',
    description: 'Practice-ready client and Companies House reporting documents.',
    categories: ['reporting'],
    icon: '📄',
  },
];

function formatDate(value?: string): string {
  if (!value) return NO_DATA;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateLong(value?: string): string {
  if (!value) return NO_DATA;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatCurrency(value?: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return NO_DATA;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLabel(value?: string | null): string {
  if (!value) return NO_DATA;
  return String(value)
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function joinAddress(parts: Array<string | undefined>): string {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ') || NO_DATA;
}

function annualisedFee(service: ClientServiceEngagement): number {
  switch (service.frequency) {
    case 'WEEKLY':
      return service.feeAmount * 52;
    case 'MONTHLY':
      return service.feeAmount * 12;
    case 'QUARTERLY':
      return service.feeAmount * 4;
    case 'ANNUAL':
    case 'AD_HOC':
    default:
      return service.feeAmount;
  }
}

function serviceRows(services: ClientServiceEngagement[]): string {
  if (!services.length) {
    return '<tr><td colspan="4">No Data</td></tr>';
  }

  return services
    .map(
      (service) => `<tr>
<td>${service.displayName}</td>
<td>${formatLabel(service.frequency)}</td>
<td>${formatCurrency(service.feeAmount)}</td>
<td>${formatDate(service.nextDue)}</td>
</tr>`
    )
    .join('');
}

function nextDeadline(services: ClientServiceEngagement[]) {
  const dated = services
    .filter((service) => service.nextDue)
    .map((service) => ({ service, date: new Date(service.nextDue as string) }))
    .filter((entry) => !Number.isNaN(entry.date.getTime()))
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  return dated[0]?.service;
}

function daysUntil(value?: string): string {
  if (!value) return NO_DATA;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return NO_DATA;
  const today = new Date();
  const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return String(diff);
}

function buildNoDataRow(columnCount: number): string {
  return `<tr><td colspan="${columnCount}">${NO_DATA}</td></tr>`;
}

export function buildPracticeTemplateData(input?: {
  client?: Contact | null;
  settings?: Partial<SystemSettings> | null;
  services?: ClientServiceEngagement[];
}): PracticeTemplateData {
  const client = input?.client ?? null;
  const settings = input?.settings || {};
  const services = input?.services || [];
  const today = new Date();
  const registeredAddress = joinAddress([
    client?.registered_address_line_1 || client?.address,
    client?.registered_address_line_2 || client?.address_line_2,
    client?.registered_city || client?.city,
    client?.registered_postcode || client?.postcode,
    client?.registered_country || client?.country,
  ]);
  const practiceAddress = buildPracticeAddress(settings);
  const practiceAddressParts = getPracticeAddressParts(settings);
  const nextService = nextDeadline(services);
  const totalAnnualFee = services.reduce((sum, service) => sum + annualisedFee(service), 0);
  const totalMonthlyFee = services
    .filter((service) => service.frequency === 'MONTHLY')
    .reduce((sum, service) => sum + service.feeAmount, 0);
  const clientManager = client?.client_manager;
  const partner = client?.partner;
  const reviewer = client?.assigned_reviewer;
  const clientRef = client?.client_ref || client?.id;
  const companyNumber = client?.company_number;
  const vatPeriodEnd = client?.accounts_reference_date || client?.year_end || nextService?.nextDue || '';
  const vatDueDate = nextService?.serviceCode === 'VAT' ? nextService.nextDue : '';

  return {
    document_title: 'Practice Template',
    today: formatDateLong(today.toISOString()),
    year: String(today.getFullYear()),
    generated_date: formatDateLong(today.toISOString()),
    generated_time: today.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    'practice.name': settings.companyName || settings.declarantOrganisationName,
    'practice.tagline': undefined,
    'practice.registration_number': settings.agentId,
    'practice.contact': settings.fullName,
    'practice.email': settings.email,
    'practice.phone': settings.phone,
    'practice.address': practiceAddress,
    'practice.website': undefined,
    'client.name': client?.name,
    'client.reference': clientRef,
    'client.contact_name': client?.contact_person || client?.name,
    'client.email': client?.email,
    'client.phone': client?.phone,
    'client.address': joinAddress([client?.address, client?.address_line_2, client?.city, client?.postcode, client?.country]),
    'client.registered_address': registeredAddress,
    'client.company_number': companyNumber,
    'client.entity_type': formatLabel(client?.legal_entity_type || client?.engagement_type || client?.type),
    'client.year_end': formatDate(client?.year_end),
    'client.manager': clientManager,
    'client.partner': partner,
    'client.assigned_reviewer': reviewer,
    'client.software': formatLabel(client?.software_used),
    'client.billing_model': formatLabel(client?.billing_model),
    'client.payment_method': client?.payment_method,
    'client.monthly_fee': formatCurrency(client?.monthly_fee),
    'client.registered_name': client?.name,
    'client.vat_number': client?.vat_number,
    'client.utr': client?.utr,
    'client.corporation_tax_ref': client?.corporation_tax_reference,
    'client.paye_reference': client?.paye_reference,
    'client.previous_accountant': client?.previous_accountant,
    'client.hmrc_agent_reference': client?.hmrc_agent_reference,
    'services.total_annual_fee': formatCurrency(totalAnnualFee),
    'services.total_monthly_fee': formatCurrency(totalMonthlyFee),
    'services.summary_count': String(services.length),
    'services.records_due_date': formatDate(nextService?.nextDue),
    service_rows: serviceRows(services),
    'deadline.type': nextService?.displayName,
    'deadline.due_date': formatDate(nextService?.nextDue),
    'deadline.days_remaining': daysUntil(nextService?.nextDue),
    'deadline.action_items': undefined,
    'deadline.contact': settings.email,
    'deadline.notes': undefined,
    'vat.period': vatPeriodEnd ? `Period ending ${formatDate(vatPeriodEnd)}` : undefined,
    'vat.due_date': formatDate(vatDueDate || nextService?.nextDue),
    'vat.net_amount': undefined,
    'vat.scheme': formatLabel(client?.vat_scheme),
    'vat.frequency': formatLabel(client?.vat_frequency),
    'accounts.year_end': formatDate(client?.year_end),
    'accounts.approval_due': formatDate(nextService?.nextDue),
    'accounts.manager': clientManager,
    'accounts.notes': undefined,
    client_name: client?.name,
    client_ref: clientRef,
    company_number: companyNumber,
    registered_address: registeredAddress,
    practice_name: settings.companyName || settings.declarantOrganisationName,
    prepared_by: settings.fullName,
    practice_email: settings.email,
    practice_phone: settings.phone,
    practice_address: practiceAddress,
    annual_fee: formatCurrency(totalAnnualFee),
    monthly_recurring: formatCurrency(totalMonthlyFee),
    open_tasks: String(services.reduce((sum, service) => sum + service.taskInstances.filter((task) => task.status !== 'DONE').length, 0)),
    next_filing_due: formatDate(nextService?.nextDue),
    risk_level: formatLabel(client?.aml_risk_rating),
    risk_score: undefined,
    compliance_coverage: services.length ? '100%' : '0%',
    covered_services: String(services.length),
    client_manager: clientManager,
    responsible_partner: partner,
    assigned_reviewer: reviewer,
    accounting_software: formatLabel(client?.software_used),
    billing_model: formatLabel(client?.billing_model),
    payroll_frequency: formatLabel(client?.payroll_frequency),
    contact_email: client?.email,
    contact_phone: client?.phone,
    utr: client?.utr,
    corporation_tax_ref: client?.corporation_tax_reference,
    self_assessment_utr: client?.self_assessment_utr,
    ni_number: client?.ni_number,
    vat_number: client?.vat_number,
    vat_scheme: formatLabel(client?.vat_scheme),
    vat_frequency: formatLabel(client?.vat_frequency),
    paye_reference: client?.paye_reference,
    company_name: client?.name,
    company_status: undefined,
    company_status_badge_class: 'neutral',
    company_type: formatLabel(client?.legal_entity_type),
    company_incorporated: undefined,
    company_jurisdiction: undefined,
    company_registered_office: registeredAddress,
    company_sic_codes: client?.sector,
    company_can_file: undefined,
    company_has_charges: undefined,
    company_has_insolvency_history: undefined,
    accounts_next_due: formatDate(nextService?.serviceCode === 'ACCS' ? nextService.nextDue : client?.year_end),
    accounts_due_badge_class: 'neutral',
    accounts_due_badge_text: NO_DATA,
    confirmation_next_due: undefined,
    confirmation_due_badge_class: 'neutral',
    confirmation_due_badge_text: NO_DATA,
    officers_summary: undefined,
    officers_rows: buildNoDataRow(6),
    filings_count: '0',
    filings_rows: buildNoDataRow(4),
    charges_text: NO_DATA,
    psc_count: '0',
    psc_rows: buildNoDataRow(4),
    raw_json: NO_DATA,
    settings_business_name: settings.companyName || settings.declarantOrganisationName,
    settings_address_line1: practiceAddressParts.line1,
    settings_address_line2: practiceAddressParts.line2 ? `, ${practiceAddressParts.line2}` : '',
    settings_city: practiceAddressParts.city,
    settings_postcode: practiceAddressParts.postcode,
    settings_email: settings.email,
    settings_phone: settings.phone,
    next_accounts_made_up_to: formatDate(client?.year_end),
    accounts_due_by: formatDate(nextService?.serviceCode === 'ACCS' ? nextService.nextDue : ''),
    last_accounts_made_up_to: undefined,
    next_statement_date: undefined,
    statement_due_by: undefined,
    last_statement_dated: undefined,
    last_synced: undefined,
  };
}

export function getPracticeTemplateSampleData(): PracticeTemplateData {
  return buildPracticeTemplateData({
    client: PREVIEW_SAMPLE_CLIENT,
    settings: PREVIEW_PRACTICE_SETTINGS,
    services: PREVIEW_SAMPLE_SERVICES,
  });
}
