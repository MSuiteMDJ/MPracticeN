// Hybrid API Wrapper
// Automatically routes to demo database or Heroku API based on login

import {
  isWebEnvironment,
  getWebDemoDeclarations,
  getWebDemoClients,
  getWebDemoClaims,
  getWebDemoContacts,
  getWebDemoSettings,
} from './web-demo-data';

// Import Tauri demo functions only if available
let isDemoMode: () => boolean;
let getDemoDeclarations: any;
let getDemoClients: any;
let getDemoClaims: any;
let getDemoContacts: any;
let getDemoDeclaration: any;
let getDemoClient: any;
let getDemoSettings: any;
let getDemoDashboardStats: any;

// Dynamically import Tauri functions only in desktop environment
if (!isWebEnvironment()) {
  import('./demo-database').then(module => {
    isDemoMode = module.isDemoMode;
    getDemoDeclarations = module.getDemoDeclarations;
    getDemoClients = module.getDemoClients;
    getDemoClaims = module.getDemoClaims;
    getDemoContacts = module.getDemoContacts;
    getDemoDeclaration = module.getDemoDeclaration;
    getDemoClient = module.getDemoClient;
    getDemoSettings = module.getDemoSettings;
    getDemoDashboardStats = module.getDemoDashboardStats;
  });
} else {
  // Web environment: use localStorage for demo mode
  isDemoMode = () => localStorage.getItem('demo_mode') === 'true';
}

const HEROKU_API_URL = (import.meta as any).env?.VITE_API_URL || 'https://suite-customs-backend-0c17d12529d3.herokuapp.com';

// Helper to get auth token
function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

// Helper for Heroku API calls
async function herokuFetch(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${HEROKU_API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

// Hybrid API: Get Declarations
export async function getDeclarations() {
  if (isDemoMode()) {
    if (isWebEnvironment()) {
      const declarations = await getWebDemoDeclarations();
      return { declarations };
    }
    const declarations = await getDemoDeclarations();
    return { declarations };
  }
  return herokuFetch('/cds/declarations');
}

// Hybrid API: Get Single Declaration
export async function getDeclaration(id: string) {
  if (isDemoMode()) {
    if (isWebEnvironment()) {
      const declarations = await getWebDemoDeclarations();
      const declaration = declarations.find((d: any) => d.id === id);
      return declaration || null;
    }
    return getDemoDeclaration(id);
  }
  return herokuFetch(`/cds/declarations/${id}`);
}

// Hybrid API: Get Clients
export async function getClients() {
  if (isDemoMode()) {
    if (isWebEnvironment()) {
      const clients = await getWebDemoClients();
      return { clients };
    }
    const clients = await getDemoClients();
    return { clients };
  }
  return herokuFetch('/clients');
}

// Hybrid API: Get Single Client
export async function getClient(id: string) {
  if (isDemoMode()) {
    if (isWebEnvironment()) {
      const clients = await getWebDemoClients();
      const client = clients.find((c: any) => c.id === id);
      return client || null;
    }
    return getDemoClient(id);
  }
  return herokuFetch(`/clients/${id}`);
}

// Hybrid API: Get Claims
export async function getClaims(options?: { limit?: number }) {
  if (isDemoMode()) {
    if (isWebEnvironment()) {
      let claims = await getWebDemoClaims();
      if (options?.limit) {
        claims = claims.slice(0, options.limit);
      }
      return { claims };
    }
    let claims = await getDemoClaims();
    if (options?.limit) {
      claims = claims.slice(0, options.limit);
    }
    return { claims };
  }
  const endpoint = options?.limit ? `/claims?limit=${options.limit}` : '/claims';
  return herokuFetch(endpoint);
}

// Hybrid API: Get Contacts
export async function getContacts(clientId?: string) {
  if (isDemoMode()) {
    if (isWebEnvironment()) {
      const contacts = await getWebDemoContacts(clientId);
      return { contacts };
    }
    const contacts = await getDemoContacts(clientId);
    return { contacts };
  }
  const endpoint = clientId ? `/contacts?client_id=${clientId}` : '/contacts';
  return herokuFetch(endpoint);
}

// Hybrid API: Get Dashboard Stats
export async function getDashboardStats() {
  if (isDemoMode()) {
    if (isWebEnvironment()) {
      // Calculate stats from web demo data
      const declarations = await getWebDemoDeclarations();
      const claims = await getWebDemoClaims();
      const clients = await getWebDemoClients();
      
      return {
        total_declarations: declarations.length,
        total_claims: claims.length,
        total_clients: clients.length,
        pending_claims: claims.filter((c: any) => c.status === 'draft' || c.status === 'submitted').length,
        approved_claims: claims.filter((c: any) => c.status === 'approved').length,
        total_duty_paid: declarations.reduce((sum: number, d: any) => sum + (d.total_duty || 0), 0),
        total_vat_paid: declarations.reduce((sum: number, d: any) => sum + (d.total_vat || 0), 0),
        potential_savings: claims.reduce((sum: number, c: any) => sum + (c.claim_amount || 0), 0),
      };
    }
    return getDemoDashboardStats();
  }
  return herokuFetch('/dashboard/stats');
}

// Hybrid API: Login
export async function login(email: string, password: string) {
  // Check if demo login
  if (email === 'demo@mpractice.com' && password === 'demo1234') {
    // Demo mode: Store demo user info
    localStorage.setItem('current_user_email', email);
    localStorage.setItem('demo_mode', 'true');
    
    let settings;
    if (isWebEnvironment()) {
      settings = await getWebDemoSettings();
    } else {
      settings = await getDemoSettings();
    }
    
    return {
      success: true,
      mode: 'demo',
      user: {
        email: 'demo@mpractice.com',
        first_name: 'Demo',
        last_name: 'User',
        company_name: settings.company_name || 'Demo Company',
        role: 'admin',
      },
    };
  }

  // Production mode: Call Heroku API
  localStorage.removeItem('demo_mode');
  const response = await fetch(`${HEROKU_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error('Invalid credentials');
  }

  const data = await response.json();
  
  // Store token and user info
  localStorage.setItem('auth_token', data.token);
  localStorage.setItem('current_user_email', email);
  
  return {
    success: true,
    mode: 'production',
    ...data,
  };
}

// Hybrid API: Register (always uses Heroku)
export async function register(data: {
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}) {
  localStorage.removeItem('demo_mode');
  
  const response = await fetch(`${HEROKU_API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
  }

  const result = await response.json();
  
  // Store token and user info
  localStorage.setItem('auth_token', result.token);
  localStorage.setItem('current_user_email', data.email);
  
  return result;
}

// Hybrid API: Logout
export function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('current_user_email');
  localStorage.removeItem('demo_mode');
}

// Check if user is logged in
export function isLoggedIn(): boolean {
  return isDemoMode() || !!getAuthToken();
}

// Get current mode
export function getCurrentMode(): 'demo' | 'production' | null {
  if (isDemoMode()) return 'demo';
  if (getAuthToken()) return 'production';
  return null;
}

// Demo mode indicator for UI
export function showDemoIndicator(): boolean {
  return isDemoMode();
}
