// Accounts Production Types

export type AccountingFramework =
  | 'MICRO_FRS105'
  | 'SMALL_FRS102_1A'
  | 'DORMANT'
  | 'SOLE_TRADER'
  | 'INDIVIDUAL';

export type AccountsSetStatus = 'DRAFT' | 'IN_PROGRESS' | 'IN_REVIEW' | 'READY' | 'LOCKED';
export type DepreciationMethod = 'STRAIGHT_LINE' | 'REDUCING_BALANCE';
export type ExemptionStatementKey =
  | 'CA2006_S477_SMALL'
  | 'MICRO_ENTITY'
  | 'DORMANT'
  | 'NOT_APPLICABLE';
export type SignatureType = 'TYPED_NAME' | 'UPLOADED_SIGNATURE';

export interface APAddress {
  line1: string;
  line2?: string;
  town?: string;
  county?: string;
  postcode: string;
  country: string;
}

export interface Director {
  name: string;
  appointedDate?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  section?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  section?: string;
}

export interface CompanyPeriodSection {
  framework: AccountingFramework;
  company: {
    name: string;
    companyNumber?: string;
    registeredOffice: APAddress;
    directors?: Director[];
    sicCode?: string;
    sicDescription?: string;
  };
  period: {
    startDate: string;
    endDate: string;
    isFirstYear: boolean;
  };
  accountant?: {
    name?: string;
    firmName?: string;
    address?: APAddress;
    signedDate?: string;
  };
}

export interface FrameworkDisclosuresSection {
  framework: AccountingFramework;
  auditExemption: {
    isAuditExempt: boolean;
    exemptionStatementKey: ExemptionStatementKey;
  };
  includePLInClientPack: boolean;
  includeDetailedPL: boolean;
  includeHmrcPL: boolean;
  includeDirectorsReport: boolean;
  includeAccountantsReport: boolean;
}

export interface AccountingPoliciesSection {
  basisOfPreparation: string;
  goingConcern: {
    isGoingConcern: boolean;
    noteText?: string;
  };
  turnoverPolicyText?: string;
  operatingLeases?: { include: boolean; policyText?: string };
  financeCosts?: { include: boolean; policyText?: string };
  interestReceivable?: { include: boolean };
  governmentGrants?: { include: boolean; policyText?: string };
  currentTaxation?: { include: boolean; policyText?: string };
  deferredTax?: { include: boolean; policyText?: string };
  tangibleFixedAssets?: {
    hasAssets: boolean;
    policyText?: string;
    depreciationRates?: Array<{ category: string; ratePercent: number; method: DepreciationMethod }>;
  };
  intangibleAssets?: { include: boolean; policyText?: string };
  stocks?: { include: boolean; policyText?: string };
  investments?: { include: boolean; policyText?: string };
  tradeDebtors?: { include: boolean };
  tradeCreditors?: { include: boolean };
  relatedParties?: { include: boolean };
}

export interface ProfitAndLossLines {
  turnover: number;
  costOfSales: number;
  grossProfit?: number; // derived
  otherOperatingIncome: number;
  adminExpenses: number;
  distributionCosts: number;
  wages: number;
  rent: number;
  rates: number;
  lightAndHeat: number;
  cleaning: number;
  serviceCharges: number;
  motor: number;
  travel: number;
  advertising: number;
  computerSoftware: number;
  subscriptions: number;
  insurance: number;
  repairsMaintenance: number;
  sundryExpenses: number;
  supportAdminCosts: number;
  donations: number;
  hirePlantMachinery: number;
  telephoneInternet: number;
  printingPostage: number;
  professionalFees: number;
  accountancyFees: number;
  consultancyFees: number;
  legalFees: number;
  otherExpenses: number;
  depreciation: number;
  amortisation: number;
  interestReceivable: number;
  interestPayable: number;
  financeCharges: number;
  bankCharges: number;
  taxCharge: number;
  dividendsDeclared: number;
}

export interface ProfitAndLossSection {
  lines: ProfitAndLossLines;
  comparatives?: { priorYearLines: ProfitAndLossLines };
}

export interface FixedAssets {
  tangibleFixedAssets: number;
  intangibleAssets: number;
  investments: number;
}

export interface CurrentAssets {
  stock: number;
  debtors: number;
  cash: number;
  prepayments: number;
}

export interface Creditors {
  bankLoans: number;
  tradeCreditors: number;
  groupUndertakings: number;
  taxes: number;
  accrualsDeferredIncome: number;
  directorsLoan: number;
  otherCreditors: number;
}

export interface CreditorsAfterOneYear {
  loans: number;
  other: number;
}

export interface Equity {
  shareCapital: number;
  sharePremium: number;
  revaluationReserve: number;
  retainedEarnings: number;
  otherReserves: number;
}

export interface BalanceSheetData {
  assets: { fixedAssets: FixedAssets; currentAssets: CurrentAssets };
  liabilities: {
    creditorsWithinOneYear: Creditors;
    creditorsAfterOneYear: CreditorsAfterOneYear;
  };
  provisions?: number;
  equity: Equity;
}

export interface BalanceSheetSection extends BalanceSheetData {
  comparatives?: { prior: BalanceSheetData };
}

export interface ShareClass {
  shareClass: string;
  numberOfShares: number;
  nominalValue: number;
  currency: string;
}

export interface TangibleAssetCategory {
  name: string;
  costBfwd: number;
  additions: number;
  disposals: number;
  costCfwd: number;
  depnBfwd: number;
  depnCharge: number;
  depnOnDisposals: number;
  depnCfwd: number;
  nbvCurrent: number;
  nbvPrior: number;
}

export interface IntangibleAssetCategory {
  name: string;
  costBfwd: number;
  additions: number;
  disposals: number;
  costCfwd: number;
  amortBfwd: number;
  amortCharge: number;
  amortOnDisposals: number;
  amortCfwd: number;
  nbvCurrent: number;
  nbvPrior: number;
}

export interface DebtorBreakdown {
  tradeDebtors: number;
  otherDebtors: number;
  prepayments: number;
  accrued: number;
}

export interface CreditorBreakdown {
  bankLoans: number;
  tradeCreditors: number;
  groupUndertakings: number;
  otherCreditors: number;
  directorsLoan: number;
  taxationSocialSecurity: number;
  accrualsDeferredIncome: number;
}

export interface DeferredTaxNote {
  include: boolean;
  otherTimingDifferences: number;
  priorOtherTimingDifferences?: number;
}

export interface DirectorsRemunerationNote {
  include: boolean;
  aggregateRemuneration: number;
  pensionContributions: number;
  priorAggregateRemuneration?: number;
  priorPensionContributions?: number;
}

export interface NotesSection {
  principalActivity?: string;
  countryOfIncorporation: string;
  employees?: { include: boolean; averageEmployees?: number; priorAverageEmployees?: number };
  shareClasses?: ShareClass[];
  revaluationReserve?: { openingBalance: number; closingBalance: number };
  dividends?: { declared: boolean; totalAmount?: number; perShare?: number };
  tangibleAssetCategories?: TangibleAssetCategory[];
  intangibleAssetCategories?: IntangibleAssetCategory[];
  debtorBreakdown?: DebtorBreakdown;
  priorDebtorBreakdown?: DebtorBreakdown;
  creditorBreakdownWithin?: CreditorBreakdown;
  priorCreditorBreakdownWithin?: CreditorBreakdown;
  creditorBreakdownAfter?: { loans: number; other: number };
  priorCreditorBreakdownAfter?: { loans: number; other: number };
  deferredTax?: DeferredTaxNote;
  directorsRemuneration?: DirectorsRemunerationNote;
  eventsAfterReportingDate?: { include: boolean; text?: string };
  relatedParties?: { include: boolean; text?: string };
  additionalNotes?: Array<{ title: string; text: string }>;
}

export interface DirectorsApprovalSection {
  approved: boolean;
  directorName?: string;
  approvalDate?: string;
  signatureType?: SignatureType;
}

export interface AccountsSet {
  id: string;
  clientId?: string | null;
  companyNumber: string;
  framework: AccountingFramework;
  status: AccountsSetStatus;
  period: { startDate: string; endDate: string; isFirstYear: boolean };
  sections: {
    companyPeriod?: CompanyPeriodSection;
    frameworkDisclosures?: FrameworkDisclosuresSection;
    accountingPolicies?: AccountingPoliciesSection;
    profitAndLoss?: ProfitAndLossSection;
    balanceSheet?: BalanceSheetSection;
    notes?: NotesSection;
    directorsApproval?: DirectorsApprovalSection;
  };
  validation: {
    errors: ValidationError[];
    warnings: ValidationWarning[];
    isBalanced: boolean;
  };
  outputs: { htmlUrl: string | null; pdfUrl: string | null };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastEditedBy: string;
}

// Wizard types
export type WizardStep =
  | 'companyPeriod'
  | 'frameworkDisclosures'
  | 'accountingPolicies'
  | 'profitAndLoss'
  | 'balanceSheet'
  | 'notes'
  | 'directorsApproval'
  | 'reviewAndOutputs';

export interface WizardStepConfig {
  key: WizardStep;
  title: string;
  description: string;
  isComplete: (accountsSet: AccountsSet) => boolean;
  hasErrors: (accountsSet: AccountsSet) => boolean;
}

export interface AutosaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  error: string | null;
}
