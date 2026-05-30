import { useEffect, useMemo, useState } from 'react';
import type {
  AccountsSet, NotesSection, TangibleAssetCategory, IntangibleAssetCategory,
  DebtorBreakdown, CreditorBreakdown,
} from '@/types/accounts-production';

interface Props {
  accountsSet: AccountsSet;
  onUpdate: (data: NotesSection) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none';
const numCls = inputCls + ' text-right';
const cardCls = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';
const h3Cls = 'mb-4 text-base font-bold text-slate-900';
const btnSm = 'inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50';
const btnDanger = 'inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50';
const btnPrimSm = 'inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700';

function blankTangible(): TangibleAssetCategory {
  return { name: '', costBfwd: 0, additions: 0, disposals: 0, costCfwd: 0, depnBfwd: 0, depnCharge: 0, depnOnDisposals: 0, depnCfwd: 0, nbvCurrent: 0, nbvPrior: 0 };
}
function blankIntangible(): IntangibleAssetCategory {
  return { name: '', costBfwd: 0, additions: 0, disposals: 0, costCfwd: 0, amortBfwd: 0, amortCharge: 0, amortOnDisposals: 0, amortCfwd: 0, nbvCurrent: 0, nbvPrior: 0 };
}
function blankDebtors(): DebtorBreakdown {
  return { tradeDebtors: 0, otherDebtors: 0, prepayments: 0, accrued: 0 };
}
function blankCreditors(): CreditorBreakdown {
  return { bankLoans: 0, tradeCreditors: 0, groupUndertakings: 0, otherCreditors: 0, directorsLoan: 0, taxationSocialSecurity: 0, accrualsDeferredIncome: 0 };
}

function buildDefault(accountsSet: AccountsSet): NotesSection {
  const ex = accountsSet.sections.notes;
  const isST = accountsSet.framework === 'SOLE_TRADER' || accountsSet.framework === 'INDIVIDUAL';
  return {
    principalActivity: ex?.principalActivity ?? '',
    countryOfIncorporation: ex?.countryOfIncorporation ?? 'England and Wales',
    employees: ex?.employees ?? { include: false, averageEmployees: 0 },
    shareClasses: ex?.shareClasses ?? (isST ? [] : [{ shareClass: 'Ordinary shares', numberOfShares: 1, nominalValue: 1, currency: 'GBP' }]),
    dividends: ex?.dividends ?? { declared: false },
    tangibleAssetCategories: ex?.tangibleAssetCategories ?? [],
    intangibleAssetCategories: ex?.intangibleAssetCategories ?? [],
    debtorBreakdown: ex?.debtorBreakdown,
    priorDebtorBreakdown: ex?.priorDebtorBreakdown,
    creditorBreakdownWithin: ex?.creditorBreakdownWithin,
    priorCreditorBreakdownWithin: ex?.priorCreditorBreakdownWithin,
    creditorBreakdownAfter: ex?.creditorBreakdownAfter,
    priorCreditorBreakdownAfter: ex?.priorCreditorBreakdownAfter,
    deferredTax: ex?.deferredTax ?? { include: false, otherTimingDifferences: 0 },
    directorsRemuneration: ex?.directorsRemuneration ?? { include: false, aggregateRemuneration: 0, pensionContributions: 0 },
    eventsAfterReportingDate: ex?.eventsAfterReportingDate ?? { include: false, text: '' },
    relatedParties: ex?.relatedParties ?? { include: false, text: '' },
    additionalNotes: ex?.additionalNotes ?? [],
  };
}

export function NotesStep({ accountsSet, onUpdate }: Props) {
  const isSoleTrader = accountsSet.framework === 'SOLE_TRADER' || accountsSet.framework === 'INDIVIDUAL';
  const isFirstYear = accountsSet.period?.isFirstYear ?? true;

  const incomingData = useMemo(() => buildDefault(accountsSet), [accountsSet]);
  const incomingSignature = useMemo(() => JSON.stringify(incomingData), [incomingData]);
  const [formData, setFormData] = useState<NotesSection>(incomingData);

  useEffect(() => {
    setFormData(current => {
      const sig = JSON.stringify(current);
      return sig === incomingSignature ? current : incomingData;
    });
  }, [incomingData, incomingSignature]);

  const commit = (next: NotesSection) => { setFormData(next); onUpdate(next); };

  const set = (path: string, value: unknown) => {
    const keys = path.split('.');
    const clone = (o: any): any =>
      Array.isArray(o) ? [...o] : (o && typeof o === 'object' ? { ...o } : o);
    const next: any = clone(formData);
    let cur = next;
    for (let i = 0; i < keys.length - 1; i++) {
      cur[keys[i]] = clone(cur[keys[i]] ?? {});
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    commit(next);
  };

  // Share classes
  const addShareClass = () => commit({ ...formData, shareClasses: [...(formData.shareClasses ?? []), { shareClass: 'Ordinary shares', numberOfShares: 0, nominalValue: 1, currency: 'GBP' }] });
  const removeShareClass = (i: number) => commit({ ...formData, shareClasses: (formData.shareClasses ?? []).filter((_, idx) => idx !== i) });
  const updateShareClass = (i: number, field: string, value: unknown) => {
    const next = (formData.shareClasses ?? []).map((sc, idx) => idx === i ? { ...sc, [field]: value } : sc);
    commit({ ...formData, shareClasses: next });
  };

  // Tangible asset categories
  const addTangible = () => commit({ ...formData, tangibleAssetCategories: [...(formData.tangibleAssetCategories ?? []), blankTangible()] });
  const removeTangible = (i: number) => commit({ ...formData, tangibleAssetCategories: (formData.tangibleAssetCategories ?? []).filter((_, idx) => idx !== i) });
  const updateTangible = (i: number, field: keyof TangibleAssetCategory, value: unknown) => {
    const next = (formData.tangibleAssetCategories ?? []).map((c, idx) => idx === i ? { ...c, [field]: value } : c);
    commit({ ...formData, tangibleAssetCategories: next });
  };

  // Intangible asset categories
  const addIntangible = () => commit({ ...formData, intangibleAssetCategories: [...(formData.intangibleAssetCategories ?? []), blankIntangible()] });
  const removeIntangible = (i: number) => commit({ ...formData, intangibleAssetCategories: (formData.intangibleAssetCategories ?? []).filter((_, idx) => idx !== i) });
  const updateIntangible = (i: number, field: keyof IntangibleAssetCategory, value: unknown) => {
    const next = (formData.intangibleAssetCategories ?? []).map((c, idx) => idx === i ? { ...c, [field]: value } : c);
    commit({ ...formData, intangibleAssetCategories: next });
  };

  // Additional notes
  const addNote = () => commit({ ...formData, additionalNotes: [...(formData.additionalNotes ?? []), { title: '', text: '' }] });
  const removeNote = (i: number) => commit({ ...formData, additionalNotes: (formData.additionalNotes ?? []).filter((_, idx) => idx !== i) });
  const updateNote = (i: number, field: 'title' | 'text', value: string) => {
    const next = (formData.additionalNotes ?? []).map((n, idx) => idx === i ? { ...n, [field]: value } : n);
    commit({ ...formData, additionalNotes: next });
  };

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="text-sm">{label}</span>
    </label>
  );

  const totalShareCapital = (formData.shareClasses ?? []).reduce((sum, sc) => sum + sc.numberOfShares * sc.nominalValue, 0);

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Company Information */}
      <div className={cardCls}>
        <h3 className={h3Cls}>{isSoleTrader ? 'Business Information' : 'Company Information'}</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label className="block text-sm font-medium mb-1">{isSoleTrader ? 'Country of Residence' : 'Country of Incorporation'} *</label>
            <select className={inputCls} value={formData.countryOfIncorporation} onChange={e => set('countryOfIncorporation', e.target.value)}>
              <option value="England and Wales">England and Wales</option>
              <option value="Scotland">Scotland</option>
              <option value="Northern Ireland">Northern Ireland</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Principal Activity</label>
            <textarea className={inputCls} rows={3} value={formData.principalActivity ?? ''} onChange={e => set('principalActivity', e.target.value)} placeholder="Describe the principal activity of the business..." />
          </div>
        </div>
      </div>

      {/* Share Capital */}
      {!isSoleTrader && (
        <div className={cardCls}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="text-base font-bold text-slate-900">Share Capital</h3>
            <button type="button" className={btnSm} onClick={addShareClass}>Add Share Class</button>
          </div>
          {(formData.shareClasses ?? []).length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-6 text-center">
              <button type="button" className={btnPrimSm} onClick={addShareClass}>Add Share Class</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {(formData.shareClasses ?? []).map((sc, i) => (
                <div key={i} className="rounded-lg bg-slate-50 p-4" style={{ display: 'grid', gap: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <div>
                      <label className="block text-sm font-medium mb-1">Share Class</label>
                      <input className={inputCls} value={sc.shareClass} onChange={e => updateShareClass(i, 'shareClass', e.target.value)} placeholder="e.g. Ordinary shares" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Number of Shares</label>
                      <input type="number" className={numCls} min={0} value={sc.numberOfShares} onChange={e => updateShareClass(i, 'numberOfShares', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Nominal Value (£)</label>
                      <input type="number" className={numCls} min={0} step={0.01} value={sc.nominalValue} onChange={e => updateShareClass(i, 'nominalValue', parseFloat(e.target.value) || 0)} />
                    </div>
                    <button type="button" className={btnDanger} style={{ marginTop: '22px' }} onClick={() => removeShareClass(i)}>Remove</button>
                  </div>
                  <div className="text-sm text-slate-500">Total: {fmt(sc.numberOfShares * sc.nominalValue)}</div>
                </div>
              ))}
              <div className="rounded-lg bg-violet-50 p-3" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong className="text-sm font-semibold text-violet-700">Total Share Capital</strong>
                <strong className="text-sm font-semibold text-violet-700">{fmt(totalShareCapital)}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dividends */}
      <div className={cardCls}>
        <h3 className={h3Cls}>Dividends</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Toggle label="Dividends were declared during the period" checked={formData.dividends?.declared === true} onChange={v => set('dividends.declared', v)} />
          {formData.dividends?.declared && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="block text-sm font-medium mb-1">Total Amount Declared (£) *</label>
                <input type="number" className={numCls} min={0} step={1} value={formData.dividends.totalAmount ?? ''} onChange={e => set('dividends.totalAmount', parseFloat(e.target.value) || 0)} placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Per Share (£) — optional</label>
                <input type="number" className={numCls} min={0} step={0.01} value={formData.dividends.perShare ?? ''} onChange={e => set('dividends.perShare', parseFloat(e.target.value) || undefined)} placeholder="0.00" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Employees */}
      <div className={cardCls}>
        <h3 className={h3Cls}>Employees</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Toggle label="Include employee numbers in notes" checked={formData.employees?.include === true} onChange={v => set('employees.include', v)} />
          {formData.employees?.include && (
            <div style={{ display: 'grid', gridTemplateColumns: isFirstYear ? '1fr' : '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="block text-sm font-medium mb-1">Average Number of Employees {isFirstYear ? '' : '(Current Year)'}</label>
                <input type="number" className={numCls} min={0} value={formData.employees.averageEmployees ?? 0} onChange={e => set('employees.averageEmployees', parseInt(e.target.value) || 0)} />
              </div>
              {!isFirstYear && (
                <div>
                  <label className="block text-sm font-medium mb-1">Average Number of Employees (Prior Year)</label>
                  <input type="number" className={numCls} min={0} value={formData.employees.priorAverageEmployees ?? 0} onChange={e => set('employees.priorAverageEmployees', parseInt(e.target.value) || 0)} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Directors' Remuneration */}
      {!isSoleTrader && (
        <div className={cardCls}>
          <h3 className={h3Cls}>Directors' Remuneration</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <Toggle label="Include directors' remuneration note" checked={formData.directorsRemuneration?.include === true} onChange={v => set('directorsRemuneration.include', v)} />
            {formData.directorsRemuneration?.include && (
              <div style={{ display: 'grid', gridTemplateColumns: isFirstYear ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="block text-sm font-medium mb-1">Aggregate Remuneration {isFirstYear ? '' : '(Current)'}</label>
                  <input type="number" className={numCls} min={0} step={1} value={formData.directorsRemuneration.aggregateRemuneration} onChange={e => set('directorsRemuneration.aggregateRemuneration', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Pension Contributions {isFirstYear ? '' : '(Current)'}</label>
                  <input type="number" className={numCls} min={0} step={1} value={formData.directorsRemuneration.pensionContributions} onChange={e => set('directorsRemuneration.pensionContributions', parseFloat(e.target.value) || 0)} />
                </div>
                {!isFirstYear && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Aggregate Remuneration (Prior)</label>
                      <input type="number" className={numCls} min={0} step={1} value={formData.directorsRemuneration.priorAggregateRemuneration ?? 0} onChange={e => set('directorsRemuneration.priorAggregateRemuneration', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Pension Contributions (Prior)</label>
                      <input type="number" className={numCls} min={0} step={1} value={formData.directorsRemuneration.priorPensionContributions ?? 0} onChange={e => set('directorsRemuneration.priorPensionContributions', parseFloat(e.target.value) || 0)} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tangible Asset Categories */}
      <div className={cardCls}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="text-base font-bold text-slate-900">Tangible Fixed Assets Note</h3>
          <button type="button" className={btnSm} onClick={addTangible}>Add Category</button>
        </div>
        {(formData.tangibleAssetCategories ?? []).length === 0 ? (
          <div className="rounded-lg bg-slate-50 p-6 text-center text-slate-500">
            <p className="mb-3 text-sm">Add asset categories to generate the tangible assets note.</p>
            <button type="button" className={btnPrimSm} onClick={addTangible}>Add Category</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {(formData.tangibleAssetCategories ?? []).map((cat, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-4">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <input className={inputCls} style={{ maxWidth: '300px' }} value={cat.name} onChange={e => updateTangible(i, 'name', e.target.value)} placeholder="Category name (e.g. Motor Vehicles)" />
                  <button type="button" className={btnDanger} onClick={() => removeTangible(i)}>Remove</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        {['Cost b/fwd','Additions','Disposals','Cost c/fwd','Depn b/fwd','Depn charge','Depn on disposals','Depn c/fwd','NBV current','NBV prior'].map(h => (
                          <th key={h} style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {(['costBfwd','additions','disposals','costCfwd','depnBfwd','depnCharge','depnOnDisposals','depnCfwd','nbvCurrent','nbvPrior'] as (keyof TangibleAssetCategory)[]).map(field => (
                          <td key={field} style={{ padding: '0.25rem' }}>
                            <input type="number" className={numCls} style={{ minWidth: '80px' }} step={1} value={(cat[field] as number) ?? 0} onChange={e => updateTangible(i, field, parseFloat(e.target.value) || 0)} />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Intangible Asset Categories */}
      <div className={cardCls}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="text-base font-bold text-slate-900">Intangible Assets Note</h3>
          <button type="button" className={btnSm} onClick={addIntangible}>Add Category</button>
        </div>
        {(formData.intangibleAssetCategories ?? []).length === 0 ? (
          <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">No intangible asset categories added.</div>
        ) : (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {(formData.intangibleAssetCategories ?? []).map((cat, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-4">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <input className={inputCls} style={{ maxWidth: '300px' }} value={cat.name} onChange={e => updateIntangible(i, 'name', e.target.value)} placeholder="Category name (e.g. Goodwill)" />
                  <button type="button" className={btnDanger} onClick={() => removeIntangible(i)}>Remove</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        {['Cost b/fwd','Additions','Disposals','Cost c/fwd','Amort b/fwd','Amort charge','Amort on disposals','Amort c/fwd','NBV current','NBV prior'].map(h => (
                          <th key={h} style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {(['costBfwd','additions','disposals','costCfwd','amortBfwd','amortCharge','amortOnDisposals','amortCfwd','nbvCurrent','nbvPrior'] as (keyof IntangibleAssetCategory)[]).map(field => (
                          <td key={field} style={{ padding: '0.25rem' }}>
                            <input type="number" className={numCls} style={{ minWidth: '80px' }} step={1} value={(cat[field] as number) ?? 0} onChange={e => updateIntangible(i, field, parseFloat(e.target.value) || 0)} />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Debtor Breakdown */}
      <div className={cardCls}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="text-base font-bold text-slate-900">Debtors Note</h3>
          <button type="button" className={btnSm} onClick={() => commit({ ...formData, debtorBreakdown: formData.debtorBreakdown ?? blankDebtors(), priorDebtorBreakdown: isFirstYear ? undefined : (formData.priorDebtorBreakdown ?? blankDebtors()) })}>
            {formData.debtorBreakdown ? 'Editing' : 'Add Breakdown'}
          </button>
        </div>
        {formData.debtorBreakdown ? (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {(['tradeDebtors','otherDebtors','prepayments','accrued'] as (keyof DebtorBreakdown)[]).map(field => (
              <div key={field} style={{ display: 'grid', gridTemplateColumns: isFirstYear ? '1fr 160px' : '1fr 160px 160px', gap: '0.75rem', alignItems: 'center' }}>
                <label className="text-sm text-slate-700 capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
                <input type="number" className={numCls} step={1} value={formData.debtorBreakdown![field]} onChange={e => set(`debtorBreakdown.${field}`, parseFloat(e.target.value) || 0)} />
                {!isFirstYear && <input type="number" className={numCls} step={1} value={(formData.priorDebtorBreakdown ?? blankDebtors())[field]} onChange={e => set(`priorDebtorBreakdown.${field}`, parseFloat(e.target.value) || 0)} />}
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#f8fafc', borderRadius: '6px' }}>
              <strong className="text-sm">Total Debtors</strong>
              <strong className="text-sm">{fmt(Object.values(formData.debtorBreakdown).reduce((s, v) => s + (v as number), 0))}</strong>
            </div>
            <button type="button" className={btnDanger} style={{ justifySelf: 'start' }} onClick={() => commit({ ...formData, debtorBreakdown: undefined, priorDebtorBreakdown: undefined })}>Remove Breakdown</button>
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No debtor breakdown added. Click "Add Breakdown" to include a debtors note.</div>
        )}
      </div>

      {/* Creditor Breakdown */}
      <div className={cardCls}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="text-base font-bold text-slate-900">Creditors Note</h3>
          <button type="button" className={btnSm} onClick={() => commit({ ...formData, creditorBreakdownWithin: formData.creditorBreakdownWithin ?? blankCreditors(), priorCreditorBreakdownWithin: isFirstYear ? undefined : (formData.priorCreditorBreakdownWithin ?? blankCreditors()) })}>
            {formData.creditorBreakdownWithin ? 'Editing' : 'Add Breakdown'}
          </button>
        </div>
        {formData.creditorBreakdownWithin ? (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <p className="text-sm font-semibold text-slate-700">Amounts falling due within one year</p>
            {(['bankLoans','tradeCreditors','groupUndertakings','otherCreditors','directorsLoan','taxationSocialSecurity','accrualsDeferredIncome'] as (keyof CreditorBreakdown)[]).map(field => (
              <div key={field} style={{ display: 'grid', gridTemplateColumns: isFirstYear ? '1fr 160px' : '1fr 160px 160px', gap: '0.75rem', alignItems: 'center' }}>
                <label className="text-sm text-slate-700 capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
                <input type="number" className={numCls} step={1} value={formData.creditorBreakdownWithin![field]} onChange={e => set(`creditorBreakdownWithin.${field}`, parseFloat(e.target.value) || 0)} />
                {!isFirstYear && <input type="number" className={numCls} step={1} value={(formData.priorCreditorBreakdownWithin ?? blankCreditors())[field]} onChange={e => set(`priorCreditorBreakdownWithin.${field}`, parseFloat(e.target.value) || 0)} />}
              </div>
            ))}
            <button type="button" className={btnDanger} style={{ justifySelf: 'start' }} onClick={() => commit({ ...formData, creditorBreakdownWithin: undefined, priorCreditorBreakdownWithin: undefined })}>Remove Breakdown</button>
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No creditor breakdown added.</div>
        )}
      </div>

      {/* Deferred Tax */}
      <div className={cardCls}>
        <h3 className={h3Cls}>Deferred Tax</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Toggle label="Include deferred tax note" checked={formData.deferredTax?.include === true} onChange={v => set('deferredTax.include', v)} />
          {formData.deferredTax?.include && (
            <div style={{ display: 'grid', gridTemplateColumns: isFirstYear ? '1fr' : '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="block text-sm font-medium mb-1">Other Timing Differences {isFirstYear ? '' : '(Current)'}</label>
                <input type="number" className={numCls} step={1} value={formData.deferredTax.otherTimingDifferences} onChange={e => set('deferredTax.otherTimingDifferences', parseFloat(e.target.value) || 0)} />
              </div>
              {!isFirstYear && (
                <div>
                  <label className="block text-sm font-medium mb-1">Other Timing Differences (Prior)</label>
                  <input type="number" className={numCls} step={1} value={formData.deferredTax.priorOtherTimingDifferences ?? 0} onChange={e => set('deferredTax.priorOtherTimingDifferences', parseFloat(e.target.value) || 0)} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Related Parties */}
      <div className={cardCls}>
        <h3 className={h3Cls}>Related Party Transactions</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Toggle label="Include related party transactions note" checked={formData.relatedParties?.include === true} onChange={v => set('relatedParties.include', v)} />
          {formData.relatedParties?.include && (
            <div>
              <label className="block text-sm font-medium mb-1">Related Party Note Text *</label>
              <textarea className={inputCls} rows={4} value={formData.relatedParties.text ?? ''} onChange={e => set('relatedParties.text', e.target.value)} placeholder="Describe related party transactions during the period..." />
            </div>
          )}
        </div>
      </div>

      {/* Events After Reporting Date */}
      <div className={cardCls}>
        <h3 className={h3Cls}>Events After the Reporting Date</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Toggle label="Include post-balance sheet events note" checked={formData.eventsAfterReportingDate?.include === true} onChange={v => set('eventsAfterReportingDate.include', v)} />
          {formData.eventsAfterReportingDate?.include && (
            <div>
              <label className="block text-sm font-medium mb-1">Events Note Text *</label>
              <textarea className={inputCls} rows={4} value={formData.eventsAfterReportingDate.text ?? ''} onChange={e => set('eventsAfterReportingDate.text', e.target.value)} placeholder="Describe significant events after the reporting date..." />
            </div>
          )}
        </div>
      </div>

      {/* Additional Notes */}
      <div className={cardCls}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="text-base font-bold text-slate-900">Additional Disclosures</h3>
          <button type="button" className={btnSm} onClick={addNote}>Add Note</button>
        </div>
        {(formData.additionalNotes ?? []).length === 0 ? (
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500 text-center">No additional notes. Click "Add Note" to include bespoke disclosures.</div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {(formData.additionalNotes ?? []).map((note, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-4" style={{ display: 'grid', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input className={inputCls} value={note.title} onChange={e => updateNote(i, 'title', e.target.value)} placeholder="Note title" style={{ maxWidth: '400px' }} />
                  <button type="button" className={btnDanger} onClick={() => removeNote(i)}>Remove</button>
                </div>
                <textarea className={inputCls} rows={4} value={note.text} onChange={e => updateNote(i, 'text', e.target.value)} placeholder="Note content..." />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
