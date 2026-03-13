import type { CDSDeclaration } from '@/types';

export interface ManifestSummary {
  totalDeclarations: number;
  uniqueMrns: number;
  matchedClients: number;
  issues: number;
  totalDuties: number;
  lastImport?: string;
}

export interface ImportBatch {
  id: string;
  file_names?: string[];
  status: string;
  declarations: number;
  items: number;
  tax_lines: number;
  documents?: number;
  created_at: string;
  completed_at?: string;
}

export interface ManifestFilters {
  mrn?: string;
  client?: string;
  status?: string;
  batchId?: string;
  hasIssues?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface ManifestDeclaration extends CDSDeclaration {
  batch_id?: string;
  client_name?: string;
  issue_count?: number;
  items_count?: number;
  has_issues?: boolean;
}

export type DeclarationDetail = CDSDeclaration & {
  items?: Array<{
    id: string;
    item_number: number;
    commodity_code: string;
    goods_description?: string;
    net_mass?: number;
    gross_mass?: number;
    statistical_value?: number;
    customs_value?: number;
    supplementary_units?: number;
  }>;
  taxes?: Array<{
    id: string;
    item_number: number;
    tax_type: string;
    tax_amount?: number;
    tax_base?: number;
    tax_rate?: number;
  }>;
};
