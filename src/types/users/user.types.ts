/**
 * User & Identity Types
 *
 * Shared across auth, settings, and identity validation.
 */

export type UserType = 'SELF' | 'AGENT';

export type EntityType =
  | 'PERSON'
  | 'SOLE_TRADER'
  | 'PARTNERSHIP'
  | 'LTD_COMPANY'
  | 'LLP'
  | 'CHARITY'
  | 'TRUST'
  | 'OTHER_ORGANISATION';

export type DeclarantCapacity =
  | 'importer'
  | 'agent'
  | 'duty_representative'
  | 'employee_of_importer';

export interface UserProfile {
  declarant_name: string;
  declarant_capacity: DeclarantCapacity;
  declarant_organisation_name?: string;
  entity_id?: string;
  entity_type?: EntityType;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postcode?: string;
  country?: string;
}

export interface User {
  user_id: string;
  username: string;
  password: string;
  user_type: UserType;
  profile: UserProfile;
  created_at: string;
  updated_at: string;
}

export type AuthUser = {
  id?: string;
  username: string;
  email?: string;
  role?: string;
  role_name?: string;
  permissions?: string[];
  user_type?: UserType;
  declarant_name?: string;
  declarant_capacity?: DeclarantCapacity;
  declarant_organisation_name?: string;
  entity_type?: EntityType;
  entity_id?: string;
} | null;

export interface SignupFormData {
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirm: string;
  user_type?: 'SELF' | 'AGENT' | '';
  declarant_name?: string;
  declarant_capacity?: DeclarantCapacity | '';
  declarant_organisation_name?: string;
  entity_type?: EntityType | '';
}
