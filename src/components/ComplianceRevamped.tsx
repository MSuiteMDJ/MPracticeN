import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import UniversalPageLayout from '@/components/ui/UniversalPageLayout';
import UniversalPageHeader from '@/components/ui/UniversalPageHeader';
import { contactsAPI } from '@/lib/api-service';
import {
  getClientServiceEngagements,
  mapEngagementToServiceModel,
  subscribeToServiceDataUpdates,
  type ClientServiceModel,
} from '@/lib/service-model';

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

function statusClass(status: ClientServiceModel['status']): string {
  if (status === 'active') return 'bg-emerald-100 text-emerald-700';
  if (status === 'attention') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

type ComplianceRow = ClientServiceModel & {
  clientRef: string;
};

export default function ComplianceRevamped() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [services, setServices] = useState<ComplianceRow[]>([]);
  const [serviceFilter, setServiceFilter] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const response = await contactsAPI.getContacts({ limit: 250, sort_by: 'name', sort_order: 'asc' });
      const clientById = new Map<string, { name: string; clientRef: string }>(
        response.contacts.map((contact) => [
          contact.id,
          {
            name: contact.name,
            clientRef: contact.client_ref || '—',
          },
        ])
      );
      const rows = (await getClientServiceEngagements())
        .map((engagement) => {
          const client = clientById.get(engagement.clientId);
          const model = mapEngagementToServiceModel(
            engagement,
            client?.name || engagement.clientId
          );
          return {
            ...model,
            clientRef: client?.clientRef || '—',
          };
        })
        .filter((row) => row.complianceType !== 'NONE');
      setServices(rows);
    } catch (error) {
      console.error('Failed to load service compliance', error);
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    return subscribeToServiceDataUpdates(() => {
      void loadData();
    });
  }, []);

  const summary = useMemo(() => {
    const total = services.length;
    const active = services.filter((service) => service.status === 'active').length;
    const attention = services.filter((service) => service.status === 'attention').length;
    const pending = services.filter((service) => service.status === 'pending').length;
    return { total, active, attention, pending };
  }, [services]);

  const serviceOptions = useMemo(() => {
    return Array.from(
      new Map(
        services.map((service) => [
          service.serviceCode,
          `${service.displayName} (${service.serviceCode})`,
        ])
      ).entries()
    )
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [services]);

  const filteredServices = useMemo(() => {
    const dueFromTime = dueFrom ? new Date(`${dueFrom}T00:00:00`).getTime() : null;
    const dueToTime = dueTo ? new Date(`${dueTo}T23:59:59`).getTime() : null;

    return services
      .filter((service) => {
        if (serviceFilter && service.serviceCode !== serviceFilter) {
          return false;
        }

        const dueTime = service.nextDue ? new Date(`${service.nextDue}T00:00:00`).getTime() : null;
        if (dueFromTime !== null && (dueTime === null || dueTime < dueFromTime)) {
          return false;
        }
        if (dueToTime !== null && (dueTime === null || dueTime > dueToTime)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aTime = a.nextDue ? new Date(`${a.nextDue}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.nextDue ? new Date(`${b.nextDue}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
        if (aTime !== bTime) {
          return aTime - bTime;
        }
        return `${a.clientRef} ${a.displayName}`.localeCompare(`${b.clientRef} ${b.displayName}`);
      });
  }, [services, serviceFilter, dueFrom, dueTo]);

  const alerts = useMemo(() => {
    return filteredServices
      .filter((service) => service.status !== 'active' || service.overdueTasks > 0)
      .slice(0, 10)
      .map((service) => ({
        id: service.id,
        title: `${service.clientRef} — ${service.clientName} · ${service.displayName}`,
        message:
          service.overdueTasks > 0
            ? `${service.overdueTasks} overdue service tasks`
            : `Compliance status: ${service.status}`,
      }));
  }, [filteredServices]);

  return (
    <UniversalPageLayout>
      <UniversalPageHeader
        title="Compliance Tracking"
        subtitle="Accounting service compliance linked to service engagements and tasks"
        actions={
          <>
            <button onClick={() => void loadData()} className="btn-secondary" disabled={isLoading}>
              <RefreshCw size={18} /> Refresh
            </button>
            <button onClick={() => navigate('/services')} className="btn-secondary">
              <FileDown size={18} /> Services
            </button>
          </>
        }
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compliance Lines</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{isLoading ? '...' : summary.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Healthy</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{isLoading ? '...' : summary.active}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attention</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">{isLoading ? '...' : summary.attention}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending</p>
            <p className="mt-2 text-3xl font-bold text-slate-700">{isLoading ? '...' : summary.pending}</p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr,1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service Compliance</p>
                <h2 className="text-xl font-semibold text-slate-900">Client Service Compliance Matrix</h2>
              </div>
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            </header>

            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={serviceFilter}
                onChange={(event) => setServiceFilter(event.target.value)}
              >
                <option value="">All services</option>
                {serviceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={dueFrom}
                onChange={(event) => setDueFrom(event.target.value)}
                aria-label="Due from date"
              />
              <input
                type="date"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={dueTo}
                onChange={(event) => setDueTo(event.target.value)}
                aria-label="Due to date"
              />
              <button
                className="btn-secondary"
                onClick={() => {
                  setServiceFilter('');
                  setDueFrom('');
                  setDueTo('');
                }}
                disabled={!serviceFilter && !dueFrom && !dueTo}
              >
                Clear
              </button>
            </div>

            <div className="mt-4" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Client</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Service</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Compliance Type</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Tasks</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Next Due</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '1rem', color: '#64748b' }}>
                        Loading compliance matrix...
                      </td>
                    </tr>
                  ) : filteredServices.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '1rem', color: '#64748b' }}>
                        No compliance-linked services match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredServices.map((service) => (
                      <tr key={service.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                          <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.75rem', color: '#475569' }}>
                            {service.clientRef}
                          </p>
                          <p style={{ margin: 0 }}>{service.clientName}</p>
                        </td>
                        <td style={{ padding: '0.75rem' }}>{service.displayName}</td>
                        <td style={{ padding: '0.75rem' }}>{service.complianceType}</td>
                        <td style={{ padding: '0.75rem' }}>
                          {service.openTasks} open
                          {service.overdueTasks > 0 ? ` · ${service.overdueTasks} overdue` : ''}
                        </td>
                        <td style={{ padding: '0.75rem' }}>{formatDate(service.nextDue)}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(service.status)}`}>
                            {service.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <button
                            className="btn-secondary"
                            onClick={() => navigate(`/clients/${service.clientId}?tab=compliance`)}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alerts</p>
                <h2 className="text-xl font-semibold text-slate-900">Compliance Notifications</h2>
              </div>
              <ShieldAlert className="h-5 w-5 text-amber-500" />
            </header>

            <div className="mt-4 space-y-3 text-sm">
              {alerts.length === 0 ? (
                <p className="text-slate-500">No active compliance alerts.</p>
              ) : (
                alerts.map((alert) => (
                  <article key={alert.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="font-semibold text-slate-900">{alert.title}</p>
                    <p className="mt-1 text-xs text-slate-700">{alert.message}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </UniversalPageLayout>
  );
}
