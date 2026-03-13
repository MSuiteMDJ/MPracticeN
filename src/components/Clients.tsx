import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  Search,
  Shield,
  Upload,
  UserPlus,
  Wallet,
  Wrench,
} from 'lucide-react';
import { contactsAPI } from '@/lib/api-service';
import UniversalPageLayout from '@/components/ui/UniversalPageLayout';
import UniversalPageHeader from '@/components/ui/UniversalPageHeader';
import { useSettings } from '@/contexts/SettingsContext';
import {
  calculateAnnualCost,
  getClientServiceEngagements,
  subscribeToServiceDataUpdates,
} from '@/lib/service-model';

const currencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

type FocusFilter = 'all' | 'missing' | 'with_services' | 'without_services';
type SortColumn = 'ref' | 'name' | 'city' | 'services' | 'open_tasks' | 'annual_cost';
type PageSizeOption = '10' | '20' | 'all';

type ClientListRow = {
  id: string;
  clientRef: string;
  name: string;
  companyNumber: string;
  corporationTaxReference: string;
  displayType: string;
  status: 'active' | 'onboarding' | 'ready';
  portfolioId: string;
  portfolioCode: number;
  portfolioName: string;
  mainContact: string;
  mainContactDetail: string;
  phone: string;
  yearEnd: string;
  accountsDue: string;
  confirmationStatementDue: string;
  openTasks: number;
  annualServiceCost: number;
  missingOnboardingFields: number;
};

function formatClientType(contact: {
  type?: string;
  legal_entity_type?: string;
}): string {
  if (contact.legal_entity_type) {
    return String(contact.legal_entity_type)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  if (contact.type === 'individual') return 'Individual';
  if (contact.type === 'business') return 'Business';
  return '—';
}

function formatShortDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function resolveYearEnd(contact: {
  year_end?: string;
  accounts_reference_date?: string;
}): string {
  if (contact.year_end) {
    return formatYearEndValue(contact.year_end);
  }
  if (contact.accounts_reference_date) {
    return formatYearEndValue(contact.accounts_reference_date);
  }
  return '—';
}

function deriveClientStatus(row: {
  servicesCount: number;
  missingOnboardingFields: number;
}): 'active' | 'onboarding' | 'ready' {
  if (row.servicesCount > 0) return 'active';
  if (row.missingOnboardingFields > 0) return 'onboarding';
  return 'ready';
}

function getMissingOnboardingFieldCount(contact: {
  email?: string;
  address?: string;
  vat_number?: string;
}): number {
  return [
    !contact.email,
    !contact.address,
    !contact.vat_number,
  ].filter(Boolean).length;
}

export default function Clients() {
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [rows, setRows] = useState<ClientListRow[]>([]);
  const [search, setSearch] = useState('');
  const [focusFilter, setFocusFilter] = useState<FocusFilter>('all');
  const [portfolioFilter, setPortfolioFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('ref');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState<PageSizeOption>('10');
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasAuthToken =
    typeof window !== 'undefined' && Boolean(window.localStorage.getItem('auth_token'));
  const userType: 'AGENT' | 'SELF' =
    settings.userType === 'agent' || hasAuthToken ? 'AGENT' : 'SELF';

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await contactsAPI.getContacts({
        type: ['business', 'individual'],
        sort_by: 'name',
        sort_order: 'asc',
        limit: 200,
      });
      const engagements = await getClientServiceEngagements();

      const mapped: ClientListRow[] = response.contacts.map((contact) => {
        const activeServices = engagements.filter(
          (service) => service.clientId === contact.id && service.isActive
        );
        const servicesCount = activeServices.length;
        const openTasks = activeServices.reduce(
          (sum, service) => sum + service.taskInstances.filter((task) => task.status !== 'DONE').length,
          0
        );
        const annualServiceCost = activeServices.reduce(
          (sum, service) => sum + calculateAnnualCost(service),
          0
        );
        const accountsService = activeServices.find((service) => service.serviceCode === 'ACCS');
        const statementService = activeServices.find((service) => service.serviceCode === 'CS01');
        const missingOnboardingFields = getMissingOnboardingFieldCount(contact);
        const mainContact = contact.contact_person || contact.email || contact.name || '—';
        const mainContactDetail =
          contact.contact_person && contact.email ? contact.email : contact.contact_person ? 'Primary contact' : 'Primary email';

        return {
          id: contact.id,
          clientRef: contact.client_ref || '—',
          name: contact.name || 'Unnamed',
          companyNumber: contact.company_number || '—',
          corporationTaxReference: contact.corporation_tax_reference || '—',
          displayType: formatClientType(contact),
          status: deriveClientStatus({ servicesCount, missingOnboardingFields }),
          portfolioId: contact.portfolio_id || 'portfolio-default',
          portfolioCode: contact.portfolio_code ?? 1,
          portfolioName: contact.portfolio_name || 'Main',
          mainContact,
          mainContactDetail,
          phone: contact.phone || '—',
          yearEnd: resolveYearEnd(contact),
          accountsDue: formatShortDate(accountsService?.nextDue),
          confirmationStatementDue: formatShortDate(statementService?.nextDue),
          openTasks,
          annualServiceCost,
          missingOnboardingFields,
        };
      });

      setRows(mapped);
    } catch (err) {
      console.error('Failed to load clients', err);
      setError(err instanceof Error ? err.message : 'Unable to load clients');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userType !== 'AGENT') return;
    void loadRows();
  }, [userType, loadRows]);

  useEffect(() => {
    return subscribeToServiceDataUpdates(() => {
      if (userType === 'AGENT') {
        void loadRows();
      }
    });
  }, [userType, loadRows]);

  const portfolioFilterOptions = useMemo(
    () =>
      Array.from(
        new Map(
          rows.map((row) => [row.portfolioId, { id: row.portfolioId, code: row.portfolioCode, name: row.portfolioName }])
        ).values()
      ).sort((a, b) => a.code - b.code),
    [rows]
  );

  const filteredRows = useMemo(() => {
    let data = [...rows];
    const query = search.trim().toLowerCase();
    if (query) {
      data = data.filter((row) =>
        [
          row.clientRef,
          row.name,
          row.companyNumber,
          row.corporationTaxReference,
          row.mainContact,
          row.phone,
          `${row.portfolioCode} - ${row.portfolioName}`,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query)
      );
    }

    if (portfolioFilter !== 'all') {
      data = data.filter((row) => row.portfolioId === portfolioFilter);
    }

    if (focusFilter === 'missing') {
      data = data.filter((row) => row.missingOnboardingFields > 0);
    } else if (focusFilter === 'with_services') {
      data = data.filter((row) => row.servicesCount > 0);
    } else if (focusFilter === 'without_services') {
      data = data.filter((row) => row.servicesCount === 0);
    }

    data.sort((a, b) => {
      const av =
        sortColumn === 'ref'
          ? a.clientRef.toLowerCase()
          : sortColumn === 'name'
          ? a.name.toLowerCase()
          : sortColumn === 'city'
            ? a.mainContact.toLowerCase()
            : sortColumn === 'services'
              ? a.portfolioCode
              : sortColumn === 'open_tasks'
                ? a.openTasks
                : a.annualServiceCost;

      const bv =
        sortColumn === 'ref'
          ? b.clientRef.toLowerCase()
          : sortColumn === 'name'
          ? b.name.toLowerCase()
          : sortColumn === 'city'
            ? b.mainContact.toLowerCase()
            : sortColumn === 'services'
              ? b.portfolioCode
              : sortColumn === 'open_tasks'
                ? b.openTasks
                : b.annualServiceCost;

      if (av < bv) return sortDirection === 'asc' ? -1 : 1;
      if (av > bv) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [rows, search, focusFilter, portfolioFilter, sortColumn, sortDirection]);

  const paginatedRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows;
    const size = Number(pageSize);
    const start = (currentPage - 1) * size;
    return filteredRows.slice(start, start + size);
  }, [filteredRows, pageSize, currentPage]);

  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1;
    const size = Number(pageSize);
    return Math.max(1, Math.ceil(filteredRows.length / size));
  }, [filteredRows.length, pageSize]);

  const summary = useMemo(() => {
    const total = rows.length;
    const missingOnboarding = rows.filter((row) => row.missingOnboardingFields > 0).length;
    const withServices = rows.filter((row) => row.status === 'active').length;
    const annualServiceCost = rows.reduce((sum, row) => sum + row.annualServiceCost, 0);
    return { total, missingOnboarding, withServices, annualServiceCost };
  }, [rows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, focusFilter, portfolioFilter, sortColumn, sortDirection, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleExportClients = async () => {
    setIsExporting(true);
    setTransferMessage(null);
    try {
      const blob = await contactsAPI.exportClientDataCsv();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `client-data-export-${stamp}.csv`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      setTransferMessage('Exported client data as CSV.');
    } catch (exportError) {
      setTransferMessage(exportError instanceof Error ? exportError.message : 'Unable to export client data.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClients = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsImporting(true);
    setTransferMessage(null);
    try {
      const result = await contactsAPI.importClientDataCsv(file);
      await loadRows();
      const summary = [
        `${result.created} created`,
        `${result.updated} updated`,
        `${result.skipped} skipped`,
        result.relationship_links ? `${result.relationship_links} party links added` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      const errors = result.errors.length ? ` ${result.errors.join(' ')}` : '';
      setTransferMessage(`Import complete: ${summary}.${errors}`.trim());
    } catch (importError) {
      setTransferMessage(importError instanceof Error ? importError.message : 'Unable to import client data.');
    } finally {
      setIsImporting(false);
    }
  };

  if (userType === 'SELF') {
    return (
      <div className="p-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Client Workspace</h1>
          <p className="mt-4 text-slate-600">
            Client management is available for Agent accounts with multi-client workflows.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Review Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <UniversalPageLayout>
      <UniversalPageHeader
        title="Clients"
        subtitle="Client records and agreed service values"
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => void handleImportClients(event)}
            />
            <button
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 font-semibold disabled:opacity-60"
              onClick={() => void handleExportClients()}
              disabled={isExporting || isImporting}
            >
              <Download size={18} />
              {isExporting ? 'Exporting...' : 'Export Client CSV'}
            </button>
            <button
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 font-semibold disabled:opacity-60"
              onClick={() => fileInputRef.current?.click()}
              disabled={isExporting || isImporting}
            >
              <Upload size={18} />
              {isImporting ? 'Importing...' : 'Import Client CSV'}
            </button>
            <button
              className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              onClick={() => navigate('/onboarding')}
            >
              <UserPlus size={20} />
              Start Onboarding
            </button>
          </>
        }
      />

      <div className="mx-auto max-w-7xl px-6 py-8">
        {transferMessage && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            {transferMessage}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Active Clients</p>
            <div className="mt-4 flex items-end justify-between">
              <span className="text-3xl font-semibold text-slate-900">{summary.total}</span>
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="mt-2 text-xs text-slate-500">From client database records</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Missing Onboarding Data</p>
            <div className="mt-4 flex items-end justify-between">
              <span className="text-3xl font-semibold text-slate-900">{summary.missingOnboarding}</span>
              <AlertTriangle className="h-8 w-8 text-rose-500" />
            </div>
            <p className="mt-2 text-xs text-slate-500">EORI is optional and does not block onboarding</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Clients With Services</p>
            <div className="mt-4 flex items-end justify-between">
              <span className="text-3xl font-semibold text-slate-900">{summary.withServices}</span>
              <Wrench className="h-8 w-8 text-amber-500" />
            </div>
            <p className="mt-2 text-xs text-slate-500">Agreed service engagements</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Annual Service Cost</p>
            <div className="mt-4 flex items-end justify-between">
              <span className="text-2xl font-semibold text-slate-900">
                {currencyFormatter.format(summary.annualServiceCost)}
              </span>
              <Wallet className="h-8 w-8 text-purple-500" />
            </div>
            <p className="mt-2 text-xs text-slate-500">Sum of active client services</p>
          </div>
        </div>

        <div className="mt-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by name, ref, email, reg no, UTR..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-8 w-full border-0 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <div className="grid w-full gap-3 md:w-auto md:grid-cols-2">
                <select
                  value={portfolioFilter}
                  onChange={(event) => setPortfolioFilter(event.target.value)}
                  className="h-10 min-w-[220px] rounded-xl border border-slate-200 px-3 text-sm text-slate-700"
                >
                  <option value="all">All Portfolios</option>
                  {portfolioFilterOptions.map((portfolio) => (
                    <option key={portfolio.id} value={portfolio.id}>
                      {portfolio.code} - {portfolio.name}
                    </option>
                  ))}
                </select>
                <select
                  value={`${sortColumn}:${sortDirection}`}
                  onChange={(event) => {
                    const [column, direction] = event.target.value.split(':') as [SortColumn, 'asc' | 'desc'];
                    setSortColumn(column);
                    setSortDirection(direction);
                  }}
                  className="h-10 min-w-[220px] rounded-xl border border-slate-200 px-3 text-sm text-slate-700"
                >
                  <option value="ref:asc">Sort by Reference</option>
                  <option value="name:asc">Sort by Name</option>
                  <option value="annual_cost:desc">Sort by Fees</option>
                  <option value="open_tasks:desc">Sort by Tasks Due</option>
                  <option value="services:asc">Sort by Portfolio</option>
                </select>
              </div>
              <div className="w-full md:w-auto">
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(event.target.value as PageSizeOption)}
                  className="h-10 min-w-[140px] rounded-xl border border-slate-200 px-3 text-sm text-slate-700"
                >
                  <option value="10">10 per page</option>
                  <option value="20">20 per page</option>
                  <option value="all">All results</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                {[
                  { label: 'All', value: 'all' as const },
                  { label: 'Missing Data', value: 'missing' as const },
                  { label: 'With Services', value: 'with_services' as const },
                  { label: 'Without Services', value: 'without_services' as const },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setFocusFilter(filter.value)}
                    className={`rounded-full px-4 py-1 ${
                      focusFilter === filter.value ? 'bg-black text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              {isLoading ? (
                <p className="py-10 text-center text-sm text-slate-500">Loading clients...</p>
              ) : error ? (
                <p className="py-10 text-center text-sm text-rose-500">{error}</p>
              ) : filteredRows.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">No clients match the current filters.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Ref</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Main Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Year End</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Accounts Due</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">CS Due</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Fees</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Tasks Due</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedRows.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer transition hover:bg-slate-50"
                        onClick={() => navigate(`/clients/${row.id}`)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-semibold text-slate-900">{row.clientRef}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                Company No: {row.companyNumber} • CT UTR: {row.corporationTaxReference}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                            {row.displayType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              row.status === 'active'
                                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                : row.status === 'onboarding'
                                  ? 'border border-amber-200 bg-amber-50 text-amber-700'
                                  : 'border border-slate-200 bg-slate-100 text-slate-700'
                            }`}
                          >
                            {row.status === 'active' ? 'Active' : row.status === 'onboarding' ? 'Onboarding' : 'Ready'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-slate-900">{row.mainContact}</p>
                          <p className="mt-1 text-xs text-slate-500">{row.mainContactDetail}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{row.phone}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{row.yearEnd}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{row.accountsDue}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{row.confirmationStatementDue}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                          {currencyFormatter.format(row.annualServiceCost)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{row.openTasks}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/clients/${row.id}`);
                            }}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {!isLoading && !error && filteredRows.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
                <p>
                  Showing{' '}
                  <span className="font-semibold text-slate-900">
                    {pageSize === 'all' ? filteredRows.length : paginatedRows.length}
                  </span>{' '}
                  of <span className="font-semibold text-slate-900">{filteredRows.length}</span> clients
                </p>
                {pageSize !== 'all' && totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                    <span className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </UniversalPageLayout>
  );
}
