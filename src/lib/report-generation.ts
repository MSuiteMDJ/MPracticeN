import { buildPracticeTemplateData } from '@/lib/practice-template-library';
import {
  companiesHouseAPI,
  contactsAPI,
  documentsAPI,
  type CompaniesHouseProfileResponse,
  type CompaniesHouseOfficer,
  type PracticeDocumentRecord,
} from '@/lib/api-service';
import { generateDocument, type TemplateData } from '@/lib/templateGenerator';
import type { Contact } from '@/types';
import type { SystemSettings } from '@/contexts/SettingsContext';
import { calculateAnnualCost, type ClientServiceEngagement } from '@/lib/service-model';
import { buildPracticeAddress } from '@/lib/practice-settings';

const NO_DATA = 'No Data';

function formatDate(value: string | undefined | null): string {
  if (!value) return NO_DATA;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatStatus(value: string | undefined | null): string {
  if (!value) return NO_DATA;
  return String(value)
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatLabel(value: string | undefined | null): string {
  if (!value) return NO_DATA;
  return String(value)
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function loadTeamDirectory(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('auth_token');
  if (!token) return {};
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3003';

  const nextDirectory: Record<string, string> = {};

  const [meRes, teamRes] = await Promise.allSettled([
    fetch(`${apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${apiUrl}/auth/team`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  if (meRes.status === 'fulfilled' && meRes.value.ok) {
    const meData = await meRes.value.json();
    const me = meData?.user;
    if (me?.id) {
      nextDirectory[String(me.id)] =
        [me.first_name, me.last_name].filter(Boolean).join(' ').trim() || me.email || String(me.id);
    }
  }

  if (teamRes.status === 'fulfilled' && teamRes.value.ok) {
    const teamData = await teamRes.value.json();
    const users = Array.isArray(teamData?.users) ? teamData.users : [];
    users.forEach((user) => {
      nextDirectory[String(user.id)] =
        [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email || String(user.id);
    });
  }

  return nextDirectory;
}

function resolveUserLabel(value: string | undefined | null, directory: Record<string, string>): string {
  if (!value) return NO_DATA;
  return directory[value] || value;
}

function formatBoolean(value: boolean | undefined | null): string {
  if (value === undefined || value === null) return NO_DATA;
  return value ? 'Yes' : 'No';
}

function formatCurrencyValue(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return NO_DATA;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function normalizePersonName(value: string | undefined | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.includes(',')) {
    const [last, ...rest] = raw.split(',');
    return `${rest.join(' ').trim()} ${last.trim()}`.replace(/\s+/g, ' ').trim().toLowerCase();
  }
  return raw.replace(/\s+/g, ' ').trim().toLowerCase();
}

function compareIsoDates(left?: string, right?: string): number {
  const leftValue = left ? Date.parse(left) : Number.POSITIVE_INFINITY;
  const rightValue = right ? Date.parse(right) : Number.POSITIVE_INFINITY;
  return leftValue - rightValue;
}

function buildClientServiceRows(services: ClientServiceEngagement[]): string {
  if (!services.length) return '<tr><td colspan="6">No Data</td></tr>';

  return services
    .map((service) => {
      const complianceSummary = service.complianceDates.length
        ? service.complianceDates
            .map((date) => `${date.label}: ${formatDate(date.dueDate)}`)
            .join(' • ')
        : formatDate(service.nextDue);

      return `<tr>
<td>${escapeHtml(service.displayName || NO_DATA)}</td>
<td>${escapeHtml(formatLabel(service.frequency))}</td>
<td>${escapeHtml(formatCurrencyValue(calculateAnnualCost(service)))}</td>
<td>${escapeHtml(formatDate(service.nextDue))}</td>
<td>${escapeHtml(complianceSummary)}</td>
<td>${escapeHtml(service.isActive ? 'Active' : 'Inactive')}</td>
</tr>`;
    })
    .join('');
}

function buildDeadlineRows(services: ClientServiceEngagement[]): string {
  const rows = services
    .flatMap((service) => {
      const deadlines = service.complianceDates.length
        ? service.complianceDates.map((date) => ({
            serviceName: service.displayName || NO_DATA,
            dueDate: date.dueDate,
            description: date.label,
            taskCount: service.taskInstances.filter((task) => task.status !== 'DONE').length,
          }))
        : service.nextDue
          ? [{
              serviceName: service.displayName || NO_DATA,
              dueDate: service.nextDue,
              description: 'Next compliance date',
              taskCount: service.taskInstances.filter((task) => task.status !== 'DONE').length,
            }]
          : [];
      return deadlines;
    })
    .sort((left, right) => compareIsoDates(left.dueDate, right.dueDate));

  if (!rows.length) return '<tr><td colspan="4">No Data</td></tr>';

  return rows
    .map(
      (row) => `<tr>
<td>${escapeHtml(row.serviceName)}</td>
<td>${escapeHtml(formatDate(row.dueDate))}</td>
<td>${escapeHtml(row.description)}</td>
<td>${escapeHtml(row.taskCount ? String(row.taskCount) : NO_DATA)}</td>
</tr>`
    )
    .join('');
}

function buildTaskRows(services: ClientServiceEngagement[]): string {
  const rows = services
    .flatMap((service) =>
      service.taskInstances.map((task) => ({
        serviceName: service.displayName || NO_DATA,
        title: task.title || NO_DATA,
        dueDate: task.dueDate,
        status: formatLabel(task.status),
        priority: formatLabel(task.priority),
      }))
    )
    .sort((left, right) => compareIsoDates(left.dueDate, right.dueDate));

  if (!rows.length) return '<tr><td colspan="5">No Data</td></tr>';

  return rows
    .map(
      (row) => `<tr>
<td>${escapeHtml(row.serviceName)}</td>
<td>${escapeHtml(row.title)}</td>
<td>${escapeHtml(formatDate(row.dueDate))}</td>
<td>${escapeHtml(row.status)}</td>
<td>${escapeHtml(row.priority)}</td>
</tr>`
    )
    .join('');
}

function buildDirectorRows(officers: CompaniesHouseOfficer[], relatedClients: Contact[]): string {
  if (!officers.length) return '<tr><td colspan="5">No Data</td></tr>';

  return officers
    .map((officer) => {
      const linkedClient = relatedClients.find(
        (client) => normalizePersonName(client.name) === normalizePersonName(officer.displayName || officer.name)
      );
      return `<tr${officer.status === 'resigned' ? ' class="historical-row"' : ''}>
<td>${escapeHtml(officer.displayName || officer.name || NO_DATA)}</td>
<td>${escapeHtml(formatLabel(officer.role || 'director'))}</td>
<td>${escapeHtml(formatDate(officer.appointedOn))}</td>
<td>${escapeHtml(formatDate(officer.resignedOn))}</td>
<td>${escapeHtml(linkedClient?.client_ref || NO_DATA)}</td>
</tr>`;
    })
    .join('');
}

function buildDocumentRows(documents: PracticeDocumentRecord[]): string {
  if (!documents.length) return '<tr><td colspan="5">No Data</td></tr>';

  return documents
    .sort((left, right) => compareIsoDates(left.created_at, right.created_at))
    .map(
      (document) => `<tr>
<td>${escapeHtml(document.document_type || NO_DATA)}</td>
<td>${escapeHtml(document.category || NO_DATA)}</td>
<td>${escapeHtml(formatDate(document.updated_at || document.created_at))}</td>
<td>${escapeHtml(String(document.version || 1))}</td>
<td>${escapeHtml(document.file_name || NO_DATA)}</td>
</tr>`
    )
    .join('');
}

function buildAdvisoryText(input: {
  client: Contact;
  services: ClientServiceEngagement[];
  documents: PracticeDocumentRecord[];
}): string {
  const items: string[] = [];

  if (!input.client.engagement_letter_signed_date) {
    items.push('Engagement letter has not been signed.');
  }

  const overdueDeadlines = input.services.flatMap((service) =>
    service.complianceDates.filter((date) => date.dueDate && Date.parse(date.dueDate) < Date.now())
  );
  if (overdueDeadlines.length) {
    items.push(`${overdueDeadlines.length} compliance deadline${overdueDeadlines.length === 1 ? '' : 's'} overdue.`);
  }

  const overdueTasks = input.services.flatMap((service) =>
    service.taskInstances.filter((task) => task.status !== 'DONE' && task.dueDate && Date.parse(task.dueDate) < Date.now())
  );
  if (overdueTasks.length) {
    items.push(`${overdueTasks.length} service task${overdueTasks.length === 1 ? '' : 's'} overdue.`);
  }

  if (!input.documents.length) {
    items.push('No client documents uploaded.');
  }

  if (!items.length) return NO_DATA;

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

export function makeReportFileName(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'report';
}

export async function generatePracticeClientReport(input: {
  client: Contact;
  settings: Partial<SystemSettings>;
  services: ClientServiceEngagement[];
}) {
  const [teamDirectory, companiesHouseResponse, relatedClients, documentResponse] = await Promise.all([
    loadTeamDirectory(),
    input.client.company_number
      ? companiesHouseAPI
          .getCompanyProfile(input.client.company_number, { itemsPerPage: 10 })
          .catch(() => null)
      : Promise.resolve(null),
    contactsAPI.getRelatedClients(input.client.id).catch(() => []),
    documentsAPI.listDocuments({ clientId: input.client.id }).catch(() => ({ documents: [] })),
  ]);

  const baseData = buildPracticeTemplateData({
    client: input.client,
    settings: input.settings,
    services: input.services,
  });

  const company = companiesHouseResponse?.profile.company;
  const compliance = companiesHouseResponse?.profile.compliance;
  const accounts = (compliance?.accounts ?? null) as
    | {
        next_made_up_to?: string;
        next_due?: string;
        next_accounts?: { period_end_on?: string; due_on?: string };
        last_accounts?: { made_up_to?: string; period_end_on?: string };
      }
    | null;
  const confirmation = (compliance?.confirmationStatement ?? null) as
    | {
        next_statement_date?: string;
        next_made_up_to?: string;
        next_due?: string;
        last_made_up_to?: string;
      }
    | null;

  const documents = Array.isArray(documentResponse.documents) ? documentResponse.documents : [];
  const serviceRows = buildClientServiceRows(input.services);
  const deadlineRows = buildDeadlineRows(input.services);
  const taskRows = buildTaskRows(input.services);
  const directorRows = buildDirectorRows(companiesHouseResponse?.profile.officers.items || [], relatedClients);
  const documentRows = buildDocumentRows(documents);
  const advisoryText = buildAdvisoryText({
    client: input.client,
    services: input.services,
    documents,
  });
  const portfolioName = input.client.portfolio_name || NO_DATA;
  const clientType = formatLabel(input.client.legal_entity_type || input.client.engagement_type || input.client.type);
  const primaryContactName = input.client.contact_person || input.client.name || NO_DATA;
  const primaryContactEmail = input.client.email || NO_DATA;
  const primaryContactPhone = input.client.phone || NO_DATA;
  const contactAddress = String(baseData['client.address'] || NO_DATA);

  const reportData: TemplateData = {
    ...baseData,
    client_type: clientType,
    portfolio_name: portfolioName,
    internal_rating: input.client.internal_rating || NO_DATA,
    primary_contact_name: primaryContactName,
    primary_contact_email: primaryContactEmail,
    primary_contact_phone: primaryContactPhone,
    contact_address: contactAddress,
    aml_risk_rating: formatLabel(input.client.aml_risk_rating),
    risk_review_frequency: formatLabel(input.client.risk_review_frequency),
    aml_review_date: formatDate(input.client.aml_review_date),
    id_verified: formatBoolean(input.client.id_verified),
    source_of_funds_checked: formatBoolean(input.client.source_of_funds_checked),
    beneficial_owner_verified: formatBoolean(input.client.beneficial_owner_verified),
    hmrc_agent_authorised: formatBoolean(input.client.hmrc_agent_authorised),
    professional_clearance_received: formatBoolean(input.client.professional_clearance_received),
    take_on_completed: formatBoolean(input.client.take_on_completed),
    engagement_type: formatLabel(input.client.engagement_type || input.client.legal_entity_type || input.client.type),
    engagement_letter_sent_date: formatDate(input.client.engagement_letter_sent_date),
    engagement_letter_signed_date: formatDate(input.client.engagement_letter_signed_date),
    payment_method: formatLabel(input.client.payment_method),
    last_fee_review_date: formatDate(input.client.last_fee_review_date),
    client_manager: resolveUserLabel(input.client.client_manager, teamDirectory),
    responsible_partner: resolveUserLabel(input.client.partner, teamDirectory),
    assigned_reviewer: resolveUserLabel(input.client.assigned_reviewer, teamDirectory),
    service_rows: serviceRows,
    deadline_rows: deadlineRows,
    task_rows: taskRows,
    director_rows: directorRows,
    document_rows: documentRows,
    advisory_text: advisoryText,
    company_status: formatLabel(company?.companyStatus),
    company_type: formatLabel(company?.companyType),
    incorporated_on: formatDate(company?.dateOfCreation),
    last_synced: companiesHouseResponse ? formatDate(new Date().toISOString()) : NO_DATA,
    next_accounts_made_up_to: formatDate(
      accounts?.next_made_up_to || accounts?.next_accounts?.period_end_on
    ),
    accounts_due_by: formatDate(accounts?.next_due || accounts?.next_accounts?.due_on),
    last_accounts_made_up_to: formatDate(
      accounts?.last_accounts?.made_up_to || accounts?.last_accounts?.period_end_on
    ),
    next_statement_date: formatDate(
      confirmation?.next_statement_date || confirmation?.next_made_up_to
    ),
    statement_due_by: formatDate(confirmation?.next_due),
    last_statement_dated: formatDate(confirmation?.last_made_up_to),
  };

  const html = await generateDocument('client_report.html', reportData);

  return {
    title: `${input.client.name || 'Client'} Report`,
    reportType: 'client_report',
    templateFile: 'client_report.html',
    html,
  };
}

export async function generateCompaniesHouseHtmlReport(input: {
  companyNumber: string;
  settings: Partial<SystemSettings>;
}) {
  const response = await companiesHouseAPI.getCompanyProfile(input.companyNumber, {
    itemsPerPage: 50,
  });
  const reportData = buildCompaniesHouseReportData(response, input.settings);
  const html = await generateDocument('companies_house_report.html', reportData);

  return {
    title: `${reportData.company_name || 'Company'} Companies House Report`,
    reportType: 'companies_house_report',
    templateFile: 'companies_house_report.html',
    html,
  };
}

export function buildCompaniesHouseReportData(
  response: CompaniesHouseProfileResponse,
  settings: Partial<SystemSettings>
): TemplateData {
  const profileData = response.profile;
  const company = profileData.company;
  const accounts = profileData.compliance.accounts as
    | {
        next_due?: string;
        overdue?: boolean;
        next_accounts?: { due_on?: string; overdue?: boolean };
      }
    | null;
  const confirmation = profileData.compliance.confirmationStatement as
    | {
        next_due?: string;
        overdue?: boolean;
      }
    | null;
  const generatedAt = new Date();

  const officersRows = profileData.officers.items.length
    ? profileData.officers.items
        .map(
          (officer) => `<tr${officer.status === 'resigned' ? ' class="historical-row"' : ''}>
<td>${escapeHtml(officer.displayName || officer.name || NO_DATA)}</td>
<td>${escapeHtml(formatStatus(officer.role || ''))}</td>
<td>${escapeHtml(formatDate(officer.appointedOn))}</td>
<td>${escapeHtml(formatDate(officer.resignedOn))}</td>
<td>${escapeHtml(officer.nationality || NO_DATA)}</td>
<td>${escapeHtml(officer.countryOfResidence || NO_DATA)}</td>
</tr>`
        )
        .join('')
    : '<tr><td colspan="6">No Data</td></tr>';

  const filingRows = profileData.filingHistory.items.length
    ? profileData.filingHistory.items
        .slice(0, 50)
        .map(
          (filing) => `<tr>
<td>${escapeHtml(formatDate(filing.date))}</td>
<td>${escapeHtml(filing.description || NO_DATA)}</td>
<td>${escapeHtml(formatStatus(filing.category || ''))}</td>
<td>${escapeHtml(filing.type || NO_DATA)}</td>
</tr>`
        )
        .join('')
    : '<tr><td colspan="4">No Data</td></tr>';

  const pscRows = profileData.psc.items.length
    ? profileData.psc.items
        .map(
          (psc) => `<tr${psc.status === 'ceased' ? ' class="historical-row"' : ''}>
<td>${escapeHtml(psc.displayName || psc.name || NO_DATA)}</td>
<td>${escapeHtml(formatStatus(psc.kind || ''))}</td>
<td>${escapeHtml(formatDate(psc.notifiedOn))}</td>
<td>${escapeHtml(psc.natureOfControl.length ? psc.natureOfControl.join(' • ') : NO_DATA)}</td>
</tr>`
        )
        .join('')
    : '<tr><td colspan="4">No Data</td></tr>';

  const accountsDueOverdue = Boolean(accounts?.overdue || accounts?.next_accounts?.overdue);
  const confirmationDueOverdue = Boolean(confirmation?.overdue);
  const companyStatusRaw = String(company.companyStatus || '').toLowerCase();
  const companyStatusBadgeClass =
    companyStatusRaw === 'active'
      ? 'success'
      : companyStatusRaw === 'dissolved'
        ? 'danger'
        : 'warning';

  return {
    company_name: company.companyName || NO_DATA,
    company_number: company.companyNumber || NO_DATA,
    generated_date: generatedAt.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
    generated_time: generatedAt.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    company_status: formatStatus(company.companyStatus),
    company_status_badge_class: companyStatusBadgeClass,
    company_type: formatStatus(company.companyType),
    company_incorporated: formatDate(company.dateOfCreation),
    company_jurisdiction: formatStatus(company.jurisdiction),
    company_registered_office: company.fullAddress || NO_DATA,
    company_sic_codes: company.sicCodes.length ? company.sicCodes.join(', ') : NO_DATA,
    company_can_file: company.canFile ? 'Yes' : 'No',
    company_has_charges: company.hasCharges ? 'Yes' : 'No',
    company_has_insolvency_history: company.hasInsolvencyHistory ? 'Yes' : 'No',
    accounts_next_due: formatDate(accounts?.next_due || accounts?.next_accounts?.due_on),
    accounts_due_badge_class: accountsDueOverdue ? 'danger' : 'success',
    accounts_due_badge_text: accountsDueOverdue ? 'OVERDUE' : 'On Track',
    confirmation_next_due: formatDate(confirmation?.next_due),
    confirmation_due_badge_class: confirmationDueOverdue ? 'danger' : 'success',
    confirmation_due_badge_text: confirmationDueOverdue ? 'OVERDUE' : 'On Track',
    officers_summary: `${profileData.officers.active} Active, ${profileData.officers.resigned} Resigned`,
    officers_rows: officersRows,
    filings_count: String(Math.min(profileData.filingHistory.items.length, 50)),
    filings_rows: filingRows,
    charges_text:
      profileData.charges.total > 0
        ? `Total charges: ${profileData.charges.total} (Satisfied: ${profileData.charges.satisfiedCount}, Part satisfied: ${profileData.charges.partSatisfiedCount})`
        : NO_DATA,
    psc_count: String(profileData.psc.total),
    psc_rows: pscRows,
    raw_json: escapeHtml(JSON.stringify(profileData, null, 2)),
    practice_name: settings.companyName || settings.declarantOrganisationName || settings.fullName || NO_DATA,
    practice_address: buildPracticeAddress(settings) || NO_DATA,
    practice_email: settings.email || NO_DATA,
    practice_phone: settings.phone || NO_DATA,
    year: String(generatedAt.getFullYear()),
  };
}
