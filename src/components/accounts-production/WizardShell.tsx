import { ReactNode } from 'react';
import type { AccountsSet, WizardStep, WizardStepConfig, AutosaveState } from '@/types/accounts-production';

interface WizardShellProps {
  steps: WizardStepConfig[];
  currentStep: WizardStep;
  accountsSet: AccountsSet;
  onStepChange: (step: WizardStep) => void;
  autosaveState: AutosaveState;
  children: ReactNode;
}

export function WizardShell({ steps, currentStep, accountsSet, onStepChange, autosaveState, children }: WizardShellProps) {
  const currentStepIndex = steps.findIndex(s => s.key === currentStep);
  const currentStepConfig = steps[currentStepIndex];

  const canNavigateToStep = (index: number) => {
    if (index <= currentStepIndex) return true;
    if (index === currentStepIndex + 1) {
      return !!(currentStepConfig?.isComplete(accountsSet) && !currentStepConfig?.hasErrors(accountsSet));
    }
    return false;
  };

  const getStepStatus = (step: WizardStepConfig, index: number) => {
    if (step.key === currentStep) return 'current';
    if (step.hasErrors(accountsSet)) return 'error';
    if (step.isComplete(accountsSet)) return 'complete';
    if (canNavigateToStep(index)) return 'available';
    return 'disabled';
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1 && canNavigateToStep(currentStepIndex + 1)) {
      onStepChange(steps[currentStepIndex + 1].key);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) onStepChange(steps[currentStepIndex - 1].key);
  };

  const formatLastSaved = (date: Date | null) => {
    if (!date) return '';
    const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSeconds < 60) return 'just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const completedSteps = steps.filter(s => s.isComplete(accountsSet)).length;
  const progressPct = Math.round((completedSteps / steps.length) * 100);

  const stepButtonClass = (status: string, canNav: boolean) => {
    const base = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition';
    if (status === 'current') return `${base} bg-violet-600 border-violet-600 text-white`;
    if (status === 'complete') return `${base} bg-emerald-50 border-emerald-200 text-emerald-700 ${canNav ? 'cursor-pointer hover:bg-emerald-100' : ''}`;
    if (status === 'error') return `${base} bg-rose-50 border-rose-200 text-rose-700 ${canNav ? 'cursor-pointer hover:bg-rose-100' : ''}`;
    if (status === 'disabled') return `${base} bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60`;
    return `${base} bg-white border-slate-200 text-slate-700 ${canNav ? 'cursor-pointer hover:bg-slate-50' : ''}`;
  };

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{currentStepConfig?.title}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{currentStepConfig?.description}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {autosaveState.isSaving && (
              <span className="flex items-center gap-1.5 text-slate-500">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Saving...
              </span>
            )}
            {!autosaveState.isSaving && autosaveState.lastSaved && (
              <span className="text-slate-400">Saved {formatLastSaved(autosaveState.lastSaved)}</span>
            )}
            {autosaveState.error && (
              <span className="text-rose-600">Save failed: {autosaveState.error}</span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="mb-1.5 flex justify-between text-xs text-slate-500">
            <span>{completedSteps} of {steps.length} steps complete</span>
            <span className="font-semibold text-violet-600">{progressPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-violet-600 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Step tabs */}
        <div className="flex flex-wrap gap-2">
          {steps.map((step, index) => {
            const status = getStepStatus(step, index);
            const canNav = canNavigateToStep(index);
            return (
              <button
                key={step.key}
                onClick={() => canNav && onStepChange(step.key)}
                disabled={!canNav}
                className={stepButtonClass(status, canNav)}
              >
                <span>
                  {status === 'complete' ? '✓' : status === 'error' ? '!' : status === 'current' ? '●' : index + 1}
                </span>
                {step.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div>{children}</div>

      {/* Navigation footer */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStepIndex === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
          >
            ← Previous
          </button>

          <div className="flex items-center gap-3 text-sm">
            {accountsSet.validation.errors.length > 0 && (
              <span className="font-semibold text-rose-600">
                ! {accountsSet.validation.errors.length} error{accountsSet.validation.errors.length !== 1 ? 's' : ''}
              </span>
            )}
            {accountsSet.validation.warnings.length > 0 && (
              <span className="font-semibold text-amber-600">
                ⚠ {accountsSet.validation.warnings.length} warning{accountsSet.validation.warnings.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <button
            onClick={handleNext}
            disabled={currentStepIndex === steps.length - 1 || !canNavigateToStep(currentStepIndex + 1)}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
