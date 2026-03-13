import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import UniversalPageLayout, { ContentSection, KPIGrid } from '@/components/ui/UniversalPageLayout';
import UniversalPageHeader from '@/components/ui/UniversalPageHeader';
import { contactsAPI } from '@/lib/api-service';
import {
  getClientServiceEngagements,
  mapEngagementToServiceModel,
  subscribeToServiceDataUpdates,
  type ClientServiceEngagement,
} from '@/lib/service-model';

type DashboardTaskRow = {
  id: string;
  clientId: string;
  clientName: string;
  serviceName: string;
  title: string;
  dueDate?: string;
  priority: string;
  status: 'todo' | 'in_progress' | 'completed' | 'overdue';
};

type DashboardComplianceRow = {
  id: string;
  clientId: string;
  clientName: string;
  serviceName: string;
  label: string;
  dueDate?: string;
  timing: 'overdue' | 'due_7' | 'due_30' | 'later' | 'undated';
};

type DashboardSnapshot = {
  clientCount: number;
  activeServices: number;
  tasksNext7: number;
  overdueTasks: number;
  overdueCompliance: number;
  dueSoonCompliance: number;
  healthyServices: number;
  attentionServices: number;
  taskCompletionRate: number;
  upcomingTasks: DashboardTaskRow[];
  urgentCompliance: DashboardComplianceRow[];
  workloadBuckets: Array<{ label: string; count: number }>;
  complianceBuckets: Array<{ label: string; count: number; tone: string }>;
  lastUpdated: string;
};

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  clientCount: 0,
  activeServices: 0,
  tasksNext7: 0,
  overdueTasks: 0,
  overdueCompliance: 0,
  dueSoonCompliance: 0,
  healthyServices: 0,
  attentionServices: 0,
  taskCompletionRate: 0,
  upcomingTasks: [],
  urgentCompliance: [],
  workloadBuckets: [],
  complianceBuckets: [],
  lastUpdated: '',
};

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dayDiffFromToday(value?: string): number | null {
  const parsed = parseDate(value);
  if (!parsed) return null;
  const today = startOfDay(new Date());
  const target = startOfDay(parsed);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDueDate(value?: string): string {
  const parsed = parseDate(value);
  if (!parsed) return 'No date';
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function timingLabel(daysUntil: number | null): string {
  if (daysUntil === null) return 'No date';
  if (daysUntil < 0) return `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} late`;
  if (daysUntil === 0) return 'Due today';
  if (daysUntil === 1) return 'Due tomorrow';
  return `Due in ${daysUntil} days`;
}

function taskStatusTone(status: DashboardTaskRow['status']): string {
  if (status === 'overdue') return 'bg-rose-100 text-rose-700';
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700';
  if (status === 'in_progress') return 'bg-blue-100 text-blue-700';
  return 'bg-amber-100 text-amber-700';
}

function complianceTone(timing: DashboardComplianceRow['timing']): string {
  if (timing === 'overdue') return 'bg-rose-100 text-rose-700';
  if (timing === 'due_7') return 'bg-amber-100 text-amber-700';
  if (timing === 'due_30') return 'bg-blue-100 text-blue-700';
  if (timing === 'later') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}

function dashboardTaskStatus(
  task: ClientServiceEngagement['taskInstances'][number],
  fallbackDueDate?: string
): DashboardTaskRow['status'] {
  if (task.status === 'DONE') return 'completed';
  const daysUntil = dayDiffFromToday(task.dueDate || fallbackDueDate);
  if (daysUntil !== null && daysUntil < 0) return 'overdue';
  if (task.status === 'IN_PROGRESS') return 'in_progress';
  return 'todo';
}

function buildWeeklyWorkloadBuckets(tasks: DashboardTaskRow[]): Array<{ label: string; count: number }> {
  const labels = ['This week', 'Next week', 'Week 3', 'Week 4', 'Week 5', 'Week 6'];
  const buckets = labels.map((label) => ({ label, count: 0 }));

  tasks
    .filter((task) => task.status !== 'completed')
    .forEach((task) => {
      const daysUntil = dayDiffFromToday(task.dueDate);
      if (daysUntil === null || daysUntil < 0 || daysUntil > 41) return;
      const bucketIndex = Math.min(5, Math.floor(daysUntil / 7));
      buckets[bucketIndex].count += 1;
    });

  return buckets;
}

function buildSnapshot(
  clientCount: number,
  engagements: ClientServiceEngagement[],
  nameByClientId: Map<string, string>
): DashboardSnapshot {
  const serviceModels = engagements.map((engagement) =>
    mapEngagementToServiceModel(engagement, nameByClientId.get(engagement.clientId) || engagement.clientId)
  );

  const taskRows: DashboardTaskRow[] = engagements.flatMap((engagement) =>
    engagement.taskInstances.map((task) => ({
      id: task.id,
      clientId: engagement.clientId,
      clientName: nameByClientId.get(engagement.clientId) || engagement.clientId,
      serviceName: engagement.displayName,
      title: task.title,
      dueDate: task.dueDate || engagement.nextDue || engagement.startDate,
      priority: task.priority,
      status: dashboardTaskStatus(task, engagement.nextDue || engagement.startDate),
    }))
  );

  const complianceRows: DashboardComplianceRow[] = engagements.flatMap((engagement) => {
    if (!engagement.isActive || engagement.complianceType === 'NONE') return [];

    const complianceDates = engagement.complianceDates.length
      ? engagement.complianceDates
      : engagement.nextDue
        ? [{ id: `${engagement.id}-next`, label: 'Next due', dueDate: engagement.nextDue }]
        : [];

    return complianceDates.map((item) => {
      const daysUntil = dayDiffFromToday(item.dueDate);
      let timing: DashboardComplianceRow['timing'] = 'undated';
      if (daysUntil !== null) {
        if (daysUntil < 0) timing = 'overdue';
        else if (daysUntil <= 7) timing = 'due_7';
        else if (daysUntil <= 30) timing = 'due_30';
        else timing = 'later';
      }

      return {
        id: `${engagement.id}-${item.id}`,
        clientId: engagement.clientId,
        clientName: nameByClientId.get(engagement.clientId) || engagement.clientId,
        serviceName: engagement.displayName,
        label: item.label,
        dueDate: item.dueDate,
        timing,
      };
    });
  });

  const openTasks = taskRows.filter((task) => task.status !== 'completed');
  const completedTasks = taskRows.filter((task) => task.status === 'completed').length;
  const tasksNext7 = openTasks.filter((task) => {
    const daysUntil = dayDiffFromToday(task.dueDate);
    return daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
  }).length;
  const overdueTasks = openTasks.filter((task) => task.status === 'overdue').length;
  const overdueCompliance = complianceRows.filter((item) => item.timing === 'overdue').length;
  const dueSoonCompliance = complianceRows.filter((item) => item.timing === 'due_7').length;

  return {
    clientCount,
    activeServices: engagements.filter((engagement) => engagement.isActive).length,
    tasksNext7,
    overdueTasks,
    overdueCompliance,
    dueSoonCompliance,
    healthyServices: serviceModels.filter((service) => service.status === 'active').length,
    attentionServices: serviceModels.filter((service) => service.status === 'attention').length,
    taskCompletionRate: taskRows.length ? Math.round((completedTasks / taskRows.length) * 100) : 0,
    upcomingTasks: openTasks
      .filter((task) => {
        const daysUntil = dayDiffFromToday(task.dueDate);
        return daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
      })
      .sort((left, right) => {
        const leftDate = parseDate(left.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
        const rightDate = parseDate(right.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
        return leftDate - rightDate;
      })
      .slice(0, 8),
    urgentCompliance: complianceRows
      .filter((item) => item.timing === 'overdue' || item.timing === 'due_7' || item.timing === 'due_30')
      .sort((left, right) => {
        const leftDate = parseDate(left.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
        const rightDate = parseDate(right.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
        return leftDate - rightDate;
      })
      .slice(0, 8),
    workloadBuckets: buildWeeklyWorkloadBuckets(taskRows),
    complianceBuckets: [
      { label: 'Overdue', count: overdueCompliance, tone: 'bg-rose-500' },
      { label: 'Next 7 days', count: dueSoonCompliance, tone: 'bg-amber-500' },
      {
        label: 'Next 30 days',
        count: complianceRows.filter((item) => item.timing === 'due_30').length,
        tone: 'bg-blue-500',
      },
      {
        label: 'Later',
        count: complianceRows.filter((item) => item.timing === 'later').length,
        tone: 'bg-emerald-500',
      },
    ],
    lastUpdated: new Date().toISOString(),
  };
}

function DashboardMetricCard(props: {
  label: string;
  value: string | number;
  subtext: string;
  icon: typeof BarChart3;
  tone: string;
}) {
  const { label, value, subtext, icon: Icon, tone } = props;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`rounded-2xl p-3 ${tone}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-500">{subtext}</p>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY_SNAPSHOT);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const contactsResponse = await contactsAPI.getContacts({
        limit: 500,
        sort_by: 'name',
        sort_order: 'asc',
      });
      const nameByClientId = new Map(
        contactsResponse.contacts.map((contact) => [contact.id, contact.name])
      );
      const engagements = await getClientServiceEngagements();
      setSnapshot(buildSnapshot(contactsResponse.total_count || contactsResponse.contacts.length, engagements, nameByClientId));
    } catch (error) {
      console.error('Failed to load dashboard data', error);
      setSnapshot(EMPTY_SNAPSHOT);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    return subscribeToServiceDataUpdates(() => {
      void loadDashboard();
    });
  }, []);

  const maxWorkloadCount = Math.max(...snapshot.workloadBuckets.map((bucket) => bucket.count), 1);
  const totalComplianceTracked = snapshot.complianceBuckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <UniversalPageLayout>
      <UniversalPageHeader
        title="Dashboard"
        subtitle="Live practice overview built from active clients, service tasks, and compliance dates."
        meta={
          <div className="space-y-1">
            <p>
              <span className="font-semibold text-slate-800">{snapshot.overdueTasks}</span> overdue tasks and{' '}
              <span className="font-semibold text-slate-800">{snapshot.overdueCompliance}</span> overdue compliance lines.
            </p>
            <p>Updated {snapshot.lastUpdated ? new Date(snapshot.lastUpdated).toLocaleString('en-GB') : '—'}</p>
          </div>
        }
        actions={
          <button className="btn-secondary" onClick={() => void loadDashboard()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <KPIGrid>
        <DashboardMetricCard
          label="Clients"
          value={isLoading ? '...' : snapshot.clientCount}
          subtext="Active practice client records"
          icon={BarChart3}
          tone="bg-slate-800"
        />
        <DashboardMetricCard
          label="Active Services"
          value={isLoading ? '...' : snapshot.activeServices}
          subtext={`${snapshot.healthyServices} healthy, ${snapshot.attentionServices} needing attention`}
          icon={CheckCircle2}
          tone="bg-emerald-600"
        />
        <DashboardMetricCard
          label="Tasks Next 7 Days"
          value={isLoading ? '...' : snapshot.tasksNext7}
          subtext={`${snapshot.overdueTasks} overdue tasks already outside target`}
          icon={Clock3}
          tone="bg-blue-600"
        />
        <DashboardMetricCard
          label="Late Compliance"
          value={isLoading ? '...' : snapshot.overdueCompliance}
          subtext={`${snapshot.dueSoonCompliance} more due in the next 7 days`}
          icon={ShieldAlert}
          tone="bg-amber-500"
        />
      </KPIGrid>

      <ContentSection>
        <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next 7 Days</p>
                <h2 className="text-xl font-semibold text-slate-900">Upcoming Tasks</h2>
              </div>
              <button className="text-sm font-semibold text-cyan-700 hover:text-cyan-800" onClick={() => navigate('/services')}>
                Open Services
              </button>
            </div>

            {isLoading ? (
              <p className="mt-6 text-sm text-slate-500">Loading tasks…</p>
            ) : snapshot.upcomingTasks.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm text-slate-500">No tasks due in the next 7 days.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {snapshot.upcomingTasks.map((task) => (
                  <button
                    key={`${task.clientId}-${task.id}`}
                    onClick={() => navigate(`/clients/${task.clientId}?tab=services`)}
                    className="grid w-full gap-3 rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:border-cyan-200 hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{task.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {task.clientName} · {task.serviceName}
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${taskStatusTone(task.status)}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                      <p className="text-sm font-semibold text-slate-900">{formatDueDate(task.dueDate)}</p>
                      <p className="text-xs text-slate-500">{timingLabel(dayDiffFromToday(task.dueDate))}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Action Queue</p>
                <h2 className="text-xl font-semibold text-slate-900">Late and Due Compliance</h2>
              </div>
              <button className="text-sm font-semibold text-cyan-700 hover:text-cyan-800" onClick={() => navigate('/compliance')}>
                Open Compliance
              </button>
            </div>

            {isLoading ? (
              <p className="mt-6 text-sm text-slate-500">Loading compliance items…</p>
            ) : snapshot.urgentCompliance.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm text-slate-500">No late or near-term compliance items.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {snapshot.urgentCompliance.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/clients/${item.clientId}?tab=compliance`)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:border-cyan-200 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.clientName} · {item.serviceName}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${complianceTone(item.timing)}`}>
                        {item.timing === 'due_7' ? 'Next 7 days' : item.timing === 'due_30' ? 'Next 30 days' : item.timing}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">{formatDueDate(item.dueDate)}</p>
                      <p className="text-xs text-slate-500">{timingLabel(dayDiffFromToday(item.dueDate))}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr,0.95fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workload Outlook</p>
                <h2 className="text-xl font-semibold text-slate-900">Task Load Over 6 Weeks</h2>
              </div>
              <CalendarClock className="h-5 w-5 text-slate-400" />
            </div>

            {isLoading ? (
              <p className="mt-8 text-sm text-slate-500">Loading workload trend…</p>
            ) : (
              <>
                <div className="mt-6 grid grid-cols-6 gap-3">
                  {snapshot.workloadBuckets.map((bucket) => (
                    <div key={bucket.label} className="flex flex-col items-center gap-3">
                      <div className="flex h-44 w-full items-end rounded-2xl bg-slate-50 px-2 pb-2">
                        <div
                          className="w-full rounded-xl bg-gradient-to-t from-cyan-600 to-sky-400"
                          style={{
                            height: `${Math.max(10, (bucket.count / maxWorkloadCount) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-slate-900">{bucket.count}</p>
                        <p className="text-xs font-medium text-slate-500">{bucket.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completion Rate</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{snapshot.taskCompletionRate}%</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overdue Tasks</p>
                    <p className="mt-2 text-2xl font-bold text-rose-700">{snapshot.overdueTasks}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due This Week</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{snapshot.tasksNext7}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compliance Radar</p>
                <h2 className="text-xl font-semibold text-slate-900">Late and Upcoming Compliance</h2>
              </div>
              <AlertTriangle className="h-5 w-5 text-slate-400" />
            </div>

            {isLoading ? (
              <p className="mt-8 text-sm text-slate-500">Loading compliance profile…</p>
            ) : (
              <div className="mt-6 space-y-5">
                {snapshot.complianceBuckets.map((bucket) => {
                  const width = totalComplianceTracked
                    ? Math.max(8, (bucket.count / totalComplianceTracked) * 100)
                    : 8;
                  return (
                    <div key={bucket.label}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">{bucket.label}</p>
                        <p className="text-sm font-semibold text-slate-900">{bucket.count}</p>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100">
                        <div
                          className={`h-3 rounded-full ${bucket.tone}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Focus</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {snapshot.overdueCompliance > 0
                      ? `${snapshot.overdueCompliance} compliance item${snapshot.overdueCompliance === 1 ? '' : 's'} need immediate attention`
                      : snapshot.dueSoonCompliance > 0
                        ? `${snapshot.dueSoonCompliance} compliance item${snapshot.dueSoonCompliance === 1 ? '' : 's'} due within 7 days`
                        : 'No urgent compliance blockers'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </ContentSection>
    </UniversalPageLayout>
  );
}
