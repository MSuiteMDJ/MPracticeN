// Demo Data Service - Provides consistent static data across all pages in demo mode

import type { C285Claim, ClaimReason } from '@/types';
import type { ClaimCompliance, AccountCompliance } from '@/types';
import type { Contact } from '@/types';

// Seed for consistent random generation
let seed = 12345;
function seededRandom() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Reset seed to ensure consistent data
function resetSeed() {
  seed = 12345;
}

// ============================================
// DEMO CONTACTS DATA
// ============================================

export function generateDemoContacts(): Contact[] {
  resetSeed();

  // Generate demo claims first to calculate usage statistics
  const demoClaims = generateDemoClaims();

  // Calculate claim counts per trader EORI
  const claimCounts = new Map<string, number>();
  const lastUsedDates = new Map<string, Date>();

  demoClaims.forEach((claim) => {
    if (claim.trader_eori) {
      claimCounts.set(claim.trader_eori, (claimCounts.get(claim.trader_eori) || 0) + 1);

      // Track most recent claim date
      const claimDate = new Date(claim.submitted_date || claim.created_at || 0);
      const currentLastUsed = lastUsedDates.get(claim.trader_eori);
      if (!currentLastUsed || claimDate > currentLastUsed) {
        lastUsedDates.set(claim.trader_eori, claimDate);
      }
    }
  });

  const traders = [
    {
      name: 'ABC Trading Ltd',
      eori: 'GB123456789000',
      email: 'john@abctrading.com',
      phone: '020 1234 5678',
      address: '123 High Street',
      city: 'London',
      postcode: 'SW1A 1AA',
      country: 'GB',
      company_number: '12345678',
      contact_person: 'John Smith',
      created_at: new Date(2023, 0, 15).toISOString(),
    },
    {
      name: 'XYZ Imports Ltd',
      eori: 'GB987654321000',
      email: 'jane@xyzimports.com',
      phone: '0161 234 5678',
      address: '456 Market Road',
      city: 'Manchester',
      postcode: 'M1 1AA',
      country: 'GB',
      company_number: '87654321',
      contact_person: 'Jane Doe',
      created_at: new Date(2023, 1, 20).toISOString(),
    },
    {
      name: 'Global Logistics Ltd',
      eori: 'GB456789123000',
      email: 'robert@globallogistics.com',
      phone: '0121 345 6789',
      address: '789 Commerce Way',
      city: 'Birmingham',
      postcode: 'B1 1AA',
      country: 'GB',
      company_number: '45678912',
      contact_person: 'Robert Brown',
      created_at: new Date(2023, 2, 10).toISOString(),
    },
    {
      name: 'Premier Imports Ltd',
      eori: 'GB789123456000',
      email: 'sarah@premierimports.com',
      phone: '0113 456 7890',
      address: '321 Trade Street',
      city: 'Leeds',
      postcode: 'LS1 1AA',
      country: 'GB',
      company_number: '78912345',
      contact_person: 'Sarah Wilson',
      created_at: new Date(2023, 3, 5).toISOString(),
    },
    {
      name: 'Elite Trading Co',
      eori: 'GB321654987000',
      email: 'michael@elitetrading.com',
      phone: '0117 567 8901',
      address: '654 Business Park',
      city: 'Bristol',
      postcode: 'BS1 1AA',
      country: 'GB',
      company_number: '32165498',
      contact_person: 'Michael Taylor',
      created_at: new Date(2023, 4, 12).toISOString(),
    },
    // ONBOARDING CLIENTS - At different stages
    {
      name: 'TechImport Solutions Ltd',
      eori: '', // Not yet provided - early stage
      email: 'sarah.mitchell@techimport.com',
      phone: '020 8765 4321',
      address: '45 Innovation Drive',
      city: 'London',
      postcode: 'E14 5AB',
      country: 'GB',
      company_number: '11223344',
      contact_person: 'Sarah Mitchell',
      created_at: new Date(2024, 10, 15).toISOString(), // Recent - just started
    },
    {
      name: 'Global Freight Partners',
      eori: 'GB888777666000',
      email: 'michael.chen@globalfreight.co.uk',
      phone: '0161 555 7788',
      address: '78 Cargo Street',
      city: 'Manchester',
      postcode: 'M2 3BB',
      country: 'GB',
      company_number: '55667788',
      contact_person: 'Michael Chen',
      created_at: new Date(2024, 10, 1).toISOString(), // Started 2 weeks ago
    },
    {
      name: 'Premier Logistics UK',
      eori: 'GB555666777000',
      email: 'emma.thompson@premierlogistics.co.uk',
      phone: '0113 999 8877',
      address: '12 Distribution Way',
      city: 'Leeds',
      postcode: 'LS9 8TT',
      country: 'GB',
      company_number: '99887766',
      contact_person: 'Emma Thompson',
      created_at: new Date(2024, 9, 20).toISOString(), // Started a month ago
    },
  ];

  const importerContacts = traders.map((trader, index) => {
    const totalClaims = trader.eori ? claimCounts.get(trader.eori) || 0 : 0;
    const lastUsed = trader.eori ? lastUsedDates.get(trader.eori) : undefined;
    const vatNumber = trader.eori ? trader.eori.substring(0, 11) : ''; // GB123456789000 → GB123456789

    // Determine onboarding stage based on data completeness
    const hasBank = index < 5 || index === 6 || index === 7; // First 5 + Global Freight + Premier have bank details
    
    return {
      // Required fields
      id: `contact-${index + 1}`,
      type: 'business' as const,
      name: trader.name,
      email: trader.email,
      phone: trader.phone,
      address: trader.address,
      city: trader.city,
      postcode: trader.postcode,
      country: trader.country,
      created_at: trader.created_at,
      updated_at: trader.created_at,
      created_by: 'demo-user-id',

      // Contact person
      contact_person: trader.contact_person,

      // Tax registration (may be empty for onboarding clients)
      eori: trader.eori || undefined,
      vat_number: vatNumber || undefined,
      company_number: trader.company_number,

      // Bank details (only for established clients and some onboarding)
      bank_account_name: hasBank ? trader.name : undefined,
      bank_account_number: hasBank ? trader.company_number : undefined,
      bank_sort_code: hasBank ? '12-34-56' : undefined,

      // Agent authority
      allows_agent_refund: true,

      // Usage tracking
      total_claims: totalClaims,
      last_used: lastUsed?.toISOString(),
    };
  });

  const directoryContacts: Contact[] = [
    {
      id: 'contact-agent-1',
      type: 'agent',
      name: 'North Sea Customs Agency',
      contact_person: 'Emily Carter',
      email: 'hello@northseacustoms.co.uk',
      phone: '020 3984 2210',
      address: '22 Bishopsgate',
      city: 'London',
      postcode: 'EC2N 4AJ',
      country: 'GB',
      notes: 'Preferred CDS permissions partner',
      allows_agent_refund: false,
      created_at: new Date(2023, 5, 1).toISOString(),
      updated_at: new Date(2023, 11, 3).toISOString(),
      created_by: 'demo-user-id',
    },
    {
      id: 'contact-agent-2',
      type: 'agent',
      name: 'Harbour Compliance Associates',
      contact_person: 'Gareth Patel',
      email: 'gareth@harbourcompliance.uk',
      phone: '0151 123 8890',
      address: 'Suite 4, Liverpool Waters',
      city: 'Liverpool',
      postcode: 'L3 0AN',
      country: 'GB',
      notes: 'Specialists in deferred account controls',
      allows_agent_refund: false,
      created_at: new Date(2023, 6, 14).toISOString(),
      updated_at: new Date(2024, 0, 12).toISOString(),
      created_by: 'demo-user-id',
    },
    {
      id: 'contact-hmrc-1',
      type: 'hmrc',
      name: 'HMRC CDS Permissions Team',
      email: 'cds-team@hmrc.gov.uk',
      phone: '0300 200 3700',
      address: '100 Parliament Street',
      city: 'London',
      postcode: 'SW1A 2BQ',
      country: 'GB',
      notes: 'Schedule D covering letters to this address',
      allows_agent_refund: false,
      created_at: new Date(2023, 7, 2).toISOString(),
      updated_at: new Date(2024, 0, 5).toISOString(),
      created_by: 'demo-user-id',
    },
    {
      id: 'contact-hmrc-2',
      type: 'hmrc',
      name: 'HMRC National Duty Repayments Centre',
      email: 'ndrteam@hmrc.gov.uk',
      phone: '0300 322 7012',
      address: 'Customs House',
      city: 'Salford',
      postcode: 'M5 3NE',
      country: 'GB',
      notes: 'Primary C285 processing office',
      allows_agent_refund: false,
      created_at: new Date(2023, 8, 18).toISOString(),
      updated_at: new Date(2023, 10, 24).toISOString(),
      created_by: 'demo-user-id',
    },
  ];

  return [...importerContacts, ...directoryContacts];
}

// ============================================
// DEMO CLAIMS DATA
// ============================================

export function generateDemoClaims(): Partial<C285Claim>[] {
  resetSeed();

  // Realistic trader data matching CSV template format
  const traders = [
    {
      name: 'ABC Trading Ltd',
      eori: 'GB123456789000',
      address: '123 High Street',
      city: 'London',
      postcode: 'SW1A 1AA',
      country: 'GB',
      company_number: '12345678',
      contact_name: 'John Smith',
      contact_email: 'john@abctrading.com',
      contact_phone: '020 1234 5678',
    },
    {
      name: 'XYZ Imports Ltd',
      eori: 'GB987654321000',
      address: '456 Market Road',
      city: 'Manchester',
      postcode: 'M1 1AA',
      country: 'GB',
      company_number: '87654321',
      contact_name: 'Jane Doe',
      contact_email: 'jane@xyzimports.com',
      contact_phone: '0161 234 5678',
    },
    {
      name: 'Global Logistics Ltd',
      eori: 'GB456789123000',
      address: '789 Commerce Way',
      city: 'Birmingham',
      postcode: 'B1 1AA',
      country: 'GB',
      company_number: '45678912',
      contact_name: 'Robert Brown',
      contact_email: 'robert@globallogistics.com',
      contact_phone: '0121 345 6789',
    },
    {
      name: 'Premier Imports Ltd',
      eori: 'GB789123456000',
      address: '321 Trade Street',
      city: 'Leeds',
      postcode: 'LS1 1AA',
      country: 'GB',
      company_number: '78912345',
      contact_name: 'Sarah Wilson',
      contact_email: 'sarah@premierimports.com',
      contact_phone: '0113 456 7890',
    },
    {
      name: 'Elite Trading Co',
      eori: 'GB321654987000',
      address: '654 Business Park',
      city: 'Bristol',
      postcode: 'BS1 1AA',
      country: 'GB',
      company_number: '32165498',
      contact_name: 'Michael Taylor',
      contact_email: 'michael@elitetrading.com',
      contact_phone: '0117 567 8901',
    },
  ];

  const reasonsData = [
    { code: 'tariff_code_error', desc: 'Incorrect tariff code applied to imported goods' },
    { code: 'origin_relief', desc: 'Origin preference not applied at time of import' },
    { code: 'incorrect_valuation', desc: 'Incorrect customs valuation method used' },
    { code: 'preference_not_claimed', desc: 'Preferential tariff treatment not claimed' },
    { code: 'relief_not_applied', desc: 'Eligible relief scheme not applied' },
  ];

  const statuses: Array<'draft' | 'submitted' | 'under_review' | 'approved' | 'paid'> = [
    'draft',
    'draft',
    'submitted',
    'under_review',
    'approved',
    'paid',
    'draft',
    'submitted',
    'under_review',
    'approved',
    'draft',
    'submitted',
    'approved',
    'paid',
    'under_review',
  ];

  return Array.from({ length: 15 }, (_, i) => {
    const trader = traders[i % traders.length];
    const reasonData = reasonsData[i % reasonsData.length];
    const status = statuses[i % statuses.length];
    const date = new Date(2024, 0, 1 + i * 2);
    const acceptanceDate = new Date(2023, 11 - (i % 6), 15);

    // Calculate realistic amounts
    const originalDuty = Math.floor(seededRandom() * 2000) + 200;
    const correctDuty = Math.floor(originalDuty * (seededRandom() * 0.5));
    const originalVat = Math.floor(seededRandom() * 1500) + 150;
    const correctVat = Math.floor(originalVat * (seededRandom() * 0.6));
    const dutyRefund = originalDuty - correctDuty;
    const vatRefund = originalVat - correctVat;
    const totalAmount = dutyRefund + vatRefund;

    return {
      id: `demo-claim-${i + 1}`,
      reference: `CLM-2024-${String(i + 1).padStart(4, '0')}`,
      mrn: `24GB${String(Math.floor(seededRandom() * 1000000000000)).padStart(12, '0')}`,
      entry_number: `${100 + (i % 5)} ${1000000 + i}`,
      acceptance_date: acceptanceDate.toISOString().split('T')[0],

      // Trader details (from CSV template)
      trader_name: trader.name,
      trader_eori: trader.eori,
      trader_address: trader.address,
      trader_city: trader.city,
      trader_postcode: trader.postcode,
      trader_country: trader.country,
      company_number: trader.company_number,
      contact_name: trader.contact_name,
      contact_email: trader.contact_email,
      contact_phone: trader.contact_phone,

      // Agent details (M Practice Manager)
      agent_eori: 'GB999888777000',
      agent_name: 'M Practice Manager Ltd',

      // Claim details
      reason: reasonData.code as ClaimReason,
      reason_description: reasonData.desc,

      // Financial details
      original_duty: originalDuty,
      correct_duty: correctDuty,
      duty_overpayment: dutyRefund,
      original_vat: originalVat,
      correct_vat: correctVat,
      vat_overpayment: vatRefund,
      original_excise: 0,
      correct_excise: 0,
      excise_overpayment: 0,
      original_total: originalDuty + originalVat,
      correct_total: correctDuty + correctVat,
      total_claim_amount: totalAmount,

      // Payment details
      payment_method: 'bank_transfer',
      bank_account_name: trader.name,
      bank_account_number: trader.company_number,
      bank_sort_code: '12-34-56',

      // Status and dates
      status,
      created_date: date.toISOString().split('T')[0],
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
      submitted_date: status !== 'draft' ? date.toISOString().split('T')[0] : undefined,

      // Items (simplified for demo)
      items: [],

      // Required declarant fields
      declarant_id: 'demo-user-id',
      declarant_name: 'Demo Agent',
      declarant_capacity: 'agent' as const,

      // Required claimant fields
      claimant_id: `client-${i + 1}`,
      claimant_type: 'contact' as const,
      identity_source: 'SETTINGS' as const,
      identity_locked_at: date.toISOString(),
    } as Partial<C285Claim>;
  });
}

// ============================================
// DEMO COMPLIANCE DATA
// ============================================

export function generateDemoClaimCompliance(): ClaimCompliance[] {
  resetSeed();

  const claims = generateDemoClaims();

  return claims.map((claim, index) => {
    // Generate consistent scores based on index
    const baseScore = 50 + ((index * 7) % 50);
    const score = Math.min(100, baseScore);
    const issueCount =
      score < 50 ? 5 + (index % 3) : score < 75 ? 2 + (index % 3) : score < 90 ? index % 2 : 0;

    return {
      claimRef: claim.reference || '',
      mrn: claim.mrn || '',
      status:
        claim.status === 'draft'
          ? ('Draft' as const)
          : claim.status === 'submitted'
            ? ('In Progress' as const)
            : claim.status === 'under_review'
              ? ('In Progress' as const)
              : claim.status === 'approved'
                ? ('Ready' as const)
                : ('Submitted' as const),
      score,
      issueCount,
      lastChecked: new Date(2024, 10, 15 - index),
    };
  });
}

export function generateDemoAccountCompliance(): AccountCompliance {
  resetSeed();

  return {
    declarantStatus: 'pass',
    declarantDetails: {
      name: 'M Practice Manager Ltd',
      eori: 'GB999888777000',
      verified: true,
      issues: [],
    },
    traderProfileStatus: 'pass',
    traderDetails: {
      businessName: 'M Practice Manager Ltd',
      registrationNumber: 'GB12345678',
      verified: true,
      issues: [],
    },
    bankStatus: 'pass',
    bankDetails: {
      accountName: 'M Practice Manager Ltd',
      accountNumber: '98765432',
      sortCode: '20-00-00',
      verified: true,
      issues: [],
    },
    overallScore: 95,
    lastUpdated: new Date(2024, 10, 17),
  };
}

export function generateDemoComplianceDetails(claimRef: string) {
  resetSeed();

  // Use claim ref to generate consistent data for each claim
  const claimIndex = parseInt(claimRef.split('-')[2]) || 0;
  seed = 12345 + claimIndex * 100;

  const getStatus = () => {
    const rand = seededRandom();
    if (rand > 0.7) return 'pass';
    if (rand > 0.4) return 'warn';
    if (rand > 0.2) return 'fail';
    return 'missing';
  };

  const mandatoryDocs = [
    'Commercial Invoice',
    'Bill of Lading',
    'Packing List',
    'Certificate of Origin',
    'Import License',
  ].map((name) => {
    const status = getStatus();
    return {
      name,
      status,
      uploadedDate: status !== 'missing' ? new Date(2024, 10, 1 + claimIndex) : undefined,
      issues:
        status === 'fail'
          ? [`${name} is incomplete or invalid`]
          : status === 'warn'
            ? [`${name} requires review`]
            : [],
      suggestions:
        status !== 'pass'
          ? [`Upload a valid ${name}`, 'Ensure all required fields are completed']
          : [],
    };
  });

  const supportingDocs = [
    'Insurance Certificate',
    'Quality Certificate',
    'Phytosanitary Certificate',
  ].map((name) => {
    const status = getStatus();
    return {
      name,
      status,
      uploadedDate: status !== 'missing' ? new Date(2024, 10, 1 + claimIndex) : undefined,
      issues:
        status === 'fail'
          ? [`${name} is incomplete`]
          : status === 'warn'
            ? [`${name} may be required`]
            : [],
      suggestions: status !== 'pass' ? [`Consider uploading ${name}`] : [],
    };
  });

  const tariffStatus = getStatus();
  const originStatus = getStatus();
  const declarantMatchStatus: 'pass' | 'warn' | 'fail' = claimIndex % 3 === 0 ? 'fail' : 'pass';
  const bankMatchStatus: 'pass' | 'warn' | 'fail' = claimIndex % 4 === 0 ? 'warn' : 'pass';
  const financialStatus: 'pass' | 'warn' | 'fail' =
    claimIndex % 5 === 0 ? 'fail' : claimIndex % 7 === 0 ? 'warn' : 'pass';

  return {
    mandatoryDocuments: mandatoryDocs,
    supportingDocuments: supportingDocs,
    tariffEvidence: {
      status: tariffStatus,
      description: 'Tariff classification justification and supporting documentation',
      issues:
        tariffStatus === 'fail'
          ? ['Tariff code not justified', 'Missing classification evidence']
          : tariffStatus === 'warn'
            ? ['Tariff classification requires additional evidence']
            : [],
      suggestions:
        tariffStatus !== 'pass'
          ? ['Provide detailed product description', 'Include technical specifications']
          : [],
    },
    originEvidence: {
      status: originStatus,
      description: 'Preferential or non-preferential origin proof',
      issues:
        originStatus === 'fail'
          ? ['Origin certificate missing', 'Origin declaration invalid']
          : originStatus === 'warn'
            ? ['Origin evidence requires verification']
            : [],
      suggestions:
        originStatus !== 'pass'
          ? ['Upload valid certificate of origin', 'Verify origin declaration']
          : [],
    },
    declarantMatch: {
      status: declarantMatchStatus,
      expected: 'M Practice Manager Ltd (GB999888777000)',
      actual:
        declarantMatchStatus === 'pass'
          ? 'M Practice Manager Ltd (GB999888777000)'
          : 'M Practice Manager (GB999888777000)',
      issues:
        declarantMatchStatus !== 'pass' ? ['Declarant name does not match account identity'] : [],
      suggestions:
        declarantMatchStatus !== 'pass'
          ? ['Update declarant details to match account', 'Verify EORI number']
          : [],
    },
    bankMatch: {
      status: bankMatchStatus,
      expected: 'M Practice Manager Ltd (98765432)',
      actual:
        bankMatchStatus === 'pass'
          ? 'M Practice Manager Ltd (98765432)'
          : 'M Practice Manager Ltd (98765432)',
      issues: bankMatchStatus !== 'pass' ? ['Bank account does not belong to claim owner'] : [],
      suggestions:
        bankMatchStatus !== 'pass' ? ['Verify bank account ownership', 'Update bank details'] : [],
    },
    financialAccuracy: {
      status: financialStatus,
      calculatedAmount: 15420.5,
      declaredAmount: financialStatus === 'pass' ? 15420.5 : 15500.0,
      variance: financialStatus === 'pass' ? 0 : 79.5,
      issues:
        financialStatus === 'fail'
          ? [
              'Overpayment calculation incorrect',
              'Declared amount does not match calculated amount',
            ]
          : financialStatus === 'warn'
            ? ['Minor variance detected in calculation']
            : [],
      suggestions:
        financialStatus !== 'pass'
          ? ['Review duty calculation', 'Verify exchange rates and tariff rates']
          : [],
    },
  };
}

// ============================================
// DEMO DATA GENERATION (For Seeding Only)
// ============================================
// Note: Cache and getter functions removed.
// Data is now generated once during seeding and stored in API service arrays.
// Stats are now calculated from stored data in api-service.ts


// Note: Onboarding clients are now created as regular Contact records
// They will appear in both Clients and Onboarding pages based on their completion status
