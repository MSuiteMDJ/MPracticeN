/**
 * Contact Management Types
 *
 * Contacts represent importers, agents, or entities involved in C285 claims.
 * Used for auto-filling claim data and ensuring compliance.
 */

export type ContactType = 'individual' | 'business' | 'agent' | 'hmrc';
export type ContactFieldStatus = 'missing' | 'provided' | 'not_applicable' | 'applied_for';

export interface Contact {
  id: string;
  type: ContactType;

  // Identity
  name: string; // Full name or business name
  contact_person?: string; // For business/agent types
  portfolio_id?: string;
  portfolio_code?: number;
  portfolio_name?: string;
  client_ref?: string;
  related_to_client_id?: string;
  related_to_client_ref?: string;
  related_to_client_name?: string;
  party_roles?: string[];
  party_status?: 'current' | 'former';

  // Contact details
  email: string;
  phone: string;
  address: string; // Address line 1
  address_line_2?: string;
  city?: string;
  postcode?: string;
  country?: string;

  // Tax registration
  eori?: string;
  vat_number?: string;
  company_number?: string;

  // 🆕 Enhanced business identity
  legal_entity_type?: 'ltd' | 'plc' | 'llp' | 'partnership' | 'sole_trader' | 'charity' | 'other';
  registered_address_line_1?: string;
  registered_address_line_2?: string;
  registered_city?: string;
  registered_postcode?: string;
  registered_country?: string;
  company_country_of_establishment?: string;

  // 🆕 Individual additional fields
  date_of_birth?: string;
  national_id_passport?: string;

  // 🆕 Contact preferences
  preferred_contact_method?: string;
  alternative_email?: string;

  // 🆕 Deferment
  has_deferment_account?: boolean;
  deferment_account_number?: string;

  // Bank details (for refund payments)
  bank_account_name?: string;
  bank_account_number?: string;
  bank_sort_code?: string;
  bank_iban?: string;
  bank_swift?: string;

  // Agent authority
  allows_agent_refund?: boolean; // If true, agent can receive refunds
  authority_signed?: boolean;
  authority_date?: string;
  authority_document_id?: string;

  // Practice engagement and authority
  engagement_letter_sent_date?: string;
  engagement_letter_signed_date?: string;
  engagement_type?: 'limited_company' | 'sole_trader' | 'partnership' | 'individual';
  acting_as_agent?: boolean;
  hmrc_agent_authorised?: boolean;
  hmrc_agent_reference?: string;
  government_gateway_username?: string;
  government_gateway_password?: string;
  auth_code_delivery_contact?: string;
  companies_house_auth_code?: string;
  directors_ch_verification_no?: string;
  professional_clearance_received?: boolean;
  previous_accountant?: string;
  take_on_completed?: boolean;

  // AML / KYC controls
  aml_risk_rating?: 'low' | 'medium' | 'high';
  aml_review_date?: string;
  risk_review_frequency?: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  id_verified?: boolean;
  id_verification_method?: string;
  source_of_funds_checked?: boolean;
  beneficial_owner_verified?: boolean;
  psc_verified?: boolean;
  pep_flag?: boolean;
  ongoing_monitoring_flag?: boolean;
  assigned_reviewer?: string;
  aml_notes?: string;

  // Tax references
  utr?: string;
  paye_reference?: string;
  accounts_reference_date?: string;
  corporation_tax_reference?: string;
  vat_stagger?: 'monthly' | 'a' | 'b' | 'c';
  vat_frequency?: 'monthly' | 'quarterly' | 'annual';
  vat_scheme?: string;
  mtd_enabled?: boolean;
  ni_number?: string;
  self_assessment_utr?: string;

  // Billing and commercial controls
  billing_model?: 'fixed' | 'monthly_dd' | 'hourly' | 'value_pricing';
  monthly_fee?: number;
  credit_terms?: string;
  payment_method?: string;
  direct_debit_mandate_signed?: boolean;
  last_fee_review_date?: string;

  // Internal practice management
  client_manager?: string;
  partner?: string;
  internal_rating?: string;
  sector?: string;
  year_end?: string;
  software_used?: 'xero' | 'quickbooks' | 'sage' | 'other';
  payroll_frequency?: 'weekly' | 'fortnightly' | 'four_weekly' | 'monthly' | 'quarterly';

  // Metadata
  notes?: string;
  field_statuses?: Partial<Record<string, ContactFieldStatus>>;
  created_from_claim?: boolean; // Created during claim creation
  created_at: string;
  updated_at: string;
  created_by: string;

  // Usage tracking
  total_claims?: number;
  last_used?: string;
}

export interface ContactFilter {
  type?: ContactType | ContactType[];
  search?: string;
  has_eori?: boolean;
  has_vat?: boolean;
  has_bank_details?: boolean;
  allows_agent_refund?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: 'name' | 'created_at' | 'last_used' | 'total_claims';
  sort_order?: 'asc' | 'desc';
}

export interface ContactListResponse {
  contacts: Contact[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface ContactValidationError {
  field: string;
  message: string;
}

export interface ContactValidationResult {
  valid: boolean;
  errors: ContactValidationError[];
  warnings?: ContactValidationError[];
}

/**
 * Validate contact for use in C285 claim
 */
export function validateContactForClaim(
  contact: Contact,
  requireEori: boolean = false,
  requireBankDetails: boolean = false
): ContactValidationResult {
  const errors: ContactValidationError[] = [];
  const warnings: ContactValidationError[] = [];

  // Required fields
  if (!contact.name) {
    errors.push({ field: 'name', message: 'Name is required' });
  }
  if (!contact.email) {
    errors.push({ field: 'email', message: 'Email is required' });
  }
  if (!contact.address) {
    errors.push({ field: 'address', message: 'Address is required' });
  }

  // Conditional requirements
  if (requireEori && !contact.eori) {
    errors.push({ field: 'eori', message: 'EORI is required for this claim type' });
  }

  if (requireBankDetails) {
    if (!contact.bank_account_name) {
      errors.push({ field: 'bank_account_name', message: 'Bank account name is required' });
    }
    if (!contact.bank_account_number) {
      errors.push({ field: 'bank_account_number', message: 'Bank account number is required' });
    }
    if (!contact.bank_sort_code) {
      errors.push({ field: 'bank_sort_code', message: 'Bank sort code is required' });
    }
  }

  // Warnings
  if (!contact.phone) {
    warnings.push({ field: 'phone', message: 'Phone number is recommended' });
  }
  if ((contact.type === 'business' || contact.type === 'agent') && !contact.contact_person) {
    warnings.push({
      field: 'contact_person',
      message: 'Contact person is recommended for businesses',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
