import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  Wallet,
} from 'lucide-react';
import {
  type AuditEventRecord,
  companiesHouseAPI,
  contactsAPI,
  type CompaniesHouseOfficer,
  type CompaniesHouseProfileResponse,
  type CompaniesHousePsc,
} from '@/lib/api-service';
import type { Contact } from '@/types';
import { useSettings } from '@/contexts/SettingsContext';
import type { ClientProfile } from '@/lib/client-insights';
import { buildClientProfile } from '@/lib/client-insights';
import { generateDocument, openGeneratedDocument, type TemplateData } from '@/lib/templateGenerator';
import { buildPracticeAddress } from '@/lib/practice-settings';
import { generatePracticeClientReport } from '@/lib/report-generation';
import OnboardingChecklist from '@/components/client/OnboardingChecklist';
import ClientDocuments from '@/components/client/ClientDocuments';
import DocumentTemplateGenerator from '@/components/client/DocumentTemplateGenerator';
import {
  addClientServiceEngagement,
  calculateAnnualCost,
  getClientServiceEngagements,
  getServiceScheduleRule,
  getServiceTemplates,
  mapContactTypeToCanonical,
  removeClientServiceEngagement,
  removeClientServiceEngagementsForClient,
  subscribeToServiceDataUpdates,
  updateClientServiceEngagement,
  updateClientServiceTaskStatus,
  type ClientServiceEngagement,
  type Frequency,
  type ServiceTemplateModel,
} from '@/lib/service-model';

const currencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

type ClientTab =
  | 'overview'
  | 'services'
  | 'compliance'
  | 'engagement'
  | 'companies-house'
  | 'documents'
  | 'notes'
  | 'audit-log';

const clientTabs: { key: ClientTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'services', label: 'Services' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'companies-house', label: 'Companies House' },
  { key: 'documents', label: 'Documents' },
  { key: 'notes', label: 'Notes' },
  { key: 'audit-log', label: 'Audit Log' },
];

const serviceFrequencyOptions: Frequency[] = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'AD_HOC'];

type AccountsComplianceSnapshot = {
  next_made_up_to?: string;
  next_due?: string;
  overdue?: boolean;
  next_accounts?: {
    period_end_on?: string;
    due_on?: string;
    overdue?: boolean;
  };
  last_accounts?: {
    made_up_to?: string;
    period_end_on?: string;
  };
};

type ConfirmationComplianceSnapshot = {
  next_made_up_to?: string;
  next_statement_date?: string;
  next_due?: string;
  last_made_up_to?: string;
  overdue?: boolean;
};

type TeamUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
};

type TeamOption = {
  value: string;
  label: string;
};

type CompaniesHouseTab = 'company-details' | 'officers' | 'psc' | 'filings';

type RiskBucket = 'low' | 'medium' | 'high' | 'critical';

type RiskFactor = {
  label: string;
  points: number;
};

type EditableSection = 'identity' | 'engagement' | 'aml' | 'tax' | 'ops';

const SECTION_LABELS: Record<EditableSection, string> = {
  identity: 'Client Identity',
  engagement: 'Engagement & Authority',
  aml: 'AML & Risk',
  tax: 'Tax Registrations',
  ops: 'Ownership & Operations',
};

const SECTION_FIELDS: Record<EditableSection, Array<keyof Contact>> = {
  identity: [
    'name',
    'contact_person',
    'email',
    'phone',
    'address',
    'address_line_2',
    'city',
    'postcode',
    'country',
    'legal_entity_type',
    'vat_number',
    'company_number',
  ],
  engagement: [
    'engagement_type',
    'engagement_letter_sent_date',
    'engagement_letter_signed_date',
    'acting_as_agent',
    'hmrc_agent_authorised',
    'hmrc_agent_reference',
    'government_gateway_username',
    'government_gateway_password',
    'auth_code_delivery_contact',
    'companies_house_auth_code',
    'directors_ch_verification_no',
    'professional_clearance_received',
    'take_on_completed',
    'previous_accountant',
  ],
  aml: [
    'aml_risk_rating',
    'aml_review_date',
    'risk_review_frequency',
    'id_verification_method',
    'id_verified',
    'source_of_funds_checked',
    'beneficial_owner_verified',
    'psc_verified',
    'pep_flag',
    'ongoing_monitoring_flag',
    'assigned_reviewer',
    'aml_notes',
  ],
  tax: [
    'utr',
    'vat_number',
    'paye_reference',
    'ni_number',
    'vat_scheme',
    'vat_frequency',
    'vat_stagger',
    'mtd_enabled',
    'accounts_reference_date',
    'field_statuses',
  ],
  ops: [
    'client_manager',
    'partner',
    'sector',
    'internal_rating',
    'software_used',
    'billing_model',
    'payment_method',
    'bank_account_name',
    'bank_sort_code',
    'bank_account_number',
    'monthly_fee',
    'credit_terms',
    'payroll_frequency',
    'last_fee_review_date',
    'direct_debit_mandate_signed',
  ],
};

function normalizeClientTab(raw: string | null): ClientTab {
  if (!raw) return 'overview';
  const normalized = raw.toLowerCase();
  if (normalized === 'onboarding' || normalized === 'work' || normalized === 'financials') {
    return 'services';
  }
  if (normalized === 'practice' || normalized === 'aml' || normalized === 'tax') {
    return 'engagement';
  }

  if (
    normalized === 'overview' ||
    normalized === 'services' ||
    normalized === 'compliance' ||
    normalized === 'engagement' ||
    normalized === 'companies-house' ||
    normalized === 'documents' ||
    normalized === 'notes' ||
    normalized === 'audit-log'
  ) {
    return normalized;
  }

  return 'overview';
}

function statusTone(status: string): string {
  const value = status.toLowerCase();
  if (value === 'complete' || value === 'completed' || value === 'active' || value === 'valid') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (value === 'warning' || value === 'expiring' || value === 'pending' || value === 'draft') {
    return 'bg-amber-100 text-amber-700';
  }
  if (value === 'alert' || value === 'missing' || value === 'required' || value === 'overdue') {
    return 'bg-rose-100 text-rose-700';
  }
  return 'bg-slate-100 text-slate-700';
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatYearEndValue(value?: string): string {
  if (!value) return '—';
  const trimmed = String(value).trim();
  const ukDate = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2}|\d{4}))?$/);
  if (ukDate) {
    const day = Number(ukDate[1]);
    const month = Number(ukDate[2]);
    const yearToken = ukDate[3];
    const year = yearToken ? Number(yearToken.length === 2 ? `20${yearToken}` : yearToken) : 2000;
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      });
    }
  }

  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = isoDate
    ? new Date(Date.UTC(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3])))
    : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function resolveYearEndDisplay(contact?: Pick<Contact, 'type' | 'year_end' | 'accounts_reference_date'> | null): string {
  if (!contact) return '—';
  if (contact.year_end) return formatYearEndValue(contact.year_end);
  if (contact.accounts_reference_date) return formatYearEndValue(contact.accounts_reference_date);
  return '—';
}

function formatLabel(value?: string | null): string {
  if (!value) return '—';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCompaniesHouseFilingDescription(value?: string | null): string {
  if (!value) return '—';
  return formatLabel(value)
    .replace(/\bPsc\b/g, 'PSC')
    .replace(/\bCh\b/g, 'CH');
}

function formatBoolean(value?: boolean, whenTrue: string = 'Yes', whenFalse: string = 'No'): string {
  if (value === undefined || value === null) return '—';
  return value ? whenTrue : whenFalse;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toneForRisk(risk: RiskBucket): { label: string; classes: string } {
  if (risk === 'critical') return { label: 'Critical Risk', classes: 'bg-rose-200 text-rose-800' };
  if (risk === 'high') return { label: 'High Risk', classes: 'bg-rose-100 text-rose-700' };
  if (risk === 'medium') return { label: 'Medium Risk', classes: 'bg-amber-100 text-amber-700' };
  return { label: 'Low Risk', classes: 'bg-emerald-100 text-emerald-700' };
}

function riskLevelFromScore(score: number): RiskBucket {
  if (score >= 60) return 'critical';
  if (score >= 35) return 'high';
  if (score >= 15) return 'medium';
  return 'low';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePartyLookupKey(value?: string | null): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized.includes(',')) return normalized;

  const commaIndex = normalized.indexOf(',');
  const lastName = normalized.slice(0, commaIndex).trim();
  const givenNames = normalized.slice(commaIndex + 1).trim();
  return [givenNames, lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function buildPartyAddress(address?: {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postcode?: string;
  country?: string;
} | null): {
  address?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  country?: string;
} {
  if (!address) return {};

  const addressLine2 = [address.line2, address.region]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');

  return {
    address: String(address.line1 || '').trim() || undefined,
    addressLine2: addressLine2 || undefined,
    city: String(address.city || '').trim() || undefined,
    postcode: String(address.postcode || '').trim() || undefined,
    country: String(address.country || '').trim() || undefined,
  };
}

function DataField({ label, value }: { label: string; value: string | number | undefined | null }) {
  const safeValue = value === undefined || value === null || value === '' ? '—' : value;
  return (
    <dl className="text-sm text-slate-600">
      <dt className="font-semibold text-slate-800">{label}</dt>
      <dd>{safeValue}</dd>
    </dl>
  );
}

function isFieldStatusApplicable(status?: Contact['field_statuses'][string]) {
  return status === 'not_applicable' || status === 'applied_for';
}

function getEffectiveFieldStatus(contact: Contact, fieldKey: string): Contact['field_statuses'][string] | undefined {
  const explicitStatus = contact.field_statuses?.[fieldKey];
  if (explicitStatus) return explicitStatus;

  if (
    fieldKey === 'ni_number' &&
    contact.type === 'business' &&
    !contact.ni_number
  ) {
    return 'not_applicable';
  }

  return undefined;
}

function TriStateField({
  label,
  value,
  fieldKey,
  contact,
}: {
  label: string;
  value: string | number | undefined | null;
  fieldKey: string;
  contact: Contact;
}) {
  const status = getEffectiveFieldStatus(contact, fieldKey);
  const hasValue = !(value === undefined || value === null || value === '' || value === '—');
  if (status === 'applied_for') {
    return (
      <dl className="text-sm text-slate-600">
        <dt className="font-semibold text-slate-800">{label}</dt>
        <dd className="flex items-center gap-2">
          {hasValue ? <span>{value}</span> : <span className="text-slate-400">Awaiting registration</span>}
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Applied for</span>
        </dd>
      </dl>
    );
  }
  if (status === 'not_applicable') {
    return (
      <dl className="text-sm text-slate-600">
        <dt className="font-semibold text-slate-800">{label}</dt>
        <dd>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Not applicable</span>
        </dd>
      </dl>
    );
  }
  if (!hasValue) {
    return (
      <dl className="text-sm text-slate-600">
        <dt className="font-semibold text-slate-800">{label}</dt>
        <dd>
          <span className="text-slate-400">Not set</span>
        </dd>
      </dl>
    );
  }
  return (
    <dl className="text-sm text-slate-600">
      <dt className="font-semibold text-slate-800">{label}</dt>
      <dd className="flex items-center gap-2">
        <span>{value}</span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Provided</span>
      </dd>
    </dl>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useSettings();
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3003';

  const [contact, setContact] = useState<Contact | null>(null);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [companiesHouseProfile, setCompaniesHouseProfile] =
    useState<CompaniesHouseProfileResponse['profile'] | null>(null);
  const [companiesHouseError, setCompaniesHouseError] = useState<string | null>(null);
  const [clientServices, setClientServices] = useState<ClientServiceEngagement[]>([]);
  const [eligibleTemplates, setEligibleTemplates] = useState<ServiceTemplateModel[]>([]);
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({});
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});
  const [frequencyDrafts, setFrequencyDrafts] = useState<Record<string, Frequency>>({});
  const [newService, setNewService] = useState<{
    serviceCode: string;
    frequency: Frequency | '';
    feeAmount: string;
    startDate: string;
    scheduleDate: string;
  }>({
    serviceCode: '',
    frequency: '',
    feeAmount: '',
    startDate: new Date().toISOString().slice(0, 10),
    scheduleDate: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [isTemplateGeneratorOpen, setIsTemplateGeneratorOpen] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [companiesHouseTab, setCompaniesHouseTab] = useState<CompaniesHouseTab>('company-details');
  const [showFormerOfficers, setShowFormerOfficers] = useState(false);
  const [showFormerPsc, setShowFormerPsc] = useState(false);
  const [isRefreshingCompaniesHouse, setIsRefreshingCompaniesHouse] = useState(false);
  const [editingSection, setEditingSection] = useState<EditableSection | null>(null);
  const [sectionDraft, setSectionDraft] = useState<Partial<Contact>>({});
  const [sectionSaveError, setSectionSaveError] = useState<string | null>(null);
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([]);
  const [teamDirectory, setTeamDirectory] = useState<Record<string, string>>({});
  const [relatedClients, setRelatedClients] = useState<Contact[]>([]);
  const [relatedClientError, setRelatedClientError] = useState<string | null>(null);
  const [creatingRelatedClientKey, setCreatingRelatedClientKey] = useState<string | null>(null);

  const hasAuthToken =
    typeof window !== 'undefined' && Boolean(window.localStorage.getItem('auth_token'));
  const userType: 'AGENT' | 'SELF' =
    settings.userType === 'agent' || hasAuthToken ? 'AGENT' : 'SELF';
  const activeTab = normalizeClientTab(searchParams.get('tab'));
  const managerOptions = useMemo<TeamOption[]>(() => {
    const options = new Map<string, TeamOption>();
    options.set('', { value: '', label: 'Unassigned' });

    Object.entries(teamDirectory).forEach(([value, label]) => {
      options.set(value, { value, label });
    });

    const currentUserId =
      typeof window !== 'undefined' ? window.localStorage.getItem('mdr-current-user') || '' : '';
    const currentName = settings.fullName?.trim();
    if (currentUserId && currentName) {
      options.set(currentUserId, { value: currentUserId, label: currentName });
    }

    [contact?.created_by, currentName, settings.email?.trim()].filter(Boolean).forEach((value) => {
      const text = String(value);
      if (!options.has(text)) {
        options.set(text, { value: text, label: text });
      }
    });

    return Array.from(options.values());
  }, [teamDirectory, settings.fullName, settings.email, contact?.created_by]);
  const sectorOptions = ['General', 'Retail', 'Construction', 'Professional Services', 'Hospitality', 'Technology'];

  const resolveUserLabel = useCallback(
    (value?: string | null) => {
      if (!value) return value;
      return teamDirectory[value] || value;
    },
    [teamDirectory]
  );

  const refreshClientServices = useCallback(async (clientRecord: Contact) => {
    const services = await getClientServiceEngagements(clientRecord.id);
    const allowedClientTypes = new Set([
      mapContactTypeToCanonical(clientRecord.type),
    ]);

    if (clientRecord.engagement_type === 'individual') {
      allowedClientTypes.add('INDIVIDUAL');
    }
    if (clientRecord.engagement_type === 'sole_trader' || clientRecord.legal_entity_type === 'sole_trader') {
      allowedClientTypes.add('SOLE_TRADER');
    }
    if (clientRecord.engagement_type === 'partnership' || clientRecord.legal_entity_type === 'partnership') {
      allowedClientTypes.add('PARTNERSHIP');
    }
    if (clientRecord.legal_entity_type === 'llp') {
      allowedClientTypes.add('LLP');
    }

    const templates = getServiceTemplates().filter((template) =>
      template.clientTypes.some((clientType) => allowedClientTypes.has(clientType))
    );
    setClientServices(services);
    setEligibleTemplates(templates);
    setFeeDrafts(
      services.reduce<Record<string, string>>((acc, service) => {
        acc[service.id] = String(service.feeAmount);
        return acc;
      }, {})
    );
    setDateDrafts(
      services.reduce<Record<string, string>>((acc, service) => {
        acc[service.id] =
          service.scheduleMode === 'PERIOD_END'
            ? service.periodEndDate || ''
            : service.manualDueDate || service.nextDue || '';
        return acc;
      }, {})
    );
    setFrequencyDrafts(
      services.reduce<Record<string, Frequency>>((acc, service) => {
        acc[service.id] = service.frequency;
        return acc;
      }, {})
    );
  }, []);

  const refreshRelatedClients = useCallback(async (clientId: string) => {
    try {
      const clients = await contactsAPI.getRelatedClients(clientId);
      setRelatedClients(clients);
      setRelatedClientError(null);
    } catch (loadError) {
      setRelatedClients([]);
      setRelatedClientError(loadError instanceof Error ? loadError.message : 'Unable to load linked client parties.');
    }
  }, []);

  const refreshAuditEvents = useCallback(async (clientId: string) => {
    try {
      const events = await contactsAPI.getAuditEvents(clientId);
      setAuditEvents(events);
    } catch {
      setAuditEvents([]);
    }
  }, []);

  const selectedServiceSchedule = useMemo(
    () => getServiceScheduleRule(newService.serviceCode || ''),
    [newService.serviceCode]
  );

  const loadClient = useCallback(async (clientId: string) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await contactsAPI.getContact(clientId);
      if (!resp) {
        setError('Client not found');
        setContact(null);
        setProfile(null);
        return;
      }

      setContact(resp);
      setProfile(buildClientProfile(resp));
      await Promise.all([refreshClientServices(resp), refreshRelatedClients(clientId), refreshAuditEvents(clientId)]);
    } catch (err) {
      console.error('Failed to load client detail', err);
      setError(err instanceof Error ? err.message : 'Unable to load client');
    } finally {
      setLoading(false);
    }
  }, [refreshClientServices, refreshRelatedClients, refreshAuditEvents]);

  useEffect(() => {
    if (!id || userType !== 'AGENT') return;
    void loadClient(id);
  }, [id, userType, loadClient]);

  useEffect(() => {
    return subscribeToServiceDataUpdates(() => {
      if (contact) {
        void refreshClientServices(contact);
      }
    });
  }, [contact, refreshClientServices]);

  useEffect(() => {
    if (userType !== 'AGENT' || typeof window === 'undefined') return;
    const token = window.localStorage.getItem('auth_token');
    if (!token) return;

    let cancelled = false;

    const loadTeamDirectory = async () => {
      try {
        const [meRes, teamRes] = await Promise.all([
          fetch(`${apiUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiUrl}/auth/team`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const nextDirectory: Record<string, string> = {};

        if (meRes.ok) {
          const meData = await meRes.json();
          const me = meData?.user;
          if (me?.id) {
            nextDirectory[String(me.id)] =
              [me.first_name, me.last_name].filter(Boolean).join(' ').trim() || me.email || String(me.id);
          }
        }

        if (teamRes.ok) {
          const teamData = await teamRes.json();
          const users = Array.isArray(teamData?.users) ? (teamData.users as TeamUser[]) : [];
          users.forEach((user) => {
            nextDirectory[String(user.id)] =
              [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email || String(user.id);
          });
        }

        if (!cancelled) {
          setTeamDirectory(nextDirectory);
        }
      } catch (loadError) {
        if (!cancelled) {
          console.warn('Failed to load team directory', loadError);
        }
      }
    };

    void loadTeamDirectory();

    return () => {
      cancelled = true;
    };
  }, [apiUrl, userType]);

  const loadCompaniesHouseSnapshot = useCallback(async (companyNumber: string) => {
    const safeNumber = companyNumber.trim();
    if (!safeNumber) {
      setCompaniesHouseProfile(null);
      setCompaniesHouseError(null);
      return;
    }

    try {
      const response = await companiesHouseAPI.getCompanyProfile(safeNumber, { itemsPerPage: 10 });
      setCompaniesHouseProfile(response.profile);
      setCompaniesHouseError(null);
    } catch (err) {
      setCompaniesHouseProfile(null);
      setCompaniesHouseError(err instanceof Error ? err.message : 'Unable to load Companies House profile.');
    }
  }, []);

  useEffect(() => {
    const companyNumber = contact?.company_number?.trim();
    if (!companyNumber) {
      setCompaniesHouseProfile(null);
      setCompaniesHouseError(null);
      return;
    }
    void loadCompaniesHouseSnapshot(companyNumber);
  }, [contact?.company_number, loadCompaniesHouseSnapshot]);

  const taskSummary = useMemo(() => {
    const counts = { open: 0, overdue: 0, completed: 0 };
    const now = new Date();
    clientServices.forEach((service) => {
      service.taskInstances.forEach((task) => {
        const dueDate = parseDate(task.dueDate || service.nextDue);
        if (task.status === 'DONE') counts.completed += 1;
        if (task.status === 'IN_PROGRESS' || task.status === 'TODO') {
          counts.open += 1;
          if (dueDate && dueDate < now) counts.overdue += 1;
        }
      });
    });
    return counts;
  }, [clientServices]);

  const annualServiceCost = useMemo(
    () => clientServices.reduce((sum, service) => sum + calculateAnnualCost(service), 0),
    [clientServices]
  );

  const complianceServices = useMemo(
    () => clientServices.filter((service) => service.isActive && service.createsCompliance),
    [clientServices]
  );

  const activeServices = useMemo(() => clientServices.filter((service) => service.isActive), [clientServices]);
  const activeServiceCodes = useMemo(() => new Set(activeServices.map((service) => service.serviceCode)), [activeServices]);

  const completedServiceTasks = useMemo(
    () =>
      clientServices.reduce(
        (sum, service) => sum + service.taskInstances.filter((task) => task.status === 'DONE').length,
        0
      ),
    [clientServices]
  );
  const totalServiceTasks = taskSummary.open + completedServiceTasks;
  const taskCompletionRate = totalServiceTasks > 0 ? Math.round((completedServiceTasks / totalServiceTasks) * 100) : 0;
  const complianceCoverageRate =
    activeServices.length > 0 ? Math.round((complianceServices.length / activeServices.length) * 100) : 0;

  const onboardingChecks = useMemo(() => {
    const fieldStatuses = contact?.field_statuses || {};
    const statusApplied = (field: string) => isFieldStatusApplicable(fieldStatuses[field]);
    const notApplicable = (field: string) => fieldStatuses[field] === 'not_applicable';
    const hasEngagement =
      notApplicable('engagement_letter_signed_date') || Boolean(contact?.engagement_letter_signed_date);
    const hasAml =
      (notApplicable('id_verified') || Boolean(contact?.id_verified)) &&
      (notApplicable('source_of_funds_checked') || Boolean(contact?.source_of_funds_checked)) &&
      (notApplicable('beneficial_owner_verified') || Boolean(contact?.beneficial_owner_verified));
    const needsCt = activeServiceCodes.has('CT600');
    const needsVat = activeServiceCodes.has('VAT');
    const needsPaye = activeServiceCodes.has('PAYE');

    const hasTaxRefs =
      (!needsCt || Boolean(contact?.utr)) &&
      (!needsVat || statusApplied('vat_number') || Boolean(contact?.vat_number && (contact?.vat_stagger || contact?.vat_frequency))) &&
      (!needsPaye || statusApplied('paye_reference') || Boolean(contact?.paye_reference));

    const hasBillingProfile = Boolean(contact?.billing_model) && (
      contact?.billing_model !== 'monthly_dd' || Boolean(contact?.direct_debit_mandate_signed)
    );

    const checks = [
      { label: 'Engagement signed', complete: hasEngagement },
      { label: 'AML complete', complete: hasAml },
      { label: 'Tax refs complete', complete: hasTaxRefs },
      { label: 'Billing profile set', complete: hasBillingProfile },
    ];

    const completeCount = checks.filter((check) => check.complete).length;
    const completionRate = Math.round((completeCount / checks.length) * 100);

    return { checks, completionRate, hasEngagement, hasAml, hasTaxRefs };
  }, [contact, activeServiceCodes]);

  const companySnapshot = companiesHouseProfile?.company;
  const complianceSnapshot = companiesHouseProfile?.compliance;
  const accountsCompliance = (complianceSnapshot?.accounts ?? null) as AccountsComplianceSnapshot | null;
  const confirmationCompliance = (complianceSnapshot?.confirmationStatement ??
    null) as ConfirmationComplianceSnapshot | null;

  const complianceDeadlines = useMemo(() => {
    const items: { id: string; label: string; category: 'VAT' | 'Accounts' | 'CT' | 'PAYE'; dueDate: Date }[] = [];
    const pushDeadline = (
      id: string,
      label: string,
      category: 'VAT' | 'Accounts' | 'CT' | 'PAYE',
      value?: string
    ) => {
      const parsed = parseDate(value);
      if (parsed) items.push({ id, label, category, dueDate: parsed });
    };

    activeServices.forEach((service) => {
      if (service.complianceDates.length > 0) {
        service.complianceDates.forEach((deadline) => {
          const category =
            service.serviceCode === 'VAT'
              ? 'VAT'
              : service.serviceCode === 'PAYE'
                ? 'PAYE'
                : service.serviceCode === 'CT600'
                  ? 'CT'
                  : 'Accounts';
          pushDeadline(`${service.id}-${deadline.id}`, `${service.displayName} - ${deadline.label}`, category, deadline.dueDate);
        });
        return;
      }
      if (service.serviceCode === 'VAT') {
        pushDeadline(`${service.id}-vat`, `${service.displayName}`, 'VAT', service.nextDue);
      }
      if (service.serviceCode === 'ACCS' || service.serviceCode === 'CS01') {
        pushDeadline(`${service.id}-accounts`, `${service.displayName}`, 'Accounts', service.nextDue);
      }
      if (service.serviceCode === 'CT600') {
        pushDeadline(`${service.id}-ct`, `${service.displayName}`, 'CT', service.nextDue);
      }
      if (service.serviceCode === 'PAYE') {
        pushDeadline(`${service.id}-paye`, `${service.displayName}`, 'PAYE', service.nextDue);
      }
    });

    return items
      .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())
      .filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index);
  }, [activeServices]);

  const complianceDeadlineSummary = useMemo(() => {
    const now = new Date();
    const ninetyDays = new Date(now);
    ninetyDays.setDate(ninetyDays.getDate() + 90);
    const overdue = complianceDeadlines.filter((item) => item.dueDate < now);
    const upcoming = complianceDeadlines.filter((item) => item.dueDate >= now && item.dueDate <= ninetyDays);
    const next = complianceDeadlines.find((item) => item.dueDate >= now) || null;
    return { overdue, upcoming, next };
  }, [complianceDeadlines]);

  const riskEngine = useMemo(() => {
    const factors: RiskFactor[] = [];
    const now = new Date();
    const amlReviewDate = parseDate(contact?.aml_review_date);

    if (
      contact &&
      contact.type !== 'hmrc' &&
      contact.field_statuses?.engagement_letter_signed_date !== 'not_applicable' &&
      !contact.engagement_letter_signed_date
    ) {
      factors.push({ label: 'Engagement unsigned', points: 30 });
    }
    if (amlReviewDate && amlReviewDate < now) {
      factors.push({ label: 'AML review overdue', points: 20 });
    }
    if (complianceDeadlineSummary.overdue.length > 0) {
      factors.push({ label: 'Compliance overdue', points: 20 });
    }
    if (activeServiceCodes.has('CT600') && !contact?.utr) {
      factors.push({ label: 'UTR missing while CT service active', points: 10 });
    }
    if (contact?.billing_model === 'monthly_dd' && !contact.direct_debit_mandate_signed) {
      factors.push({ label: 'Direct debit mandate missing', points: 10 });
    }
    if (contact?.acting_as_agent && !contact.hmrc_agent_authorised) {
      factors.push({ label: 'Agent authority incomplete', points: 10 });
    }

    const score = factors.reduce((sum, factor) => sum + factor.points, 0);
    const level = riskLevelFromScore(score);
    return { score, level, factors };
  }, [contact, activeServiceCodes, complianceDeadlineSummary.overdue.length]);

  const riskStatus = useMemo(() => toneForRisk(riskEngine.level), [riskEngine.level]);

  const nextComplianceDate = useMemo(() => {
    if (!complianceDeadlineSummary.next) return '—';
    return complianceDeadlineSummary.next.dueDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [complianceDeadlineSummary.next]);

  const now = new Date();
  const activeOfficers = useMemo(
    () => companiesHouseProfile?.officers?.items?.filter((officer) => officer.status !== 'resigned') || [],
    [companiesHouseProfile?.officers?.items]
  );
  const formerOfficers = useMemo(
    () => companiesHouseProfile?.officers?.items?.filter((officer) => officer.status === 'resigned') || [],
    [companiesHouseProfile?.officers?.items]
  );
  const activePscEntries = useMemo(
    () => companiesHouseProfile?.psc?.items?.filter((psc) => psc.status !== 'ceased') || [],
    [companiesHouseProfile?.psc?.items]
  );
  const formerPscEntries = useMemo(
    () => companiesHouseProfile?.psc?.items?.filter((psc) => psc.status === 'ceased') || [],
    [companiesHouseProfile?.psc?.items]
  );
  const relatedClientLookup = useMemo(() => {
    const lookup = new Map<string, Contact>();
    relatedClients.forEach((client) => {
      const key = normalizePartyLookupKey(client.name);
      if (key && !lookup.has(key)) {
        lookup.set(key, client);
      }
    });
    return lookup;
  }, [relatedClients]);
  const dayOfYear = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 0)) /
      (24 * 60 * 60 * 1000)
  );
  const annualFeeValue = annualServiceCost;
  const recurringMonthly = annualFeeValue / 12;
  const revenueYtd = Math.round((annualFeeValue * dayOfYear) / 365);
  const outstandingInvoices = complianceDeadlineSummary.overdue.length;

  const smartActions = useMemo(() => {
    const critical: string[] = [];
    const risk: string[] = [];
    const advisory: string[] = [];

    if (!onboardingChecks.hasEngagement) {
      critical.push('Engagement letter must be signed before compliance services can be activated.');
    }
    if (!onboardingChecks.hasAml) {
      critical.push('AML verification is incomplete for this client profile.');
    }
    if (complianceDeadlineSummary.overdue.length > 0) {
      critical.push(`${complianceDeadlineSummary.overdue.length} compliance item(s) are overdue.`);
    }

    if (!onboardingChecks.hasTaxRefs) {
      risk.push('Required tax references are incomplete for active services.');
    }
    if (contact?.billing_model === 'monthly_dd' && !contact.direct_debit_mandate_signed) {
      risk.push('Direct debit mandate is missing while monthly DD billing is selected.');
    }
    if (riskEngine.factors.some((factor) => factor.label.includes('AML review overdue'))) {
      risk.push('AML review date has expired and should be refreshed immediately.');
    }

    if (!contact?.client_manager || !contact?.partner) {
      advisory.push('Assign client manager and responsible partner for ownership clarity.');
    }
    if (!contact?.last_fee_review_date) {
      advisory.push('Fee review date is not set; schedule commercial review.');
    }
    if (!companiesHouseProfile?.filingHistory?.items?.length) {
      advisory.push('Refresh Companies House snapshot for latest filing visibility.');
    }

    return { critical, risk, advisory };
  }, [
    onboardingChecks.hasEngagement,
    onboardingChecks.hasAml,
    onboardingChecks.hasTaxRefs,
    complianceDeadlineSummary.overdue.length,
    contact?.billing_model,
    contact?.direct_debit_mandate_signed,
    contact?.client_manager,
    contact?.partner,
    contact?.last_fee_review_date,
    companiesHouseProfile?.filingHistory?.items?.length,
    riskEngine.factors,
  ]);

  const companySearchQuery =
    (contact?.company_number || contact?.name || contact?.eori || contact?.id || '').trim();
  const companySearchUrl = companySearchQuery
    ? `/companies-house?q=${encodeURIComponent(companySearchQuery)}`
    : '/companies-house';

  const profileCompanyName = companySnapshot?.companyName || contact?.name || '—';
  const profileCompanyNumber = companySnapshot?.companyNumber || contact?.company_number || '—';
  const profileRegisteredOffice = companySnapshot?.fullAddress || contact?.address || '—';
  const profileCompanyStatus = formatLabel(companySnapshot?.companyStatus || null);
  const profileCompanyType = formatLabel(companySnapshot?.companyType || null);
  const profileIncorporatedOn = formatDate(companySnapshot?.dateOfCreation || undefined);
  const nextAccountsMadeUpTo = formatDate(
    (accountsCompliance?.next_made_up_to || accountsCompliance?.next_accounts?.period_end_on) as string | undefined
  );
  const accountsDueBy = formatDate(
    (accountsCompliance?.next_due || accountsCompliance?.next_accounts?.due_on) as string | undefined
  );
  const lastAccountsMadeUpTo = formatDate(
    (accountsCompliance?.last_made_up_to || accountsCompliance?.last_accounts?.made_up_to || accountsCompliance?.last_accounts?.period_end_on) as
      | string
      | undefined
  );
  const nextStatementDate = formatDate(
    (confirmationCompliance?.next_statement_date || confirmationCompliance?.next_made_up_to) as string | undefined
  );
  const statementDueBy = formatDate(confirmationCompliance?.next_due as string | undefined);
  const lastStatementDated = formatDate(confirmationCompliance?.last_made_up_to as string | undefined);

  const setActiveTab = (tab: ClientTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') {
      next.delete('tab');
    } else {
      next.set('tab', tab);
    }
    setSearchParams(next, { replace: true });
  };

  const toggleServiceExpanded = (serviceId: string) => {
    setExpandedServices((prev) => ({ ...prev, [serviceId]: !prev[serviceId] }));
  };

  const handleRefreshCompaniesHouse = async () => {
    const companyNumber = contact?.company_number?.trim();
    if (!companyNumber) return;
    setIsRefreshingCompaniesHouse(true);
    try {
      await loadCompaniesHouseSnapshot(companyNumber);
    } finally {
      setIsRefreshingCompaniesHouse(false);
    }
  };

  const handleCreateRelatedClient = async (
    partyKey: string,
    payload: {
      name: string;
      dateOfBirth?: string;
      address?: string;
      addressLine2?: string;
      city?: string;
      postcode?: string;
      country?: string;
      roles: string[];
      status: 'current' | 'former';
    }
  ) => {
    if (!contact) return;

    setCreatingRelatedClientKey(partyKey);
    setRelatedClientError(null);
    try {
      const response = await contactsAPI.createRelatedClient(contact.id, {
        name: payload.name,
        date_of_birth: payload.dateOfBirth,
        address: payload.address,
        address_line2: payload.addressLine2,
        city: payload.city,
        postcode: payload.postcode,
        country: payload.country,
        party_roles: payload.roles,
        party_status: payload.status,
      });
      await refreshRelatedClients(contact.id);
      navigate(`/clients/${response.client.id}`);
    } catch (createError) {
      setRelatedClientError(createError instanceof Error ? createError.message : 'Unable to add linked client.');
    } finally {
      setCreatingRelatedClientKey(null);
    }
  };

  const handleAddOfficerClient = async (officer: CompaniesHouseOfficer) => {
    const partyKey = `officer:${normalizePartyLookupKey(officer.name)}`;
    const address = buildPartyAddress(officer.address);
    await handleCreateRelatedClient(partyKey, {
      name: officer.displayName || officer.name,
      dateOfBirth: officer.dateOfBirth || undefined,
      address: address.address,
      addressLine2: address.addressLine2,
      city: address.city,
      postcode: address.postcode,
      country: address.country,
      roles: [officer.role || 'director'].filter(Boolean),
      status: officer.status === 'resigned' ? 'former' : 'current',
    });
  };

  const handleAddPscClient = async (psc: CompaniesHousePsc) => {
    const partyKey = `psc:${normalizePartyLookupKey(psc.name)}`;
    const address = buildPartyAddress(psc.address);
    await handleCreateRelatedClient(partyKey, {
      name: psc.displayName || psc.name,
      dateOfBirth: psc.dateOfBirth || undefined,
      address: address.address,
      addressLine2: address.addressLine2,
      city: address.city,
      postcode: address.postcode,
      country: address.country,
      roles: [psc.kind || 'psc'].filter(Boolean),
      status: psc.status === 'ceased' ? 'former' : 'current',
    });
  };

  const handleAddService = async () => {
    if (!contact) return;
    if (!newService.serviceCode) {
      setServiceError('Select a service template.');
      return;
    }
    const fee = Number(newService.feeAmount);
    if (!Number.isFinite(fee) || fee < 0) {
      setServiceError('Enter a valid service fee.');
      return;
    }
    if (!newService.scheduleDate) {
      setServiceError(`${selectedServiceSchedule.inputLabel} is required.`);
      return;
    }
    const selectedTemplate = eligibleTemplates.find(
      (template) => template.serviceCode === newService.serviceCode
    );
    if (selectedTemplate?.createsCompliance) {
      const blockers: string[] = [];
      if (!onboardingChecks.hasEngagement) blockers.push('engagement letter is unsigned');
      if (!onboardingChecks.hasAml) blockers.push('AML checks are incomplete');
      if (!onboardingChecks.hasTaxRefs) blockers.push('required tax references are incomplete');
      if (blockers.length > 0) {
        setServiceError(`Cannot activate compliance-tracked service: ${blockers.join('; ')}.`);
        return;
      }
    }
    try {
      await addClientServiceEngagement({
        clientId: contact.id,
        serviceCode: newService.serviceCode,
        feeAmount: fee,
        startDate: newService.startDate,
        frequency: newService.frequency || undefined,
        periodEndDate:
          selectedServiceSchedule.mode === 'PERIOD_END' ? newService.scheduleDate || undefined : undefined,
        manualDueDate:
          selectedServiceSchedule.mode === 'MANUAL_DUE' ? newService.scheduleDate || undefined : undefined,
      });
      await refreshClientServices(contact);
      await refreshAuditEvents(contact.id);
      setIsAddServiceOpen(false);
      setServiceError(null);
      setNewService({
        serviceCode: '',
        frequency: '',
        feeAmount: '',
        startDate: new Date().toISOString().slice(0, 10),
        scheduleDate: '',
      });
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : 'Unable to add service.');
    }
  };

  const handleTaskStatusChange = async (serviceId: string, taskId: string, status: 'TODO' | 'IN_PROGRESS' | 'DONE') => {
    if (!contact) return;
    await updateClientServiceTaskStatus(serviceId, taskId, status);
    await refreshClientServices(contact);
    await refreshAuditEvents(contact.id);
  };

  const handleFeeSave = async (serviceId: string) => {
    if (!contact) return;
    const fee = Number(feeDrafts[serviceId]);
    if (!Number.isFinite(fee) || fee < 0) {
      setServiceError('Fee must be a positive number.');
      return;
    }
    await updateClientServiceEngagement(serviceId, { feeAmount: fee });
    await refreshClientServices(contact);
    await refreshAuditEvents(contact.id);
    setServiceError(null);
  };

  const handleDateSave = async (service: ClientServiceEngagement) => {
    if (!contact) return;
    const draftValue = dateDrafts[service.id] || '';
    if (!draftValue) {
      setServiceError(`${getServiceScheduleRule(service.serviceCode).inputLabel} is required.`);
      return;
    }
    await updateClientServiceEngagement(service.id, {
      periodEndDate: service.scheduleMode === 'PERIOD_END' ? draftValue : undefined,
      manualDueDate: service.scheduleMode === 'MANUAL_DUE' ? draftValue : undefined,
    });
    await refreshClientServices(contact);
    await refreshAuditEvents(contact.id);
    setServiceError(null);
  };

  const handleFrequencySave = async (service: ClientServiceEngagement) => {
    if (!contact) return;
    const frequency = frequencyDrafts[service.id];
    if (!frequency) {
      setServiceError('Frequency is required.');
      return;
    }
    await updateClientServiceEngagement(service.id, { frequency });
    await refreshClientServices(contact);
    await refreshAuditEvents(contact.id);
    setServiceError(null);
  };

  const toggleServiceActive = async (serviceId: string, isActive: boolean) => {
    if (!contact) return;
    const service = clientServices.find((item) => item.id === serviceId);
    if (!isActive && service?.createsCompliance) {
      const blockers: string[] = [];
      if (!onboardingChecks.hasEngagement) blockers.push('engagement letter is unsigned');
      if (!onboardingChecks.hasAml) blockers.push('AML checks are incomplete');
      if (!onboardingChecks.hasTaxRefs) blockers.push('required tax references are incomplete');
      if (blockers.length > 0) {
        setServiceError(`Cannot activate compliance-tracked service: ${blockers.join('; ')}.`);
        return;
      }
    }
    await updateClientServiceEngagement(serviceId, { isActive: !isActive });
    await refreshClientServices(contact);
    await refreshAuditEvents(contact.id);
  };

  const handleDeleteService = async (service: ClientServiceEngagement) => {
    if (!contact) return;
    const confirmed = window.confirm(
      `Delete "${service.displayName}" for ${contact.name}?\n\nThis will remove the service, task schedule, and compliance dates.`
    );
    if (!confirmed) return;

    await removeClientServiceEngagement(service.id);
    await refreshClientServices(contact);
    await refreshAuditEvents(contact.id);
    setServiceError(null);
  };

  const templateShortcuts = [
    {
      name: 'Client Welcome Pack',
      description: 'Introduction and service overview',
      action: () => setIsTemplateGeneratorOpen(true),
    },
    {
      name: 'Engagement Letter',
      description: 'Terms and conditions',
      action: () => setIsTemplateGeneratorOpen(true),
    },
    {
      name: 'Service Agreement',
      description: 'Service terms and scope confirmation',
      action: () => setIsTemplateGeneratorOpen(true),
    },
  ];

  const openSectionEditor = (section: EditableSection) => {
    if (!contact) return;
    const draft = Object.fromEntries(
      SECTION_FIELDS[section].map((field) => [field, contact[field]])
    ) as Partial<Contact>;
    if (section === 'tax') {
      draft.field_statuses = {
        ...(contact.field_statuses || {}),
      };
      if (
        contact.type === 'business' &&
        !draft.ni_number &&
        !draft.field_statuses.ni_number
      ) {
        draft.field_statuses.ni_number = 'not_applicable';
      }
    }
    setSectionDraft(draft);
    setSectionSaveError(null);
    setEditingSection(section);
  };

  const closeSectionEditor = () => {
    setEditingSection(null);
    setSectionSaveError(null);
  };

  const updateSectionDraft = <K extends keyof Contact>(field: K, value: Contact[K]) => {
    setSectionDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateFieldStatusDraft = (field: string, status: Contact['field_statuses'][string]) => {
    setSectionDraft((prev) => ({
      ...prev,
      field_statuses: {
        ...(prev.field_statuses || {}),
        [field]: status,
      },
    }));
  };

  const buildSectionPatch = (
    section: EditableSection,
    draft: Partial<Contact>,
    current: Contact
  ): Partial<Contact> => {
    const patch: Record<keyof Contact, Contact[keyof Contact] | undefined> = {} as Record<
      keyof Contact,
      Contact[keyof Contact] | undefined
    >;
    SECTION_FIELDS[section].forEach((field) => {
      if (!(field in draft)) return;
      const value = draft[field];
      const normalizedValue =
        typeof value === 'string' ? (value.trim() === '' ? undefined : value) : value;
      const currentValue = current[field];
      const normalizedCurrent =
        typeof currentValue === 'string'
          ? (currentValue.trim() === '' ? undefined : currentValue)
          : currentValue;
      if (normalizedValue === normalizedCurrent) {
        return;
      }
      patch[field] = normalizedValue as Contact[typeof field];
    });
    return patch as Partial<Contact>;
  };

  const validateSectionDraft = (section: EditableSection, draft: Partial<Contact>): string | null => {
    if (section !== 'identity') return null;
    if (!String(draft.name || '').trim()) return 'Client name is required.';
    if (!String(draft.email || '').trim()) return 'Email is required.';
    if (!String(draft.phone || '').trim()) return 'Phone is required.';
    if (!String(draft.address || '').trim()) return 'Address is required.';
    return null;
  };

  const saveSectionDraft = async () => {
    if (!contact || !editingSection) return;
    const validationError = validateSectionDraft(editingSection, sectionDraft);
    if (validationError) {
      setSectionSaveError(validationError);
      return;
    }
    const patch = buildSectionPatch(editingSection, sectionDraft, contact);
    if (Object.keys(patch).length === 0) {
      closeSectionEditor();
      return;
    }
    setIsSavingSection(true);
    setSectionSaveError(null);
    try {
      const updated = await contactsAPI.updateContactSection(contact.id, editingSection, patch);
      setContact(updated);
      setProfile(buildClientProfile(updated));
      await refreshClientServices(updated);
      await refreshAuditEvents(updated.id);

      closeSectionEditor();
    } catch (saveError) {
      setSectionSaveError(saveError instanceof Error ? saveError.message : 'Unable to save section.');
    } finally {
      setIsSavingSection(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!contact || isDeletingClient) return;
    const confirmed = window.confirm(
      `Delete "${contact.name}"?\n\nThis will remove the client and all linked services, service tasks, and compliance tracking data.`
    );
    if (!confirmed) return;

    setIsDeletingClient(true);
    try {
      await contactsAPI.deleteContact(contact.id);
      await removeClientServiceEngagementsForClient(contact.id);
      navigate('/clients');
    } catch (err) {
      console.error('Failed to delete client', err);
      setError(err instanceof Error ? err.message : 'Unable to delete client.');
    } finally {
      setIsDeletingClient(false);
    }
  };

  const handleExportClient = async () => {
    if (!contact || !profile) return;

    try {
      const report = await generatePracticeClientReport({
        client: contact,
        settings,
        services: clientServices,
      });
      openGeneratedDocument(report.html);
    } catch (err) {
      console.error('Failed to export client report', err);
      window.alert(err instanceof Error ? err.message : 'Unable to generate client report.');
    }
  };

  if (userType === 'SELF') {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Importer Workspace Restricted</h1>
          <p className="mt-4 text-slate-600">
            Client detail pages are available for Agent accounts. Upgrade your plan or contact
            support to unlock the multi-client workflow.
          </p>
          <button
            className="mt-6 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white"
            onClick={() => navigate('/settings')}
          >
            Review Plan Options
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 py-8">
      <div className="mx-auto max-w-7xl px-6">
        <button
          onClick={() => navigate('/clients')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Clients
        </button>

        {loading ? (
          <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            Loading client workspace...
          </div>
        ) : error ? (
          <div className="mt-12 rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-600 shadow-sm">
            {error}
          </div>
        ) : contact && profile ? (
          <>
            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex flex-wrap justify-between gap-4 md:items-stretch">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">
                    Client
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-bold text-slate-900">{contact.name}</h1>
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${riskStatus.classes}`}>
                      {riskStatus.label}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-semibold text-slate-700">
                      Company Number <span className="font-normal text-slate-500">{profileCompanyNumber}</span>
                    </p>
                    <p className="text-sm text-slate-500">{profileRegisteredOffice}</p>
                  </div>
                </div>

                <div className="flex min-w-[240px] flex-col items-end justify-between gap-3 md:self-stretch">
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client Ref</p>
                    <p className="font-mono text-xl font-semibold text-slate-900">
                      {contact.client_ref || '—'}
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={handleExportClient}
                    >
                      Export
                    </button>
                    <button
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => openSectionEditor('identity')}
                    >
                      Edit Client Details
                    </button>
                    <button
                      className="rounded-full border border-rose-200 bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleDeleteClient}
                      disabled={isDeletingClient}
                    >
                      {isDeletingClient ? 'Deleting...' : 'Delete Client'}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                title={
                  riskEngine.factors.length
                    ? `Risk factors:\n${riskEngine.factors.map((factor) => `• ${factor.label}`).join('\n')}`
                    : 'No active risk factors.'
                }
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Annual Fees</p>
                  <Wallet className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currencyFormatter.format(annualFeeValue)}</p>
                <p className="text-xs text-slate-500">{currencyFormatter.format(recurringMonthly)} monthly recurring</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open Tasks</p>
                  <ClipboardList className="h-4 w-4 text-amber-600" />
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">{taskSummary.open}</p>
                <p className="text-xs text-slate-500">{taskSummary.overdue} overdue</p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${taskCompletionRate}%` }} />
                </div>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compliance Status</p>
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">{complianceCoverageRate}%</p>
                <p className="text-xs text-slate-500">{complianceServices.length} covered services</p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                <div
                    className={`h-1.5 rounded-full ${complianceCoverageRate >= 80 ? 'bg-emerald-500' : complianceCoverageRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${complianceCoverageRate}%` }}
                  />
                </div>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next Filing Due</p>
                  <FileText className="h-4 w-4 text-violet-600" />
                </div>
                <p className="mt-2 text-xl font-bold text-slate-900">{nextComplianceDate}</p>
                <p className="text-xs text-slate-500">
                  {complianceDeadlineSummary.upcoming.length} due in next 90 days
                </p>
              </article>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {clientTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={activeTab === tab.key ? 'btn-primary btn-onboarding' : 'btn-secondary'}
                    style={{ minWidth: 130 }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </section>

            {activeTab === 'overview' && (
              <>
                <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_340px]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Operational Snapshot
                        </p>
                        <h2 className="text-xl font-semibold text-slate-900">Practice Overview</h2>
                      </div>
                      <Sparkles className="h-4 w-4 text-amber-500" />
                    </header>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Onboarding Completion</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{onboardingChecks.completionRate}%</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Compliance Rate</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{complianceCoverageRate}%</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Task Completion</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{taskCompletionRate}%</p>
                      </div>
                    </div>
                    <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trend Signal</p>
                      <svg viewBox="0 0 120 36" className="mt-2 h-10 w-full">
                        <polyline
                          fill="none"
                          stroke="#0f766e"
                          strokeWidth="2"
                          points={`0,${36 - onboardingChecks.completionRate * 0.3} 40,${36 - complianceCoverageRate * 0.3} 80,${36 - taskCompletionRate * 0.3} 120,${36 - Math.min(100, (onboardingChecks.completionRate + taskCompletionRate) / 2) * 0.3}`}
                        />
                      </svg>
                    </div>
                    <div className="mt-4 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                      {onboardingChecks.checks.map((check) => (
                        <div key={check.label} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2">
                          <span>{check.label}</span>
                          <span className={check.complete ? 'text-emerald-700' : 'text-rose-700'}>
                            {check.complete ? 'Complete' : 'Missing'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
                    <header>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Smart Action</p>
                      <h2 className="text-xl font-semibold text-slate-900">Priority Queues</h2>
                    </header>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-xl border border-rose-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Critical</p>
                        {smartActions.critical.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-600">No blocking issues.</p>
                        ) : (
                          <ul className="mt-2 space-y-2 text-sm text-slate-700">
                            {smartActions.critical.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Risk</p>
                        {smartActions.risk.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-600">No immediate exposure.</p>
                        ) : (
                          <ul className="mt-2 space-y-2 text-sm text-slate-700">
                            {smartActions.risk.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="rounded-xl border border-yellow-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700">Advisory</p>
                        {smartActions.advisory.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-600">No advisory actions pending.</p>
                        ) : (
                          <ul className="mt-2 space-y-2 text-sm text-slate-700">
                            {smartActions.advisory.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="mt-6 grid gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Companies House Snapshot
                        </p>
                        <h2 className="text-xl font-semibold text-slate-900">{profileCompanyName}</h2>
                      </div>
                      <button className="btn-secondary" onClick={() => setActiveTab('companies-house')}>
                        Open
                      </button>
                    </header>
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-4 md:grid-cols-1">
                        <DataField label="Company Status" value={profileCompanyStatus} />
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <DataField label="Next Accounts Made Up To" value={nextAccountsMadeUpTo} />
                        <DataField label="Accounts Due By" value={accountsDueBy} />
                        <DataField label="Last Accounts Made Up To" value={lastAccountsMadeUpTo} />
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <DataField label="Next Statement Date" value={nextStatementDate} />
                        <DataField label="Statement Due By" value={statementDueBy} />
                        <DataField label="Last Statement Dated" value={lastStatementDated} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Financial Snapshot</p>
                      <h2 className="text-xl font-semibold text-slate-900">Commercial Position</h2>
                    </header>
                    <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Annual Fee</p>
                        <p className="text-xl font-bold text-slate-900">{currencyFormatter.format(annualFeeValue)}</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Monthly Recurring</p>
                        <p className="text-xl font-bold text-slate-900">{currencyFormatter.format(recurringMonthly)}</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Outstanding Invoices</p>
                        <p className={`text-xl font-bold ${outstandingInvoices > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                          {outstandingInvoices}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Realised Revenue</p>
                        <p className="text-xl font-bold text-slate-900">{currencyFormatter.format(revenueYtd)}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Engagement Lifecycle
                      </p>
                      <div className="mt-2 grid grid-cols-5 gap-2 text-[11px]">
                        {[
                          'Onboarded',
                          'Engaged',
                          'Active',
                          riskEngine.level === 'high' || riskEngine.level === 'critical' ? 'At Risk' : 'Stable',
                          'Disengaged',
                        ].map((phase, index) => (
                          <span
                            key={`${phase}-${index}`}
                            className={`rounded-full px-2 py-1 text-center ${
                              index < 3
                                ? 'bg-emerald-100 text-emerald-700'
                                : phase === 'At Risk'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {phase}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeTab === 'services' && (
              <>
                <section className="mt-6 grid gap-6 xl:grid-cols-[1.25fr,1fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Services</p>
                        <h2 className="text-xl font-semibold text-slate-900">Client Service Portfolio</h2>
                        <p className="text-sm text-slate-500">
                          Annual service value: {currencyFormatter.format(annualServiceCost)}
                        </p>
                      </div>
                      <button className="btn-primary btn-onboarding" onClick={() => setIsAddServiceOpen(true)}>
                        Add Service
                      </button>
                    </header>
                    <div className="mt-4 space-y-4">
                      {clientServices.length === 0 ? (
                        <p className="text-sm text-slate-500">No services have been agreed for this client yet.</p>
                      ) : (
                        clientServices.map((service) => {
                          const scheduleRule = getServiceScheduleRule(service.serviceCode);
                          const progressPercent =
                            service.taskInstances.length === 0
                              ? 0
                              : Math.round(
                                  (service.taskInstances.filter((task) => task.status === 'DONE').length /
                                    service.taskInstances.length) *
                                    100
                                );
                          const scheduleAnchorDate =
                            service.scheduleMode === 'PERIOD_END'
                              ? service.periodEndDate
                              : service.manualDueDate || service.nextDue;

                          return (
                            <article key={service.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm">
                              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-lg font-semibold text-slate-900">
                                      {service.displayName} ({service.serviceCode})
                                    </p>
                                    <span
                                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                        service.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                                      }`}
                                    >
                                      {service.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                                    {formatLabel(service.frequency)} · {formatLabel(service.billingType)} · {formatLabel(service.billingUnit)}
                                  </p>
                                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Compliance</p>
                                      <p className="mt-1 text-sm font-semibold text-slate-900">
                                        {service.createsCompliance ? formatLabel(service.complianceType) : 'No compliance tracking'}
                                      </p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next Due</p>
                                      <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(service.nextDue)}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                        {scheduleRule.inputLabel}
                                      </p>
                                      <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(scheduleAnchorDate)}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-blue-50 p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">Annualized Value</p>
                                      <p className="mt-1 text-sm font-semibold text-blue-900">
                                        {currencyFormatter.format(calculateAnnualCost(service))}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 xl:w-[170px] xl:flex-col xl:items-stretch">
                                  <button className="btn-secondary" onClick={() => toggleServiceActive(service.id, service.isActive)}>
                                    {service.isActive ? 'Deactivate' : 'Activate'}
                                  </button>
                                  <button className="btn-secondary" onClick={() => void handleDeleteService(service)}>
                                    Delete
                                  </button>
                                  <button className="btn-secondary" onClick={() => toggleServiceExpanded(service.id)}>
                                    {expandedServices[service.id] ? (
                                      <>
                                        <ChevronUp className="h-4 w-4" /> Collapse
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="h-4 w-4" /> Manage
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="mt-5">
                                <div className="flex items-center justify-between text-xs text-slate-600">
                                  <span>Service progress</span>
                                  <span>{`${progressPercent}%`}</span>
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-slate-200">
                                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${progressPercent}%` }} />
                                </div>
                              </div>

                              {expandedServices[service.id] && (
                                <div className="mt-5 border-t border-slate-200 pt-5">
                                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                                    <div className="space-y-4">
                                      <div className="grid gap-3 md:grid-cols-3">
                                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service Fee</p>
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={feeDrafts[service.id] ?? String(service.feeAmount)}
                                            onChange={(event) =>
                                              setFeeDrafts((prev) => ({ ...prev, [service.id]: event.target.value }))
                                            }
                                            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                          />
                                          <button className="btn-secondary mt-3 w-full" onClick={() => handleFeeSave(service.id)}>
                                            Save Fee
                                          </button>
                                        </div>

                                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Frequency</p>
                                          <select
                                            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                            value={frequencyDrafts[service.id] ?? service.frequency}
                                            onChange={(event) =>
                                              setFrequencyDrafts((prev) => ({
                                                ...prev,
                                                [service.id]: event.target.value as Frequency,
                                              }))
                                            }
                                          >
                                            {serviceFrequencyOptions.map((option) => (
                                              <option key={option} value={option}>
                                                {formatLabel(option)}
                                              </option>
                                            ))}
                                          </select>
                                          <button className="btn-secondary mt-3 w-full" onClick={() => handleFrequencySave(service)}>
                                            Save Frequency
                                          </button>
                                        </div>

                                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            {scheduleRule.inputLabel}
                                          </p>
                                          <input
                                            type="date"
                                            value={dateDrafts[service.id] ?? ''}
                                            onChange={(event) =>
                                              setDateDrafts((prev) => ({ ...prev, [service.id]: event.target.value }))
                                            }
                                            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                          />
                                          <button className="btn-secondary mt-3 w-full" onClick={() => handleDateSave(service)}>
                                            Save Date
                                          </button>
                                        </div>
                                      </div>

                                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scheduling Notes</p>
                                        <p className="mt-2 text-sm text-slate-600">{scheduleRule.helperText}</p>
                                      </div>
                                    </div>

                                    <div className="space-y-4">
                                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service Snapshot</p>
                                        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                                          <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Open Tasks</p>
                                            <p className="mt-1 text-lg font-semibold text-slate-900">{service.openTasks}</p>
                                          </div>
                                          <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</p>
                                            <p className="mt-1 text-lg font-semibold text-slate-900">{formatLabel(service.status)}</p>
                                          </div>
                                        </div>
                                      </div>

                                      {service.complianceDates.length > 0 && (
                                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Compliance Dates
                                          </p>
                                          <div className="mt-3 space-y-2">
                                            {service.complianceDates.map((deadline) => (
                                              <div
                                                key={`${service.id}-${deadline.id}`}
                                                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700"
                                              >
                                                <p className="font-semibold text-slate-900">{deadline.label}</p>
                                                <p className="mt-1 text-slate-600">Due {formatDate(deadline.dueDate)}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Service Tasks
                                    </p>
                                    {service.taskInstances.length === 0 ? (
                                      <p className="mt-3 text-sm text-slate-500">No tasks linked to this service.</p>
                                    ) : (
                                      <div className="mt-3 space-y-3">
                                        {service.taskInstances.map((task) => (
                                          <div
                                            key={task.id}
                                            className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,1.7fr)_140px_170px]"
                                          >
                                            <div>
                                              <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                                              <p className="mt-1 text-xs text-slate-500">
                                                {formatDate(task.dueDate)} · {task.daysBeforeDue} days before due
                                              </p>
                                            </div>
                                            <div className="flex items-start md:justify-center">
                                              <span className="inline-flex h-fit rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                                                {task.priority}
                                              </span>
                                            </div>
                                            <select
                                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                                              value={task.status}
                                              onChange={(event) =>
                                                handleTaskStatusChange(
                                                  service.id,
                                                  task.id,
                                                  event.target.value as 'TODO' | 'IN_PROGRESS' | 'DONE'
                                                )
                                              }
                                            >
                                              <option value="TODO">To do</option>
                                              <option value="IN_PROGRESS">In progress</option>
                                              <option value="DONE">Done</option>
                                            </select>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </article>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Work Summary</p>
                        <h2 className="text-xl font-semibold text-slate-900">Service Task Progress</h2>
                      </div>
                      <ClipboardList className="h-5 w-5 text-slate-500" />
                    </header>
                    <div className="mt-4 grid gap-3 text-sm">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Open tasks</p>
                        <p className="text-2xl font-bold text-slate-900">{taskSummary.open}</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Completed tasks</p>
                        <p className="text-2xl font-bold text-emerald-600">{completedServiceTasks}</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Compliance services</p>
                        <p className="text-2xl font-bold text-slate-900">{complianceServices.length}</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Annual service value</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {currencyFormatter.format(annualServiceCost)}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="mt-6 grid gap-6 xl:grid-cols-2">
                  <OnboardingChecklist clientId={contact.id} />
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Services</p>
                        <h2 className="text-xl font-semibold text-slate-900">Recent Task Activity</h2>
                      </div>
                      <FileText className="h-5 w-5 text-blue-500" />
                    </header>
                    <div className="mt-4 space-y-3">
                      {clientServices.length === 0 ? (
                        <p className="text-sm text-slate-500">No service activity recorded for this client.</p>
                      ) : (
                        clientServices
                          .flatMap((service) =>
                            service.taskInstances.map((task) => ({
                              id: `${service.id}-${task.id}`,
                              service: service.displayName,
                              title: task.title,
                              status: task.status,
                            }))
                          )
                          .slice(0, 8)
                          .map((taskItem) => (
                          <article
                            key={taskItem.id}
                            className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                          >
                            <div className="flex items-center justify-between text-sm">
                              <div>
                                <p className="font-semibold text-slate-900">{taskItem.title}</p>
                                <p className="text-xs text-slate-500">{taskItem.service}</p>
                              </div>
                              <div className="text-right">
                                <span
                                  className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusTone(taskItem.status)}`}
                                >
                                  {taskItem.status.replace(/_/g, ' ')}
                                </span>
                              </div>
                            </div>
                          </article>
                          ))
                      )}
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeTab === 'compliance' && (
              <section className="mt-6 grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <header className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Compliance
                      </p>
                      <h2 className="text-xl font-semibold text-slate-900">Upcoming Deadlines (Next 90 Days)</h2>
                    </div>
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  </header>
                  <div className="mt-4 space-y-3">
                    {complianceDeadlineSummary.upcoming.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No deadlines in the next 90 days.
                      </p>
                    ) : (
                      complianceDeadlineSummary.upcoming.map((item) => (
                        <article key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-slate-900">{item.label}</p>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {item.category}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">Due {item.dueDate.toLocaleDateString('en-GB')}</p>
                        </article>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <header>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Regulatory Controls</p>
                    <h2 className="text-xl font-semibold text-slate-900">Compliance Panel</h2>
                  </header>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <DataField label="Overdue Items" value={complianceDeadlineSummary.overdue.length} />
                    <DataField label="Deadlines in 90 Days" value={complianceDeadlineSummary.upcoming.length} />
                    <DataField label="Compliance Coverage" value={`${complianceCoverageRate}%`} />
                    <DataField label="Next Filing Due" value={nextComplianceDate} />
                  </div>

                  {complianceDeadlineSummary.overdue.length > 0 && (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        <p className="font-semibold">Overdue Compliance Items</p>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {complianceDeadlineSummary.overdue.map((item) => (
                          <li key={item.id}>
                            {item.label} ({item.category}) due {item.dueDate.toLocaleDateString('en-GB')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold">Timeline (Preview)</p>
                    <ul className="mt-2 space-y-1">
                      {complianceDeadlines.slice(0, 5).map((item) => (
                        <li key={`timeline-${item.id}`}>
                          {item.dueDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} - {item.category}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'engagement' && (
              <>
                <section className="mt-6 grid gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Engagement</p>
                        <h2 className="text-xl font-semibold text-slate-900">Engagement & Authority</h2>
                      </div>
                      <button className="btn-secondary" onClick={() => openSectionEditor('engagement')}>
                        Edit
                      </button>
                    </header>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <TriStateField
                        label="Engagement Type"
                        value={formatLabel(contact.engagement_type)}
                        fieldKey="engagement_type"
                        contact={contact}
                      />
                      <TriStateField
                        label="Engagement Sent"
                        value={formatDate(contact.engagement_letter_sent_date)}
                        fieldKey="engagement_letter_sent_date"
                        contact={contact}
                      />
                      <TriStateField
                        label="Engagement Signed"
                        value={formatDate(contact.engagement_letter_signed_date)}
                        fieldKey="engagement_letter_signed_date"
                        contact={contact}
                      />
                      <DataField label="Acting As Agent" value={formatBoolean(contact.acting_as_agent)} />
                      <DataField label="HMRC Agent Authorised" value={formatBoolean(contact.hmrc_agent_authorised)} />
                      <TriStateField
                        label="Professional Clearance"
                        value={formatBoolean(contact.professional_clearance_received, 'Received', 'Pending')}
                        fieldKey="professional_clearance_received"
                        contact={contact}
                      />
                      <DataField label="Take-on Completed" value={formatBoolean(contact.take_on_completed, 'Yes', 'No')} />
                      <TriStateField
                        label="Previous Accountant"
                        value={contact.previous_accountant}
                        fieldKey="previous_accountant"
                        contact={contact}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credentials</p>
                        <h2 className="text-xl font-semibold text-slate-900">Usernames and Codes</h2>
                      </div>
                      <button className="btn-secondary" onClick={() => openSectionEditor('engagement')}>
                        Edit
                      </button>
                    </header>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <DataField label="Gateway Username" value={contact.government_gateway_username} />
                      <DataField label="Gateway Password" value={contact.government_gateway_password} />
                      <DataField label="Where Auth Code Is Sent" value={contact.auth_code_delivery_contact} />
                      <DataField label="Companies House Auth Code" value={contact.companies_house_auth_code} />
                      <DataField label="Directors CH Verification No" value={contact.directors_ch_verification_no} />
                    </div>
                  </div>
                </section>

                <section className="mt-6 grid gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AML & Risk</p>
                        <h2 className="text-xl font-semibold text-slate-900">Risk & Verification</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${riskStatus.classes}`}>
                          {riskStatus.label}
                        </span>
                        <button className="btn-secondary" onClick={() => openSectionEditor('aml')}>
                          Edit
                        </button>
                      </div>
                    </header>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <DataField label="Risk Rating (Calculated)" value={`${riskEngine.score} points`} />
                      <DataField label="AML Review Date" value={formatDate(contact.aml_review_date)} />
                      <DataField label="Risk Review Frequency" value={formatLabel(contact.risk_review_frequency)} />
                      <DataField label="ID Verified" value={formatBoolean(contact.id_verified)} />
                      <DataField label="Source of Funds" value={formatBoolean(contact.source_of_funds_checked)} />
                      <DataField label="Beneficial Owner" value={formatBoolean(contact.beneficial_owner_verified)} />
                      <DataField label="PEP Flag" value={formatBoolean(contact.pep_flag, 'Yes', 'No')} />
                      <DataField label="Ongoing Monitoring" value={formatBoolean(contact.ongoing_monitoring_flag, 'Enabled', 'Disabled')} />
                      <DataField label="Assigned Reviewer" value={resolveUserLabel(contact.assigned_reviewer)} />
                    </div>
                    {riskEngine.factors.length > 0 && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <p className="font-semibold">Risk drivers</p>
                        <ul className="mt-2 space-y-1">
                          {riskEngine.factors.map((factor) => (
                            <li key={factor.label}>
                              {factor.label} (+{factor.points})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">HMRC & Tax</p>
                        <h2 className="text-xl font-semibold text-slate-900">Tax Registrations</h2>
                      </div>
                      <button className="btn-secondary" onClick={() => openSectionEditor('tax')}>
                        Edit
                      </button>
                    </header>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <TriStateField label="UTR" value={contact.utr} fieldKey="utr" contact={contact} />
                      <TriStateField
                        label="VAT Number"
                        value={contact.vat_number}
                        fieldKey="vat_number"
                        contact={contact}
                      />
                      <TriStateField
                        label="VAT Scheme"
                        value={contact.vat_scheme}
                        fieldKey="vat_scheme"
                        contact={contact}
                      />
                      <DataField label="VAT Frequency" value={formatLabel(contact.vat_frequency || contact.vat_stagger)} />
                      <DataField label="MTD Enabled" value={formatBoolean(contact.mtd_enabled)} />
                      <TriStateField
                        label="PAYE Number"
                        value={contact.paye_reference}
                        fieldKey="paye_reference"
                        contact={contact}
                      />
                      <TriStateField
                        label="NI Number"
                        value={contact.ni_number}
                        fieldKey="ni_number"
                        contact={contact}
                      />
                      <DataField label="Accounts Reference Date" value={formatDate(contact.accounts_reference_date)} />
                    </div>
                  </div>
                </section>

                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <header className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Internal Practice Structure
                      </p>
                      <h2 className="text-xl font-semibold text-slate-900">Ownership & Operations</h2>
                    </div>
                    <button className="btn-secondary" onClick={() => openSectionEditor('ops')}>
                      Edit
                    </button>
                  </header>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <DataField label="Client Manager" value={resolveUserLabel(contact.client_manager)} />
                    <DataField label="Responsible Partner" value={resolveUserLabel(contact.partner)} />
                    <DataField label="Sector" value={contact.sector} />
                    <DataField label="Year End" value={resolveYearEndDisplay(contact)} />
                    <DataField label="Accounting Software" value={formatLabel(contact.software_used)} />
                    <DataField label="Payroll Frequency" value={formatLabel(contact.payroll_frequency)} />
                    <DataField label="Internal Rating" value={contact.internal_rating} />
                    <DataField label="Billing Model" value={formatLabel(contact.billing_model)} />
                    <DataField label="Payment Method" value={contact.payment_method} />
                    <DataField label="Bank Account Name" value={contact.bank_account_name} />
                    <DataField label="Bank Sort Code" value={contact.bank_sort_code} />
                    <DataField label="Bank Account Number" value={contact.bank_account_number} />
                    <DataField label="Monthly Fee" value={typeof contact.monthly_fee === 'number' ? currencyFormatter.format(contact.monthly_fee) : undefined} />
                  </div>
                </section>
              </>
            )}

            {activeTab === 'companies-house' && (
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Companies House
                    </p>
                    <h2 className="text-xl font-semibold text-slate-900">Embedded Company Profile</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="btn-secondary"
                      onClick={() => void handleRefreshCompaniesHouse()}
                      disabled={isRefreshingCompaniesHouse || !contact.company_number}
                    >
                      {isRefreshingCompaniesHouse ? 'Refreshing...' : 'Refresh from Companies House'}
                    </button>
                    <button className="btn-secondary" onClick={() => navigate(companySearchUrl)}>
                      Search Companies House
                    </button>
                    {contact.company_number && (
                      <a
                        className="btn-secondary"
                        href={`https://find-and-update.company-information.service.gov.uk/company/${contact.company_number}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        Open Official Register <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </header>

                <div className="mt-6 flex flex-wrap gap-2">
                  {([
                    { key: 'company-details', label: 'Company Details' },
                    { key: 'officers', label: 'Officers' },
                    { key: 'psc', label: 'PSC' },
                    { key: 'filings', label: 'Filings' },
                  ] as { key: CompaniesHouseTab; label: string }[]).map((tab) => (
                    <button
                      key={tab.key}
                      className={companiesHouseTab === tab.key ? 'btn-primary btn-onboarding' : 'btn-secondary'}
                      onClick={() => setCompaniesHouseTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {companiesHouseError && (
                  <p className="mt-4 text-sm text-amber-700">
                    Companies House snapshot unavailable: {companiesHouseError}
                  </p>
                )}
                {relatedClientError && (
                  <p className="mt-2 text-sm text-rose-700">{relatedClientError}</p>
                )}

                {companiesHouseTab === 'company-details' && (
                  <div className="mt-6 grid gap-4 xl:grid-cols-3">
                    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company Profile</p>
                      <div className="mt-4 grid gap-4">
                        <DataField label="Company Name" value={profileCompanyName} />
                        <DataField label="Company Number" value={profileCompanyNumber} />
                        <DataField label="Company Type" value={profileCompanyType} />
                        <DataField label="Company Status" value={profileCompanyStatus} />
                        <DataField label="Incorporated On" value={profileIncorporatedOn} />
                        <DataField label="Registered Address" value={profileRegisteredOffice} />
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accounts</p>
                      <div className="mt-4 grid gap-4">
                        <DataField label="Next Accounts Made Up To" value={nextAccountsMadeUpTo} />
                        <DataField label="Accounts Due By" value={accountsDueBy} />
                        <DataField label="Last Accounts Made Up To" value={lastAccountsMadeUpTo} />
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Statement</p>
                      <div className="mt-4 grid gap-4">
                        <DataField label="Next Statement Date" value={nextStatementDate} />
                        <DataField label="Statement Due By" value={statementDueBy} />
                        <DataField label="Last Statement Dated" value={lastStatementDated} />
                      </div>
                    </section>
                  </div>
                )}

                {companiesHouseTab === 'officers' && (
                  <div className="mt-6 space-y-3">
                    {activeOfficers.length ? (
                      <>
                        <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-4">
                          <span>Name</span>
                          <span>Role</span>
                          <span>Appointment</span>
                          <span>Resigned</span>
                        </div>
                        {activeOfficers.map((officer) => {
                          const linkedClient = relatedClientLookup.get(normalizePartyLookupKey(officer.name));
                          const actionKey = `officer:${normalizePartyLookupKey(officer.name)}`;

                          return (
                            <article
                              key={`${officer.name}-${officer.appointedOn}`}
                              className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                            >
                              <div className="grid gap-3 md:grid-cols-4 md:items-start">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Name</p>
                                  <p className="font-semibold text-slate-900">{officer.name}</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {linkedClient ? (
                                      <>
                                        <span className="text-xs font-medium text-slate-500">
                                          {linkedClient.client_ref || 'Linked client'}
                                        </span>
                                        <button
                                          type="button"
                                          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white"
                                          onClick={() => navigate(`/clients/${linkedClient.id}`)}
                                        >
                                          Open Client
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                        onClick={() => void handleAddOfficerClient(officer)}
                                        disabled={creatingRelatedClientKey === actionKey}
                                      >
                                        {creatingRelatedClientKey === actionKey ? 'Adding...' : 'Add Client'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Role</p>
                                  <p className="text-sm text-slate-700">{formatLabel(officer.role)}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Appointment</p>
                                  <p className="text-sm text-slate-700">{formatDate(officer.appointedOn)}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Resigned</p>
                                  <p className="text-sm text-slate-700">—</p>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">No current officers returned in this snapshot.</p>
                    )}

                    {formerOfficers.length > 0 && (
                      <div className="pt-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setShowFormerOfficers((value) => !value)}
                        >
                          {showFormerOfficers
                            ? `Hide Previous Officers (${formerOfficers.length})`
                            : `Show Previous Officers (${formerOfficers.length})`}
                        </button>
                        {showFormerOfficers && (
                          <div className="mt-3 space-y-3">
                            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-4">
                              <span>Name</span>
                              <span>Role</span>
                              <span>Appointment</span>
                              <span>Resigned</span>
                            </div>
                            {formerOfficers.map((officer) => {
                              const linkedClient = relatedClientLookup.get(normalizePartyLookupKey(officer.name));
                              const actionKey = `officer:${normalizePartyLookupKey(officer.name)}`;

                              return (
                                <article
                                  key={`${officer.name}-${officer.appointedOn}-${officer.resignedOn || 'former'}`}
                                  className="rounded-xl border border-slate-200 bg-slate-100 p-4"
                                >
                                  <div className="grid gap-3 md:grid-cols-4 md:items-start">
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Name</p>
                                      <p className="font-semibold text-slate-900">{officer.name}</p>
                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        {linkedClient ? (
                                          <>
                                            <span className="text-xs font-medium text-slate-500">
                                              {linkedClient.client_ref || 'Linked client'}
                                            </span>
                                            <button
                                              type="button"
                                              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white"
                                              onClick={() => navigate(`/clients/${linkedClient.id}`)}
                                            >
                                              Open Client
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            type="button"
                                            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                            onClick={() => void handleAddOfficerClient(officer)}
                                            disabled={creatingRelatedClientKey === actionKey}
                                          >
                                            {creatingRelatedClientKey === actionKey ? 'Adding...' : 'Add Client'}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Role</p>
                                      <p className="text-sm text-slate-700">{formatLabel(officer.role)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Appointment</p>
                                      <p className="text-sm text-slate-700">{formatDate(officer.appointedOn)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Resigned</p>
                                      <p className="text-sm text-slate-700">{formatDate(officer.resignedOn)}</p>
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {companiesHouseTab === 'psc' && (
                  <div className="mt-6 space-y-3">
                    {activePscEntries.length ? (
                      <>
                        <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-4">
                          <span>Name</span>
                          <span>Type</span>
                          <span>Notified</span>
                          <span>Ceased</span>
                        </div>
                        {activePscEntries.map((psc) => {
                          const linkedClient = relatedClientLookup.get(normalizePartyLookupKey(psc.name));
                          const actionKey = `psc:${normalizePartyLookupKey(psc.name)}`;

                          return (
                            <article
                              key={`${psc.name}-${psc.notifiedOn}`}
                              className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                            >
                              <div className="grid gap-3 md:grid-cols-4 md:items-start">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Name</p>
                                  <p className="font-semibold text-slate-900">{psc.name}</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {linkedClient ? (
                                      <>
                                        <span className="text-xs font-medium text-slate-500">
                                          {linkedClient.client_ref || 'Linked client'}
                                        </span>
                                        <button
                                          type="button"
                                          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white"
                                          onClick={() => navigate(`/clients/${linkedClient.id}`)}
                                        >
                                          Open Client
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                        onClick={() => void handleAddPscClient(psc)}
                                        disabled={creatingRelatedClientKey === actionKey}
                                      >
                                        {creatingRelatedClientKey === actionKey ? 'Adding...' : 'Add Client'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Type</p>
                                  <p className="text-sm text-slate-700">{formatLabel(psc.kind)}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Notified</p>
                                  <p className="text-sm text-slate-700">{formatDate(psc.notifiedOn)}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Ceased</p>
                                  <p className="text-sm text-slate-700">—</p>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">No current PSC entries returned in this snapshot.</p>
                    )}

                    {formerPscEntries.length > 0 && (
                      <div className="pt-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setShowFormerPsc((value) => !value)}
                        >
                          {showFormerPsc
                            ? `Hide Previous PSC (${formerPscEntries.length})`
                            : `Show Previous PSC (${formerPscEntries.length})`}
                        </button>
                        {showFormerPsc && (
                          <div className="mt-3 space-y-3">
                            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-4">
                              <span>Name</span>
                              <span>Type</span>
                              <span>Notified</span>
                              <span>Ceased</span>
                            </div>
                            {formerPscEntries.map((psc) => {
                              const linkedClient = relatedClientLookup.get(normalizePartyLookupKey(psc.name));
                              const actionKey = `psc:${normalizePartyLookupKey(psc.name)}`;

                              return (
                                <article
                                  key={`${psc.name}-${psc.notifiedOn}-${psc.ceasedOn || 'former'}`}
                                  className="rounded-xl border border-slate-200 bg-slate-100 p-4"
                                >
                                  <div className="grid gap-3 md:grid-cols-4 md:items-start">
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Name</p>
                                      <p className="font-semibold text-slate-900">{psc.name}</p>
                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        {linkedClient ? (
                                          <>
                                            <span className="text-xs font-medium text-slate-500">
                                              {linkedClient.client_ref || 'Linked client'}
                                            </span>
                                            <button
                                              type="button"
                                              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white"
                                              onClick={() => navigate(`/clients/${linkedClient.id}`)}
                                            >
                                              Open Client
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            type="button"
                                            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                            onClick={() => void handleAddPscClient(psc)}
                                            disabled={creatingRelatedClientKey === actionKey}
                                          >
                                            {creatingRelatedClientKey === actionKey ? 'Adding...' : 'Add Client'}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Type</p>
                                      <p className="text-sm text-slate-700">{formatLabel(psc.kind)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Notified</p>
                                      <p className="text-sm text-slate-700">{formatDate(psc.notifiedOn)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Ceased</p>
                                      <p className="text-sm text-slate-700">{formatDate(psc.ceasedOn)}</p>
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {companiesHouseTab === 'filings' && (
                  <div className="mt-6 space-y-3">
                    {companiesHouseProfile?.filingHistory?.items?.length ? (
                      <>
                        <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[140px_120px_1fr]">
                          <span>Date</span>
                          <span>Doc Ref</span>
                          <span>Description</span>
                        </div>
                        {companiesHouseProfile.filingHistory.items.slice(0, 15).map((filing) => (
                          <article
                            key={filing.transactionId}
                            className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                          >
                            <div className="grid gap-3 md:grid-cols-[140px_120px_1fr] md:items-start">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Date</p>
                                <p className="text-sm text-slate-700">{formatDate(filing.date)}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Doc Ref</p>
                                <p className="text-sm font-semibold text-slate-900">{filing.type || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Description</p>
                                <p className="font-semibold text-slate-900">
                                  {formatCompaniesHouseFilingDescription(filing.description)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">{formatLabel(filing.category)}</p>
                              </div>
                            </div>
                          </article>
                        ))}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">No filing history returned in current snapshot.</p>
                    )}
                  </div>
                )}
              </section>
            )}

            {activeTab === 'documents' && (
              <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr,1fr]">
                <ClientDocuments clientId={contact.id} />
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <header className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Templates
                      </p>
                      <h2 className="text-xl font-semibold text-slate-900">Document Kits</h2>
                    </div>
                    <Upload className="h-5 w-5 text-purple-500" />
                  </header>
                  <div className="mt-4 space-y-3 text-sm">
                    {templateShortcuts.map((template) => (
                      <button
                        key={template.name}
                        onClick={template.action}
                        className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:bg-white"
                      >
                        <p className="font-semibold text-slate-900">{template.name}</p>
                        <p className="text-xs text-slate-500">{template.description}</p>
                        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                          Open Template <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'notes' && (
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <header className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Client Profile
                    </p>
                    <h2 className="text-xl font-semibold text-slate-900">Notes</h2>
                  </div>
                  <BookOpen className="h-5 w-5 text-slate-500" />
                </header>
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                  {contact.notes?.trim() ? contact.notes : 'No profile notes recorded yet.'}
                </div>
              </section>
            )}

            {activeTab === 'audit-log' && (
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <header className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audit</p>
                    <h2 className="text-xl font-semibold text-slate-900">Recent Activity Log</h2>
                  </div>
                  <button className="btn-secondary" onClick={() => void refreshAuditEvents(contact.id)}>
                    <RefreshCw className="h-4 w-4" /> Refresh
                  </button>
                </header>

                <div className="mt-4 space-y-3 text-sm">
                  {auditEvents.length === 0 ? (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-slate-500">
                      No audit events recorded yet.
                    </div>
                  ) : (
                    auditEvents.map((event) => (
                    <article key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-900">
                          {formatLabel(event.module)} {formatLabel(event.action)}
                        </p>
                        <span className="text-xs text-slate-500">{formatDateTime(event.created_at)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        User: {resolveUserLabel(event.actor) || event.actor || 'System'}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {event.entity_label || formatLabel(event.entity_type)}
                        {event.detail ? ` · ${event.detail}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {event.changes.length > 0
                          ? event.changes
                              .map((change) => `${formatLabel(change.field)}: ${change.from || '—'} -> ${change.to || '—'}`)
                              .join(' | ')
                          : 'No field-level changes captured.'}
                      </p>
                    </article>
                  )))}
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>

      {contact && editingSection && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 p-4">
          <div className="mx-auto mt-10 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-xl font-semibold text-slate-900">{SECTION_LABELS[editingSection]} Edit</h3>
              <button className="btn-secondary" onClick={closeSectionEditor}>
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              {sectionSaveError && (
                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {sectionSaveError}
                </div>
              )}

              {editingSection === 'identity' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Business / Client Name
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.name || '')}
                      onChange={(event) => updateSectionDraft('name', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Contact Person
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.contact_person || '')}
                      onChange={(event) => updateSectionDraft('contact_person', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Email
                    <input
                      type="email"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.email || '')}
                      onChange={(event) => updateSectionDraft('email', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Phone
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.phone || '')}
                      onChange={(event) => updateSectionDraft('phone', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                    Address Line 1
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.address || '')}
                      onChange={(event) => updateSectionDraft('address', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                    Address Line 2
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.address_line_2 || '')}
                      onChange={(event) => updateSectionDraft('address_line_2', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    City
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.city || '')}
                      onChange={(event) => updateSectionDraft('city', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Postcode
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.postcode || '')}
                      onChange={(event) => updateSectionDraft('postcode', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Country
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.country || '')}
                      onChange={(event) => updateSectionDraft('country', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Legal Entity Type
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.legal_entity_type || '')}
                      onChange={(event) =>
                        updateSectionDraft(
                          'legal_entity_type',
                          (event.target.value || undefined) as Contact['legal_entity_type']
                        )
                      }
                    >
                      <option value="">Select</option>
                      <option value="ltd">Ltd</option>
                      <option value="plc">PLC</option>
                      <option value="llp">LLP</option>
                      <option value="partnership">Partnership</option>
                      <option value="sole_trader">Sole trader</option>
                      <option value="charity">Charity</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    VAT Number
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.vat_number || '')}
                      onChange={(event) => updateSectionDraft('vat_number', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Company Number
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.company_number || '')}
                      onChange={(event) => updateSectionDraft('company_number', event.target.value)}
                    />
                  </label>
                </div>
              )}

              {editingSection === 'engagement' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Engagement Type
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.engagement_type || '')}
                      onChange={(event) =>
                        updateSectionDraft(
                          'engagement_type',
                          (event.target.value || undefined) as Contact['engagement_type']
                        )
                      }
                    >
                      <option value="">Select</option>
                      <option value="limited_company">Limited company</option>
                      <option value="sole_trader">Sole trader</option>
                      <option value="partnership">Partnership</option>
                      <option value="individual">Individual</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Previous Accountant
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.previous_accountant || '')}
                      onChange={(event) => updateSectionDraft('previous_accountant', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Engagement Sent
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.engagement_letter_sent_date || '')}
                      onChange={(event) => updateSectionDraft('engagement_letter_sent_date', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Engagement Signed
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.engagement_letter_signed_date || '')}
                      onChange={(event) => updateSectionDraft('engagement_letter_signed_date', event.target.value)}
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(sectionDraft.acting_as_agent)}
                      onChange={(event) => updateSectionDraft('acting_as_agent', event.target.checked)}
                    />
                    Acting as agent
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(sectionDraft.hmrc_agent_authorised)}
                      onChange={(event) => updateSectionDraft('hmrc_agent_authorised', event.target.checked)}
                    />
                    HMRC authorised
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Agent Reference (ARN)
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.hmrc_agent_reference || '')}
                      onChange={(event) => updateSectionDraft('hmrc_agent_reference', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Gateway Username
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.government_gateway_username || '')}
                      onChange={(event) => updateSectionDraft('government_gateway_username', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Gateway Password
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.government_gateway_password || '')}
                      onChange={(event) => updateSectionDraft('government_gateway_password', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Where Auth Code Is Sent
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.auth_code_delivery_contact || '')}
                      onChange={(event) => updateSectionDraft('auth_code_delivery_contact', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Companies House Auth Code
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.companies_house_auth_code || '')}
                      onChange={(event) => updateSectionDraft('companies_house_auth_code', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Directors CH Verification No
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.directors_ch_verification_no || '')}
                      onChange={(event) => updateSectionDraft('directors_ch_verification_no', event.target.value)}
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(sectionDraft.professional_clearance_received)}
                      onChange={(event) => updateSectionDraft('professional_clearance_received', event.target.checked)}
                    />
                    Professional clearance received
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(sectionDraft.take_on_completed)}
                      onChange={(event) => updateSectionDraft('take_on_completed', event.target.checked)}
                    />
                    Take-on completed
                  </label>
                </div>
              )}

              {editingSection === 'aml' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    AML Risk Rating
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.aml_risk_rating || '')}
                      onChange={(event) =>
                        updateSectionDraft(
                          'aml_risk_rating',
                          (event.target.value || undefined) as Contact['aml_risk_rating']
                        )
                      }
                    >
                      <option value="">Select</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    AML Review Date
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.aml_review_date || '')}
                      onChange={(event) => updateSectionDraft('aml_review_date', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Risk Review Frequency
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.risk_review_frequency || '')}
                      onChange={(event) =>
                        updateSectionDraft(
                          'risk_review_frequency',
                          (event.target.value || undefined) as Contact['risk_review_frequency']
                        )
                      }
                    >
                      <option value="">Select</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="semi_annual">Semi annual</option>
                      <option value="annual">Annual</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    ID Verification Method
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.id_verification_method || '')}
                      onChange={(event) => updateSectionDraft('id_verification_method', event.target.value)}
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(sectionDraft.id_verified)}
                      onChange={(event) => updateSectionDraft('id_verified', event.target.checked)}
                    />
                    ID verified
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(sectionDraft.source_of_funds_checked)}
                      onChange={(event) => updateSectionDraft('source_of_funds_checked', event.target.checked)}
                    />
                    Source of funds verified
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(sectionDraft.beneficial_owner_verified)}
                      onChange={(event) => updateSectionDraft('beneficial_owner_verified', event.target.checked)}
                    />
                    Beneficial owner verified
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(sectionDraft.pep_flag)}
                      onChange={(event) => updateSectionDraft('pep_flag', event.target.checked)}
                    />
                    PEP flag
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(sectionDraft.ongoing_monitoring_flag)}
                      onChange={(event) => updateSectionDraft('ongoing_monitoring_flag', event.target.checked)}
                    />
                    Ongoing monitoring
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Assigned Reviewer
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.assigned_reviewer || '')}
                      onChange={(event) => updateSectionDraft('assigned_reviewer', event.target.value)}
                    >
                      {managerOptions.map((option) => (
                        <option key={`reviewer-${option.value || 'unassigned'}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                    AML Notes
                    <textarea
                      rows={4}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.aml_notes || '')}
                      onChange={(event) => updateSectionDraft('aml_notes', event.target.value)}
                    />
                  </label>
                </div>
              )}

              {editingSection === 'tax' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    UTR
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.utr || '')}
                      onChange={(event) => updateSectionDraft('utr', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    VAT Number
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.vat_number || '')}
                      onChange={(event) => updateSectionDraft('vat_number', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    VAT Status
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.field_statuses?.vat_number || 'missing')}
                      onChange={(event) =>
                        updateFieldStatusDraft(
                          'vat_number',
                          (event.target.value || 'missing') as Contact['field_statuses'][string]
                        )
                      }
                    >
                      <option value="missing">Missing</option>
                      <option value="provided">Provided</option>
                      <option value="applied_for">Applied For</option>
                      <option value="not_applicable">Not Applicable</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    PAYE Number
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.paye_reference || '')}
                      onChange={(event) => updateSectionDraft('paye_reference', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    PAYE Status
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.field_statuses?.paye_reference || 'missing')}
                      onChange={(event) =>
                        updateFieldStatusDraft(
                          'paye_reference',
                          (event.target.value || 'missing') as Contact['field_statuses'][string]
                        )
                      }
                    >
                      <option value="missing">Missing</option>
                      <option value="provided">Provided</option>
                      <option value="applied_for">Applied For</option>
                      <option value="not_applicable">Not Applicable</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    NI Number
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.ni_number || '')}
                      onChange={(event) => updateSectionDraft('ni_number', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    NI Status
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.field_statuses?.ni_number || 'missing')}
                      onChange={(event) =>
                        updateFieldStatusDraft(
                          'ni_number',
                          (event.target.value || 'missing') as Contact['field_statuses'][string]
                        )
                      }
                    >
                      <option value="missing">Missing</option>
                      <option value="provided">Provided</option>
                      <option value="not_applicable">Not Applicable</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    VAT Scheme
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.vat_scheme || '')}
                      onChange={(event) => updateSectionDraft('vat_scheme', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    VAT Frequency
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.vat_frequency || '')}
                      onChange={(event) =>
                        updateSectionDraft(
                          'vat_frequency',
                          (event.target.value || undefined) as Contact['vat_frequency']
                        )
                      }
                    >
                      <option value="">Select</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(sectionDraft.mtd_enabled)}
                      onChange={(event) => updateSectionDraft('mtd_enabled', event.target.checked)}
                    />
                    MTD enabled
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Accounts Reference Date
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.accounts_reference_date || '')}
                      onChange={(event) => updateSectionDraft('accounts_reference_date', event.target.value)}
                    />
                  </label>
                </div>
              )}

              {editingSection === 'ops' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Client Manager
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.client_manager || '')}
                      onChange={(event) => updateSectionDraft('client_manager', event.target.value)}
                    >
                      {managerOptions.map((option) => (
                        <option key={`manager-${option.value || 'unassigned'}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Responsible Partner
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.partner || '')}
                      onChange={(event) => updateSectionDraft('partner', event.target.value)}
                    >
                      {managerOptions.map((option) => (
                        <option key={`partner-${option.value || 'unassigned'}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Sector
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.sector || '')}
                      onChange={(event) => updateSectionDraft('sector', event.target.value)}
                    >
                      <option value="">Select</option>
                      {sectorOptions.map((sector) => (
                        <option key={sector} value={sector}>
                          {sector}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Internal Rating
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.internal_rating || '')}
                      onChange={(event) => updateSectionDraft('internal_rating', event.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Accounting Software
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.software_used || '')}
                      onChange={(event) =>
                        updateSectionDraft(
                          'software_used',
                          (event.target.value || undefined) as Contact['software_used']
                        )
                      }
                    >
                      <option value="">Select</option>
                      <option value="xero">Xero</option>
                      <option value="quickbooks">QuickBooks</option>
                      <option value="sage">Sage</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Billing Model
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.billing_model || '')}
                      onChange={(event) =>
                        updateSectionDraft(
                          'billing_model',
                          (event.target.value || undefined) as Contact['billing_model']
                        )
                      }
                    >
                      <option value="">Select</option>
                      <option value="fixed">Fixed</option>
                      <option value="monthly_dd">Monthly DD</option>
                      <option value="hourly">Hourly</option>
                      <option value="value_pricing">Value pricing</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Payment Method
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.payment_method || '')}
                      onChange={(event) => updateSectionDraft('payment_method', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Bank Account Name
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.bank_account_name || '')}
                      onChange={(event) => updateSectionDraft('bank_account_name', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Bank Sort Code
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.bank_sort_code || '')}
                      onChange={(event) => updateSectionDraft('bank_sort_code', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Bank Account Number
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.bank_account_number || '')}
                      onChange={(event) => updateSectionDraft('bank_account_number', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Monthly Fee
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={sectionDraft.monthly_fee ?? ''}
                      onChange={(event) =>
                        updateSectionDraft(
                          'monthly_fee',
                          (event.target.value === '' ? undefined : Number(event.target.value)) as Contact['monthly_fee']
                        )
                      }
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Credit Terms
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.credit_terms || '')}
                      onChange={(event) => updateSectionDraft('credit_terms', event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Payroll Frequency
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.payroll_frequency || '')}
                      onChange={(event) =>
                        updateSectionDraft(
                          'payroll_frequency',
                          (event.target.value || undefined) as Contact['payroll_frequency']
                        )
                      }
                    >
                      <option value="">Select</option>
                      <option value="weekly">Weekly</option>
                      <option value="fortnightly">Fortnightly</option>
                      <option value="four_weekly">Four-weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Last Fee Review Date
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={String(sectionDraft.last_fee_review_date || '')}
                      onChange={(event) => updateSectionDraft('last_fee_review_date', event.target.value)}
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(sectionDraft.direct_debit_mandate_signed)}
                      onChange={(event) => updateSectionDraft('direct_debit_mandate_signed', event.target.checked)}
                    />
                    Direct debit mandate signed
                  </label>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button className="btn-secondary" onClick={closeSectionEditor} disabled={isSavingSection}>
                Cancel
              </button>
              <button className="btn-primary btn-onboarding" onClick={() => void saveSectionDraft()} disabled={isSavingSection}>
                {isSavingSection ? 'Saving...' : 'Save Section'}
              </button>
            </div>
          </div>
        </div>
      )}

      {contact && isTemplateGeneratorOpen && (
        <DocumentTemplateGenerator
          client={contact}
          services={clientServices}
          onClose={() => setIsTemplateGeneratorOpen(false)}
        />
      )}

      {contact && isAddServiceOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 p-4">
          <div className="mx-auto mt-10 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-xl font-semibold text-slate-900">Add Service Engagement</h3>
              <button className="rounded-lg border border-slate-200 p-2 text-slate-500" onClick={() => setIsAddServiceOpen(false)}>
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              {serviceError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {serviceError}
                </div>
              )}
              <div className="grid gap-3">
                <label className="text-sm font-semibold text-slate-700">Service Template</label>
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={newService.serviceCode}
                  onChange={(event) => {
                    const serviceCode = event.target.value;
                    const selectedTemplate = eligibleTemplates.find((template) => template.serviceCode === serviceCode);
                    setNewService((prev) => ({
                      ...prev,
                      serviceCode,
                      frequency: selectedTemplate?.defaultFrequency || '',
                    }));
                  }}
                >
                  <option value="">Select template</option>
                  {eligibleTemplates.map((template) => (
                    <option key={template.serviceCode} value={template.serviceCode}>
                      {template.displayName} ({template.serviceCode}) · {template.billingUnit}
                    </option>
                  ))}
                </select>
                <label className="text-sm font-semibold text-slate-700">Service Fee</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={newService.feeAmount}
                  onChange={(event) => setNewService((prev) => ({ ...prev, feeAmount: event.target.value }))}
                  placeholder="e.g. 750"
                />
                <label className="text-sm font-semibold text-slate-700">Start Date</label>
                <input
                  type="date"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={newService.startDate}
                  onChange={(event) => setNewService((prev) => ({ ...prev, startDate: event.target.value }))}
                />
                <label className="text-sm font-semibold text-slate-700">Frequency</label>
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={newService.frequency}
                  onChange={(event) =>
                    setNewService((prev) => ({ ...prev, frequency: event.target.value as Frequency }))
                  }
                >
                  <option value="">Select frequency</option>
                  {serviceFrequencyOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatLabel(option)}
                    </option>
                  ))}
                </select>
                <label className="text-sm font-semibold text-slate-700">{selectedServiceSchedule.inputLabel}</label>
                <input
                  type="date"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={newService.scheduleDate}
                  onChange={(event) => setNewService((prev) => ({ ...prev, scheduleDate: event.target.value }))}
                />
                <p className="text-xs text-slate-500">{selectedServiceSchedule.helperText}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button className="btn-secondary" onClick={() => setIsAddServiceOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary btn-onboarding" onClick={handleAddService}>
                Apply Service
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
