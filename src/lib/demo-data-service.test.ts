import { describe, it, expect, beforeEach } from 'vitest';
import { generateDemoContacts, generateDemoClaims, clearDemoData } from './demo-data-service';

describe('Demo Contact Generation', () => {
  beforeEach(() => {
    clearDemoData();
  });

  it('should generate exactly 5 contacts', () => {
    const contacts = generateDemoContacts();
    expect(contacts).toHaveLength(5);
  });

  it('should have all required Contact fields', () => {
    const contacts = generateDemoContacts();

    contacts.forEach((contact) => {
      // Required fields
      expect(contact.id).toBeDefined();
      expect(contact.type).toBe('business');
      expect(contact.name).toBeDefined();
      expect(contact.email).toBeDefined();
      expect(contact.phone).toBeDefined();
      expect(contact.address).toBeDefined();
      expect(contact.created_at).toBeDefined();
      expect(contact.updated_at).toBeDefined();
      expect(contact.created_by).toBe('demo-user-id');

      // Contact person
      expect(contact.contact_person).toBeDefined();

      // Tax registration
      expect(contact.eori).toBeDefined();
      expect(contact.vat_number).toBeDefined();
      expect(contact.company_number).toBeDefined();

      // Bank details
      expect(contact.bank_account_name).toBeDefined();
      expect(contact.bank_account_number).toBeDefined();
      expect(contact.bank_sort_code).toBe('12-34-56');

      // Agent authority
      expect(contact.allows_agent_refund).toBe(true);

      // Usage tracking
      expect(contact.total_claims).toBeDefined();
      expect(typeof contact.total_claims).toBe('number');
    });
  });

  it('should have contact EORIs matching trader EORIs from claims', () => {
    const contacts = generateDemoContacts();
    const claims = generateDemoClaims();

    const contactEoris = new Set(contacts.map((c) => c.eori));
    const traderEoris = new Set(claims.map((c) => c.trader_eori).filter(Boolean));

    // All trader EORIs should have corresponding contacts
    traderEoris.forEach((eori) => {
      expect(contactEoris.has(eori)).toBe(true);
    });
  });

  it('should calculate total_claims correctly for each contact', () => {
    const contacts = generateDemoContacts();
    const claims = generateDemoClaims();

    contacts.forEach((contact) => {
      const expectedCount = claims.filter((c) => c.trader_eori === contact.eori).length;
      expect(contact.total_claims).toBe(expectedCount);
    });
  });

  it('should set last_used to most recent claim date', () => {
    const contacts = generateDemoContacts();
    const claims = generateDemoClaims();

    contacts.forEach((contact) => {
      const traderClaims = claims.filter((c) => c.trader_eori === contact.eori);

      if (traderClaims.length > 0) {
        const mostRecentClaimDate = traderClaims.reduce((latest, claim) => {
          const claimDate = new Date(claim.submitted_date || claim.created_at || 0);
          return claimDate > latest ? claimDate : latest;
        }, new Date(0));

        expect(contact.last_used).toBeDefined();
        expect(new Date(contact.last_used!).getTime()).toBe(mostRecentClaimDate.getTime());
      }
    });
  });

  it('should produce consistent results with seeded random generation', () => {
    const contacts1 = generateDemoContacts();
    clearDemoData();
    const contacts2 = generateDemoContacts();

    expect(contacts1).toHaveLength(contacts2.length);

    contacts1.forEach((contact, index) => {
      expect(contact.id).toBe(contacts2[index].id);
      expect(contact.name).toBe(contacts2[index].name);
      expect(contact.eori).toBe(contacts2[index].eori);
      expect(contact.email).toBe(contacts2[index].email);
      expect(contact.total_claims).toBe(contacts2[index].total_claims);
    });
  });

  it('should generate VAT numbers from EORI numbers', () => {
    const contacts = generateDemoContacts();

    contacts.forEach((contact) => {
      // VAT number should be first 11 characters of EORI
      const expectedVat = contact.eori?.substring(0, 11);
      expect(contact.vat_number).toBe(expectedVat);
    });
  });

  it('should set bank account number to company number', () => {
    const contacts = generateDemoContacts();

    contacts.forEach((contact) => {
      expect(contact.bank_account_number).toBe(contact.company_number);
    });
  });

  it('should set bank account name to contact name', () => {
    const contacts = generateDemoContacts();

    contacts.forEach((contact) => {
      expect(contact.bank_account_name).toBe(contact.name);
    });
  });

  it('should have all contacts with type business', () => {
    const contacts = generateDemoContacts();

    contacts.forEach((contact) => {
      expect(contact.type).toBe('business');
    });
  });

  it('should have realistic created_at dates', () => {
    const contacts = generateDemoContacts();

    contacts.forEach((contact) => {
      const createdDate = new Date(contact.created_at);
      expect(createdDate.getFullYear()).toBe(2023);
      expect(createdDate.getTime()).toBeLessThan(Date.now());
    });
  });

  it('should have matching contact details with trader details from claims', () => {
    const contacts = generateDemoContacts();
    const claims = generateDemoClaims();

    contacts.forEach((contact) => {
      const matchingClaim = claims.find((c) => c.trader_eori === contact.eori);

      if (matchingClaim) {
        expect(contact.name).toBe(matchingClaim.trader_name);
        expect(contact.address).toBe(matchingClaim.trader_address);
        expect(contact.city).toBe(matchingClaim.trader_city);
        expect(contact.postcode).toBe(matchingClaim.trader_postcode);
        expect(contact.country).toBe(matchingClaim.trader_country);
        expect(contact.company_number).toBe(matchingClaim.company_number);
      }
    });
  });
});
