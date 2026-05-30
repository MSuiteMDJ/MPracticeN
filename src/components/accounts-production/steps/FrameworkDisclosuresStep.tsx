import { useEffect, useMemo, useState } from 'react';
import type { AccountsSet, FrameworkDisclosuresSection } from '@/types/accounts-production';

interface Props {
  accountsSet: AccountsSet;
  onUpdate: (data: FrameworkDisclosuresSection) => void;
}

type ExemptionOption = {
  value: string;
  label: string;
};

function isSoleTraderFramework(framework: AccountsSet['framework']) {
  return framework === 'SOLE_TRADER' || framework === 'INDIVIDUAL';
}

function getDefaultExemptionKey(framework: AccountsSet['framework']): string {
  switch (framework) {
    case 'MICRO_FRS105':
      return 'MICRO_ENTITY';
    case 'SMALL_FRS102_1A':
      return 'CA2006_S477_SMALL';
    case 'DORMANT':
      return 'DORMANT';
    default:
      return 'NOT_APPLICABLE';
  }
}

function getExemptionOptions(framework: AccountsSet['framework']): ExemptionOption[] {
  switch (framework) {
    case 'MICRO_FRS105':
      return [{ value: 'MICRO_ENTITY', label: 'Micro-entity exemption' }];
    case 'SMALL_FRS102_1A':
      return [
        {
          value: 'CA2006_S477_SMALL',
          label: 'Small company exemption (CA2006 S477)',
        },
      ];
    case 'DORMANT':
      return [{ value: 'DORMANT', label: 'Dormant company exemption' }];
    default:
      return [{ value: 'NOT_APPLICABLE', label: 'Not applicable' }];
  }
}

function getFrameworkDescription(framework: AccountsSet['framework']) {
  switch (framework) {
    case 'MICRO_FRS105':
      return 'Micro-entity accounts under FRS 105. Simplest form of statutory accounts for very small companies.';
    case 'SMALL_FRS102_1A':
      return 'Small company accounts under FRS 102 Section 1A. More detailed disclosure than micro-entity accounts.';
    case 'DORMANT':
      return 'Dormant company accounts. For companies with no significant accounting transactions during the period.';
    default:
      return 'Sole trader / individual accounts. Companies House disclosures and audit exemptions do not apply.';
  }
}

function buildDefaultSection(accountsSet: AccountsSet): FrameworkDisclosuresSection {
  const existing = accountsSet.sections.frameworkDisclosures;
  const framework = existing?.framework || accountsSet.framework;
  const soleTrader = isSoleTraderFramework(framework);
  const exemptionOptions = getExemptionOptions(framework);
  const fallbackExemptionKey = getDefaultExemptionKey(framework);

  const existingExemptionKey = existing?.auditExemption?.exemptionStatementKey;
  const validExemptionKey =
    existingExemptionKey &&
    exemptionOptions.some((option) => option.value === existingExemptionKey)
      ? existingExemptionKey
      : fallbackExemptionKey;

  return {
    framework,
    auditExemption: {
      isAuditExempt: soleTrader
        ? false
        : existing?.auditExemption?.isAuditExempt ?? true,
      exemptionStatementKey: soleTrader ? 'NOT_APPLICABLE' : validExemptionKey,
    },
    includePLInClientPack: existing?.includePLInClientPack ?? true,
    includeDetailedPL: existing?.includeDetailedPL ?? false,
    includeHmrcPL: existing?.includeHmrcPL ?? false,
    includeDirectorsReport: soleTrader
      ? false
      : existing?.includeDirectorsReport ?? false,
    includeAccountantsReport: existing?.includeAccountantsReport ?? false,
  };
}

export function FrameworkDisclosuresStep({ accountsSet, onUpdate }: Props) {
  const incomingData = useMemo(
    () => buildDefaultSection(accountsSet),
    [accountsSet]
  );

  const [formData, setFormData] = useState<FrameworkDisclosuresSection>(incomingData);

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

  const isSoleTrader = isSoleTraderFramework(formData.framework);
  const exemptionOptions = getExemptionOptions(formData.framework);

  const commit = (next: FrameworkDisclosuresSection) => {
    setFormData(next);
    onUpdate(next);
  };

  const handleFrameworkChange = (framework: AccountsSet['framework']) => {
    const soleTrader = isSoleTraderFramework(framework);
    const nextOptions = getExemptionOptions(framework);
    const fallbackExemptionKey = getDefaultExemptionKey(framework);

    const currentExemptionKey = formData.auditExemption?.exemptionStatementKey;
    const preservedExemptionKey =
      currentExemptionKey &&
      nextOptions.some((option) => option.value === currentExemptionKey)
        ? currentExemptionKey
        : fallbackExemptionKey;

    commit({
      ...formData,
      framework,
      auditExemption: {
        isAuditExempt: soleTrader ? false : formData.auditExemption?.isAuditExempt ?? true,
        exemptionStatementKey: soleTrader ? 'NOT_APPLICABLE' : preservedExemptionKey,
      },
      includeDirectorsReport: soleTrader ? false : formData.includeDirectorsReport,
    });
  };

  const handleAuditExemptChange = (checked: boolean) => {
    if (isSoleTrader) {
      return;
    }

    commit({
      ...formData,
      auditExemption: {
        isAuditExempt: checked,
        exemptionStatementKey: checked
          ? formData.auditExemption?.exemptionStatementKey ||
            getDefaultExemptionKey(formData.framework)
          : formData.auditExemption?.exemptionStatementKey ||
            getDefaultExemptionKey(formData.framework),
      },
    });
  };

  const handleExemptionKeyChange = (value: string) => {
    commit({
      ...formData,
      auditExemption: {
        ...formData.auditExemption,
        exemptionStatementKey: value,
      },
    });
  };

  const handleToggle =
    (field: 'includePLInClientPack' | 'includeDetailedPL' | 'includeHmrcPL' | 'includeDirectorsReport' | 'includeAccountantsReport') =>
    (checked: boolean) => {
      if (field === 'includeDirectorsReport' && isSoleTrader) {
        return;
      }

      commit({
        ...formData,
        [field]: checked,
      });
    };

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none';
  const cardCls = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';
  const h3Cls = 'mb-4 text-base font-bold text-slate-900';

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div className={cardCls}>
        <h3 className={h3Cls}>Accounting Framework</h3>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label className="mb-1 block text-sm font-medium">Framework *</label>
            <select
              className={inputCls}
              value={formData.framework}
              onChange={(e) =>
                handleFrameworkChange(e.target.value as AccountsSet['framework'])
              }
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

          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
            {getFrameworkDescription(formData.framework)}
          </div>
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Audit Exemption</h3>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={isSoleTrader ? false : formData.auditExemption.isAuditExempt}
              disabled={isSoleTrader}
              onChange={(e) => handleAuditExemptChange(e.target.checked)}
            />
            <span>
              {isSoleTrader
                ? 'Audit exemption is not applicable for sole trader / individual accounts'
                : 'Company is exempt from audit'}
            </span>
          </label>

          {isSoleTrader ? (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              Audit exemption statements are only relevant for company accounts.
            </div>
          ) : formData.auditExemption.isAuditExempt ? (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Exemption Statement *
              </label>
              <select
                className={inputCls}
                value={formData.auditExemption.exemptionStatementKey}
                onChange={(e) => handleExemptionKeyChange(e.target.value)}
              >
                {exemptionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              Audit exemption statement will be omitted because the company is marked as not exempt.
            </div>
          )}
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={h3Cls}>Additional Disclosures</h3>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={formData.includePLInClientPack}
              onChange={(e) => handleToggle('includePLInClientPack')(e.target.checked)}
            />
            <span>Include Profit &amp; Loss in client pack</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={formData.includeDetailedPL ?? false}
              onChange={(e) => handleToggle('includeDetailedPL')(e.target.checked)}
            />
            <span>Include Detailed Profit &amp; Loss</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={formData.includeHmrcPL ?? false}
              onChange={(e) => handleToggle('includeHmrcPL')(e.target.checked)}
            />
            <span>Include HMRC Detailed Profit &amp; Loss</span>
          </label>

          {!isSoleTrader && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={formData.includeDirectorsReport}
                onChange={(e) =>
                  handleToggle('includeDirectorsReport')(e.target.checked)
                }
              />
              <span>Include Directors&apos; Report</span>
            </label>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={formData.includeAccountantsReport}
              onChange={(e) =>
                handleToggle('includeAccountantsReport')(e.target.checked)
              }
            />
            <span>Include Accountants&apos; Report</span>
          </label>
        </div>
      </div>
    </div>
  );
}