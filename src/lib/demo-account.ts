/**
 * Demo Account Configuration
 *
 * Pre-configured demo account with all settings.
 * This account is used when "Demo Mode" button is clicked.
 */

export const DEMO_ACCOUNT = {
  // Credentials
  email: 'demo@mpractice.com',
  password: 'demo123',

  // User object
  user: {
    id: 'demo-agent-id',
    username: 'demo@mpractice.com',
    email: 'demo@mpractice.com',
    user_type: 'agent' as const,
    declarant_name: 'Demo Agent',
    declarant_capacity: 'agent' as const,
    declarant_organisation_name: 'M Practice Manager Ltd',
    isDemo: true,
  },

  // System settings
  settings: {
    userType: 'agent' as const,
    fullName: 'Demo Agent',
    email: 'demo@mpractice.com',
    phone: '020 7946 0958',
    address: '100 Parliament Street',
    address_line_2: 'Westminster',
    city: 'London',
    postcode: 'SW1A 2BQ',
    country: 'GB',
    hasEori: true,
    eori: 'GB999888777000',
    hasVat: true,
    vat: 'GB999888777',
    companyName: 'M Practice Manager Ltd',
    agentContact: 'Demo Agent',
    agentRefundAllowed: true,
    allowBranding: true,
    // Declarant information
    declarantName: 'Demo Agent',
    declarantCapacity: 'agent' as const,
    declarantOrganisationName: 'M Practice Manager Ltd',
  },
};

/**
 * Initialize demo account settings
 * Called when demo mode is entered
 */
export function initializeDemoAccount(): void {
  localStorage.setItem('systemSettings', JSON.stringify(DEMO_ACCOUNT.settings));
  window.dispatchEvent(new Event('settingsUpdated'));
}

/**
 * Check if credentials match demo account
 */
export function isDemoAccount(email: string, password: string): boolean {
  return email === DEMO_ACCOUNT.email && password === DEMO_ACCOUNT.password;
}
