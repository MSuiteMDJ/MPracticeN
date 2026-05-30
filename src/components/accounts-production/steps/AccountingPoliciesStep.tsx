import { useEffect, useMemo, useState } from 'react';
import type { AccountsSet, AccountingPoliciesSection } from '@/types/accounts-production';

interface Props {
  accountsSet: AccountsSet;
  onUpdate: (data: AccountingPoliciesSection) => void;
}

const BASIS_FRS102_1A =
  'These accounts have been prepared under the historical cost convention and in accordance with FRS 102 "The Financial Reporting Standard applicable in the UK and Republic of Ireland", including the provisions of Section 1A Small Entities.';

const BASIS_FRS105 =
  'These accounts have been prepared under the historical cost convention and in accordance with FRS 105 "The Financial Reporting Standard applicable to the Micro-entities Regime".';

const BASIS_STANDARD =
  'These accounts have been prepared under the historical cost convention and in accordance with applicable UK accounting standards.';

const TURNOVER_SERVICE_COMPANY =
  'Turnover represents amounts receivable for services provided in the ordinary course of the company\'s activities, net of VAT and trade discounts.';

const TURNOVER_SERVICE_BUSINESS =
  'Turnover represents amounts receivable for services provided in the ordinary course of the business\'s activities, net of VAT and trade discounts.';

const TURNOVER_PROPERTY =
  'Turnover represents amounts receivable in respect of property-related services provided during the period, net of VAT where applicable.';

const TURNOVER_TRADING =
  'Turnover represents the invoiced value of goods sold and services provided during the period, excluding VAT and trade discounts.';

const TFA_STANDARD =
  'Tangible fixed assets are measured at cost less accumulated depreciation and any accumulated impairment losses. Depreciation is provided on all tangible fixed assets, other than freehold land, at rates calculated to write off the cost, less estimated residual value, of each asset evenly over its expected useful life.';

const TFA_PROPERTY =
  'Tangible fixed assets are measured at cost less accumulated depreciation and any accumulated impairment losses. Depreciation is provided on a straight-line basis over the estimated useful lives of the assets. Freehold land is not depreciated.';

const TFA_SIMPLE =
  'Tangible fixed assets are stated at cost less accumulated depreciation and accumulated impairment losses.';

const INTANGIBLE_STANDARD =
  'Intangible assets are stated at cost less accumulated amortisation and accumulated impairment losses. Amortisation is provided on a straight-line basis over the estimated useful economic life of the asset.';

const STOCKS_STANDARD =
  'Stocks are valued at the lower of cost and net realisable value, after making due allowance for obsolete and slow-moving items.';

const INVESTMENTS_STANDARD =
  'Fixed asset investments are stated at cost less provision for impairment where necessary.';

const OPERATING_LEASES_STANDARD =
  'Rentals payable under operating leases are charged to the profit and loss account on a straight-line basis over the term of the lease.';

const FINANCE_COSTS_STANDARD =
  'Finance costs are charged to the profit and loss account in the period in which they are incurred.';

const CURRENT_TAX_STANDARD =
  'The tax expense for the period comprises current and deferred tax. Tax is recognised in the profit and loss account, except to the extent that it relates to items recognised directly in equity or in other comprehensive income.';

const DEFERRED_TAX_STANDARD =
  'Deferred tax is recognised in respect of all timing differences that have originated but not reversed at the balance sheet date where transactions or events have occurred at that date that will result in an obligation to pay more tax in the future, or a right to pay less tax in the future.';

const GOVERNMENT_GRANTS_STANDARD =
  'Government grants are recognised in income so as to match them with the expenditure towards which they are intended to contribute.';

function sanitiseText(value: string): string {
  return value
    .replace(/\bmeasured a t\b/gi, 'measured at')
    .replace(/\baccumulative depreciation\b/gi, 'accumulated depreciation')
    .replace(/\bDepreciation i s\b/gi, 'Depreciation is')
    .replace(/\bi s\b/g, ' is ')
    .replace(/\bo f\b/g, ' of ')
    .replace(/\bo n\b/g, ' on ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function defaultTurnoverText(accountsSet: AccountsSet): string {
  const isSoleTrader = accountsSet.framework === 'SOLE_TRADER' || accountsSet.framework === 'INDIVIDUAL';
  const principalActivity = accountsSet.sections.notes?.principalActivity?.toLowerCase() ?? '';

  if (principalActivity.includes('property')) return TURNOVER_PROPERTY;
  return isSoleTrader ? TURNOVER_SERVICE_BUSINESS : TURNOVER_SERVICE_COMPANY;
}

function buildDefault(accountsSet: AccountsSet): AccountingPoliciesSection {
  const ex = accountsSet.sections.accountingPolicies;
  const isSoleTrader = accountsSet.framework === 'SOLE_TRADER' || accountsSet.framework === 'INDIVIDUAL';

  return {
    basisOfPreparation: sanitiseText(
      ex?.basisOfPreparation ??
        (isSoleTrader
          ? BASIS_STANDARD
          : accountsSet.framework === 'MICRO_FRS105'
            ? BASIS_FRS105
            : BASIS_FRS102_1A),
    ),
    goingConcern: ex?.goingConcern ?? { isGoingConcern: true, noteText: '' },
    turnoverPolicyText: sanitiseText(ex?.turnoverPolicyText ?? defaultTurnoverText(accountsSet)),
    operatingLeases: ex?.operatingLeases ?? { include: false, policyText: '' },
    financeCosts: ex?.financeCosts ?? { include: false, policyText: '' },
    interestReceivable: ex?.interestReceivable ?? { include: false },
    governmentGrants: ex?.governmentGrants ?? { include: false, policyText: '' },
    currentTaxation: ex?.currentTaxation ?? { include: true, policyText: CURRENT_TAX_STANDARD },
    deferredTax: ex?.deferredTax ?? { include: false, policyText: '' },
    tangibleFixedAssets: ex?.tangibleFixedAssets ?? { hasAssets: false, policyText: '', depreciationRates: [] },
    intangibleAssets: ex?.intangibleAssets ?? { include: false, policyText: '' },
    stocks: ex?.stocks ?? { include: false, policyText: '' },
    investments: ex?.investments ?? { include: false, policyText: '' },
    tradeDebtors: ex?.tradeDebtors ?? { include: false },
    tradeCreditors: ex?.tradeCreditors ?? { include: false },
    relatedParties: ex?.relatedParties ?? { include: false },
  };
}

export function AccountingPoliciesStep({ accountsSet, onUpdate }: Props) {
  const isSoleTrader = accountsSet.framework === 'SOLE_TRADER' || accountsSet.framework === 'INDIVIDUAL';

  const incomingData = useMemo(() => buildDefault(accountsSet), [accountsSet]);
  const incomingSignature = useMemo(() => JSON.stringify(incomingData), [incomingData]);

  const [formData, setFormData] = useState<AccountingPoliciesSection>(incomingData);

  useEffect(() => {
    setFormData(current => {
      const sig = JSON.stringify(current);
      return sig === incomingSignature ? current : incomingData;
    });
  }, [incomingData, incomingSignature]);

  const commit = (next: AccountingPoliciesSection) => {
    setFormData(next);
    onUpdate(next);
  };

  const set = (path: string, value: unknown) => {
    const keys = path.split('.');
    const clone = (obj: any): any => {
      if (Array.isArray(obj)) return [...obj];
      if (obj && typeof obj === 'object') return { ...obj };
      return obj;
    };

    const next: any = clone(formData);
    let cur = next;

    for (let i = 0; i < keys.length - 1; i++) {
      cur[keys[i]] = clone(cur[keys[i]] ?? {});
      cur = cur[keys[i]];
    }

    cur[keys[keys.length - 1]] = value;
    commit(next);
  };

  const setText = (path: string, value: string) => set(path, sanitiseText(value));

  const addRate = () => {
    const rates = [
      ...(formData.tangibleFixedAssets?.depreciationRates ?? []),
      { category: '', ratePercent: 0, method: 'STRAIGHT_LINE' as const },
    ];
    set('tangibleFixedAssets.depreciationRates', rates);
  };

  const removeRate = (i: number) => {
    const rates = (formData.tangibleFixedAssets?.depreciationRates ?? []).filter((_, idx) => idx !== i);
    set('tangibleFixedAssets.depreciationRates', rates);
  };

  const updateRate = (i: number, field: string, value: unknown) => {
    const rates = (formData.tangibleFixedAssets?.depreciationRates ?? []).map((r, idx) =>
      idx === i ? { ...r, [field]: value } : r,
    );
    set('tangibleFixedAssets.depreciationRates', rates);
  };

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none';
  const cardCls = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';
  const h3Cls = 'mb-4 text-base font-bold text-slate-900';
  const btnOutlineSm =
    'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50';
  const btnPrimarySm =
    'inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700';
  const helperCls = 'text-xs text-slate-500';
  const presetWrapCls = 'flex flex-wrap gap-2';

  const Toggle = ({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );

  const PresetButtons = ({ items }: { items: { label: string; onClick: () => void }[] }) => (
    <div className={presetWrapCls}>
      {items.map(item => (
        <button key={item.label} type="button" className={btnOutlineSm} onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div className={cardCls}>
        <h3 className={h3Cls}>Basis of Preparation</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label className="block text-sm font-medium mb-1">Basis of Preparation Statement *</label>
            <textarea
              className={inputCls}
              rows={4}
              value={formData.basisOfPreparation}
              onChange={e => setText('basisOfPreparation', e.target.value)}
            />
          </div>
          <PresetButtons
            items={[
              { label: 'FRS 102 1A', onClick: () => set('basisOfPreparation', BASIS_FRS102_1A) },
              { label: 'FRS 105 micro', onClick: () => set('basisOfPreparation', BASIS_FRS105) },
              { label: 'Standard', onClick: () => set('basisOfPreparation', BASIS_STANDARD) },
            ]}
          />
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Going Concern</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Toggle
            label={isSoleTrader ? 'Business is a going concern' : 'Company is a going concern'}
            checked={formData.goingConcern.isGoingConcern}
            onChange={v => set('goingConcern.isGoingConcern', v)}
          />
          {!formData.goingConcern.isGoingConcern && (
            <div>
              <label className="block text-sm font-medium mb-1">Going Concern Note *</label>
              <textarea
                className={inputCls}
                rows={3}
                value={formData.goingConcern.noteText ?? ''}
                onChange={e => setText('goingConcern.noteText', e.target.value)}
                placeholder="Explain the going concern issues and management's assessment..."
              />
            </div>
          )}
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Turnover Recognition Policy</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label className="block text-sm font-medium mb-1">Turnover Policy</label>
            <textarea
              className={inputCls}
              rows={3}
              value={formData.turnoverPolicyText ?? ''}
              onChange={e => setText('turnoverPolicyText', e.target.value)}
              placeholder="Describe how turnover is recognised and measured..."
            />
          </div>
          <PresetButtons
            items={[
              {
                label: 'Standard service',
                onClick: () => set('turnoverPolicyText', isSoleTrader ? TURNOVER_SERVICE_BUSINESS : TURNOVER_SERVICE_COMPANY),
              },
              { label: 'Property', onClick: () => set('turnoverPolicyText', TURNOVER_PROPERTY) },
              { label: 'Simple trading', onClick: () => set('turnoverPolicyText', TURNOVER_TRADING) },
            ]}
          />
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Tangible Fixed Assets</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Toggle
            label={isSoleTrader ? 'Business has tangible fixed assets' : 'Company has tangible fixed assets'}
            checked={formData.tangibleFixedAssets?.hasAssets === true}
            onChange={v => set('tangibleFixedAssets.hasAssets', v)}
          />

          {formData.tangibleFixedAssets?.hasAssets && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Policy Text</label>
                <textarea
                  className={inputCls}
                  rows={4}
                  value={formData.tangibleFixedAssets.policyText ?? ''}
                  onChange={e => setText('tangibleFixedAssets.policyText', e.target.value)}
                  placeholder="Tangible fixed assets are stated at cost less accumulated depreciation..."
                />
                <p className={helperCls}>
                  This field is now sanitised automatically so inherited OCR artefacts like “measured a t cost” are removed.
                </p>
              </div>

              <PresetButtons
                items={[
                  { label: 'Standard fixed assets', onClick: () => set('tangibleFixedAssets.policyText', TFA_STANDARD) },
                  { label: 'Property company', onClick: () => set('tangibleFixedAssets.policyText', TFA_PROPERTY) },
                  { label: 'Simple', onClick: () => set('tangibleFixedAssets.policyText', TFA_SIMPLE) },
                ]}
              />

              <div>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}
                >
                  <strong className="text-sm font-semibold text-slate-900">Depreciation Rates</strong>
                  <button type="button" className={btnOutlineSm} onClick={addRate}>
                    Add Rate
                  </button>
                </div>

                {(!formData.tangibleFixedAssets.depreciationRates ||
                  formData.tangibleFixedAssets.depreciationRates.length === 0) ? (
                  <div className="rounded-lg bg-slate-50 p-6 text-center text-slate-500">
                    <button type="button" className={btnPrimarySm} onClick={addRate}>
                      Add First Rate
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {formData.tangibleFixedAssets.depreciationRates.map((rate, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-slate-50 p-3"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 140px 140px auto',
                          gap: '0.75rem',
                          alignItems: 'flex-end',
                        }}
                      >
                        <div>
                          <label className="block text-sm font-medium mb-1">Asset Category *</label>
                          <input
                            className={inputCls}
                            value={rate.category}
                            onChange={e => updateRate(i, 'category', e.target.value)}
                            placeholder="e.g. Buildings"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Rate %</label>
                          <input
                            type="number"
                            className={inputCls}
                            value={rate.ratePercent}
                            min={0}
                            max={100}
                            step={0.1}
                            onChange={e => updateRate(i, 'ratePercent', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Method</label>
                          <select
                            className={inputCls}
                            value={rate.method}
                            onChange={e => updateRate(i, 'method', e.target.value)}
                          >
                            <option value="STRAIGHT_LINE">Straight line</option>
                            <option value="REDUCING_BALANCE">Reducing balance</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50"
                          onClick={() => removeRate(i)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Intangible Assets</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Toggle
            label="Include intangible assets policy"
            checked={formData.intangibleAssets?.include === true}
            onChange={v => set('intangibleAssets.include', v)}
          />
          {formData.intangibleAssets?.include && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Policy Text</label>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={formData.intangibleAssets.policyText ?? ''}
                  onChange={e => setText('intangibleAssets.policyText', e.target.value)}
                  placeholder="Intangible assets are stated at cost less accumulated amortisation..."
                />
              </div>
              <PresetButtons
                items={[{ label: 'Standard intangible assets', onClick: () => set('intangibleAssets.policyText', INTANGIBLE_STANDARD) }]}
              />
            </>
          )}
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Stocks</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Toggle label="Include stocks policy" checked={formData.stocks?.include === true} onChange={v => set('stocks.include', v)} />
          {formData.stocks?.include && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Policy Text</label>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={formData.stocks.policyText ?? ''}
                  onChange={e => setText('stocks.policyText', e.target.value)}
                  placeholder="Stocks are valued at the lower of cost and net realisable value..."
                />
              </div>
              <PresetButtons items={[{ label: 'Standard stocks', onClick: () => set('stocks.policyText', STOCKS_STANDARD) }]} />
            </>
          )}
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Investments</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Toggle
            label="Include investments policy"
            checked={formData.investments?.include === true}
            onChange={v => set('investments.include', v)}
          />
          {formData.investments?.include && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Policy Text</label>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={formData.investments.policyText ?? ''}
                  onChange={e => setText('investments.policyText', e.target.value)}
                  placeholder="Fixed asset investments are stated at cost less any provision for impairment..."
                />
              </div>
              <PresetButtons items={[{ label: 'Standard investments', onClick: () => set('investments.policyText', INVESTMENTS_STANDARD) }]} />
            </>
          )}
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Operating Leases</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Toggle
            label="Include operating leases policy"
            checked={formData.operatingLeases?.include === true}
            onChange={v => set('operatingLeases.include', v)}
          />
          {formData.operatingLeases?.include && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Policy Text</label>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={formData.operatingLeases.policyText ?? ''}
                  onChange={e => setText('operatingLeases.policyText', e.target.value)}
                  placeholder="Rentals payable under operating leases are charged to the profit and loss account..."
                />
              </div>
              <PresetButtons
                items={[{ label: 'Standard operating leases', onClick: () => set('operatingLeases.policyText', OPERATING_LEASES_STANDARD) }]}
              />
            </>
          )}
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Finance Costs</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Toggle
            label="Include finance costs policy"
            checked={formData.financeCosts?.include === true}
            onChange={v => set('financeCosts.include', v)}
          />
          {formData.financeCosts?.include && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Policy Text</label>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={formData.financeCosts.policyText ?? ''}
                  onChange={e => setText('financeCosts.policyText', e.target.value)}
                  placeholder="Finance costs are charged to the profit and loss account in the period incurred..."
                />
              </div>
              <PresetButtons
                items={[{ label: 'Standard finance costs', onClick: () => set('financeCosts.policyText', FINANCE_COSTS_STANDARD) }]}
              />
            </>
          )}
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Taxation</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Toggle
            label="Include current taxation policy"
            checked={formData.currentTaxation?.include === true}
            onChange={v => set('currentTaxation.include', v)}
          />
          {formData.currentTaxation?.include && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Policy Text</label>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={formData.currentTaxation.policyText ?? ''}
                  onChange={e => setText('currentTaxation.policyText', e.target.value)}
                />
              </div>
              <PresetButtons items={[{ label: 'Standard current tax', onClick: () => set('currentTaxation.policyText', CURRENT_TAX_STANDARD) }]} />
            </>
          )}

          <Toggle
            label="Include deferred tax policy"
            checked={formData.deferredTax?.include === true}
            onChange={v => set('deferredTax.include', v)}
          />
          {formData.deferredTax?.include && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Deferred Tax Policy Text</label>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={formData.deferredTax.policyText ?? ''}
                  onChange={e => setText('deferredTax.policyText', e.target.value)}
                  placeholder="Deferred tax is recognised in respect of timing differences..."
                />
              </div>
              <PresetButtons items={[{ label: 'Standard deferred tax', onClick: () => set('deferredTax.policyText', DEFERRED_TAX_STANDARD) }]} />
            </>
          )}
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Other Policies</h3>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Toggle label="Include trade debtors policy" checked={formData.tradeDebtors?.include === true} onChange={v => set('tradeDebtors.include', v)} />
          <Toggle label="Include trade creditors policy" checked={formData.tradeCreditors?.include === true} onChange={v => set('tradeCreditors.include', v)} />
          <Toggle label="Include related parties policy" checked={formData.relatedParties?.include === true} onChange={v => set('relatedParties.include', v)} />
          <Toggle label="Include interest receivable policy" checked={formData.interestReceivable?.include === true} onChange={v => set('interestReceivable.include', v)} />
          <Toggle label="Include government grants policy" checked={formData.governmentGrants?.include === true} onChange={v => set('governmentGrants.include', v)} />

          {formData.governmentGrants?.include && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Government Grants Policy Text</label>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={formData.governmentGrants.policyText ?? ''}
                  onChange={e => setText('governmentGrants.policyText', e.target.value)}
                  placeholder="Government grants are recognised when there is reasonable assurance..."
                />
              </div>
              <PresetButtons
                items={[{ label: 'Standard government grants', onClick: () => set('governmentGrants.policyText', GOVERNMENT_GRANTS_STANDARD) }]}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}