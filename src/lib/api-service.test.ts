import { describe, it, expect, beforeEach, vi } from 'vitest';
import { contactsAPI, setUserContext, clearUserContext } from './api-service';
import { clearDemoData, initializeDemoData } from './demo-data-service';

describe('Contact API with Demo Data', () => {
  beforeEach(() => {
    clearDemoData();
    clearUserContext();
    localStorage.clear();
  });

  describe('Demo Mode Integration', () => {
    beforeEach(() => {
      // Enable demo mode
      localStorage.setItem('demo-mode', 'true');
      initializeDemoData();
    });

    it('should return demo contacts when in demo mode for AGENT users', async () => {
      setUserContext({
        user_id: 'test-agent-id',
        user_type: 'AGENT',
        declarant_name: 'Test Agent',
        declarant_capacity: 'agent',
      });

      const response = await contactsAPI.getContacts();

      expect(response.contacts).toHaveLength(5);
      expect(response.total_count).toBe(5);
      expect(response.contacts[0].type).toBe('business');
    });

    it('should return empty array for SELF users even in demo mode', async () => {
      setUserContext({
        user_id: 'test-self-id',
        user_type: 'SELF',
        entity_id: 'test-entity-id',
        declarant_name: 'Test Self User',
        declarant_capacity: 'importer',
      });

      const response = await contactsAPI.getContacts();

      expect(response.contacts).toHaveLength(0);
      expect(response.total_count).toBe(0);
    });
  });

  describe('Search Filtering', () => {
    beforeEach(() => {
      localStorage.setItem('demo-mode', 'true');
      initializeDemoData();
      setUserContext({
        user_id: 'test-agent-id',
        user_type: 'AGENT',
        declarant_name: 'Test Agent',
        declarant_capacity: 'agent',
      });
    });

    it('should filter contacts by name search', async () => {
      const response = await contactsAPI.getContacts({
        search: 'ABC',
      });

      expect(response.contacts.length).toBeGreaterThan(0);
      expect(response.contacts[0].name).toContain('ABC');
    });

    it('should filter contacts by email search', async () => {
      const response = await contactsAPI.getContacts({
        search: 'john@',
      });

      expect(response.contacts.length).toBeGreaterThan(0);
      expect(response.contacts[0].email).toContain('john@');
    });

    it('should filter contacts by EORI search', async () => {
      const response = await contactsAPI.getContacts({
        search: 'GB123456789000',
      });

      expect(response.contacts.length).toBeGreaterThan(0);
      expect(response.contacts[0].eori).toBe('GB123456789000');
    });

    it('should return empty array when search matches nothing', async () => {
      const response = await contactsAPI.getContacts({
        search: 'NonExistentContact',
      });

      expect(response.contacts).toHaveLength(0);
      expect(response.total_count).toBe(0);
    });
  });

  describe('Type Filtering', () => {
    beforeEach(() => {
      localStorage.setItem('demo-mode', 'true');
      initializeDemoData();
      setUserContext({
        user_id: 'test-agent-id',
        user_type: 'AGENT',
        declarant_name: 'Test Agent',
        declarant_capacity: 'agent',
      });
    });

    it('should filter contacts by type', async () => {
      const response = await contactsAPI.getContacts({
        type: 'business',
      });

      expect(response.contacts).toHaveLength(5);
      response.contacts.forEach((contact) => {
        expect(contact.type).toBe('business');
      });
    });

    it('should filter contacts by multiple types', async () => {
      const response = await contactsAPI.getContacts({
        type: ['business', 'agent'],
      });

      response.contacts.forEach((contact) => {
        expect(['business', 'agent']).toContain(contact.type);
      });
    });

    it('should return empty array when filtering by non-existent type', async () => {
      const response = await contactsAPI.getContacts({
        type: 'individual',
      });

      expect(response.contacts).toHaveLength(0);
    });
  });

  describe('Property Filtering', () => {
    beforeEach(() => {
      localStorage.setItem('demo-mode', 'true');
      initializeDemoData();
      setUserContext({
        user_id: 'test-agent-id',
        user_type: 'AGENT',
        declarant_name: 'Test Agent',
        declarant_capacity: 'agent',
      });
    });

    it('should filter contacts with EORI', async () => {
      const response = await contactsAPI.getContacts({
        has_eori: true,
      });

      expect(response.contacts).toHaveLength(5);
      response.contacts.forEach((contact) => {
        expect(contact.eori).toBeDefined();
      });
    });

    it('should filter contacts with VAT number', async () => {
      const response = await contactsAPI.getContacts({
        has_vat: true,
      });

      expect(response.contacts).toHaveLength(5);
      response.contacts.forEach((contact) => {
        expect(contact.vat_number).toBeDefined();
      });
    });

    it('should filter contacts with bank details', async () => {
      const response = await contactsAPI.getContacts({
        has_bank_details: true,
      });

      expect(response.contacts).toHaveLength(5);
      response.contacts.forEach((contact) => {
        expect(contact.bank_account_number).toBeDefined();
        expect(contact.bank_sort_code).toBeDefined();
      });
    });

    it('should filter contacts that allow agent refund', async () => {
      const response = await contactsAPI.getContacts({
        allows_agent_refund: true,
      });

      expect(response.contacts).toHaveLength(5);
      response.contacts.forEach((contact) => {
        expect(contact.allows_agent_refund).toBe(true);
      });
    });
  });

  describe('Sorting', () => {
    beforeEach(() => {
      localStorage.setItem('demo-mode', 'true');
      initializeDemoData();
      setUserContext({
        user_id: 'test-agent-id',
        user_type: 'AGENT',
        declarant_name: 'Test Agent',
        declarant_capacity: 'agent',
      });
    });

    it('should sort contacts by name ascending', async () => {
      const response = await contactsAPI.getContacts({
        sort_by: 'name',
        sort_order: 'asc',
      });

      const names = response.contacts.map((c) => c.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should sort contacts by name descending', async () => {
      const response = await contactsAPI.getContacts({
        sort_by: 'name',
        sort_order: 'desc',
      });

      const names = response.contacts.map((c) => c.name);
      const sortedNames = [...names].sort().reverse();
      expect(names).toEqual(sortedNames);
    });

    it('should sort contacts by created_at', async () => {
      const response = await contactsAPI.getContacts({
        sort_by: 'created_at',
        sort_order: 'asc',
      });

      const dates = response.contacts.map((c) => new Date(c.created_at).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
      }
    });

    it('should sort contacts by last_used', async () => {
      const response = await contactsAPI.getContacts({
        sort_by: 'last_used',
        sort_order: 'desc',
      });

      const dates = response.contacts.map((c) =>
        c.last_used ? new Date(c.last_used).getTime() : 0
      );
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
      }
    });

    it('should sort contacts by total_claims', async () => {
      const response = await contactsAPI.getContacts({
        sort_by: 'total_claims',
        sort_order: 'desc',
      });

      const counts = response.contacts.map((c) => c.total_claims || 0);
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
      }
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      localStorage.setItem('demo-mode', 'true');
      initializeDemoData();
      setUserContext({
        user_id: 'test-agent-id',
        user_type: 'AGENT',
        declarant_name: 'Test Agent',
        declarant_capacity: 'agent',
      });
    });

    it('should paginate contacts correctly', async () => {
      const page1 = await contactsAPI.getContacts({
        limit: 2,
        offset: 0,
      });

      expect(page1.contacts).toHaveLength(2);
      expect(page1.page).toBe(1);
      expect(page1.page_size).toBe(2);
      expect(page1.has_more).toBe(true);
      expect(page1.total_count).toBe(5);
    });

    it('should return second page correctly', async () => {
      const page2 = await contactsAPI.getContacts({
        limit: 2,
        offset: 2,
      });

      expect(page2.contacts).toHaveLength(2);
      expect(page2.page).toBe(2);
      expect(page2.has_more).toBe(true);
    });

    it('should return last page correctly', async () => {
      const lastPage = await contactsAPI.getContacts({
        limit: 2,
        offset: 4,
      });

      expect(lastPage.contacts).toHaveLength(1);
      expect(lastPage.page).toBe(3);
      expect(lastPage.has_more).toBe(false);
    });

    it('should handle offset beyond total count', async () => {
      const response = await contactsAPI.getContacts({
        limit: 10,
        offset: 100,
      });

      expect(response.contacts).toHaveLength(0);
      expect(response.has_more).toBe(false);
    });
  });

  describe('Combined Filters', () => {
    beforeEach(() => {
      localStorage.setItem('demo-mode', 'true');
      initializeDemoData();
      setUserContext({
        user_id: 'test-agent-id',
        user_type: 'AGENT',
        declarant_name: 'Test Agent',
        declarant_capacity: 'agent',
      });
    });

    it('should apply search and type filter together', async () => {
      const response = await contactsAPI.getContacts({
        search: 'Ltd',
        type: 'business',
      });

      expect(response.contacts.length).toBeGreaterThan(0);
      response.contacts.forEach((contact) => {
        expect(contact.name).toContain('Ltd');
        expect(contact.type).toBe('business');
      });
    });

    it('should apply search, filter, and sort together', async () => {
      const response = await contactsAPI.getContacts({
        search: 'Ltd',
        type: 'business',
        sort_by: 'name',
        sort_order: 'asc',
      });

      const names = response.contacts.map((c) => c.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should apply all filters with pagination', async () => {
      const response = await contactsAPI.getContacts({
        type: 'business',
        has_eori: true,
        sort_by: 'name',
        sort_order: 'asc',
        limit: 3,
        offset: 0,
      });

      expect(response.contacts.length).toBeLessThanOrEqual(3);
      expect(response.page_size).toBe(3);
    });
  });
});
