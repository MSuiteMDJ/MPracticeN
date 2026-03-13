import { useEffect, useState } from 'react';
import { contactsAPI, reportsAPI } from '@/lib/api-service';
import UniversalPageHeader from '@/components/ui/UniversalPageHeader';
import UniversalPageLayout, { ContentSection, KPIGrid } from '@/components/ui/UniversalPageLayout';
import { generateCompaniesHouseHtmlReport, generatePracticeClientReport, makeReportFileName } from '@/lib/report-generation';
import { openGeneratedDocument } from '@/lib/templateGenerator';
import { getClientServiceEngagements } from '@/lib/service-model';
import { useSettings } from '@/contexts/SettingsContext';
import type { Contact } from '@/types';

function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type ReportKind = 'client_report' | 'companies_house_report';

export default function Reports() {
  const { settings } = useSettings();
  const [clients, setClients] = useState<Contact[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [reportType, setReportType] = useState<ReportKind>('client_report');
  const [includeServices, setIncludeServices] = useState(true);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewTemplateFile, setPreviewTemplateFile] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredHistoryCount = history.length;
  const companiesHouseCount = history.filter((report) => report.report_type === 'companies_house_report').length;

  const loadClients = async () => {
    const response = await contactsAPI.getContacts({
      type: ['business', 'individual'],
      limit: 1000,
    });
    setClients(response.contacts || []);
  };

  const loadHistory = async (clientId?: string) => {
    const response = await reportsAPI.listReports({ clientId });
    setHistory(response.reports || []);
  };

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        await Promise.all([loadClients(), loadHistory()]);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unable to load reports.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    void loadHistory(selectedClientId || undefined);
  }, [selectedClientId]);

  const handleGenerate = async () => {
    if (!selectedClientId) {
      setError('Select a client first.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const client = await contactsAPI.getContact(selectedClientId);
      if (!client) {
        throw new Error('Client not found.');
      }

      if (reportType === 'companies_house_report') {
        if (!client.company_number) {
          throw new Error('This client does not have a company number.');
        }
        const report = await generateCompaniesHouseHtmlReport({
          companyNumber: client.company_number,
          settings,
        });
        setPreviewHtml(report.html);
        setPreviewTitle(report.title);
        setPreviewTemplateFile(report.templateFile);
        return;
      }

      const services = includeServices ? await getClientServiceEngagements(client.id) : [];
      const report = await generatePracticeClientReport({
        client,
        settings,
        services,
      });
      setPreviewHtml(report.html);
      setPreviewTitle(report.title);
      setPreviewTemplateFile(report.templateFile);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to generate report.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedClientId || !previewHtml) return;
    setIsSaving(true);
    setError(null);
    try {
      await reportsAPI.createClientReport({
        clientId: selectedClientId,
        title: previewTitle,
        reportType,
        templateFile: previewTemplateFile,
        html: previewHtml,
        metadata: {
          includeServices,
          saved_from: 'reports_workspace',
        },
      });
      await loadHistory(selectedClientId);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to save report.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewStored = async (reportId: string) => {
    try {
      const blob = await reportsAPI.previewReport(reportId);
      openBlob(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to preview report.');
    }
  };

  const handleDownloadStored = async (report: any) => {
    try {
      const blob = await reportsAPI.downloadReport(report.report_id);
      downloadBlob(blob, `${makeReportFileName(report.title)}.html`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download report.');
    }
  };

  const handleDeleteStored = async (reportId: string) => {
    if (!window.confirm('Delete this saved report?')) return;
    try {
      await reportsAPI.deleteReport(reportId);
      await loadHistory(selectedClientId || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete report.');
    }
  };

  return (
    <UniversalPageLayout>
      <UniversalPageHeader
        title="Reports"
        subtitle="Generate practice client reports, Companies House reports, and manage saved output history."
        actions={
          <button className="btn-secondary" onClick={() => void loadHistory(selectedClientId || undefined)} disabled={isLoading}>
            Refresh
          </button>
        }
      />

      <KPIGrid>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved Reports</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{filteredHistoryCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Companies House Reports</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{companiesHouseCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview Status</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{previewHtml ? 'Ready' : 'Waiting'}</p>
        </div>
      </KPIGrid>

      <ContentSection>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Builder</p>
            <h2 className="text-xl font-semibold text-slate-900">Generate Report</h2>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <select className="authInput" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.client_ref || client.company_number || client.id})
                </option>
              ))}
            </select>
            <select className="authInput" value={reportType} onChange={(e) => setReportType(e.target.value as ReportKind)}>
              <option value="client_report">Client Report</option>
              <option value="companies_house_report">Companies House Report</option>
            </select>
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={includeServices}
                onChange={(e) => setIncludeServices(e.target.checked)}
                disabled={reportType !== 'client_report'}
              />
              Include services
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary btn-templates" disabled={!selectedClientId || isGenerating} onClick={() => void handleGenerate()}>
              {isGenerating ? 'Generating…' : 'Generate'}
            </button>
            <button className="btn-secondary" disabled={!previewHtml} onClick={() => openGeneratedDocument(previewHtml)}>
              Open Preview
            </button>
            <button className="btn-secondary" disabled={!previewHtml || isSaving} onClick={() => void handleSave()}>
              {isSaving ? 'Saving…' : 'Save to History'}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
            <h2 className="text-xl font-semibold text-slate-900">Live Report Preview</h2>
          </div>
          {previewHtml ? (
            <iframe
              title="Report preview"
              srcDoc={previewHtml}
              className="mt-4 min-h-[700px] w-full rounded-xl border border-slate-200 bg-white"
            />
          ) : (
            <p className="mt-4 text-sm text-slate-500">Generate a report to preview it here.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">History</p>
            <h2 className="text-xl font-semibold text-slate-900">Saved Reports</h2>
          </div>

          <div className="mt-6 overflow-x-auto">
            {isLoading ? (
              <p className="py-6 text-sm text-slate-500">Loading reports…</p>
            ) : history.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">No saved reports yet.</p>
            ) : (
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-3 py-3 font-semibold text-slate-600">Title</th>
                    <th className="px-3 py-3 font-semibold text-slate-600">Type</th>
                    <th className="px-3 py-3 font-semibold text-slate-600">Generated</th>
                    <th className="px-3 py-3 font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((report) => (
                    <tr key={report.report_id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-4 text-slate-900">{report.title}</td>
                      <td className="px-3 py-4 text-slate-600">{report.report_type}</td>
                      <td className="px-3 py-4 text-slate-600">
                        {new Date(report.generated_at).toLocaleString('en-GB')}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button className="btn-secondary" onClick={() => void handlePreviewStored(report.report_id)}>
                            Preview
                          </button>
                          <button className="btn-secondary" onClick={() => void handleDownloadStored(report)}>
                            Download
                          </button>
                          <button
                            className="inline-flex items-center rounded-lg border border-rose-200 px-4 py-2 font-semibold text-rose-600 transition hover:bg-rose-50"
                            onClick={() => void handleDeleteStored(report.report_id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </ContentSection>
    </UniversalPageLayout>
  );
}
