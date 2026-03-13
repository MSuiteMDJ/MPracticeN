export type OnboardingStatus =
  | 'not_started'
  | 'info_submitted'
  | 'documents_pending'
  | 'verification_required'
  | 'ready_for_services'
  | 'live';

export interface OnboardingChecklistItem {
  key: string;
  label: string;
  completed: boolean;
}

export interface OnboardingSummary {
  clientId: string;
  clientRef?: string;
  status: OnboardingStatus;
  progress: number;
  missingItems: string[];
  missingKeys: string[];
  checklist: OnboardingChecklistItem[];
  name?: string;
  contact?: string;
  eori?: string;
  vat?: string;
}

export interface OnboardingClientEntry extends OnboardingSummary {
  clientRef?: string;
  name?: string;
  contact?: string;
  eori?: string;
  vat?: string;
}

export interface ClientDocument {
  document_id: string;
  client_id: string;
  document_type: string;
  category?: string;
  version: number;
  version_count?: number;
  current_version_id?: string;
  file_path: string;
  linked_mrn?: string;
  created_at: string;
  updated_at?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  is_archived?: boolean;
}

export interface ClientDocumentVersion {
  version_id: string;
  document_id: string;
  client_id: string;
  version: number;
  file_path: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
  updated_at?: string;
}

export interface DocumentTemplate {
  template_id: string;
  name: string;
  category?: string;
  placeholders: string[];
  content: string;
}

export interface OnboardingTask {
  task_id: string;
  task_type: string;
  status: string;
  due_date?: string;
}
