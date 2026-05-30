import { useEffect, useMemo, useState } from 'react';
import type { AccountsSet, CompanyPeriodSection } from '@/types/accounts-production';

interface Props {
  accountsSet: AccountsSet;
  onUpdate: (data: CompanyPeriodSection) => void;
}

function buildDefaultSection(accountsSet: AccountsSet): CompanyPeriodSection {
  return {
    framework: accountsSet.framework,
    company: {
      name: accountsSet.sections.companyPeriod?.company?.name || '',
      companyNumber:
        accountsSet.sections.companyPeriod?.company?.companyNumber ||
        accountsSet.companyNumber ||
        '',
      registeredOffice: {
        line1:
          accountsSet.sections.companyPeriod?.company?.registeredOffice?.line1 || '',
        line2:
          accountsSet.sections.companyPeriod?.company?.registeredOffice?.line2 || '',
        town:
          accountsSet.sections.companyPeriod?.company?.registeredOffice?.town || '',
        county:
          accountsSet.sections.companyPeriod?.company?.registeredOffice?.county || '',
        postcode:
          accountsSet.sections.companyPeriod?.company?.registeredOffice?.postcode || '',
        country:
          accountsSet.sections.companyPeriod?.company?.registeredOffice?.country ||
          'England',
      },
      directors: accountsSet.sections.companyPeriod?.company?.directors || [],
      sicCode: accountsSet.sections.companyPeriod?.company?.sicCode || '',
      sicDescription: accountsSet.sections.companyPeriod?.company?.sicDescription || '',
    },
    period: {
      startDate:
        accountsSet.sections.companyPeriod?.period?.startDate ||
        accountsSet.period?.startDate ||
        '',
      endDate:
        accountsSet.sections.companyPeriod?.period?.endDate ||
        accountsSet.period?.endDate ||
        '',
      isFirstYear:
        accountsSet.sections.companyPeriod?.period?.isFirstYear ??
        accountsSet.period?.isFirstYear ??
        true,
    },
    accountant: accountsSet.sections.companyPeriod?.accountant || {
      name: '',
      firmName: '',
      address: { line1: '', postcode: '', country: 'England' },
      signedDate: '',
    },
  };
}

function updateAtPath<T extends object>(source: T, path: string, value: unknown): T {
  const keys = path.split('.');
  const clone: any = Array.isArray(source) ? [...source] : { ...source };

  let cursor: any = clone;
  let originalCursor: any = source;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const originalValue = originalCursor?.[key];

    cursor[key] = Array.isArray(originalValue)
      ? [...originalValue]
      : { ...(originalValue || {}) };

    cursor = cursor[key];
    originalCursor = originalValue;
  }

  cursor[keys[keys.length - 1]] = value;
  return clone;
}

export function CompanyPeriodStep({ accountsSet, onUpdate }: Props) {
  const incomingData = useMemo(() => buildDefaultSection(accountsSet), [accountsSet]);
  const [formData, setFormData] = useState<CompanyPeriodSection>(incomingData);

  const incomingSignature = useMemo(
    () => JSON.stringify(incomingData),
    [incomingData]
  );

  useEffect(() => {
    setFormData((current) => {
      const currentSignature = JSON.stringify(current);
      return currentSignature === incomingSignature ? current : incomingData;
    });
  }, [incomingData, incomingSignature]);

  const isSoleTrader =
    formData.framework === 'SOLE_TRADER' || formData.framework === 'INDIVIDUAL';

  const commit = (next: CompanyPeriodSection) => {
    setFormData(next);
    onUpdate(next);
  };

  const handleChange = (field: string, value: unknown) => {
    commit(updateAtPath(formData, field, value));
  };

  const addDirector = () => {
    commit({
      ...formData,
      company: {
        ...formData.company,
        directors: [...(formData.company.directors || []), { name: '' }],
      },
    });
  };

  const removeDirector = (index: number) => {
    commit({
      ...formData,
      company: {
        ...formData.company,
        directors: (formData.company.directors || []).filter(
          (_, i) => i !== index
        ),
      },
    });
  };

  const updateDirector = (index: number, name: string) => {
    commit({
      ...formData,
      company: {
        ...formData.company,
        directors: (formData.company.directors || []).map((director, i) =>
          i === index ? { ...director, name } : director
        ),
      },
    });
  };

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none';
  const cardCls = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';
  const h3Cls = 'mb-4 text-base font-bold text-slate-900';
  const btnOutlineSm =
    'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60';
  const btnPrimarySm =
    'inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div className={cardCls}>
        <h3 className={h3Cls}>
          {isSoleTrader ? 'Trader Information' : 'Company Information'}
        </h3>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {isSoleTrader ? 'Trading Name' : 'Company Name'} *
            </label>
            <input
              className={inputCls}
              value={formData.company.name}
              onChange={(e) => handleChange('company.name', e.target.value)}
              placeholder={
                isSoleTrader ? 'Enter trading name' : 'Enter company name'
              }
            />
          </div>

          {!isSoleTrader && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Company Number *
              </label>
              <input
                className={inputCls}
                value={formData.company.companyNumber || ''}
                onChange={(e) =>
                  handleChange('company.companyNumber', e.target.value)
                }
                placeholder="e.g. 12345678"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">
              Accounting Framework *
            </label>
            <select
              className={inputCls}
              value={formData.framework}
              onChange={(e) => handleChange('framework', e.target.value)}
            >
              {isSoleTrader ? (
                <option value={formData.framework}>Sole trader / Individual</option>
              ) : (
                <>
                  <option value="MICRO_FRS105">Micro-entity (FRS 105)</option>
                  <option value="SMALL_FRS102_1A">Small company (FRS 102 1A)</option>
                  <option value="DORMANT">Dormant company</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>
          {isSoleTrader ? 'Business Address' : 'Registered Office Address'}
        </h3>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Address Line 1 *
            </label>
            <input
              className={inputCls}
              value={formData.company.registeredOffice.line1}
              onChange={(e) =>
                handleChange('company.registeredOffice.line1', e.target.value)
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Address Line 2
            </label>
            <input
              className={inputCls}
              value={formData.company.registeredOffice.line2 || ''}
              onChange={(e) =>
                handleChange('company.registeredOffice.line2', e.target.value)
              }
            />
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}
          >
            <div>
              <label className="mb-1 block text-sm font-medium">Town/City</label>
              <input
                className={inputCls}
                value={formData.company.registeredOffice.town || ''}
                onChange={(e) =>
                  handleChange('company.registeredOffice.town', e.target.value)
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">County</label>
              <input
                className={inputCls}
                value={formData.company.registeredOffice.county || ''}
                onChange={(e) =>
                  handleChange('company.registeredOffice.county', e.target.value)
                }
              />
            </div>
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}
          >
            <div>
              <label className="mb-1 block text-sm font-medium">Postcode *</label>
              <input
                className={inputCls}
                value={formData.company.registeredOffice.postcode}
                onChange={(e) =>
                  handleChange('company.registeredOffice.postcode', e.target.value)
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Country *</label>
              <select
                className={inputCls}
                value={formData.company.registeredOffice.country}
                onChange={(e) =>
                  handleChange('company.registeredOffice.country', e.target.value)
                }
              >
                <option value="England">England</option>
                <option value="Wales">Wales</option>
                <option value="Scotland">Scotland</option>
                <option value="Northern Ireland">Northern Ireland</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Accounting Period</h3>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}
          >
            <div>
              <label className="mb-1 block text-sm font-medium">
                Period Start Date *
              </label>
              <input
                type="date"
                className={inputCls}
                value={formData.period.startDate}
                onChange={(e) => handleChange('period.startDate', e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Period End Date *
              </label>
              <input
                type="date"
                className={inputCls}
                value={formData.period.endDate}
                onChange={(e) => handleChange('period.endDate', e.target.value)}
              />
            </div>
          </div>

          <label
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <input
              type="checkbox"
              checked={!formData.period.isFirstYear}
              onChange={(e) =>
                handleChange('period.isFirstYear', !e.target.checked)
              }
            />
            <span>
              This is not the {isSoleTrader ? "business's" : "company's"} first
              accounting period
            </span>
          </label>

          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
            {formData.period.isFirstYear
              ? 'First year accounts — comparative figures not required.'
              : 'Subsequent year accounts — comparative figures from the prior period will be required.'}
          </div>
        </div>
      </div>

      {!isSoleTrader && (
        <div className={cardCls}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h3 className="text-base font-bold text-slate-900">Directors</h3>
            <button type="button" className={btnOutlineSm} onClick={addDirector}>
              Add Director
            </button>
          </div>

          {(formData.company.directors || []).length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-8 text-center text-slate-500">
              <p className="mb-3">No directors added yet.</p>
              <button
                type="button"
                className={btnPrimarySm}
                onClick={addDirector}
              >
                Add First Director
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {(formData.company.directors || []).map((director, index) => (
                <div
                  key={index}
                  className="rounded-lg bg-slate-50 p-4"
                  style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}
                >
                  <div style={{ flex: 1 }}>
                    <label className="mb-1 block text-sm font-medium">
                      Director {index + 1} Name *
                    </label>
                    <input
                      className={inputCls}
                      value={director.name}
                      onChange={(e) => updateDirector(index, e.target.value)}
                      placeholder="Enter director name"
                    />
                  </div>

                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50"
                    onClick={() => removeDirector(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SIC Code */}
      {!isSoleTrader && (
        <div className={cardCls}>
          <h3 className={h3Cls}>Nature of Business (SIC)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '1rem' }}>
            <div>
              <label className="mb-1 block text-sm font-medium">SIC Code</label>
              <input
                className={inputCls}
                value={formData.company.sicCode || ''}
                onChange={(e) => handleChange('company.sicCode', e.target.value)}
                placeholder="e.g. 62020"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">SIC Description</label>
              <input
                className={inputCls}
                value={formData.company.sicDescription || ''}
                onChange={(e) => handleChange('company.sicDescription', e.target.value)}
                placeholder="e.g. Information technology consultancy activities"
              />
            </div>
          </div>
        </div>
      )}

      {/* Accountant Details */}
      <div className={cardCls}>
        <h3 className={h3Cls}>Accountant / Reporting Accountant</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="mb-1 block text-sm font-medium">Accountant Name</label>
              <input
                className={inputCls}
                value={formData.accountant?.name || ''}
                onChange={(e) => handleChange('accountant.name', e.target.value)}
                placeholder="e.g. John Smith"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Firm Name</label>
              <input
                className={inputCls}
                value={formData.accountant?.firmName || ''}
                onChange={(e) => handleChange('accountant.firmName', e.target.value)}
                placeholder="e.g. Smith & Co Accountants"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Firm Address Line 1</label>
            <input
              className={inputCls}
              value={formData.accountant?.address?.line1 || ''}
              onChange={(e) => handleChange('accountant.address.line1', e.target.value)}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="mb-1 block text-sm font-medium">Town/City</label>
              <input
                className={inputCls}
                value={formData.accountant?.address?.town || ''}
                onChange={(e) => handleChange('accountant.address.town', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Postcode</label>
              <input
                className={inputCls}
                value={formData.accountant?.address?.postcode || ''}
                onChange={(e) => handleChange('accountant.address.postcode', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Report Signed Date</label>
            <input
              type="date"
              className={inputCls}
              value={formData.accountant?.signedDate || ''}
              onChange={(e) => handleChange('accountant.signedDate', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}