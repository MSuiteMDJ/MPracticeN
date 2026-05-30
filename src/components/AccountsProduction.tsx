import { useState, useEffect, useCallback } from 'react';
import { AccountsProductionWizard } from './accounts-production';
import type { AccountsSet, AccountingFramework } from '@/types/accounts-production';

const CDS_API_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CDS_API_URL) ||
  'http://localhost:3003';

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
  const res = await fetch(`${CDS_API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = JSON.parse(text)?.message || text; } catch { /* noop */ }
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const FRAMEWORK_OPTIONS: { value: AccountingFramework; label: string }[] = [
  { value: 'MICRO_FRS105', label: 'Micro-entity (FRS 105)' },
  { value: 'SMALL_FRS102_1A', label: 'Small company (FRS 102 1A)' },
  { value: 'DORMANT', label: 'Dormant company' },
  { value: 'SOLE_TRADER', label: 'Sole trader' },
  { value: 'INDIVIDUAL', label: 'Individual' },
];

const STATUS_MAP: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT:       { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Draft' },
  IN_PROGRESS: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'In Progress' },
  IN_REVIEW:   { bg: 'bg-blue-100',  text: 'text-blue-700',  label: 'In Review' },
  READY:       { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Ready' },
  LOCKED:      { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Locked' },
};

interface ClientRecord {
  id: string;
  name: string;
  company_number?: string;
  type?: string;
  address?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
  country?: string;
  client_ref?: string;
}

interface RelatedClient {
  id: string;
  name: string;
  party_roles?: string[];
}

interface CreateForm {
  clientId: string;
  framework: AccountingFramework;
  startDate: string;
  endDate: string;
  isFirstYear: boolean;
}

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none';

export default function AccountsProduction() {
  const [accountsSets, setAccountsSets] = useState<AccountsSet[]>([]);
  const [activeSet, setActiveSet] = useState<AccountsSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Client selector state
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [loadingDirectors, setLoadingDirectors] = useState(false);
  const [prefillDirectors, setPrefillDirectors] = useState<string[]>([]);

  const [createForm, setCreateForm] = useState<CreateForm>({
    clientId: '',
    framework: 'MICRO_FRS105',
    startDate: '',
    endDate: '',
    isFirstYear: true,
  });

  const loadAccountsSets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiRequest<{ accountsSets: AccountsSet[] }>('/accounts-sets');
      setAccountsSets(result.accountsSets || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load accounts sets');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load clients once for the selector
  useEffect(() => {
    apiRequest<{ clients: ClientRecord[] }>('/clients')
      .then(r => setClients(r.clients || []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadAccountsSets(); }, [loadAccountsSets]);

  // When a client is selected, fetch their directors and pre-fill form
  const handleClientSelect = async (client: ClientRecord) => {
    setSelectedClient(client);
    setCreateForm(prev => ({
      ...prev,
      clientId: client.id,
      framework: client.type === 'individual' ? 'INDIVIDUAL' : prev.framework,
    }));
    setPrefillDirectors([]);

    // Fetch related clients (directors)
    try {
      setLoadingDirectors(true);
      const result = await apiRequest<{ clients: RelatedClient[] }>(`/clients/${client.id}/related-clients`);
      const directors = (result.clients || [])
        .filter(c => Array.isArray(c.party_roles) && c.party_roles.some(r => r.toLowerCase().includes('director')))
        .map(c => c.name);
      setPrefillDirectors(directors);
    } catch {
      // no directors found — that's fine
    } finally {
      setLoadingDirectors(false);
    }
  };

  const clearClientSelection = () => {
    setSelectedClient(null);
    setClientSearch('');
    setPrefillDirectors([]);
    setCreateForm(prev => ({ ...prev, clientId: '', framework: 'MICRO_FRS105' }));
  };

  const filteredClients = clients.filter(c =>
    !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.client_ref || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.company_number || '').toLowerCase().includes(clientSearch.toLowerCase())
  ).slice(0, 8);

  const handleCreate = async () => {
    if (!createForm.startDate || !createForm.endDate) {
      alert('Please enter the accounting period start and end dates.');
      return;
    }
    try {
      setCreating(true);

      // Build the initial companyPeriod section from client data if a client was selected
      let initialCompanyPeriod: Record<string, any> | undefined;
      if (selectedClient) {
        const isSoleTrader = createForm.framework === 'SOLE_TRADER' || createForm.framework === 'INDIVIDUAL';
        initialCompanyPeriod = {
          framework: createForm.framework,
          company: {
            name: selectedClient.name,
            companyNumber: selectedClient.company_number || '',
            registeredOffice: {
              line1: selectedClient.address_line1 || selectedClient.address || '',
              line2: selectedClient.address_line2 || '',
              town: selectedClient.city || '',
              county: '',
              postcode: selectedClient.postcode || '',
              country: selectedClient.country === 'GB' ? 'England' : (selectedClient.country || 'England'),
            },
            directors: isSoleTrader ? [] : prefillDirectors.map(name => ({ name })),
          },
          period: {
            startDate: createForm.startDate,
            endDate: createForm.endDate,
            isFirstYear: createForm.isFirstYear,
          },
        };
      }

      const result = await apiRequest<{ accountsSet: AccountsSet }>('/accounts-sets', {
        method: 'POST',
        body: JSON.stringify({
          clientId: createForm.clientId || undefined,
          framework: createForm.framework,
          startDate: createForm.startDate,
          endDate: createForm.endDate,
          isFirstYear: createForm.isFirstYear,
          companyNumber: selectedClient?.company_number || '',
        }),
      });

      let finalSet = result.accountsSet;

      // If we have client data, immediately save the companyPeriod section
      if (initialCompanyPeriod) {
        try {
          const patched = await apiRequest<AccountsSet>(`/accounts-sets/${finalSet.id}/sections/companyPeriod`, {
            method: 'PATCH',
            body: JSON.stringify({ data: initialCompanyPeriod }),
          });
          finalSet = patched;
        } catch {
          // non-fatal — wizard will still open with the set
        }
      }

      setAccountsSets(prev => [finalSet, ...prev]);
      setActiveSet(finalSet);
      setShowCreateModal(false);
      resetModal();
    } catch (err: any) {
      alert(`Failed to create accounts set: ${err?.message}`);
    } finally {
      setCreating(false);
    }
  };

  const resetModal = () => {
    setCreateForm({ clientId: '', framework: 'MICRO_FRS105', startDate: '', endDate: '', isFirstYear: true });
    setSelectedClient(null);
    setClientSearch('');
    setPrefillDirectors([]);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this accounts set? This cannot be undone.')) return;
    try {
      await apiRequest(`/accounts-sets/${id}`, { method: 'DELETE' });
      setAccountsSets(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      alert(`Failed to delete: ${err?.message}`);
    }
  };

  const handleUpdate = useCallback((updated: AccountsSet) => {
    setActiveSet(updated);
    setAccountsSets(prev => prev.map(s => s.id === updated.id ? updated : s));
  }, []);

  const statusBadge = (status: AccountsSet['status']) => {
    const s = STATUS_MAP[status] || STATUS_MAP.DRAFT;
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  // Find linked client name for display on list cards
  const getLinkedClientName = (set: AccountsSet) => {
    if (!set.clientId) return null;
    return clients.find(c => c.id === set.clientId)?.name || null;
  };

  if (activeSet) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => setActiveSet(null)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-slate-900">
            {activeSet.sections.companyPeriod?.company.name || 'New Accounts Set'}
          </h1>
          {statusBadge(activeSet.status)}
        </div>
        <AccountsProductionWizard accountsSet={activeSet} onUpdate={handleUpdate} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accounts Production</h1>
          <p className="mt-1 text-sm text-slate-500">Prepare statutory accounts and financial statements</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
          onClick={() => setShowCreateModal(true)}
        >
          + New Accounts Set
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-slate-500">Loading...</p>
        </div>
      )}

      {!loading && accountsSets.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mb-4 text-5xl">📋</div>
          <h3 className="mb-2 text-lg font-semibold text-slate-900">No accounts sets yet</h3>
          <p className="mb-6 text-sm text-slate-500">Create your first accounts set to get started.</p>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
            onClick={() => setShowCreateModal(true)}
          >
            + New Accounts Set
          </button>
        </div>
      )}

      {!loading && accountsSets.length > 0 && (
        <div className="space-y-3">
          {accountsSets.map(set => {
            const company = set.sections.companyPeriod?.company;
            const period = set.sections.companyPeriod?.period || set.period;
            const completedSections = ['companyPeriod', 'frameworkDisclosures', 'accountingPolicies', 'profitAndLoss', 'balanceSheet', 'notes', 'directorsApproval']
              .filter(k => set.sections[k as keyof typeof set.sections]).length;
            const frameworkLabel = FRAMEWORK_OPTIONS.find(f => f.value === set.framework)?.label || set.framework;
            const linkedClient = getLinkedClientName(set);
            return (
              <div
                key={set.id}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow-md"
                onClick={() => setActiveSet(set)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {company?.name || 'Unnamed Company'}
                    </p>
                    {company?.companyNumber && (
                      <p className="mt-0.5 text-sm text-slate-500">Co. No. {company.companyNumber}</p>
                    )}
                    {linkedClient && (
                      <p className="mt-0.5 text-xs text-violet-600">🔗 {linkedClient}</p>
                    )}
                    <p className="mt-1 text-sm text-slate-500">
                      {frameworkLabel}
                      {period?.startDate && period?.endDate && (
                        <> · {new Date(period.startDate).toLocaleDateString('en-GB')} – {new Date(period.endDate).toLocaleDateString('en-GB')}</>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {statusBadge(set.status)}
                    <span className="text-xs text-slate-400">{completedSections}/7 sections</span>
                    <button
                      className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      onClick={e => handleDelete(set.id, e)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' }}
          onClick={() => { setShowCreateModal(false); resetModal(); }}
        >
          <div
            style={{ width: 'min(92vw, 520px)', background: '#fff', borderRadius: '18px', boxShadow: '0 40px 80px rgba(15,23,42,0.35)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>New Accounts Set</h2>
              <button
                onClick={() => { setShowCreateModal(false); resetModal(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#64748b', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '1.5rem', display: 'grid', gap: '1.25rem', overflowY: 'auto' }}>

              {/* Client selector */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Link to Client (optional)</label>
                {selectedClient ? (
                  <div className="flex items-center justify-between rounded-lg border border-violet-300 bg-violet-50 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-violet-900">{selectedClient.name}</p>
                      {selectedClient.company_number && (
                        <p className="text-xs text-violet-600">Co. No. {selectedClient.company_number}</p>
                      )}
                      {loadingDirectors && <p className="text-xs text-slate-400 mt-0.5">Loading directors...</p>}
                      {!loadingDirectors && prefillDirectors.length > 0 && (
                        <p className="text-xs text-emerald-600 mt-0.5">✓ {prefillDirectors.length} director{prefillDirectors.length > 1 ? 's' : ''} found</p>
                      )}
                    </div>
                    <button onClick={clearClientSelection} className="ml-3 text-xs font-semibold text-slate-500 hover:text-rose-600">Change</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      className={inputCls}
                      placeholder="Search by name, ref or company number..."
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                    />
                    {clientSearch && filteredClients.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                        {filteredClients.map(c => (
                          <button
                            key={c.id}
                            className="w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                            onClick={() => handleClientSelect(c)}
                          >
                            <span className="font-medium text-slate-900">{c.name}</span>
                            {c.client_ref && <span className="ml-2 text-xs text-slate-400">{c.client_ref}</span>}
                            {c.company_number && <span className="ml-2 text-xs text-slate-400">Co. {c.company_number}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {clientSearch && filteredClients.length === 0 && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-400 shadow-lg">
                        No clients found
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-400">Selecting a client pre-fills company details and directors</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Accounting Framework *</label>
                <select
                  className={inputCls}
                  value={createForm.framework}
                  onChange={e => setCreateForm(prev => ({ ...prev, framework: e.target.value as AccountingFramework }))}
                >
                  {FRAMEWORK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Period Start *</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={createForm.startDate}
                    onChange={e => setCreateForm(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Period End *</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={createForm.endDate}
                    onChange={e => setCreateForm(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-violet-600"
                  checked={createForm.isFirstYear}
                  onChange={e => setCreateForm(prev => ({ ...prev, isFirstYear: e.target.checked }))}
                />
                First accounting period (no comparatives required)
              </label>
            </div>

            {/* Modal footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexShrink: 0 }}>
              <button
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => { setShowCreateModal(false); resetModal(); }}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                onClick={handleCreate}
                disabled={creating || loadingDirectors}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
