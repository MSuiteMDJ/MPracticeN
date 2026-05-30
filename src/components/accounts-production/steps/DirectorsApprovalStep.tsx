import { useEffect, useState } from 'react';
import type { AccountsSet, DirectorsApprovalSection, SignatureType } from '@/types/accounts-production';
import { calcBS } from '@/lib/balance-sheet-calc';

interface Props {
  accountsSet: AccountsSet;
  onUpdate: (data: DirectorsApprovalSection) => void;
}

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none';
const cardCls = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';
const h3Cls = 'mb-4 text-base font-bold text-slate-900';

// Genuine statutory blockers only — things that truly prevent approval
function getBlockers(accountsSet: AccountsSet, directorName: string, approvalDate: string): string[] {
  const blockers: string[] = [];
  const s = accountsSet.sections;

  if (!s.companyPeriod?.company?.name?.trim()) {
    blockers.push('Company name is missing (Client & Period step)');
  }
  if (!s.companyPeriod?.period?.startDate || !s.companyPeriod?.period?.endDate) {
    blockers.push('Accounting period dates are missing (Client & Period step)');
  }
  if (!s.balanceSheet?.assets || !s.balanceSheet?.equity) {
    blockers.push('Balance sheet data is missing (Balance Sheet step)');
  } else {
    // Use canonical calc — never rely on stale server-side validation flag
    const { isBalanced, netAssets, capitalAndReserves, difference } = calcBS(s.balanceSheet);
    if (!isBalanced) {
      const fmt = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(n);
      blockers.push(
        `Balance sheet does not balance — Net Assets ${fmt(netAssets)} vs Capital & Reserves ${fmt(capitalAndReserves)} (difference: ${fmt(difference)})`
      );
    }
  }
  if (!directorName.trim()) {
    blockers.push('A signing director must be selected');
  }
  if (!approvalDate) {
    blockers.push('An approval date is required');
  }
  return blockers;
}

// Warnings — things worth noting but not blockers
function getWarnings(accountsSet: AccountsSet): string[] {
  const warnings: string[] = [];
  const s = accountsSet.sections;
  const isSoleTrader = accountsSet.framework === 'SOLE_TRADER' || accountsSet.framework === 'INDIVIDUAL';

  if (!isSoleTrader && !s.companyPeriod?.company?.companyNumber) {
    warnings.push('Company number not entered — recommended for statutory accounts');
  }
  if (!s.frameworkDisclosures?.framework) {
    warnings.push('Framework & Disclosures not reviewed');
  }
  if (!s.accountingPolicies?.basisOfPreparation) {
    warnings.push('Accounting policies not reviewed');
  }
  if (!s.profitAndLoss?.lines) {
    warnings.push('Profit & Loss figures not entered');
  }
  if (!s.notes?.countryOfIncorporation) {
    warnings.push('Notes section not reviewed');
  }
  return warnings;
}

export function DirectorsApprovalStep({ accountsSet, onUpdate }: Props) {
  const isSoleTrader = accountsSet.framework === 'SOLE_TRADER' || accountsSet.framework === 'INDIVIDUAL';
  const directors = accountsSet.sections.companyPeriod?.company?.directors || [];

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState<DirectorsApprovalSection>(() => {
    const existing = accountsSet.sections.directorsApproval;
    // Auto-select sole director, default date to today
    const autoDirector = directors.length === 1 ? directors[0].name : '';
    return {
      approved: existing?.approved ?? false,
      directorName: existing?.directorName || autoDirector,
      approvalDate: existing?.approvalDate || today,
      signatureType: existing?.signatureType || 'TYPED_NAME',
    };
  });

  // If directors load after mount (e.g. from Companies House), auto-select sole director
  useEffect(() => {
    if (directors.length === 1 && !formData.directorName) {
      const next = { ...formData, directorName: directors[0].name };
      setFormData(next);
      onUpdate(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directors.length]);

  const handleChange = (field: keyof DirectorsApprovalSection, value: unknown) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      onUpdate(next);
      return next;
    });
  };

  const blockers = getBlockers(accountsSet, formData.directorName || '', formData.approvalDate || '');
  const warnings = getWarnings(accountsSet);
  const canApprove = blockers.length === 0;

  const handleApprovalToggle = () => {
    if (!formData.approved) {
      const next = {
        ...formData,
        approved: true,
        directorName: formData.directorName || (directors.length > 0 ? directors[0].name : ''),
        approvalDate: formData.approvalDate || today,
        signatureType: formData.signatureType || ('TYPED_NAME' as SignatureType),
      };
      setFormData(next);
      onUpdate(next);
    } else {
      handleChange('approved', false);
    }
  };

  const signatoryLabel = isSoleTrader ? 'Signing Proprietor' : 'Signing Director';

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Readiness summary */}
      <div className={cardCls}>
        <h3 className={h3Cls}>Approval Readiness</h3>

        {blockers.length > 0 && (
          <div className="mb-4 rounded-lg bg-rose-50 p-4">
            <strong className="text-sm font-semibold text-rose-700">❌ Must resolve before approving</strong>
            <ul className="mt-2 space-y-1">
              {blockers.map((b, i) => (
                <li key={i} className="text-sm text-rose-700">• {b}</li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mb-4 rounded-lg bg-amber-50 p-4">
            <strong className="text-sm font-semibold text-amber-700">⚠️ Recommendations (not blocking)</strong>
            <ul className="mt-2 space-y-1">
              {warnings.map((w, i) => (
                <li key={i} className="text-sm text-amber-700">• {w}</li>
              ))}
            </ul>
          </div>
        )}

        {canApprove && warnings.length === 0 && (
          <div className="rounded-lg bg-emerald-50 p-4">
            <strong className="text-sm font-semibold text-emerald-700">✅ Ready for approval</strong>
            <p className="mt-1 text-sm text-slate-500">All required data is present.</p>
          </div>
        )}

        {canApprove && warnings.length > 0 && (
          <div className="rounded-lg bg-emerald-50 p-4">
            <strong className="text-sm font-semibold text-emerald-700">✅ Can approve — review warnings above</strong>
          </div>
        )}
      </div>

      {/* Director selection */}
      <div className={cardCls}>
        <h3 className={h3Cls}>{isSoleTrader ? 'Proprietor Sign-off' : 'Director Selection'}</h3>
        {isSoleTrader ? (
          <div>
            <label className="block text-sm font-medium mb-1">{signatoryLabel} *</label>
            <input
              className={inputCls}
              value={formData.directorName || ''}
              onChange={e => handleChange('directorName', e.target.value)}
              placeholder="Enter proprietor name"
            />
          </div>
        ) : directors.length === 0 ? (
          <div>
            <label className="block text-sm font-medium mb-1">{signatoryLabel} *</label>
            <input
              className={inputCls}
              value={formData.directorName || ''}
              onChange={e => handleChange('directorName', e.target.value)}
              placeholder="Enter director name (or add directors in Client & Period step)"
            />
            <p className="mt-1 text-xs text-slate-400">No directors found in company data — you can type a name directly.</p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">{signatoryLabel} *</label>
            <select
              className={inputCls}
              value={formData.directorName || ''}
              onChange={e => handleChange('directorName', e.target.value)}
            >
              <option value="">Select a director...</option>
              {directors.map((d, i) => (
                <option key={i} value={d.name}>{d.name}</option>
              ))}
            </select>
            {directors.length === 1 && (
              <p className="mt-1 text-xs text-emerald-600">✓ Auto-selected sole director</p>
            )}
          </div>
        )}
      </div>

      {/* Approval details */}
      <div className={cardCls}>
        <h3 className={h3Cls}>Approval Details</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label className="block text-sm font-medium mb-1">Approval Date *</label>
            <input
              type="date"
              className={inputCls}
              value={formData.approvalDate || ''}
              max={today}
              onChange={e => handleChange('approvalDate', e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">Defaults to today</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Signature Type</label>
            <select
              className={inputCls}
              value={formData.signatureType || 'TYPED_NAME'}
              onChange={e => handleChange('signatureType', e.target.value as SignatureType)}
            >
              <option value="TYPED_NAME">Typed Name</option>
              <option value="UPLOADED_SIGNATURE">Uploaded Signature</option>
            </select>
          </div>
        </div>
      </div>

      {/* Final approval checkbox */}
      <div className={cardCls}>
        <h3 className={h3Cls}>Final Approval</h3>
        <div className={`rounded-lg p-6 border-2 ${formData.approved ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              style={{ transform: 'scale(1.2)' }}
              checked={formData.approved}
              disabled={!canApprove}
              onChange={handleApprovalToggle}
            />
            <span className={`text-base font-semibold ${formData.approved ? 'text-emerald-700' : 'text-slate-700'}`}>
              {formData.approved ? '✅ Accounts Approved' : 'Approve Accounts'}
            </span>
          </label>
          {formData.approved ? (
            <div className="text-sm text-emerald-700">
              <strong>Approved by:</strong> {formData.directorName}<br />
              <strong>Date:</strong> {formData.approvalDate ? new Date(formData.approvalDate + 'T00:00:00').toLocaleDateString('en-GB') : ''}<br />
              <strong>Signature:</strong> {formData.signatureType === 'TYPED_NAME' ? 'Typed Name' : 'Uploaded Signature'}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {canApprove
                ? 'By checking this box, you confirm that the signatory named above has reviewed and approved these accounts.'
                : 'Resolve the blocking issues above before approving.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
