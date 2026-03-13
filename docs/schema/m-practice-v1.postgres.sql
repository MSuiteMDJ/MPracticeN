-- M Practice Core Data Schema (v1 draft, PostgreSQL)
-- Generated from current TypeScript domain models.
-- Target: production-grade relational store replacing localStorage maps.

BEGIN;

-- ============================================================================
-- Contacts
-- ============================================================================

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('individual', 'business', 'agent', 'hmrc')),

  name TEXT NOT NULL,
  contact_person TEXT,

  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT,
  postcode TEXT,
  country TEXT,

  eori TEXT,
  vat_number TEXT,
  company_number TEXT,

  legal_entity_type TEXT CHECK (legal_entity_type IN ('ltd', 'plc', 'llp', 'partnership', 'sole_trader', 'charity', 'other')),
  registered_address_line_1 TEXT,
  registered_address_line_2 TEXT,
  registered_city TEXT,
  registered_postcode TEXT,
  registered_country TEXT,
  company_country_of_establishment TEXT,

  date_of_birth DATE,
  national_id_passport TEXT,

  preferred_contact_method TEXT,
  alternative_email TEXT,

  has_deferment_account BOOLEAN,
  deferment_account_number TEXT,

  bank_account_name TEXT,
  bank_account_number TEXT,
  bank_sort_code TEXT,
  bank_iban TEXT,
  bank_swift TEXT,

  allows_agent_refund BOOLEAN,
  authority_signed BOOLEAN,
  authority_date DATE,
  authority_document_id TEXT,

  engagement_letter_sent_date DATE,
  engagement_letter_signed_date DATE,
  engagement_type TEXT CHECK (engagement_type IN ('limited_company', 'sole_trader', 'partnership', 'individual')),
  acting_as_agent BOOLEAN,
  hmrc_agent_authorised BOOLEAN,
  hmrc_agent_reference TEXT,
  professional_clearance_received BOOLEAN,
  previous_accountant TEXT,
  take_on_completed BOOLEAN,

  aml_risk_rating TEXT CHECK (aml_risk_rating IN ('low', 'medium', 'high')),
  aml_review_date DATE,
  risk_review_frequency TEXT CHECK (risk_review_frequency IN ('monthly', 'quarterly', 'semi_annual', 'annual')),
  id_verified BOOLEAN,
  id_verification_method TEXT,
  source_of_funds_checked BOOLEAN,
  beneficial_owner_verified BOOLEAN,
  psc_verified BOOLEAN,
  pep_flag BOOLEAN,
  ongoing_monitoring_flag BOOLEAN,
  assigned_reviewer TEXT,
  aml_notes TEXT,

  utr TEXT,
  paye_reference TEXT,
  accounts_reference_date DATE,
  corporation_tax_reference TEXT,
  vat_stagger TEXT CHECK (vat_stagger IN ('monthly', 'a', 'b', 'c')),
  vat_frequency TEXT CHECK (vat_frequency IN ('monthly', 'quarterly', 'annual')),
  vat_scheme TEXT,
  mtd_enabled BOOLEAN,
  ni_number TEXT,
  self_assessment_utr TEXT,

  billing_model TEXT CHECK (billing_model IN ('fixed', 'monthly_dd', 'hourly', 'value_pricing')),
  monthly_fee NUMERIC(12, 2),
  credit_terms TEXT,
  payment_method TEXT,
  direct_debit_mandate_signed BOOLEAN,
  last_fee_review_date DATE,

  client_manager TEXT,
  partner TEXT,
  internal_rating TEXT,
  sector TEXT,
  year_end DATE,
  software_used TEXT CHECK (software_used IN ('xero', 'quickbooks', 'sage', 'other')),
  payroll_frequency TEXT CHECK (payroll_frequency IN ('weekly', 'fortnightly', 'four_weekly', 'monthly', 'quarterly')),

  notes TEXT,
  field_statuses JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_from_claim BOOLEAN,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  total_claims INTEGER,
  last_used TIMESTAMPTZ,

  CONSTRAINT contacts_field_statuses_object CHECK (jsonb_typeof(field_statuses) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_contacts_company_number ON contacts(company_number);
CREATE INDEX IF NOT EXISTS idx_contacts_vat_number ON contacts(vat_number);
CREATE INDEX IF NOT EXISTS idx_contacts_utr ON contacts(utr);
CREATE INDEX IF NOT EXISTS idx_contacts_last_used ON contacts(last_used);
CREATE INDEX IF NOT EXISTS idx_contacts_field_statuses_gin ON contacts USING GIN (field_statuses);

-- ============================================================================
-- Service Template Catalogue
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_templates (
  service_code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  report_category TEXT,
  category TEXT NOT NULL CHECK (category IN ('COMPLIANCE', 'TAX', 'BOOKKEEPING', 'PAYROLL', 'ADVISORY', 'SECRETARIAL', 'FORMATION')),
  compliance_type TEXT NOT NULL CHECK (compliance_type IN ('NONE', 'STATUTORY_FILING', 'TAX_RETURN', 'REGISTRATION', 'ADVISORY_ONLY')),
  creates_compliance BOOLEAN NOT NULL,
  default_frequency TEXT NOT NULL CHECK (default_frequency IN ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'AD_HOC')),
  billing_type TEXT NOT NULL CHECK (billing_type IN ('RECURRING', 'ONE_TIME', 'PROJECT')),
  billing_unit TEXT NOT NULL CHECK (billing_unit IN ('PER_MONTH', 'PER_QUARTER', 'PER_YEAR', 'PER_RETURN', 'PER_HOUR', 'FIXED_FEE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_template_client_types (
  service_code TEXT NOT NULL REFERENCES service_templates(service_code) ON DELETE CASCADE,
  client_type TEXT NOT NULL CHECK (client_type IN ('COMPANY', 'INDIVIDUAL', 'SOLE_TRADER', 'PARTNERSHIP', 'LLP')),
  PRIMARY KEY (service_code, client_type)
);

CREATE TABLE IF NOT EXISTS service_template_tasks (
  service_code TEXT NOT NULL REFERENCES service_templates(service_code) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  days_before_due INTEGER NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (service_code, task_id)
);

CREATE INDEX IF NOT EXISTS idx_service_templates_category ON service_templates(category);
CREATE INDEX IF NOT EXISTS idx_service_templates_compliance_type ON service_templates(compliance_type);
CREATE INDEX IF NOT EXISTS idx_service_template_tasks_service ON service_template_tasks(service_code);

-- ============================================================================
-- Client Service Engagements
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_service_engagements (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL REFERENCES service_templates(service_code),
  display_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('COMPLIANCE', 'TAX', 'BOOKKEEPING', 'PAYROLL', 'ADVISORY', 'SECRETARIAL', 'FORMATION')),
  compliance_type TEXT NOT NULL CHECK (compliance_type IN ('NONE', 'STATUTORY_FILING', 'TAX_RETURN', 'REGISTRATION', 'ADVISORY_ONLY')),
  creates_compliance BOOLEAN NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'AD_HOC')),
  billing_type TEXT NOT NULL CHECK (billing_type IN ('RECURRING', 'ONE_TIME', 'PROJECT')),
  billing_unit TEXT NOT NULL CHECK (billing_unit IN ('PER_MONTH', 'PER_QUARTER', 'PER_YEAR', 'PER_RETURN', 'PER_HOUR', 'FIXED_FEE')),
  fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  next_due DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_service_tasks (
  engagement_id TEXT NOT NULL REFERENCES client_service_engagements(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  days_before_due INTEGER NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status TEXT NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
  PRIMARY KEY (engagement_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_client_service_engagements_client ON client_service_engagements(client_id);
CREATE INDEX IF NOT EXISTS idx_client_service_engagements_active ON client_service_engagements(is_active);
CREATE INDEX IF NOT EXISTS idx_client_service_engagements_next_due ON client_service_engagements(next_due);
CREATE INDEX IF NOT EXISTS idx_client_service_tasks_status ON client_service_tasks(status);

-- ============================================================================
-- Client Documents (Onboarding)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_documents (
  document_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  category TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  file_path TEXT NOT NULL,
  linked_mrn TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_category ON client_documents(category);
CREATE INDEX IF NOT EXISTS idx_client_documents_created_at ON client_documents(created_at);

-- ============================================================================
-- Optional Cache Table For Companies House Embedded Snapshot
-- ============================================================================

CREATE TABLE IF NOT EXISTS companies_house_snapshots (
  company_number TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_house_snapshots_fetched_at ON companies_house_snapshots(fetched_at);
CREATE INDEX IF NOT EXISTS idx_companies_house_snapshots_payload_gin ON companies_house_snapshots USING GIN (payload);

-- ============================================================================
-- Convenience View: annualized service value per client
-- ============================================================================

CREATE OR REPLACE VIEW v_client_service_annualized_value AS
SELECT
  cse.client_id,
  SUM(
    CASE cse.billing_unit
      WHEN 'PER_MONTH' THEN cse.fee_amount * 12
      WHEN 'PER_QUARTER' THEN cse.fee_amount * 4
      WHEN 'PER_YEAR' THEN cse.fee_amount
      WHEN 'PER_RETURN' THEN cse.fee_amount
      WHEN 'PER_HOUR' THEN cse.fee_amount
      WHEN 'FIXED_FEE' THEN cse.fee_amount
      ELSE cse.fee_amount
    END
  ) AS annualized_value
FROM client_service_engagements cse
WHERE cse.is_active = TRUE
GROUP BY cse.client_id;

COMMIT;
