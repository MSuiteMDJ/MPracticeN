import { useState } from 'react';
import type { AccountsSet, ValidationError, ValidationWarning } from '@/types/accounts-production';

const CDS_API_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CDS_API_URL) ||
  'http://localhost:3003';

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
  const res = await fetch(`${CDS_API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = JSON.parse(text)?.message || text; } catch { /* noop */ }
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

interface Props {
  accountsSet: AccountsSet;
  onUpdate: (updated: AccountsSet) => void;
}

interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  isBalanced: boolean;
  isValid: boolean;
}

const cardCls = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';
const h3Cls = 'mb-4 text-base font-bold text-slate-900';
const btnOutlineSm = 'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50';
const btnPrimary = 'inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50';
const btnOutline = 'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50';

export function ReviewAndOutputsStep({ accountsSet, onUpdate }: Props) {
  const isSoleTrader = accountsSet.framework === 'SOLE_TRADER' || accountsSet.framework === 'INDIVIDUAL';
  const [generating, setGenerating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [lastValidated, setLastValidated] = useState<Date | null>(null);

  const handleValidate = async () => {
    try {
      setValidating(true);
      const result = await apiPost<ValidationResult>(`/accounts-sets/${accountsSet.id}/validate`);
      setValidationResult(result);
      setLastValidated(new Date());
      onUpdate({ ...accountsSet, validation: { errors: result.errors || [], warnings: result.warnings || [], isBalanced: result.isBalanced || false } });
    } catch (err: any) {
      setValidationResult({ errors: [{ field: 'general', message: err?.message || 'Validation failed', code: 'VALIDATION_ERROR', section: 'general' }], warnings: [], isBalanced: false, isValid: false });
    } finally {
      setValidating(false);
    }
  };

  const handleGenerateOutputs = async () => {
    try {
      setGenerating(true);
      const result = await apiPost<{ htmlUrl: string; pdfUrl: string }>(`/accounts-sets/${accountsSet.id}/outputs`);
      onUpdate({ ...accountsSet, outputs: { htmlUrl: result.htmlUrl, pdfUrl: result.pdfUrl } });
    } catch (err: any) {
      alert(`Output generation failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  const handlePreviewHtml = async () => {
    if (!accountsSet.outputs.htmlUrl) return;
    try {
      const filename = accountsSet.outputs.htmlUrl.split('/').pop();
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
      const res = await fetch(`${CDS_API_BASE}/accounts-sets/${accountsSet.id}/outputs/html/${filename}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err: any) {
      alert(`Failed to preview HTML: ${err?.message}`);
    }
  };

  const handleDownloadPdf = async () => {
    if (!accountsSet.outputs.pdfUrl) return;
    try {
      const filename = accountsSet.outputs.pdfUrl.split('/').pop();
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
      const res = await fetch(`${CDS_API_BASE}/accounts-sets/${accountsSet.id}/outputs/pdf/${filename}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename || 'statutory-accounts.html';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Failed to download: ${err?.message}`);
    }
  };

  const completionPct = (() => {
    const s = accountsSet.sections;
    const checks = [
      s.companyPeriod?.company?.name?.trim() !== '' && s.companyPeriod?.period?.startDate !== '',
      s.frameworkDisclosures?.framework !== undefined,
      s.accountingPolicies?.basisOfPreparation?.trim() !== '',
      s.profitAndLoss?.lines !== undefined,
      s.balanceSheet?.assets !== undefined,
      s.notes?.countryOfIncorporation !== undefined,
      s.directorsApproval?.approved === true,
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  })();

  const isReadyForGeneration = (
    // Only hard-block on: no director approval, or validation errors that are genuine blockers
    accountsSet.sections.directorsApproval?.approved === true &&
    (validationResult === null || validationResult.errors.length === 0)
  );
  const hasOutputs = accountsSet.outputs.htmlUrl && accountsSet.outputs.pdfUrl;

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div className={cardCls}>
        <h3 className={h3Cls}>Accounts Status Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'Completion', value: `${completionPct}%`, ok: completionPct === 100 },
            { label: 'Balance Sheet', value: validationResult?.isBalanced ? '✅' : '❌', ok: validationResult?.isBalanced },
            { label: 'Errors', value: String(validationResult?.errors?.length || 0), ok: (validationResult?.errors?.length || 0) === 0 },
            { label: 'Outputs', value: hasOutputs ? '📄' : '⏳', ok: !!hasOutputs },
          ].map(({ label, value, ok }) => (
            <div key={label} className={`rounded-lg p-4 text-center ${ok ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              <div className={`text-2xl font-bold ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>{value}</div>
              <div className="mt-1 text-sm text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={cardCls}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="text-base font-bold text-slate-900">Validation Summary</h3>
          <button className={btnOutlineSm} disabled={validating} onClick={handleValidate}>
            {validating ? 'Validating...' : 'Re-validate'}
          </button>
        </div>
        {lastValidated && <p className="mb-4 text-sm text-slate-500">Last validated: {lastValidated.toLocaleString()}</p>}
        {validationResult && (
          <>
            {validationResult.errors.length > 0 && (
              <div className="mb-4 rounded-lg bg-rose-50 p-4">
                <strong className="text-sm font-semibold text-rose-600">❌ Errors ({validationResult.errors.length})</strong>
                <div className="mt-2" style={{ display: 'grid', gap: '0.25rem' }}>
                  {validationResult.errors.map((e, i) => (
                    <div key={i} className="text-sm text-slate-700"><strong>{e.section}:</strong> {e.message}</div>
                  ))}
                </div>
              </div>
            )}
            {validationResult.warnings.length > 0 && (
              <div className="mb-4 rounded-lg bg-amber-50 p-4">
                <strong className="text-sm font-semibold text-amber-600">⚠️ Warnings ({validationResult.warnings.length})</strong>
                <div className="mt-2" style={{ display: 'grid', gap: '0.25rem' }}>
                  {validationResult.warnings.map((w, i) => (
                    <div key={i} className="text-sm text-slate-700"><strong>{w.section}:</strong> {w.message}</div>
                  ))}
                </div>
              </div>
            )}
            {validationResult.errors.length === 0 && (
              <div className="rounded-lg bg-emerald-50 p-4 text-center">
                <strong className="text-sm font-semibold text-emerald-600">✅ All Validations Passed</strong>
              </div>
            )}
          </>
        )}
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Output Generation</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className={`rounded-lg p-4 ${isReadyForGeneration ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <strong className={`text-sm font-semibold ${isReadyForGeneration ? 'text-emerald-700' : 'text-amber-700'}`}>{isReadyForGeneration ? '✅ Ready for Output Generation' : '⚠️ Not Ready for Output Generation'}</strong>
            <p className="mt-1 text-sm text-slate-500">
              {isReadyForGeneration
                ? 'Accounts are approved and ready to generate.'
                : !accountsSet.sections.directorsApproval?.approved
                  ? 'Director approval is required before generating outputs (Directors Approval step).'
                  : 'Resolve validation errors before generating outputs.'}
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <button className={btnPrimary} disabled={generating || !isReadyForGeneration} onClick={handleGenerateOutputs}>
              {generating ? 'Generating...' : 'Generate HTML & PDF'}
            </button>
          </div>
          {hasOutputs && (
            <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-6">
              <strong className="text-sm font-semibold text-emerald-600">📄 Outputs Generated Successfully</strong>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                <button className={btnOutline} onClick={handlePreviewHtml}>📄 Preview HTML</button>
                <button className={btnOutline} onClick={handleDownloadPdf}>📥 Download PDF</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {hasOutputs && accountsSet.sections.directorsApproval?.approved && (
        <div className="rounded-2xl bg-violet-600 p-6 text-center text-white shadow-sm">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <h3 className="mb-2 text-lg font-bold text-white">Accounts Production Complete</h3>
          <p className="mb-6 text-sm text-violet-100">
            {isSoleTrader ? 'The accounts pack has been successfully prepared, validated, approved, and generated.' : 'The statutory accounts have been successfully prepared, validated, approved, and generated.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            <div><div className="font-semibold text-white">Status</div><div className="text-violet-100">✅ Complete</div></div>
            <div><div className="font-semibold text-white">{isSoleTrader ? 'Signatory' : 'Approved By'}</div><div className="text-violet-100">{accountsSet.sections.directorsApproval?.directorName}</div></div>
            <div><div className="font-semibold text-white">Approval Date</div><div className="text-violet-100">{accountsSet.sections.directorsApproval?.approvalDate ? new Date(accountsSet.sections.directorsApproval.approvalDate).toLocaleDateString('en-GB') : 'N/A'}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}
