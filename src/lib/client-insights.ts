import type { Contact, ClientTask } from '@/types';

export type AgreementStatus = 'active' | 'expiring' | 'required' | 'pending';
export type AuthorisationStatus = 'valid' | 'expiring' | 'missing';
export type DocumentStatus = 'complete' | 'draft' | 'missing';

export interface ClientMeta {
  deferredAccountNumber?: string;
  cdsAgreement: {
    status: AgreementStatus;
    expiresOn?: string;
  };
  agentAuthorisation: {
    status: AuthorisationStatus;
    expiresOn?: string;
  };
  cdsData: {
    declarations: number;
    anomalies: number;
    overpayments: number;
    lastImport?: string;
  };
  claims: {
    total: number;
    inProgress: number;
    approved: number;
    estimatedRefund: number;
    lastClaimDate?: string;
  };
  potentialRefunds: {
    id: string;
    summary: string;
    amount: number;
    reason: string;
    status: 'identified' | 'draft' | 'ready';
    commodityCode?: string;
  }[];
  documents: {
    name: string;
    status: DocumentStatus;
    description: string;
    updated?: string;
  }[];
  tasks: ClientTask[];
  complianceFlags: {
    label: string;
    status: 'ok' | 'warning' | 'alert';
    description: string;
  }[];
  alerts: string[];
}

export interface ClientProfile {
  id: string;
  contact: Contact;
  eori?: string;
  vatNumber?: string;
  bankStatus: 'complete' | 'missing';
  deferredAccountNumber?: string;
  cdsAgreement: ClientMeta['cdsAgreement'];
  agentAuthorisation: ClientMeta['agentAuthorisation'];
  cdsData: ClientMeta['cdsData'];
  claims: ClientMeta['claims'];
  potentialRefunds: ClientMeta['potentialRefunds'];
  documents: ClientMeta['documents'];
  tasks: ClientMeta['tasks'];
  complianceFlags: ClientMeta['complianceFlags'];
  alerts: ClientMeta['alerts'];
  missingFields: string[];
}

const defaultMeta: ClientMeta = {
  deferredAccountNumber: undefined,
  cdsAgreement: { status: 'required' },
  agentAuthorisation: { status: 'missing' },
  cdsData: { declarations: 0, anomalies: 0, overpayments: 0 },
  claims: { total: 0, inProgress: 0, approved: 0, estimatedRefund: 0 },
  potentialRefunds: [],
  documents: [],
  tasks: [],
  complianceFlags: [],
  alerts: [],
};

const automationMeta: Record<string, ClientMeta> = {
  GB123456789000: {
    deferredAccountNumber: '1234567',
    cdsAgreement: { status: 'active', expiresOn: '2025-09-14' },
    agentAuthorisation: { status: 'valid', expiresOn: '2025-05-01' },
    cdsData: { declarations: 248, anomalies: 7, overpayments: 4, lastImport: '2025-01-08' },
    claims: {
      total: 9,
      inProgress: 2,
      approved: 5,
      estimatedRefund: 184000,
      lastClaimDate: '2024-12-12',
    },
    potentialRefunds: [
      {
        id: 'pf-1',
        summary: 'Incorrect tariff code (8471.41 vs 8471.49)',
        amount: 24500,
        reason: 'Tariff Code',
        status: 'draft',
        commodityCode: '84714900',
      },
      {
        id: 'pf-2',
        summary: 'Preference not applied (UK-South Korea FTA)',
        amount: 18750,
        reason: 'Preference',
        status: 'identified',
        commodityCode: '90189084',
      },
    ],
    documents: [
      {
        name: 'Schedule D Cover Letter',
        status: 'complete',
        description: 'Signed 2025 pack',
        updated: '2025-01-05',
      },
      {
        name: 'CDS Agreement',
        status: 'complete',
        description: 'Expires Sep 2025',
        updated: '2024-09-14',
      },
      {
        name: 'Authority Letter',
        status: 'complete',
        description: 'Agent refund authority on file',
        updated: '2024-05-01',
      },
    ],
    tasks: [
      {
        id: 'task-1',
        title: 'Upload Jan CDS header report',
        dueDate: '2025-01-15',
        status: 'open',
      },
      {
        id: 'task-2',
        title: 'Prepare C285 pack for MRN 23GB001...',
        dueDate: '2025-01-10',
        status: 'overdue',
      },
    ],
    complianceFlags: [
      { label: 'CDS Agreement', status: 'ok', description: 'Active until Sep 2025' },
      { label: 'Agent Authority', status: 'ok', description: 'Valid through May 2025' },
    ],
    alerts: [
      'Overpayment detected on MRN 23GB0012345678901',
      'Agent authority renewal due in 90 days',
    ],
  },
  GB987654321000: {
    deferredAccountNumber: '7700456',
    cdsAgreement: { status: 'expiring', expiresOn: '2025-02-28' },
    agentAuthorisation: { status: 'expiring', expiresOn: '2025-03-10' },
    cdsData: { declarations: 132, anomalies: 5, overpayments: 3, lastImport: '2025-01-05' },
    claims: {
      total: 6,
      inProgress: 3,
      approved: 2,
      estimatedRefund: 96000,
      lastClaimDate: '2024-11-18',
    },
    potentialRefunds: [
      {
        id: 'pf-3',
        summary: 'Preference not applied (EU-Canada CETA)',
        amount: 42200,
        reason: 'Preference',
        status: 'draft',
        commodityCode: '39076020',
      },
    ],
    documents: [
      {
        name: 'Schedule D Cover Letter',
        status: 'draft',
        description: 'Need updated EORI list',
        updated: '2025-01-03',
      },
      {
        name: 'CDS Agreement',
        status: 'complete',
        description: 'Expires Feb 2025',
        updated: '2024-02-28',
      },
    ],
    tasks: [
      { id: 'task-3', title: 'Renew CDS agreement', dueDate: '2025-02-01', status: 'open' },
      { id: 'task-4', title: 'Collect deferred statements', dueDate: '2025-01-18', status: 'open' },
    ],
    complianceFlags: [
      { label: 'CDS Agreement', status: 'warning', description: 'Expires in 55 days' },
      { label: 'Agent Authority', status: 'warning', description: 'Expires in 64 days' },
      { label: 'Bank Details', status: 'ok', description: 'Verified Oct 2024' },
    ],
    alerts: ['CDS agreement renewal due', 'Outstanding evidence pack for MRN 23GB0010...'],
  },
  GB456789123000: {
    cdsAgreement: { status: 'required' },
    agentAuthorisation: { status: 'missing' },
    cdsData: { declarations: 0, anomalies: 0, overpayments: 0 },
    claims: { total: 0, inProgress: 0, approved: 0, estimatedRefund: 0 },
    potentialRefunds: [],
    documents: [
      { name: 'Schedule D Cover Letter', status: 'missing', description: 'Not generated' },
      { name: 'CDS Agreement', status: 'missing', description: 'Needs signature' },
    ],
    tasks: [
      { id: 'task-5', title: 'Kick-off onboarding call', dueDate: '2025-01-09', status: 'open' },
    ],
    complianceFlags: [
      { label: 'CDS Agreement', status: 'alert', description: 'No agreement on file' },
      { label: 'EORI Verification', status: 'warning', description: 'Awaiting HMRC confirmation' },
    ],
    alerts: ['Importer missing CDS agreement', 'No CDS data imported yet'],
  },
  GB789123456000: {
    deferredAccountNumber: '9032111',
    cdsAgreement: { status: 'active', expiresOn: '2025-11-02' },
    agentAuthorisation: { status: 'valid', expiresOn: '2025-06-30' },
    cdsData: { declarations: 88, anomalies: 1, overpayments: 1, lastImport: '2024-12-19' },
    claims: {
      total: 4,
      inProgress: 1,
      approved: 3,
      estimatedRefund: 64000,
      lastClaimDate: '2024-10-06',
    },
    potentialRefunds: [
      {
        id: 'pf-4',
        summary: 'Valuation method adjustment',
        amount: 12500,
        reason: 'Valuation',
        status: 'ready',
        commodityCode: '04029990',
      },
    ],
    documents: [
      { name: 'CDS Agreement', status: 'complete', description: 'Active', updated: '2024-11-02' },
      {
        name: 'Authority Letter',
        status: 'complete',
        description: 'Uploaded Jul 2024',
        updated: '2024-07-01',
      },
    ],
    tasks: [
      {
        id: 'task-6',
        title: 'Submit MRN variance analysis',
        dueDate: '2025-01-20',
        status: 'open',
      },
    ],
    complianceFlags: [
      { label: 'CDS Agreement', status: 'ok', description: 'Active' },
      { label: 'Agent Authority', status: 'ok', description: 'Valid' },
    ],
    alerts: [],
  },
  GB321654987000: {
    cdsAgreement: { status: 'pending' },
    agentAuthorisation: { status: 'missing' },
    cdsData: { declarations: 14, anomalies: 0, overpayments: 0, lastImport: '2024-12-30' },
    claims: {
      total: 1,
      inProgress: 1,
      approved: 0,
      estimatedRefund: 18500,
      lastClaimDate: '2024-12-01',
    },
    potentialRefunds: [
      {
        id: 'pf-5',
        summary: 'Preference claim waiting for certificates',
        amount: 18500,
        reason: 'Preference',
        status: 'draft',
        commodityCode: '64039110',
      },
    ],
    documents: [
      {
        name: 'CDS Agreement',
        status: 'draft',
        description: 'Sent to importer for signature',
        updated: '2024-12-22',
      },
    ],
    tasks: [
      {
        id: 'task-7',
        title: 'Chase importer for CDS agreement signature',
        dueDate: '2025-01-07',
        status: 'overdue',
      },
      {
        id: 'task-8',
        title: 'Upload preference certificates',
        dueDate: '2025-01-25',
        status: 'open',
      },
    ],
    complianceFlags: [
      { label: 'CDS Agreement', status: 'warning', description: 'Awaiting signature' },
      { label: 'Agent Authority', status: 'alert', description: 'No authority on file' },
    ],
    alerts: ['Awaiting CDS agreement signature'],
  },
};

export function buildClientProfile(contact: Contact): ClientProfile {
  const meta = automationMeta[contact.eori || contact.id] || defaultMeta;
  const now = new Date();
  const hasBankDetails = Boolean(contact.bank_account_number && contact.bank_sort_code);
  const isIndividualClient =
    contact.type === 'individual' || contact.engagement_type === 'individual';
  const requiresEngagement = contact.type !== 'hmrc';
  const fieldStatus = contact.field_statuses || {};
  const isNotApplicable = (key: string) => fieldStatus[key] === 'not_applicable';
  const isCoveredStatus = (key: string) =>
    fieldStatus[key] === 'not_applicable' || fieldStatus[key] === 'applied_for';

  const dynamicMissingFields = [
    !contact.utr ? 'UTR' : null,
    !isCoveredStatus('vat_number') && !contact.vat_number ? 'VAT Number' : null,
    requiresEngagement && !isNotApplicable('engagement_letter_signed_date') && !contact.engagement_letter_signed_date ? 'Signed Engagement Letter' : null,
    !isNotApplicable('id_verified') && contact.id_verified === false ? 'ID Verification' : null,
    !isNotApplicable('source_of_funds_checked') && contact.source_of_funds_checked === false ? 'Source of Funds Check' : null,
  ].filter(Boolean) as string[];

  const dynamicAlerts: string[] = [];

  if (requiresEngagement && !contact.engagement_letter_signed_date) {
    dynamicAlerts.push('Engagement letter is unsigned. Client authority is incomplete.');
  }

  if (contact.billing_model === 'monthly_dd' && contact.direct_debit_mandate_signed !== true) {
    dynamicAlerts.push('Monthly direct debit billing is selected but mandate is not signed.');
  }

  if (contact.aml_risk_rating === 'high') {
    dynamicAlerts.push('AML risk rating is high. Escalate to partner review.');
  } else if (contact.aml_risk_rating === 'medium') {
    dynamicAlerts.push('AML risk rating is medium. Monitor and review controls.');
  }

  if (contact.aml_review_date) {
    const amlReviewDate = new Date(contact.aml_review_date);
    if (!Number.isNaN(amlReviewDate.getTime()) && amlReviewDate < now) {
      dynamicAlerts.push('AML review date has passed and requires immediate refresh.');
    }
  }

  const vatReminderDate = getNextVatDueDate(contact.vat_stagger || contact.vat_frequency);
  if (vatReminderDate && contact.vat_number) {
    dynamicAlerts.push(
      `Next VAT return (${(contact.vat_stagger || contact.vat_frequency || '').toUpperCase()}) due ${vatReminderDate}.`
    );
  }

  const missingFields = Array.from(new Set(dynamicMissingFields));
  const alerts = Array.from(new Set([...meta.alerts, ...dynamicAlerts]));

  return {
    id: contact.id,
    contact,
    eori: contact.eori,
    vatNumber: contact.vat_number,
    bankStatus: hasBankDetails ? 'complete' : 'missing',
    deferredAccountNumber: meta.deferredAccountNumber,
    cdsAgreement: meta.cdsAgreement,
    agentAuthorisation: meta.agentAuthorisation,
    cdsData: meta.cdsData,
    claims: meta.claims,
    potentialRefunds: meta.potentialRefunds,
    documents: meta.documents,
    tasks: meta.tasks,
    complianceFlags: meta.complianceFlags,
    alerts,
    missingFields,
  };
}

export function getClientMetaByIdentifier(identifier?: string): ClientMeta {
  if (!identifier) return defaultMeta;
  return automationMeta[identifier] || defaultMeta;
}

function getNextVatDueDate(
  stagger?: Contact['vat_stagger'] | Contact['vat_frequency']
): string | null {
  if (!stagger) return null;
  const now = new Date();
  const normalized = stagger.toLowerCase();

  if (normalized === 'monthly') {
    for (let offset = -1; offset <= 13; offset += 1) {
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
      const dueDate = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 2, 7);
      if (dueDate > now) {
        return dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    }
    return null;
  }

  if (normalized === 'annual') {
    const periodEnd = new Date(now.getFullYear(), 2, 31);
    const dueDate = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 2, 7);
    const nextDue = dueDate > now ? dueDate : new Date(periodEnd.getFullYear() + 1, periodEnd.getMonth() + 2, 7);
    return nextDue.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const quarterMonthMap: Record<string, number[]> = {
    a: [2, 5, 8, 11],
    b: [3, 6, 9, 0],
    c: [4, 7, 10, 1],
  };

  const quarterEnds = quarterMonthMap[normalized];
  if (!quarterEnds) return null;

  const candidates: Date[] = [];
  const startYear = now.getFullYear() - 1;
  for (let year = startYear; year <= startYear + 3; year += 1) {
    quarterEnds.forEach((endMonth) => {
      const periodEnd = new Date(year, endMonth + 1, 0);
      const dueDate = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 2, 7);
      if (dueDate > now) candidates.push(dueDate);
    });
  }

  if (!candidates.length) return null;
  candidates.sort((left, right) => left.getTime() - right.getTime());
  return candidates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
