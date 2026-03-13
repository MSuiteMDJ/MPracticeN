import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';

/**
 * CSV Processor Service
 * Handles parsing and validation of CDS CSV files
 */
export class CSVProcessor {
  /**
   * Process uploaded CSV files
   */
  async processFiles(files, userId) {
    const errors = [];
    const warnings = [];
    
    // Parse header file (required)
    const headerContent = await fs.readFile(files.header, 'utf-8');
    const headerRecords = parse(headerContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });

    const declarations = headerRecords.map((record, index) => {
      const declaration = this.parseHeaderRecord(record, userId, index + 2);
      
      // Validate MRN
      if (!this.isValidMRN(declaration.mrn)) {
        errors.push({
          scope: 'HEADER',
          identifier: declaration.mrn || 'UNKNOWN',
          message: 'Invalid MRN format (expected: YYGBxxxxxxxxxxxxxxxxx)',
          row: index + 2
        });
      }

      // Validate EORI
      if (!this.isValidEORI(declaration.trader_eori)) {
        warnings.push({
          scope: 'HEADER',
          identifier: declaration.mrn,
          message: 'Invalid EORI format',
          row: index + 2
        });
      }

      // Validate date
      if (!this.isValidDate(declaration.acceptance_date)) {
        errors.push({
          scope: 'HEADER',
          identifier: declaration.mrn,
          message: 'Invalid acceptance date format (expected: YYYY-MM-DD)',
          row: index + 2
        });
      }

      return declaration;
    });

    // Parse items file if provided
    let items = [];
    if (files.items) {
      const itemsContent = await fs.readFile(files.items, 'utf-8');
      const itemsRecords = parse(itemsContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      });
      
      items = itemsRecords.map((record, index) => {
        const item = this.parseItemRecord(record);
        
        // Validate commodity code
        if (item.commodity_code && !this.isValidCommodityCode(item.commodity_code)) {
          warnings.push({
            scope: 'ITEMS',
            identifier: `${item.declaration_mrn}-${item.item_number}`,
            message: 'Invalid commodity code format (expected: 10 digits)',
            row: index + 2
          });
        }
        
        return item;
      });
    }

    // Parse tax file if provided
    let taxLines = [];
    if (files.tax) {
      const taxContent = await fs.readFile(files.tax, 'utf-8');
      const taxRecords = parse(taxContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      });
      
      taxLines = taxRecords.map((record) => this.parseTaxRecord(record));
    }

    return {
      declarations,
      items,
      taxLines,
      errors,
      warnings
    };
  }

  /**
   * Parse header record
   */
  parseHeaderRecord(record, userId, rowNumber) {
    return {
      id: uuidv4(),
      user_id: userId,
      mrn: this.getField(record, ['MRN', 'mrn']),
      entry_number: this.getField(record, ['Entry Number', 'entry_number', 'EntryNumber']),
      acceptance_date: this.getField(record, ['Acceptance Date', 'acceptance_date', 'AcceptanceDate']),
      declaration_type: this.getField(record, ['Declaration Type', 'declaration_type', 'DeclarationType']) || 'IM4',
      trader_eori: this.getField(record, ['Trader EORI', 'trader_eori', 'TraderEORI']),
      importer_eori: this.getField(record, ['Importer EORI', 'importer_eori', 'ImporterEORI']),
      consignee_name: this.getField(record, ['Consignee Name', 'consignee_name', 'ConsigneeName']),
      consignor_name: this.getField(record, ['Consignor Name', 'consignor_name', 'ConsignorName']),
      incoterm: this.getField(record, ['Incoterm', 'incoterm']),
      procedure_code: this.getField(record, ['Procedure Code', 'procedure_code', 'ProcedureCode']),
      previous_procedure_code: this.getField(record, ['Previous Procedure Code', 'previous_procedure_code']),
      total_duty_paid: this.parseFloat(this.getField(record, ['Total Duty Paid', 'total_duty_paid', 'TotalDutyPaid'])),
      total_vat_paid: this.parseFloat(this.getField(record, ['Total VAT Paid', 'total_vat_paid', 'TotalVATPaid'])),
      total_excise_paid: this.parseFloat(this.getField(record, ['Total Excise Paid', 'total_excise_paid', 'TotalExcisePaid'])),
      total_taxes_paid: 0,
      status: 'accepted',
      declaration_source: 'csv'
    };
  }

  /**
   * Parse item record
   */
  parseItemRecord(record) {
    return {
      id: uuidv4(),
      declaration_mrn: this.getField(record, ['MRN', 'mrn']),
      item_number: this.parseInt(this.getField(record, ['Item Number', 'item_number', 'ItemNumber'])),
      commodity_code: this.getField(record, ['Commodity Code', 'commodity_code', 'CommodityCode']),
      description: this.getField(record, ['Description', 'description']),
      origin_country: this.getField(record, ['Origin Country', 'origin_country', 'OriginCountry']),
      gross_mass: this.parseFloat(this.getField(record, ['Gross Mass', 'gross_mass', 'GrossMass'])),
      net_mass: this.parseFloat(this.getField(record, ['Net Mass', 'net_mass', 'NetMass'])),
      quantity: this.parseFloat(this.getField(record, ['Quantity', 'quantity'])),
      invoice_value: this.parseFloat(this.getField(record, ['Invoice Value', 'invoice_value', 'InvoiceValue'])),
      invoice_currency: this.getField(record, ['Invoice Currency', 'invoice_currency', 'InvoiceCurrency']) || 'GBP',
      procedure_code: this.getField(record, ['Procedure Code', 'procedure_code', 'ProcedureCode'])
    };
  }

  /**
   * Parse tax record
   */
  parseTaxRecord(record) {
    return {
      id: uuidv4(),
      declaration_mrn: this.getField(record, ['MRN', 'mrn']),
      item_number: this.parseInt(this.getField(record, ['Item Number', 'item_number', 'ItemNumber'])),
      tax_type: this.getField(record, ['Tax Type', 'tax_type', 'TaxType']),
      tax_base: this.parseFloat(this.getField(record, ['Tax Base', 'tax_base', 'TaxBase'])),
      tax_rate: this.parseFloat(this.getField(record, ['Tax Rate', 'tax_rate', 'TaxRate'])),
      tax_amount: this.parseFloat(this.getField(record, ['Tax Amount', 'tax_amount', 'TaxAmount'])),
      calculation_method: this.getField(record, ['Calculation Method', 'calculation_method', 'CalculationMethod']) || 'ad_valorem'
    };
  }

  /**
   * Get field value with multiple possible names
   */
  getField(record, possibleNames) {
    for (const name of possibleNames) {
      if (record[name] !== undefined && record[name] !== null && record[name] !== '') {
        return record[name];
      }
    }
    return null;
  }

  /**
   * Parse float safely
   */
  parseFloat(value) {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = parseFloat(String(value).replace(/,/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Parse int safely
   */
  parseInt(value) {
    if (value === null || value === undefined || value === '') return 1;
    const parsed = parseInt(String(value));
    return isNaN(parsed) ? 1 : parsed;
  }

  /**
   * Validate MRN format
   */
  isValidMRN(mrn) {
    if (!mrn) return false;
    // MRN format: YYGBxxxxxxxxxxxxxxxxx (2 digit year + GB + 15 alphanumeric)
    const mrnRegex = /^\d{2}GB[A-Z0-9]{15}$/i;
    return mrnRegex.test(mrn);
  }

  /**
   * Validate EORI format
   */
  isValidEORI(eori) {
    if (!eori) return false;
    // UK EORI: GB + 12 digits or GB + 15 alphanumeric
    const eoriRegex = /^GB\d{12}$|^GB[A-Z0-9]{15}$/i;
    return eoriRegex.test(eori);
  }

  /**
   * Validate commodity code
   */
  isValidCommodityCode(code) {
    if (!code) return false;
    // 10-digit HS code
    return /^\d{10}$/.test(code);
  }

  /**
   * Validate date format
   */
  isValidDate(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }
}
