/**
 * CSV Parser for CDS Declaration Data
 * Handles parsing, validation, and transformation of CSV files into CDSDeclaration objects
 */

import type { CDSDeclaration, CDSItem, CDSItemTax, DeclarationType } from '@/types';

export interface CSVParseResult {
  success: boolean;
  data?: CDSDeclaration[];
  errors?: CSVParseError[];
  warnings?: CSVParseWarning[];
  stats: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicates: number;
  };
}

export interface CSVParseError {
  row: number;
  field?: string;
  message: string;
  severity: 'error' | 'critical';
}

export interface CSVParseWarning {
  row: number;
  field?: string;
  message: string;
}

interface CSVRow {
  [key: string]: string | number;
}

/**
 * Expected CSV column mappings for CDS declarations
 */
const COLUMN_MAPPINGS = {
  // Declaration header fields
  mrn: ['mrn', 'movement_reference_number', 'declaration_mrn'],
  declaration_type: ['declaration_type', 'type', 'dec_type'],
  declaration_date: ['declaration_date', 'date', 'dec_date'],
  acceptance_date: ['acceptance_date', 'accepted_date'],
  trader_eori: ['trader_eori', 'eori', 'importer_eori'],
  trader_name: ['trader_name', 'importer_name', 'trader'],

  // Item fields
  item_number: ['item_number', 'item_no', 'line_number'],
  commodity_code: ['commodity_code', 'hs_code', 'tariff_code'],
  goods_description: ['goods_description', 'description', 'item_description'],
  origin_country: ['origin_country', 'country_of_origin', 'origin'],
  net_mass: ['net_mass', 'net_weight', 'weight_kg'],
  supplementary_units: ['supplementary_units', 'quantity', 'units'],
  statistical_value: ['statistical_value', 'value', 'item_value'],
  invoice_value: ['invoice_value', 'invoice_amount', 'item_invoice_value'],

  // Tax fields
  tax_type: ['tax_type', 'duty_type', 'charge_type'],
  tax_base: ['tax_base', 'taxable_amount', 'base_amount'],
  tax_rate: ['tax_rate', 'rate', 'duty_rate'],
  tax_amount: ['tax_amount', 'duty_amount', 'charge_amount'],

  // Payment fields
  payment_method: ['payment_method', 'payment_type'],
  payment_reference: ['payment_reference', 'payment_ref'],
  payment_amount: ['payment_amount', 'amount_paid'],
};

/**
 * Parse CSV file content into CDS declarations
 */
export async function parseCSV(fileContent: string): Promise<CSVParseResult> {
  const errors: CSVParseError[] = [];
  const warnings: CSVParseWarning[] = [];
  const declarations: CDSDeclaration[] = [];
  const seenMRNs = new Set<string>();
  let duplicates = 0;

  try {
    // Parse CSV into rows
    const rows = parseCSVContent(fileContent);

    if (rows.length === 0) {
      return {
        success: false,
        errors: [{ row: 0, message: 'CSV file is empty', severity: 'critical' }],
        stats: { totalRows: 0, validRows: 0, invalidRows: 0, duplicates: 0 },
      };
    }

    // Validate headers
    const headerValidation = validateHeaders(rows[0]);
    if (!headerValidation.valid) {
      return {
        success: false,
        errors: headerValidation.errors,
        stats: { totalRows: rows.length, validRows: 0, invalidRows: rows.length, duplicates: 0 },
      };
    }

    // Group rows by MRN (each declaration can have multiple items)
    const declarationGroups = groupRowsByMRN(rows);

    // Process each declaration
    for (const [mrn, declarationRows] of declarationGroups.entries()) {
      // Check for duplicates
      if (seenMRNs.has(mrn)) {
        duplicates++;
        warnings.push({
          row: declarationRows[0].rowNumber,
          field: 'mrn',
          message: `Duplicate MRN: ${mrn}`,
        });
        continue;
      }
      seenMRNs.add(mrn);

      // Parse declaration
      const parseResult = parseDeclaration(mrn, declarationRows);

      if (parseResult.declaration) {
        declarations.push(parseResult.declaration);
      }

      errors.push(...parseResult.errors);
      warnings.push(...parseResult.warnings);
    }

    const validRows = declarations.length;
    const invalidRows = declarationGroups.size - validRows;

    return {
      success: errors.filter((e) => e.severity === 'critical').length === 0,
      data: declarations,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      stats: {
        totalRows: rows.length,
        validRows,
        invalidRows,
        duplicates,
      },
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          row: 0,
          message: `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'critical',
        },
      ],
      stats: { totalRows: 0, validRows: 0, invalidRows: 0, duplicates: 0 },
    };
  }
}

/**
 * Parse CSV content into rows
 */
function parseCSVContent(content: string): Array<CSVRow & { rowNumber: number }> {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Array<CSVRow & { rowNumber: number }> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: CSVRow & { rowNumber: number } = { rowNumber: i + 1 };
    headers.forEach((header, index) => {
      row[header.toLowerCase().trim()] = values[index]?.trim() || '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Validate CSV headers
 */
function validateHeaders(firstRow: CSVRow): { valid: boolean; errors: CSVParseError[] } {
  const errors: CSVParseError[] = [];
  const headers = Object.keys(firstRow).filter((k) => k !== 'rowNumber');

  // Check for required fields
  const requiredFields = ['mrn', 'declaration_type', 'trader_eori'];
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const mappings = COLUMN_MAPPINGS[field as keyof typeof COLUMN_MAPPINGS];
    const found = headers.some((h) => mappings.includes(h.toLowerCase()));
    if (!found) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    errors.push({
      row: 1,
      message: `Missing required columns: ${missingFields.join(', ')}`,
      severity: 'critical',
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Group CSV rows by MRN
 */
function groupRowsByMRN(
  rows: Array<CSVRow & { rowNumber: number }>
): Map<string, Array<CSVRow & { rowNumber: number }>> {
  const groups = new Map<string, Array<CSVRow & { rowNumber: number }>>();

  for (const row of rows) {
    const mrn = findFieldValue(row, 'mrn');
    if (!mrn) continue;

    if (!groups.has(mrn)) {
      groups.set(mrn, []);
    }
    groups.get(mrn)!.push(row);
  }

  return groups;
}

/**
 * Parse a single declaration from grouped rows
 */
function parseDeclaration(
  mrn: string,
  rows: Array<CSVRow & { rowNumber: number }>
): {
  declaration?: CDSDeclaration;
  errors: CSVParseError[];
  warnings: CSVParseWarning[];
} {
  const errors: CSVParseError[] = [];
  const warnings: CSVParseWarning[] = [];
  const firstRow = rows[0];

  try {
    // Parse header data from first row
    const declaration_type = findFieldValue(firstRow, 'declaration_type');
    const trader_eori = findFieldValue(firstRow, 'trader_eori');

    if (!declaration_type || !trader_eori) {
      errors.push({
        row: firstRow.rowNumber,
        message: 'Missing required fields: declaration_type or trader_eori',
        severity: 'error',
      });
      return { errors, warnings };
    }

    // Parse items
    const items: CDSItem[] = [];
    for (const row of rows) {
      const item = parseItem(row, errors, warnings);
      if (item) items.push(item);
    }

    if (items.length === 0) {
      errors.push({
        row: firstRow.rowNumber,
        message: 'No valid items found for declaration',
        severity: 'error',
      });
      return { errors, warnings };
    }

    // Calculate totals
    const total_duty = items.reduce(
      (sum, item) =>
        sum +
        (item.taxes?.filter((t) => t.tax_type === 'CUST').reduce((s, t) => s + t.tax_amount, 0) ||
          0),
      0
    );
    const total_vat = items.reduce(
      (sum, item) =>
        sum +
        (item.taxes?.filter((t) => t.tax_type === 'VAT').reduce((s, t) => s + t.tax_amount, 0) ||
          0),
      0
    );
    const total_excise = items.reduce(
      (sum, item) =>
        sum +
        (item.taxes?.filter((t) => t.tax_type === 'EXCISE').reduce((s, t) => s + t.tax_amount, 0) ||
          0),
      0
    );

    const declaration: CDSDeclaration = {
      id: crypto.randomUUID(),
      mrn,
      declaration_type: (declaration_type || 'IM4') as DeclarationType,
      acceptance_date:
        findFieldValue(firstRow, 'acceptance_date') || new Date().toISOString().split('T')[0],
      trader_eori,
      importer_eori: trader_eori,
      consignee_name: findFieldValue(firstRow, 'trader_name') || '',
      procedure_code: '4000C07', // Default procedure code
      status: 'accepted',
      total_duty_paid: total_duty,
      total_vat_paid: total_vat,
      total_excise_paid: total_excise,
      total_taxes_paid: total_duty + total_vat + total_excise,
      declaration_source: 'csv',
      items,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return { declaration, errors, warnings };
  } catch (error) {
    errors.push({
      row: firstRow.rowNumber,
      message: `Failed to parse declaration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error',
    });
    return { errors, warnings };
  }
}

/**
 * Parse a single item from a CSV row
 */
function parseItem(
  row: CSVRow & { rowNumber: number },
  errors: CSVParseError[],
  warnings: CSVParseWarning[]
): CDSItem | null {
  try {
    const item_number = parseInt(findFieldValue(row, 'item_number') || '1');
    const commodity_code = findFieldValue(row, 'commodity_code');

    if (!commodity_code) {
      warnings.push({
        row: row.rowNumber,
        field: 'commodity_code',
        message: 'Missing commodity code',
      });
      return null;
    }

    // Parse taxes
    const taxes: CDSItemTax[] = [];
    const tax_type = findFieldValue(row, 'tax_type');
    const tax_amount = parseFloat(findFieldValue(row, 'tax_amount') || '0');

    if (tax_type && tax_amount > 0) {
      // Map tax type codes to proper TaxType
      let mappedTaxType: 'CUST' | 'VAT' | 'EXCISE' = 'CUST';
      if (tax_type.includes('B') || tax_type.toLowerCase().includes('vat')) {
        mappedTaxType = 'VAT';
      } else if (tax_type.toLowerCase().includes('excise')) {
        mappedTaxType = 'EXCISE';
      }

      taxes.push({
        id: crypto.randomUUID(),
        item_id: '', // Will be set later
        tax_type: mappedTaxType,
        tax_base: parseFloat(findFieldValue(row, 'tax_base') || '0'),
        tax_rate: parseFloat(findFieldValue(row, 'tax_rate') || '0'),
        tax_amount,
        calculation_method: 'ad_valorem',
      });
    }

    const statistical_value = parseFloat(findFieldValue(row, 'statistical_value') || '0');
    const invoice_value = parseFloat(
      findFieldValue(row, 'invoice_value') || String(statistical_value)
    );

    const item: CDSItem = {
      id: crypto.randomUUID(),
      declaration_id: '', // Will be set later
      item_number,
      commodity_code,
      description: findFieldValue(row, 'goods_description') || '',
      origin_country: findFieldValue(row, 'origin_country'),
      net_mass: parseFloat(findFieldValue(row, 'net_mass') || '0'),
      quantity: parseFloat(findFieldValue(row, 'supplementary_units') || '0'),
      statistical_value,
      invoice_value,
      invoice_currency: 'GBP',
      procedure_code: '4000C07',
      taxes: taxes.length > 0 ? taxes : undefined,
    };

    return item;
  } catch (error) {
    errors.push({
      row: row.rowNumber,
      message: `Failed to parse item: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error',
    });
    return null;
  }
}

/**
 * Find field value using column mappings
 */
function findFieldValue(row: CSVRow, field: keyof typeof COLUMN_MAPPINGS): string | undefined {
  const mappings = COLUMN_MAPPINGS[field];
  for (const mapping of mappings) {
    const value = row[mapping.toLowerCase()];
    if (value !== undefined && value !== '') {
      return String(value);
    }
  }
  return undefined;
}

/**
 * Validate MRN format
 */
export function validateMRN(mrn: string): boolean {
  // MRN format: YYGBXXXXXXXXXXXXXXXXX (23 characters)
  const mrnRegex = /^\d{2}GB[A-Z0-9]{17}$/;
  return mrnRegex.test(mrn);
}

/**
 * Validate EORI format
 */
export function validateEORI(eori: string): boolean {
  // EORI format: GB followed by 12 digits
  const eoriRegex = /^GB\d{12}$/;
  return eoriRegex.test(eori);
}
