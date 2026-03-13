/**
 * Data Seeding System
 *
 * Seeds demo user account with initial data on app startup.
 * This ensures demo data is available immediately when the demo user logs in.
 */

import { users, DEMO_USER } from './auth';
import { generateDemoClaims, generateDemoContacts } from './demo-data-service';
import { setUserContext, clearUserContext } from './api-service';

// Track if seeding has been performed (persisted in localStorage)
const SEEDING_KEY = 'mdr-demo-seeded';

/**
 * Seed demo user data on app initialization
 *
 * This function:
 * 1. Checks if demo user exists in users array
 * 2. If not, adds demo user to users array
 * 3. Generates 15 demo claims with created_by field
 * 4. Generates 5 demo contacts with created_by field
 * 5. Stores all data in respective arrays
 *
 * Only runs once per app session.
 */
export function seedDemoData(): void {
  // Prevent duplicate seeding - check localStorage
  if (typeof window !== 'undefined' && localStorage.getItem(SEEDING_KEY) === 'true') {
    return;
  }

  // Ensure demo user exists in user store
  const demoUserExists = users.some((u) => u.user_id === DEMO_USER.user_id);
  if (!demoUserExists) {
    users.push(DEMO_USER);
  }

  // Temporarily set user context for data generation so created_by fields are correct
  setUserContext({
    user_id: DEMO_USER.user_id,
    user_type: DEMO_USER.user_type,
    entity_id: DEMO_USER.profile.entity_id,
    declarant_name: DEMO_USER.profile.declarant_name,
    declarant_capacity: DEMO_USER.profile.declarant_capacity,
    declarant_organisation_name: DEMO_USER.profile.declarant_organisation_name,
  });

  // Generate and store demo claims
  const demoClaims = generateDemoClaims();

  import('./api-service').then(({ addClaim }) => {
    demoClaims.forEach((claim) => {
      const claimWithUser = {
        ...claim,
        created_by: DEMO_USER.user_id,
        declarant_id: DEMO_USER.user_id,
      } as any;
      addClaim(claimWithUser);
    });
  });

  // Generate and store demo contacts (includes onboarding clients)
  const demoContacts = generateDemoContacts();

  import('./api-service').then(({ addContact }) => {
    demoContacts.forEach((contact) => {
      const contactWithUser = {
        ...contact,
        created_by: DEMO_USER.user_id,
      };
      addContact(contactWithUser);
    });
  });

  // Clear user context (will be set again on login)
  clearUserContext();

  // Mark as seeded in localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(SEEDING_KEY, 'true');
  }
}

/**
 * Reset seeding flag (for testing purposes)
 */
export function resetSeeding(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SEEDING_KEY);
  }
}
