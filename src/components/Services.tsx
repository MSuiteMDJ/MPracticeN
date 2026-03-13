import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  Layers,
  Plus,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import UniversalPageLayout from '@/components/ui/UniversalPageLayout';
import UniversalPageHeader from '@/components/ui/UniversalPageHeader';
import KPITile from '@/components/ui/KPITile';
import { contactsAPI } from '@/lib/api-service';
import {
  createServiceTemplate,
  getClientServiceEngagements,
  getServiceTemplates,
  mapEngagementToServiceModel,
  subscribeToServiceDataUpdates,
  upsertServiceTemplate,
  type BillingType,
  type BillingUnit,
  type ClientServiceModel,
  type ComplianceType,
  type Frequency,
  type ServiceCategory,
  type ServiceTaskPriority,
  type ServiceTemplateModel,
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

function badgeClass(status: ClientServiceModel['status']): string {
  if (status === 'active') return 'bg-emerald-100 text-emerald-700';
  if (status === 'attention') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

type ServiceRow = ClientServiceModel & {
  clientRef: string;
};

type TemplateEditorDraft = ServiceTemplateModel;

const templateCategories: ServiceCategory[] = [
  'COMPLIANCE',
  'TAX',
  'BOOKKEEPING',
  'PAYROLL',
  'ADVISORY',
  'SECRETARIAL',
  'FORMATION',
];

const complianceTypes: ComplianceType[] = [
  'NONE',
  'STATUTORY_FILING',
  'TAX_RETURN',
  'REGISTRATION',
  'ADVISORY_ONLY',
];

const billingTypes: BillingType[] = ['RECURRING', 'ONE_TIME', 'PROJECT'];
const billingUnits: BillingUnit[] = ['PER_MONTH', 'PER_QUARTER', 'PER_YEAR', 'PER_RETURN', 'PER_HOUR', 'FIXED_FEE'];
const frequencies: Frequency[] = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'AD_HOC'];
const priorities: ServiceTaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function defaultBillingUnitForFrequency(frequency: Frequency): BillingUnit {
  if (frequency === 'MONTHLY') return 'PER_MONTH';
  if (frequency === 'QUARTERLY') return 'PER_QUARTER';
  if (frequency === 'ANNUAL') return 'PER_YEAR';
  return 'FIXED_FEE';
}

function defaultBillingUnitForType(type: BillingType, frequency: Frequency): BillingUnit {
  if (type === 'RECURRING') return defaultBillingUnitForFrequency(frequency);
  if (type === 'PROJECT') return 'PER_HOUR';
  return 'FIXED_FEE';
}

function emptyTemplateDraft(): TemplateEditorDraft {
  return {
    serviceCode: '',
    displayName: '',
    description: '',
    reportCategory: '',
    category: 'COMPLIANCE',
    complianceType: 'NONE',
    createsCompliance: false,
    defaultFrequency: 'MONTHLY',
    billingType: 'RECURRING',
    billingUnit: 'PER_MONTH',
    clientTypes: ['COMPANY'],
    taskTemplates: [{ id: `task-${Date.now()}`, title: '', daysBeforeDue: 0, priority: 'MEDIUM' }],
  };
}

export default function Services() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [templates, setTemplates] = useState<ServiceTemplateModel[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [viewMode, setViewMode] = useState<'engagements' | 'templates'>('engagements');
  const [selectedTemplate, setSelectedTemplate] = useState<ServiceTemplateModel | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [templateDraft, setTemplateDraft] = useState<TemplateEditorDraft>(emptyTemplateDraft);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
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
      const engagements = await getClientServiceEngagements();
      const rows: ServiceRow[] = engagements.map((engagement) => {
        const client = clientById.get(engagement.clientId);
        const model = mapEngagementToServiceModel(
          engagement,
          client?.name || engagement.clientId
        );
        return {
          ...model,
          clientRef: client?.clientRef || '—',
        };
      });
      setServices(rows);
      setTemplates(getServiceTemplates());
    } catch (error) {
      console.error('Failed to load services workspace', error);
      setServices([]);
      setTemplates(getServiceTemplates());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    return subscribeToServiceDataUpdates(() => {
      void loadData();
    });
  }, [loadData]);

  const clientOptions = useMemo(() => {
    return Array.from(
      new Map(
        services.map((service) => [
          service.clientId,
          `${service.clientRef} — ${service.clientName}`,
        ])
      ).entries()
    )
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
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
    const term = serviceSearch.trim().toLowerCase();
    const dueFromTime = dueFrom ? new Date(`${dueFrom}T00:00:00`).getTime() : null;
    const dueToTime = dueTo ? new Date(`${dueTo}T23:59:59`).getTime() : null;

    return services
      .filter((service) => {
        if (
          term &&
          ![service.clientRef, service.clientName, service.displayName, service.serviceCode, service.category]
            .join(' ')
            .toLowerCase()
            .includes(term)
        ) {
          return false;
        }
        if (clientFilter && service.clientId !== clientFilter) {
          return false;
        }
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
  }, [services, serviceSearch, clientFilter, serviceFilter, dueFrom, dueTo]);

  const filteredTemplates = useMemo(() => {
    const term = templateSearch.trim().toLowerCase();
    if (!term) return templates;
    return templates.filter((template) =>
      [template.displayName, template.serviceCode, template.category, template.complianceType, template.description]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [templates, templateSearch]);

  const templateSections = useMemo(() => {
    return filteredTemplates.reduce<Record<string, ServiceTemplateModel[]>>((acc, template) => {
      if (!acc[template.category]) acc[template.category] = [];
      acc[template.category].push(template);
      return acc;
    }, {});
  }, [filteredTemplates]);

  const totalOpenTasks = services.reduce((sum, service) => sum + service.openTasks, 0);
  const annualizedServiceRevenue = services.reduce((sum, service) => sum + service.annualCost, 0);

  const serviceStats = [
    {
      label: 'Active Services',
      value: loading ? '...' : String(services.filter((service) => service.status === 'active').length),
      icon: Layers,
      color: 'emerald' as const,
      subtext: `${services.length} total engagements`,
    },
    {
      label: 'Service Tasks Open',
      value: loading ? '...' : String(totalOpenTasks),
      icon: ClipboardList,
      color: 'blue' as const,
      subtext: 'task instances',
    },
    {
      label: 'Compliance Attention',
      value: loading ? '...' : String(services.filter((service) => service.status === 'attention').length),
      icon: ShieldAlert,
      color: 'amber' as const,
      subtext: 'engagements',
    },
    {
      label: 'Template Catalogue',
      value: String(templates.length),
      icon: CheckCircle2,
      color: 'purple' as const,
      subtext: 'service templates',
    },
  ];

  const openCreateTemplate = () => {
    setEditorMode('create');
    setTemplateDraft(emptyTemplateDraft());
    setTemplateError(null);
    setIsEditorOpen(true);
  };

  const openEditTemplate = (template: ServiceTemplateModel) => {
    setEditorMode('edit');
    setTemplateDraft(JSON.parse(JSON.stringify(template)) as ServiceTemplateModel);
    setTemplateError(null);
    setIsEditorOpen(true);
    setSelectedTemplate(null);
  };

  const saveTemplate = () => {
    if (!templateDraft.serviceCode.trim()) {
      setTemplateError('Service code is required.');
      return;
    }
    if (!templateDraft.displayName.trim()) {
      setTemplateError('Display name is required.');
      return;
    }
    if (templateDraft.taskTemplates.some((task) => !task.title.trim())) {
      setTemplateError('Each task needs a title.');
      return;
    }

    try {
      const payload: ServiceTemplateModel = {
        ...templateDraft,
        createsCompliance: templateDraft.complianceType !== 'NONE',
      };
      if (editorMode === 'create') {
        createServiceTemplate(payload);
      } else {
        upsertServiceTemplate(payload);
      }
      setIsEditorOpen(false);
      setTemplateError(null);
      void loadData();
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'Unable to save template.');
    }
  };

  const currency = useMemo(
    () =>
      new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        maximumFractionDigits: 0,
      }),
    []
  );

  return (
    <UniversalPageLayout>
      <UniversalPageHeader
        title="Services Workspace"
        subtitle="Service-driven delivery with template-governed tasks and compliance"
        actions={
          <button className="btn-primary btn-onboarding" onClick={() => navigate('/compliance')}>
            Compliance
          </button>
        }
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {serviceStats.map((item) => (
            <KPITile
              key={item.label}
              title={item.label}
              value={item.value}
              subtext={item.subtext}
              icon={item.icon}
              color={item.color}
              trend={{ value: '', direction: 'neutral' }}
            />
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                viewMode === 'engagements' ? 'bg-teal-600 text-white' : 'text-slate-700'
              }`}
              onClick={() => setViewMode('engagements')}
            >
              Service Engagements
            </button>
            <button
              className={`ml-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                viewMode === 'templates' ? 'bg-teal-600 text-white' : 'text-slate-700'
              }`}
              onClick={() => setViewMode('templates')}
            >
              Service Templates
            </button>
          </div>

          {viewMode === 'engagements' ? (
            <>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Engagements</p>
                  <h2 className="text-xl font-semibold text-slate-900">Client Agreed Services</h2>
                  <p className="text-sm text-slate-500">Annualized value: {currency.format(annualizedServiceRevenue)}</p>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.2fr)_minmax(220px,1fr)_minmax(220px,1fr)_minmax(170px,1fr)_minmax(170px,1fr)_auto]">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <Clock3 className="h-4 w-4 text-slate-400" />
                    <input
                      value={serviceSearch}
                      onChange={(event) => setServiceSearch(event.target.value)}
                      type="text"
                      placeholder="Search client, service, category..."
                      className="bg-transparent text-sm outline-none"
                      style={{ minWidth: 220 }}
                    />
                  </div>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={clientFilter}
                    onChange={(event) => setClientFilter(event.target.value)}
                  >
                    <option value="">All clients</option>
                    {clientOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
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
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={dueFrom}
                    onChange={(event) => setDueFrom(event.target.value)}
                    aria-label="Due from date"
                  />
                  <input
                    type="date"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={dueTo}
                    onChange={(event) => setDueTo(event.target.value)}
                    aria-label="Due to date"
                  />
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setServiceSearch('');
                      setClientFilter('');
                      setServiceFilter('');
                      setDueFrom('');
                      setDueTo('');
                    }}
                    disabled={!serviceSearch && !clientFilter && !serviceFilter && !dueFrom && !dueTo}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-4" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Client</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Service</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Category</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Frequency</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Compliance</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Tasks</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Annual Cost</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Next Due</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={10} style={{ padding: '1rem', color: '#64748b' }}>
                          Loading service engagements...
                        </td>
                      </tr>
                    ) : filteredServices.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding: '1rem', color: '#64748b' }}>
                          No client services match the current filters.
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
                          <td style={{ padding: '0.75rem' }}>
                            <p style={{ margin: 0, fontWeight: 600 }}>{service.displayName}</p>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{service.serviceCode}</p>
                          </td>
                          <td style={{ padding: '0.75rem' }}>{service.category}</td>
                          <td style={{ padding: '0.75rem' }}>{service.frequency}</td>
                          <td style={{ padding: '0.75rem' }}>{service.complianceType}</td>
                          <td style={{ padding: '0.75rem' }}>{service.openTasks} open</td>
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>{currency.format(service.annualCost)}</td>
                          <td style={{ padding: '0.75rem' }}>{formatDate(service.nextDue)}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(service.status)}`}>
                              {service.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <button className="btn-secondary" onClick={() => navigate(`/clients/${service.clientId}?tab=services`)}>
                              Open
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Template Library</p>
                  <h2 className="text-xl font-semibold text-slate-900">Service Templates</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      value={templateSearch}
                      onChange={(event) => setTemplateSearch(event.target.value)}
                      type="text"
                      placeholder="Search service code, name, category..."
                      className="bg-transparent text-sm outline-none"
                      style={{ minWidth: 260 }}
                    />
                  </div>
                  <button className="btn-primary btn-onboarding" onClick={openCreateTemplate}>
                    <Plus size={16} /> Add Template
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {Object.entries(templateSections).length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    No service templates found.
                  </div>
                ) : (
                  Object.entries(templateSections).map(([category, rows]) => (
                    <div key={category} className="rounded-xl border border-slate-200 bg-white">
                      <div className="border-b border-slate-200 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{category}</p>
                        <h3 className="text-base font-semibold text-slate-900">{rows.length} templates</h3>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead style={{ background: '#f8fafc' }}>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Template</th>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Code</th>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Compliance</th>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Frequency</th>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Billing</th>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Tasks</th>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((template) => (
                              <tr key={template.serviceCode} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.75rem' }}>
                                  <p style={{ margin: 0, fontWeight: 600 }}>{template.displayName}</p>
                                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                                    {template.description || '—'}
                                  </p>
                                </td>
                                <td style={{ padding: '0.75rem', fontWeight: 600 }}>{template.serviceCode}</td>
                                <td style={{ padding: '0.75rem' }}>{template.complianceType}</td>
                                <td style={{ padding: '0.75rem' }}>{template.defaultFrequency}</td>
                                <td style={{ padding: '0.75rem' }}>
                                  {template.billingType} · {template.billingUnit}
                                </td>
                                <td style={{ padding: '0.75rem' }}>{template.taskTemplates.length}</td>
                                <td style={{ padding: '0.75rem' }}>
                                  <button className="btn-secondary" onClick={() => setSelectedTemplate(template)}>
                                    <Eye size={14} /> Open
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </section>
      </main>

      {selectedTemplate && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 p-4">
          <div className="mx-auto mt-8 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service Template</p>
                <h3 className="text-xl font-semibold text-slate-900">
                  {selectedTemplate.displayName} ({selectedTemplate.serviceCode})
                </h3>
              </div>
              <button
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                onClick={() => setSelectedTemplate(null)}
                aria-label="Close template popup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Template Setup</p>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">Category:</span> {selectedTemplate.category}
                  </p>
                  <p>
                    <span className="font-semibold">Report:</span> {selectedTemplate.reportCategory || 'General'}
                  </p>
                  <p>
                    <span className="font-semibold">Compliance:</span> {selectedTemplate.complianceType}
                  </p>
                  <p>
                    <span className="font-semibold">Default Frequency:</span> {selectedTemplate.defaultFrequency}
                  </p>
                  <p>
                    <span className="font-semibold">Billing:</span> {selectedTemplate.billingType} ·{' '}
                    {selectedTemplate.billingUnit}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client Type Mapping</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedTemplate.clientTypes.map((type) => (
                    <span key={type} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {type}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-sm text-slate-700">{selectedTemplate.description || 'No description.'}</p>
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task Template Steps</p>
              <div className="mt-3 space-y-2">
                {selectedTemplate.taskTemplates.map((task) => (
                  <div key={task.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <span className="rounded-full bg-slate-100 px-2 py-1">{task.priority}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1">{task.daysBeforeDue} days before due</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button className="btn-secondary" onClick={() => openEditTemplate(selectedTemplate)}>
                Edit Template
              </button>
              <button className="btn-secondary" onClick={() => setSelectedTemplate(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditorOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 p-4">
          <div className="mx-auto mt-8 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-xl font-semibold text-slate-900">
                {editorMode === 'create' ? 'Add Service Template' : `Edit Template ${templateDraft.serviceCode}`}
              </h3>
              <button className="rounded-lg border border-slate-200 p-2 text-slate-500" onClick={() => setIsEditorOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {templateError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {templateError}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Service code (e.g. ACCS)"
                  value={templateDraft.serviceCode}
                  disabled={editorMode === 'edit'}
                  onChange={(event) => setTemplateDraft((prev) => ({ ...prev, serviceCode: event.target.value }))}
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Display name"
                  value={templateDraft.displayName}
                  onChange={(event) => setTemplateDraft((prev) => ({ ...prev, displayName: event.target.value }))}
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Report category"
                  value={templateDraft.reportCategory || ''}
                  onChange={(event) => setTemplateDraft((prev) => ({ ...prev, reportCategory: event.target.value }))}
                />
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={templateDraft.category}
                  onChange={(event) =>
                    setTemplateDraft((prev) => ({ ...prev, category: event.target.value as ServiceCategory }))
                  }
                >
                  {templateCategories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={templateDraft.complianceType}
                  onChange={(event) =>
                    setTemplateDraft((prev) => ({
                      ...prev,
                      complianceType: event.target.value as ComplianceType,
                      createsCompliance: event.target.value !== 'NONE',
                    }))
                  }
                >
                  {complianceTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={templateDraft.defaultFrequency}
                  onChange={(event) =>
                    setTemplateDraft((prev) => {
                      const nextFrequency = event.target.value as Frequency;
                      return {
                        ...prev,
                        defaultFrequency: nextFrequency,
                        billingUnit:
                          prev.billingType === 'RECURRING'
                            ? defaultBillingUnitForFrequency(nextFrequency)
                            : prev.billingUnit,
                      };
                    })
                  }
                >
                  {frequencies.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={templateDraft.billingType}
                  onChange={(event) =>
                    setTemplateDraft((prev) => {
                      const nextBillingType = event.target.value as BillingType;
                      return {
                        ...prev,
                        billingType: nextBillingType,
                        billingUnit: defaultBillingUnitForType(nextBillingType, prev.defaultFrequency),
                      };
                    })
                  }
                >
                  {billingTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={templateDraft.billingUnit}
                  onChange={(event) =>
                    setTemplateDraft((prev) => ({ ...prev, billingUnit: event.target.value as BillingUnit }))
                  }
                >
                  {billingUnits.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                  placeholder="Description"
                  value={templateDraft.description || ''}
                  onChange={(event) => setTemplateDraft((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Task Templates</p>
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      setTemplateDraft((prev) => ({
                        ...prev,
                        taskTemplates: [
                          ...prev.taskTemplates,
                          {
                            id: `task-${Date.now()}`,
                            title: '',
                            daysBeforeDue: 0,
                            priority: 'MEDIUM',
                          },
                        ],
                      }))
                    }
                  >
                    <Plus size={14} /> Add Task
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {templateDraft.taskTemplates.map((task, index) => (
                    <div key={task.id} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[2fr,1fr,1fr,auto]">
                      <input
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Task title"
                        value={task.title}
                        onChange={(event) =>
                          setTemplateDraft((prev) => ({
                            ...prev,
                            taskTemplates: prev.taskTemplates.map((item, i) =>
                              i === index ? { ...item, title: event.target.value } : item
                            ),
                          }))
                        }
                      />
                      <input
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        type="number"
                        value={task.daysBeforeDue}
                        onChange={(event) =>
                          setTemplateDraft((prev) => ({
                            ...prev,
                            taskTemplates: prev.taskTemplates.map((item, i) =>
                              i === index ? { ...item, daysBeforeDue: Number(event.target.value) || 0 } : item
                            ),
                          }))
                        }
                      />
                      <select
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={task.priority}
                        onChange={(event) =>
                          setTemplateDraft((prev) => ({
                            ...prev,
                            taskTemplates: prev.taskTemplates.map((item, i) =>
                              i === index ? { ...item, priority: event.target.value as ServiceTaskPriority } : item
                            ),
                          }))
                        }
                      >
                        {priorities.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <button
                        className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600"
                        onClick={() =>
                          setTemplateDraft((prev) => ({
                            ...prev,
                            taskTemplates: prev.taskTemplates.filter((_, i) => i !== index),
                          }))
                        }
                        disabled={templateDraft.taskTemplates.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">Client Type Mapping</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(['COMPANY', 'INDIVIDUAL', 'SOLE_TRADER', 'PARTNERSHIP', 'LLP'] as const).map((type) => {
                    const active = templateDraft.clientTypes.includes(type);
                    return (
                      <button
                        key={type}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
                        }`}
                        onClick={() =>
                          setTemplateDraft((prev) => ({
                            ...prev,
                            clientTypes: active
                              ? prev.clientTypes.filter((item) => item !== type)
                              : [...prev.clientTypes, type],
                          }))
                        }
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button className="btn-secondary" onClick={() => setIsEditorOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary btn-onboarding" onClick={saveTemplate}>
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </UniversalPageLayout>
  );
}
