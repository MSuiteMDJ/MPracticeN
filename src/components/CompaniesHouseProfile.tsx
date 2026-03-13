import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Printer,
  ShieldCheck,
  Users,
} from 'lucide-react';
import UniversalPageLayout from '@/components/ui/UniversalPageLayout';
import UniversalPageHeader from '@/components/ui/UniversalPageHeader';
import { companiesHouseAPI, contactsAPI, type CompaniesHouseProfileResponse } from '@/lib/api-service';
import { downloadDocument, generateDocument, openGeneratedDocument, type TemplateData } from '@/lib/templateGenerator';
import { getDefaultPortfolio, getPortfolios, type Portfolio } from '@/lib/portfolio-model';
import { getPracticeAddressParts } from '@/lib/practice-settings';
import { useSettings } from '@/contexts/SettingsContext';

const filingCategoryOptions = [
  { value: '', label: 'All categories' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'confirmation-statement', label: 'Confirmation statements' },
  { value: 'incorporation', label: 'Incorporation' },
  { value: 'officers', label: 'Officers' },
  { value: 'capital', label: 'Capital' },
  { value: 'charges', label: 'Charges' },
];

type AccountsComplianceSnapshot = {
  next_made_up_to?: string;
  next_due?: string;
  overdue?: boolean;
  next_accounts?: {
    due_on?: string;
    overdue?: boolean;
  };
  last_accounts?: {
    made_up_to?: string;
  };
};

type ConfirmationComplianceSnapshot = {
  next_made_up_to?: string;
  next_due?: string;
  last_made_up_to?: string;
  overdue?: boolean;
};

function formatDate(value: string | undefined | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatStatus(value: string | undefined | null): string {
  if (!value) return '—';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function valueOrDash(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '—';
  const clean = String(value).trim();
  return clean.length > 0 ? clean : '—';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function DataField({ label, value }: { label: string; value: string | number | undefined | null }) {
  return (
    <dl className="text-sm text-slate-600">
      <dt className="font-semibold text-slate-800">{label}</dt>
      <dd>{valueOrDash(value)}</dd>
    </dl>
  );
}

function toFileSafeName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

export default function CompaniesHouseProfile() {
  const { companyNumber = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings } = useSettings();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'company-details' | 'charges-filings' | 'report'>('company-details');
  const [category, setCategory] = useState('');
  const [visibleFilings, setVisibleFilings] = useState(10);
  const [profileData, setProfileData] = useState<CompaniesHouseProfileResponse['profile'] | null>(null);
  const [isReportBusy, setIsReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isImportingClient, setIsImportingClient] = useState(false);
  const [importClientError, setImportClientError] = useState<string | null>(null);
  const [portfolioOptions, setPortfolioOptions] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('');

  const loadProfile = useCallback(async () => {
    if (!companyNumber) return;
    setLoading(true);
    setError(null);

    try {
      const response = await companiesHouseAPI.getCompanyProfile(companyNumber, {
        category,
        itemsPerPage: 50,
      });
      setProfileData(response.profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load company profile';
      setError(message);
      setProfileData(null);
    } finally {
      setLoading(false);
    }
  }, [category, companyNumber]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    setVisibleFilings(10);
  }, [category]);

  useEffect(() => {
    const options = getPortfolios();
    const fallback = getDefaultPortfolio();
    setPortfolioOptions(options);
    setSelectedPortfolioId(fallback.id);
  }, []);

  const company = profileData?.company;

  const currentOfficers = useMemo(() => {
    if (!profileData) return [];
    return profileData.officers.items.filter((item) => item.status === 'active');
  }, [profileData]);

  const currentPsc = useMemo(() => {
    if (!profileData) return [];
    return profileData.psc.items.filter((item) => item.status === 'active');
  }, [profileData]);

  const visibleFilingItems = useMemo(() => {
    if (!profileData) return [];
    return profileData.filingHistory.items.slice(0, visibleFilings);
  }, [profileData, visibleFilings]);

  const hasMoreFilings = (profileData?.filingHistory.items.length || 0) > visibleFilings;

  const companiesHouseUrl = company?.companyNumber
    ? `https://find-and-update.company-information.service.gov.uk/company/${company.companyNumber}`
    : '';

  const returnQuery = (searchParams.get('q') || '').trim();
  const searchReturnPath = returnQuery
    ? `/companies-house?q=${encodeURIComponent(returnQuery)}`
    : '/companies-house';

  const accounts = profileData?.compliance.accounts as AccountsComplianceSnapshot | null | undefined;
  const confirmation = profileData?.compliance.confirmationStatement as ConfirmationComplianceSnapshot | null | undefined;

  const buildReportHtml = useCallback(async (): Promise<string> => {
    if (!profileData || !company) {
      throw new Error('Company profile is not loaded yet.');
    }

    const generatedAt = new Date();

    const officersRows = profileData.officers.items.length
      ? profileData.officers.items
          .map(
            (officer) => `<tr>
<td>${escapeHtml(officer.displayName || officer.name || '—')}</td>
<td>${escapeHtml(formatStatus(officer.role))}</td>
<td>${escapeHtml(formatDate(officer.appointedOn))}</td>
<td>${escapeHtml(formatDate(officer.resignedOn))}</td>
<td>${escapeHtml(valueOrDash(officer.nationality))}</td>
<td>${escapeHtml(valueOrDash(officer.countryOfResidence))}</td>
</tr>`
          )
          .join('')
      : '<tr><td colspan="6">No officers found.</td></tr>';

    const filingRows = profileData.filingHistory.items.length
      ? profileData.filingHistory.items
          .slice(0, 50)
          .map(
            (item) => `<tr>
<td>${escapeHtml(formatDate(item.date))}</td>
<td>${escapeHtml(valueOrDash(item.description))}</td>
<td>${escapeHtml(valueOrDash(formatStatus(item.category)))}</td>
<td>${escapeHtml(valueOrDash(item.type))}</td>
</tr>`
          )
          .join('')
      : '<tr><td colspan="4">No filing history available.</td></tr>';

    const pscRows = profileData.psc.items.length
      ? profileData.psc.items
          .map(
            (psc) => `<tr>
<td>${escapeHtml(psc.displayName || psc.name || '—')}</td>
<td>${escapeHtml(formatStatus(psc.kind || ''))}</td>
<td>${escapeHtml(formatDate(psc.notifiedOn))}</td>
<td>${escapeHtml(psc.natureOfControl.length ? psc.natureOfControl.join(' • ') : '—')}</td>
</tr>`
          )
          .join('')
      : '<tr><td colspan="4">No persons with significant control found.</td></tr>';

    const accountsDueOverdue = Boolean(accounts?.overdue || accounts?.next_accounts?.overdue);
    const confirmationDueOverdue = Boolean(confirmation?.overdue);

    const companyStatusRaw = String(company.companyStatus || '').toLowerCase();
    const companyStatusBadgeClass = companyStatusRaw === 'active' ? 'success' : companyStatusRaw === 'dissolved' ? 'danger' : 'warning';

    const practiceAddressParts = getPracticeAddressParts(settings);
    const settingsAddressLine2 = practiceAddressParts.line2 ? `, ${practiceAddressParts.line2}` : '';

    const reportData: TemplateData = {
      company_name: company.companyName,
      company_number: company.companyNumber,
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
      company_registered_office: company.fullAddress,
      company_sic_codes: company.sicCodes.length ? company.sicCodes.join(', ') : '—',
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
          : 'No charges registered.',
      psc_count: String(profileData.psc.total),
      psc_rows: pscRows,
      raw_json: escapeHtml(JSON.stringify(profileData, null, 2)),
      settings_business_name: settings.companyName || settings.declarantOrganisationName || 'M Practice Manager',
      settings_address_line1: practiceAddressParts.line1 || '—',
      settings_address_line2: settingsAddressLine2,
      settings_city: practiceAddressParts.city || '—',
      settings_postcode: practiceAddressParts.postcode || '—',
      settings_email: settings.email || '—',
      settings_phone: settings.phone || '—',
      year: String(new Date().getFullYear()),
    };

    return generateDocument('companies_house_report.html', reportData);
  }, [profileData, company, settings, accounts, confirmation]);

  const handleViewReport = async () => {
    setIsReportBusy(true);
    setReportError(null);
    try {
      const html = await buildReportHtml();
      openGeneratedDocument(html);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setIsReportBusy(false);
    }
  };

  const handlePrintReport = async () => {
    setIsReportBusy(true);
    setReportError(null);
    try {
      const html = await buildReportHtml();
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Popup blocked. Allow popups to print report.');
      }

      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to print report');
    } finally {
      setIsReportBusy(false);
    }
  };

  const handleDownloadReport = async () => {
    setIsReportBusy(true);
    setReportError(null);
    try {
      const html = await buildReportHtml();
      const companyName = toFileSafeName(company?.companyName || 'company');
      const dateStamp = new Date().toISOString().split('T')[0];
      downloadDocument(html, `${companyName}_companies_house_report_${dateStamp}`);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to download report');
    } finally {
      setIsReportBusy(false);
    }
  };

  const mapCompanyTypeToLegalEntity = (
    companyType: string | undefined
  ): 'ltd' | 'plc' | 'llp' | 'partnership' | 'sole_trader' | 'charity' | 'other' => {
    const normalized = String(companyType || '').toLowerCase();
    if (normalized.includes('llp')) return 'llp';
    if (normalized.includes('plc') || normalized.includes('public')) return 'plc';
    if (normalized.includes('ltd') || normalized.includes('limited')) return 'ltd';
    if (normalized.includes('partnership')) return 'partnership';
    if (normalized.includes('sole')) return 'sole_trader';
    if (normalized.includes('charity')) return 'charity';
    return 'other';
  };

  const handleImportAsClient = async () => {
    if (!company) return;
    const selectedPortfolio =
      portfolioOptions.find((portfolio) => portfolio.id === selectedPortfolioId) ||
      getDefaultPortfolio();
    if (!selectedPortfolio?.id) {
      setImportClientError('Select a portfolio before importing this company.');
      return;
    }

    setIsImportingClient(true);
    setImportClientError(null);
    try {
      const existing = await contactsAPI.getContacts({ type: 'business', limit: 1000 });
      const duplicate = existing.contacts.find(
        (contact) =>
          String(contact.company_number || '').trim().toLowerCase() ===
          String(company.companyNumber).trim().toLowerCase()
      );

      if (duplicate) {
        navigate(`/clients/${duplicate.id}?tab=overview`);
        return;
      }

      const placeholderEmail = `onboarding+${String(company.companyNumber).replace(/[^a-zA-Z0-9]/g, '')}@client.local`;
      const imported = await contactsAPI.createContact({
        type: 'business',
        name: company.companyName,
        contact_person: '',
        email: placeholderEmail,
        phone: '',
        address: company.line1 || company.fullAddress || '',
        address_line_2: company.line2 || '',
        city: company.city || '',
        postcode: company.postcode || '',
        country: company.country || 'United Kingdom',
        legal_entity_type: mapCompanyTypeToLegalEntity(company.companyType),
        company_number: company.companyNumber,
        registered_address_line_1: company.line1 || '',
        registered_address_line_2: company.line2 || '',
        registered_city: company.city || '',
        registered_postcode: company.postcode || '',
        registered_country: company.country || '',
        portfolio_id: selectedPortfolio.id,
        portfolio_code: selectedPortfolio.code,
        portfolio_name: selectedPortfolio.name,
        notes: `Imported from Companies House on ${new Date().toLocaleDateString('en-GB')}.`,
        allows_agent_refund: true,
      });

      navigate(`/onboarding?clientId=${encodeURIComponent(imported.id)}`);
    } catch (err) {
      setImportClientError(err instanceof Error ? err.message : 'Failed to import client from Companies House.');
    } finally {
      setIsImportingClient(false);
    }
  };

  return (
    <UniversalPageLayout>
      <UniversalPageHeader
        title="Companies House Profile"
        subtitle="Review full Companies House data before onboarding or import"
        actions={
          <>
            <button
              className="btn-primary btn-onboarding"
              onClick={handleImportAsClient}
              disabled={!company || isImportingClient || !selectedPortfolioId}
            >
              {isImportingClient ? 'Importing...' : 'Import as Client'}
            </button>
            <button className="btn-secondary" onClick={() => navigate(searchReturnPath)}>
              Back to Search
            </button>
            {companiesHouseUrl && (
              <a
                className="btn-secondary"
                href={companiesHouseUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                Open Companies House <ExternalLink size={14} />
              </a>
            )}
          </>
        }
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <nav
          aria-label="Breadcrumb"
          className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
        >
          <button
            onClick={() => navigate(searchReturnPath)}
            className="inline-flex items-center gap-2 hover:text-slate-900"
            style={{ background: 'transparent', border: 0, padding: 0 }}
          >
            <ArrowLeft className="h-4 w-4" /> Companies House Search
          </button>
          <span style={{ opacity: 0.6 }}>/</span>
          <span className="text-slate-900">{companyNumber}</span>
        </nav>

        {loading ? (
          <div className="card" style={{ marginTop: '1rem', padding: '2rem', textAlign: 'center' }}>
            Loading company profile...
          </div>
        ) : error ? (
          <div
            className="card"
            style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#b91c1c',
            }}
          >
            {error}
          </div>
        ) : company ? (
          <>
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <header>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Import Setup</p>
                <h2 className="text-xl font-semibold text-slate-900">Portfolio Selection</h2>
              </header>
              <div className="mt-4 max-w-md">
                <label className="block text-sm font-semibold text-slate-700">
                  Select Portfolio
                </label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={selectedPortfolioId}
                  onChange={(event) => setSelectedPortfolioId(event.target.value)}
                >
                  {portfolioOptions.map((portfolio) => (
                    <option key={portfolio.id} value={portfolio.id}>
                      {portfolio.code} - {portfolio.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-500">
                  The imported client will be created under this portfolio.
                </p>
              </div>
            </section>

            {importClientError && (
              <div
                className="card"
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#b91c1c',
                }}
              >
                {importClientError}
              </div>
            )}
            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">Company Record</p>
                  <h1 className="mt-2 text-3xl font-bold text-slate-900">{company.companyName}</h1>
                  <p className="mt-1 text-sm text-slate-500">Company number {company.companyNumber}</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
                      Status {formatStatus(company.companyStatus)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
                      Type {formatStatus(company.companyType)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
                      Incorporated {formatDate(company.dateOfCreation)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Building2 className="h-4 w-4" />
                  {company.fullAddress || 'Registered office not available'}
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('company-details')}
                  className={activeTab === 'company-details' ? 'btn-primary btn-onboarding' : 'btn-secondary'}
                  style={{ minWidth: 170 }}
                >
                  Company Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('charges-filings')}
                  className={activeTab === 'charges-filings' ? 'btn-primary btn-onboarding' : 'btn-secondary'}
                  style={{ minWidth: 170 }}
                >
                  Charges / Filings
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('report')}
                  className={activeTab === 'report' ? 'btn-primary btn-onboarding' : 'btn-secondary'}
                  style={{ minWidth: 170 }}
                >
                  Report
                </button>
              </div>
            </section>

            {activeTab === 'company-details' && (
              <>
                <section className="mt-6 grid gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company Information</p>
                      <h2 className="text-xl font-semibold text-slate-900">Registered Details</h2>
                    </header>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <DataField label="Registered office address" value={company.fullAddress} />
                      <DataField label="Company status" value={formatStatus(company.companyStatus)} />
                      <DataField label="Company type" value={formatStatus(company.companyType)} />
                      <DataField label="Incorporated on" value={formatDate(company.dateOfCreation)} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compliance Information</p>
                      <h2 className="text-xl font-semibold text-slate-900">Accounts & Statements</h2>
                    </header>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <DataField label="Next accounts made up to" value={formatDate(accounts?.next_made_up_to)} />
                      <DataField label="Due by" value={formatDate(accounts?.next_due)} />
                      <DataField label="Last accounts made up to" value={formatDate(accounts?.last_accounts?.made_up_to)} />
                      <DataField label="Next statement date" value={formatDate(confirmation?.next_made_up_to)} />
                      <DataField label="Statement due by" value={formatDate(confirmation?.next_due)} />
                      <DataField label="Last statement dated" value={formatDate(confirmation?.last_made_up_to)} />
                    </div>
                  </div>
                </section>

                <section className="mt-6 grid gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">People</p>
                        <h2 className="text-xl font-semibold text-slate-900">Current Officers</h2>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {profileData?.officers.active || 0}
                      </span>
                    </header>

                    <div className="mt-4 space-y-4">
                      {currentOfficers.length === 0 ? (
                        <p className="text-sm text-slate-500">No active officers found.</p>
                      ) : (
                        currentOfficers.map((officer, index) => (
                          <article
                            key={`${officer.name}-${officer.appointedOn}-${index}`}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <h3 className="text-lg font-semibold text-slate-900">{officer.displayName || officer.name}</h3>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <DataField label="Role" value={formatStatus(officer.role)} />
                              <DataField label="Date of birth" value={officer.dateOfBirth} />
                              <DataField label="Appointed on" value={formatDate(officer.appointedOn)} />
                              <DataField label="Identity verification due" value={formatDate(officer.identityVerificationDueBy)} />
                              <DataField label="Correspondence address" value={officer.address.fullAddress} />
                              <DataField label="Country of residence" value={officer.countryOfResidence} />
                              <DataField label="Nationality" value={officer.nationality} />
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Persons with Significant Control</p>
                        <h2 className="text-xl font-semibold text-slate-900">Active PSC</h2>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 inline-flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> {profileData?.psc.active || 0}
                      </span>
                    </header>

                    <div className="mt-4 space-y-4">
                      {currentPsc.length === 0 ? (
                        <p className="text-sm text-slate-500">No active PSC records found.</p>
                      ) : (
                        currentPsc.map((psc, index) => (
                          <article
                            key={`${psc.name}-${psc.notifiedOn}-${index}`}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <h3 className="text-lg font-semibold text-slate-900">{psc.displayName || psc.name}</h3>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <DataField label="Nature of control" value={psc.natureOfControl.join(' • ')} />
                              <DataField label="Date of birth" value={psc.dateOfBirth} />
                              <DataField label="Notified on" value={formatDate(psc.notifiedOn)} />
                              <DataField label="Identity verification due from" value={formatDate(psc.identityVerificationDueFrom)} />
                              <DataField label="Identity verification due by" value={formatDate(psc.identityVerificationDueBy)} />
                              <DataField label="Correspondence address" value={psc.address.fullAddress} />
                              <DataField label="Country of residence" value={psc.countryOfResidence} />
                              <DataField label="Nationality" value={psc.nationality} />
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeTab === 'charges-filings' && (
              <>
                <section className="mt-6 grid gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Charges</p>
                      <h2 className="text-xl font-semibold text-slate-900">Charges Summary</h2>
                    </header>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <DataField label="Total" value={profileData?.charges.total ?? 0} />
                      <DataField label="Satisfied" value={profileData?.charges.satisfiedCount ?? 0} />
                      <DataField label="Part satisfied" value={profileData?.charges.partSatisfiedCount ?? 0} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filing History</p>
                      <h2 className="text-xl font-semibold text-slate-900">Filter by Category</h2>
                    </header>
                    <div className="mt-4 flex items-center gap-3">
                      <label htmlFor="filing-category" className="text-sm font-semibold text-slate-700">
                        Category
                      </label>
                      <select
                        id="filing-category"
                        className="authInput"
                        style={{ maxWidth: 280 }}
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                      >
                        {filingCategoryOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <header className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filing History</p>
                      <h2 className="text-xl font-semibold text-slate-900">Recent Filings</h2>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> {profileData?.filingHistory.total || 0}
                    </span>
                  </header>

                  {visibleFilingItems.length ? (
                    <>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead style={{ background: '#f8fafc' }}>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Date</th>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Description</th>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>View / Download</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleFilingItems.map((item) => (
                              <tr key={`${item.transactionId}-${item.date}`} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>{formatDate(item.date)}</td>
                                <td style={{ padding: '0.75rem' }}>{valueOrDash(item.description)}</td>
                                <td style={{ padding: '0.75rem' }}>
                                  <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                                    <a href={item.filingUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold" style={{ color: '#1d4ed8' }}>
                                      View
                                    </a>
                                    {item.metadataUrl && (
                                      <a href={item.metadataUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold" style={{ color: '#1d4ed8' }}>
                                        Download
                                      </a>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                        {hasMoreFilings && (
                          <button className="btn-secondary" onClick={() => setVisibleFilings((count) => count + 10)}>
                            Show more
                          </button>
                        )}
                        {visibleFilings > 10 && (
                          <button className="btn-secondary" onClick={() => setVisibleFilings(10)}>
                            Show less
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">No filing history entries found for this category.</p>
                  )}
                </section>
              </>
            )}

            {activeTab === 'report' && (
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <header>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report Output</p>
                  <h2 className="text-xl font-semibold text-slate-900">Companies House Comprehensive Report</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Generates a formatted HTML report using live Companies House fields and your practice footer details.
                  </p>
                </header>

                {reportError && (
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '0.85rem',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: '8px',
                      color: '#b91c1c',
                      fontSize: '0.9rem',
                    }}
                  >
                    {reportError}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <button className="btn-primary btn-onboarding" onClick={handleViewReport} disabled={isReportBusy}>
                    <Eye size={16} /> {isReportBusy ? 'Generating...' : 'View Report'}
                  </button>
                  <button className="btn-secondary" onClick={handlePrintReport} disabled={isReportBusy}>
                    <Printer size={16} /> Print Report
                  </button>
                  <button className="btn-secondary" onClick={handleDownloadReport} disabled={isReportBusy}>
                    <Download size={16} /> Download HTML
                  </button>
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">Report includes:</p>
                  <p>Company profile, compliance snapshot, officers, PSC, recent filings, charges summary, and raw JSON appendix.</p>
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="card" style={{ marginTop: '1rem', padding: '2rem', textAlign: 'center' }}>
            Company profile unavailable.
          </div>
        )}
      </main>
    </UniversalPageLayout>
  );
}
