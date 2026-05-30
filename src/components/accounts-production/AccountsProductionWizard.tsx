import { useState, useCallback, useRef, useEffect } from 'react';
import { WizardShell } from './WizardShell';
import { CompanyPeriodStep } from './steps/CompanyPeriodStep';
import { FrameworkDisclosuresStep } from './steps/FrameworkDisclosuresStep';
import { AccountingPoliciesStep } from './steps/AccountingPoliciesStep';
import { ProfitAndLossStep } from './steps/ProfitAndLossStep';
import { BalanceSheetStep } from './steps/BalanceSheetStep';
import { NotesStep } from './steps/NotesStep';
import { DirectorsApprovalStep } from './steps/DirectorsApprovalStep';
import { ReviewAndOutputsStep } from './steps/ReviewAndOutputsStep';
import { useSettings } from '@/contexts/SettingsContext';
import type { AccountsSet, WizardStep, WizardStepConfig, AutosaveState } from '@/types/accounts-production';

const CDS_API_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CDS_API_URL) ||
  'http://localhost:3003';

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function patchSection(accountsSetId: string, sectionKey: string, data: unknown): Promise<AccountsSet> {
  const res = await fetch(`${CDS_API_BASE}/accounts-sets/${accountsSetId}/sections/${sectionKey}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = JSON.parse(text)?.message || text; } catch { /* noop */ }
    throw new Error(msg || `Save failed: ${res.status}`);
  }
  return res.json() as Promise<AccountsSet>;
}

async function fetchAccountsSet(id: string): Promise<AccountsSet> {
  const res = await fetch(`${CDS_API_BASE}/accounts-sets/${id}`, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to load accounts set: ${res.status}`);
  const json = await res.json();
  return json.accountsSet ?? json;
}

const WIZARD_STEPS: WizardStepConfig[] = [
  {
    key: 'companyPeriod',
    title: 'Client & Period',
    description: 'Client information and accounting period',
    // Complete if we have a name and period dates — company number is a warning not a blocker
    isComplete: (a) => {
      const s = a.sections.companyPeriod;
      if (!s) return false;
      return !!(s.company.name && s.period.startDate && s.period.endDate);
    },
    hasErrors: (a) => a.validation.errors.some(e => e.section === 'companyPeriod'),
  },
  {
    key: 'frameworkDisclosures',
    title: 'Framework & Disclosures',
    description: 'Accounting framework and disclosure options',
    // Complete if framework is set — exemption key has a sensible default
    isComplete: (a) => !!(a.sections.frameworkDisclosures?.framework),
    hasErrors: (a) => a.validation.errors.some(e => e.section === 'frameworkDisclosures'),
  },
  {
    key: 'accountingPolicies',
    title: 'Accounting Policies',
    description: 'Accounting policies and basis of preparation',
    // Complete if section exists with any basis of preparation text
    isComplete: (a) => !!(a.sections.accountingPolicies?.basisOfPreparation),
    hasErrors: (a) => a.validation.errors.some(e => e.section === 'accountingPolicies'),
  },
  {
    key: 'profitAndLoss',
    title: 'Profit & Loss',
    description: 'Income statement figures and calculations',
    // Complete if section exists with lines (even all zeros is valid for dormant)
    isComplete: (a) => !!(a.sections.profitAndLoss?.lines),
    hasErrors: (a) => a.validation.errors.some(e => e.section === 'profitAndLoss'),
  },
  {
    key: 'balanceSheet',
    title: 'Balance Sheet',
    description: 'Statement of financial position',
    // Complete if section exists with assets/liabilities/equity
    isComplete: (a) => !!(a.sections.balanceSheet?.assets && a.sections.balanceSheet?.equity),
    hasErrors: (a) => a.validation.errors.some(e => e.section === 'balanceSheet'),
  },
  {
    key: 'notes',
    title: 'Notes',
    description: 'Additional notes and disclosures',
    // Complete if section exists — country of incorporation has a default
    isComplete: (a) => !!(a.sections.notes?.countryOfIncorporation),
    hasErrors: (a) => a.validation.errors.some(e => e.section === 'notes'),
  },
  {
    key: 'directorsApproval',
    title: 'Directors Approval',
    description: 'Director approval and signing',
    // Complete if approved with a director name and date
    isComplete: (a) => {
      const s = a.sections.directorsApproval;
      return !!(s?.approved === true && s?.directorName && s?.approvalDate);
    },
    hasErrors: (a) => a.validation.errors.some(e => e.section === 'directorsApproval'),
  },
  {
    key: 'reviewAndOutputs',
    title: 'Review & Outputs',
    description: 'Final review and output generation',
    isComplete: (a) => a.status === 'READY' || a.status === 'LOCKED',
    hasErrors: (a) => a.validation.errors.length > 0,
  },
];

interface Props {
  accountsSet: AccountsSet;
  onUpdate: (updated: AccountsSet) => void;
}

// Per-section save queue: tracks the latest pending save per section key
// so stale responses from earlier saves cannot overwrite newer local state.
interface PendingSave {
  version: number;
  timer: ReturnType<typeof setTimeout>;
}

export function AccountsProductionWizard({ accountsSet, onUpdate }: Props) {
  const { settings } = useSettings();
  const [currentStep, setCurrentStep] = useState<WizardStep>('companyPeriod');
  const [autosave, setAutosave] = useState<AutosaveState>({
    isSaving: false,
    lastSaved: null,
    hasUnsavedChanges: false,
    error: null,
  });

  // Per-section debounce timers and version counters
  const pendingSaves = useRef<Map<string, PendingSave>>(new Map());
  // Track the latest committed version per section to detect stale responses
  const committedVersions = useRef<Map<string, number>>(new Map());
  const isMounted = useRef(true);
  // Track whether we've done the initial practice-settings prefill
  const didPrefill = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Cancel all pending timers on unmount
      pendingSaves.current.forEach(p => clearTimeout(p.timer));
      pendingSaves.current.clear();
    };
  }, []);

  // Fetch latest on mount — but only update if no local edits are pending
  useEffect(() => {
    fetchAccountsSet(accountsSet.id)
      .then(latest => {
        if (!isMounted.current) return;
        // Only apply if we have no pending saves (no local edits in flight)
        if (pendingSaves.current.size === 0) {
          onUpdate(latest);
        }
      })
      .catch(() => { /* silently fall back to prop data */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsSet.id]);

  // One-time prefill of accountant block from practice settings if not already set
  useEffect(() => {
    if (didPrefill.current) return;
    if (!settings.companyName && !settings.address) return;
    const existing = accountsSet.sections.companyPeriod;
    if (existing?.accountant?.firmName) return; // already has data
    didPrefill.current = true;

    const prefilled = {
      ...(existing || {
        framework: accountsSet.framework,
        company: { name: '', registeredOffice: { line1: '', postcode: '', country: 'England' } },
        period: accountsSet.period || { startDate: '', endDate: '', isFirstYear: true },
      }),
      accountant: {
        name: existing?.accountant?.name || settings.fullName || '',
        firmName: existing?.accountant?.firmName || settings.companyName || '',
        address: {
          line1: existing?.accountant?.address?.line1 || settings.address || '',
          town: existing?.accountant?.address?.town || settings.city || '',
          postcode: existing?.accountant?.address?.postcode || settings.postcode || '',
          country: existing?.accountant?.address?.country || 'England',
        },
        signedDate: existing?.accountant?.signedDate || '',
      },
    };
    handleSectionUpdate('companyPeriod', prefilled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, accountsSet.id]);

  const triggerSave = useCallback((sectionKey: string, data: unknown, currentAccountsSet: AccountsSet) => {
    // Increment version for this section
    const prevVersion = committedVersions.current.get(sectionKey) ?? 0;
    const version = prevVersion + 1;
    committedVersions.current.set(sectionKey, version);

    // Cancel any existing debounce for this section
    const existing = pendingSaves.current.get(sectionKey);
    if (existing) clearTimeout(existing.timer);

    setAutosave(prev => ({ ...prev, hasUnsavedChanges: true, error: null }));

    const timer = setTimeout(async () => {
      if (!isMounted.current) return;
      pendingSaves.current.delete(sectionKey);

      try {
        setAutosave(prev => ({ ...prev, isSaving: true }));
        const updated = await patchSection(currentAccountsSet.id, sectionKey, data);
        if (!isMounted.current) return;

        // Only apply server response if this is still the latest version for this section
        const latestVersion = committedVersions.current.get(sectionKey) ?? 0;
        if (version >= latestVersion) {
          onUpdate(updated);
        }

        setAutosave(prev => ({
          ...prev,
          isSaving: pendingSaves.current.size > 0,
          lastSaved: new Date(),
          hasUnsavedChanges: pendingSaves.current.size > 0,
        }));
      } catch (err: unknown) {
        if (!isMounted.current) return;
        const msg = err instanceof Error ? err.message : 'Failed to save';
        setAutosave(prev => ({ ...prev, isSaving: false, error: msg }));
      }
    }, 750);

    pendingSaves.current.set(sectionKey, { version, timer });
  }, [onUpdate]);

  const handleSectionUpdate = useCallback((sectionKey: string, data: unknown) => {
    // Optimistic update — apply immediately to local state
    const optimistic: AccountsSet = {
      ...accountsSet,
      sections: { ...accountsSet.sections, [sectionKey]: data },
      updatedAt: new Date().toISOString(),
    };
    onUpdate(optimistic);
    triggerSave(sectionKey, data, optimistic);
  }, [accountsSet, onUpdate, triggerSave]);

  const renderStep = () => {
    switch (currentStep) {
      case 'companyPeriod':
        return <CompanyPeriodStep accountsSet={accountsSet} onUpdate={d => handleSectionUpdate('companyPeriod', d)} />;
      case 'frameworkDisclosures':
        return <FrameworkDisclosuresStep accountsSet={accountsSet} onUpdate={d => handleSectionUpdate('frameworkDisclosures', d)} />;
      case 'accountingPolicies':
        return <AccountingPoliciesStep accountsSet={accountsSet} onUpdate={d => handleSectionUpdate('accountingPolicies', d)} />;
      case 'profitAndLoss':
        return <ProfitAndLossStep accountsSet={accountsSet} onUpdate={d => handleSectionUpdate('profitAndLoss', d)} />;
      case 'balanceSheet':
        return <BalanceSheetStep accountsSet={accountsSet} onUpdate={d => handleSectionUpdate('balanceSheet', d)} />;
      case 'notes':
        return <NotesStep accountsSet={accountsSet} onUpdate={d => handleSectionUpdate('notes', d)} />;
      case 'directorsApproval':
        return <DirectorsApprovalStep accountsSet={accountsSet} onUpdate={d => handleSectionUpdate('directorsApproval', d)} />;
      case 'reviewAndOutputs':
        return <ReviewAndOutputsStep accountsSet={accountsSet} onUpdate={onUpdate} />;
      default:
        return null;
    }
  };

  return (
    <WizardShell
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      accountsSet={accountsSet}
      onStepChange={setCurrentStep}
      autosaveState={autosave}
    >
      {renderStep()}
    </WizardShell>
  );
}
