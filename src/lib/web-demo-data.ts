// Web Demo Data Service
// Provides same demo data as SQLite but for web browsers

// Demo data (same as in demo.db)
const DEMO_DECLARATIONS = [
  {
    id: 'demo-decl-1',
    mrn: '23GB123456789012345',
    declarant_eori: 'GB123456789000',
    importer_eori: 'GB987654321000',
    declaration_type: 'IM',
    acceptance_date: '2024-01-15',
    total_packages: 100,
    total_gross_mass: 5000.50,
    total_duty: 2500.00,
    total_vat: 1250.00,
    currency: 'GBP',
    status: 'accepted',
    client_name: 'ABC Trading Ltd',
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 'demo-decl-2',
    mrn: '23GB234567890123456',
    declarant_eori: 'GB123456789000',
    importer_eori: 'GB876543210000',
    declaration_type: 'IM',
    acceptance_date: '2024-01-20',
    total_packages: 50,
    total_gross_mass: 2500.25,
    total_duty: 1200.00,
    total_vat: 600.00,
    currency: 'GBP',
    status: 'accepted',
    client_name: 'XYZ Imports Ltd',
    created_at: '2024-01-20T14:30:00Z'
  },
  {
    id: 'demo-decl-3',
    mrn: '23GB345678901234567',
    declarant_eori: 'GB123456789000',
    importer_eori: 'GB765432109000',
    declaration_type: 'IM',
    acceptance_date: '2024-02-01',
    total_packages: 75,
    total_gross_mass: 3750.75,
    total_duty: 1800.00,
    total_vat: 900.00,
    currency: 'GBP',
    status: 'pending',
    client_name: 'Global Traders Inc',
    created_at: '2024-02-01T09:15:00Z'
  }
];

const DEMO_CLIENTS = [
  {
    id: 'demo-client-1',
    name: 'ABC Trading Ltd',
    eori: 'GB987654321000',
    vat_number: 'GB123456789',
    email: 'contact@abctrading.com',
    phone: '+44 20 1234 5678',
    address: '123 High Street, London, EC1A 1BB',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'demo-client-2',
    name: 'XYZ Imports Ltd',
    eori: 'GB876543210000',
    vat_number: 'GB234567890',
    email: 'info@xyzimports.com',
    phone: '+44 20 2345 6789',
    address: '456 Market Road, Manchester, M1 1AA',
    status: 'active',
    created_at: '2024-01-02T00:00:00Z'
  },
  {
    id: 'demo-client-3',
    name: 'Global Traders Inc',
    eori: 'GB765432109000',
    vat_number: 'GB345678901',
    email: 'hello@globaltraders.com',
    phone: '+44 20 3456 7890',
    address: '789 Business Park, Birmingham, B1 1BB',
    status: 'active',
    created_at: '2024-01-03T00:00:00Z'
  }
];

const DEMO_CLAIMS = [
  {
    id: 'demo-claim-1',
    client_id: 'demo-client-1',
    declaration_id: 'demo-decl-1',
    claim_type: 'duty_overpayment',
    claim_amount: 500.00,
    status: 'submitted',
    submitted_date: '2024-02-01',
    notes: 'Incorrect tariff code applied',
    created_at: '2024-02-01T10:00:00Z'
  },
  {
    id: 'demo-claim-2',
    client_id: 'demo-client-2',
    declaration_id: 'demo-decl-2',
    claim_type: 'vat_refund',
    claim_amount: 300.00,
    status: 'approved',
    submitted_date: '2024-02-05',
    notes: 'VAT relief for exported goods',
    created_at: '2024-02-05T11:30:00Z'
  },
  {
    id: 'demo-claim-3',
    client_id: 'demo-client-3',
    declaration_id: 'demo-decl-3',
    claim_type: 'duty_overpayment',
    claim_amount: 450.00,
    status: 'draft',
    submitted_date: null,
    notes: 'Pending documentation',
    created_at: '2024-02-10T16:45:00Z'
  }
];

const DEMO_CONTACTS = [
  {
    id: 'demo-contact-1',
    client_id: 'demo-client-1',
    name: 'John Smith',
    email: 'john.smith@abctrading.com',
    phone: '+44 20 1234 5678',
    role: 'Finance Director',
    is_primary: 1,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'demo-contact-2',
    client_id: 'demo-client-2',
    name: 'Jane Doe',
    email: 'jane.doe@xyzimports.com',
    phone: '+44 20 2345 6789',
    role: 'Operations Manager',
    is_primary: 1,
    created_at: '2024-01-02T00:00:00Z'
  },
  {
    id: 'demo-contact-3',
    client_id: 'demo-client-3',
    name: 'Bob Johnson',
    email: 'bob.johnson@globaltraders.com',
    phone: '+44 20 3456 7890',
    role: 'Practice Manager',
    is_primary: 1,
    created_at: '2024-01-03T00:00:00Z'
  }
];

// Check if running in web browser (not Tauri)
export function isWebEnvironment(): boolean {
  return typeof window !== 'undefined' && !(window as any).__TAURI__;
}

// Web Demo API: Get declarations
export async function getWebDemoDeclarations() {
  await new Promise(resolve => setTimeout(resolve, 100));
  return DEMO_DECLARATIONS;
}

// Web Demo API: Get clients
export async function getWebDemoClients() {
  await new Promise(resolve => setTimeout(resolve, 100));
  return DEMO_CLIENTS.filter(client => client.status === 'active');
}

// Web Demo API: Get claims
export async function getWebDemoClaims() {
  await new Promise(resolve => setTimeout(resolve, 100));
  return DEMO_CLAIMS;
}

// Web Demo API: Get contacts
export async function getWebDemoContacts(clientId?: string) {
  await new Promise(resolve => setTimeout(resolve, 100));
  if (clientId) {
    return DEMO_CONTACTS.filter(contact => contact.client_id === clientId);
  }
  return DEMO_CONTACTS;
}

// Web Demo API: Get settings
export async function getWebDemoSettings() {
  await new Promise(resolve => setTimeout(resolve, 100));
  return {
    company_name: 'Demo Company',
    user_name: 'Demo User',
    user_email: 'demo@mpractice.com'
  };
}
