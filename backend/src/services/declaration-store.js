import db, { storage } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Declaration Store Service
 * Handles in-memory storage for declarations
 */
export class DeclarationStore {
  /**
   * Save declarations from CSV import
   */
  saveBatch(userId, declarations, items, taxLines, errors, warnings, fileName) {
    const batchId = `BATCH-${Date.now()}`;
    
    // Save batch
    storage.batches.set(batchId, {
      batchId,
      userId,
      source: 'csv',
      fileName,
      declaration_count: declarations.length,
      item_count: items.length,
      tax_count: taxLines.length,
      status: 'completed',
      imported_at: new Date().toISOString()
    });

    // Save errors
    for (const error of errors) {
      const errorId = uuidv4();
      storage.errors.set(errorId, {
        id: errorId,
        batchId,
        ...error
      });
    }

    // Save declarations
    for (const decl of declarations) {
      const totalTaxes = (decl.total_duty_paid || 0) + (decl.total_vat_paid || 0) + (decl.total_excise_paid || 0);
      
      storage.declarations.set(decl.id, {
        ...decl,
        user_id: userId,
        total_taxes_paid: totalTaxes,
        batch_id: batchId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Save items
    for (const item of items) {
      const decl = declarations.find(d => d.mrn === item.declaration_mrn);
      if (decl) {
        storage.items.set(item.id, {
          ...item,
          declaration_id: decl.id,
          created_at: new Date().toISOString()
        });
      }
    }

    // Save tax lines
    for (const tax of taxLines) {
      const decl = declarations.find(d => d.mrn === tax.declaration_mrn);
      if (decl) {
        const item = items.find(i => 
          i.declaration_mrn === tax.declaration_mrn && 
          i.item_number === tax.item_number
        );
        
        if (item) {
          storage.taxes.set(tax.id, {
            ...tax,
            item_id: item.id,
            created_at: new Date().toISOString()
          });
        }
      }
    }

    return {
      batchId,
      declarations: declarations.length,
      items: items.length,
      taxLines: taxLines.length,
      errors
    };
  }

  /**
   * Get declarations with filters
   */
  getDeclarations(userId, filter = {}) {
    let results = Array.from(storage.declarations.values())
      .filter(d => d.user_id === userId);

    if (filter.mrn) {
      results = results.filter(d => d.mrn?.includes(filter.mrn));
    }

    if (filter.status) {
      results = results.filter(d => d.status === filter.status);
    }

    if (filter.batchId) {
      results = results.filter(d => d.batch_id === filter.batchId);
    }

    if (filter.client) {
      results = results.filter(d => 
        d.client_id === filter.client || 
        d.client_name?.includes(filter.client)
      );
    }

    if (filter.startDate) {
      results = results.filter(d => d.acceptance_date >= filter.startDate);
    }

    if (filter.endDate) {
      results = results.filter(d => d.acceptance_date <= filter.endDate);
    }

    // Sort
    results.sort((a, b) => {
      const dateCompare = new Date(b.acceptance_date) - new Date(a.acceptance_date);
      if (dateCompare !== 0) return dateCompare;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    if (filter.limit) {
      results = results.slice(0, parseInt(filter.limit));
    }

    return results;
  }

  /**
   * Get single declaration with items and taxes
   */
  getDeclaration(userId, id) {
    const declaration = storage.declarations.get(id);
    
    if (!declaration || declaration.user_id !== userId) return null;

    // Get items
    const items = Array.from(storage.items.values())
      .filter(item => item.declaration_id === id)
      .sort((a, b) => a.item_number - b.item_number);

    // Get taxes for each item
    for (const item of items) {
      item.taxes = Array.from(storage.taxes.values())
        .filter(tax => tax.item_id === item.id);
    }

    return {
      ...declaration,
      items
    };
  }

  /**
   * Delete declaration
   */
  deleteDeclaration(userId, id) {
    const declaration = storage.declarations.get(id);
    
    if (!declaration || declaration.user_id !== userId) return false;

    // Delete items and taxes
    const items = Array.from(storage.items.values())
      .filter(item => item.declaration_id === id);
    
    for (const item of items) {
      // Delete taxes
      for (const [taxId, tax] of storage.taxes) {
        if (tax.item_id === item.id) {
          storage.taxes.delete(taxId);
        }
      }
      storage.items.delete(item.id);
    }

    storage.declarations.delete(id);
    return true;
  }

  /**
   * Assign client to declaration
   */
  assignClient(userId, id, clientId, clientName) {
    const declaration = storage.declarations.get(id);
    
    if (!declaration || declaration.user_id !== userId) return false;

    declaration.client_id = clientId;
    declaration.client_name = clientName;
    declaration.updated_at = new Date().toISOString();
    
    return true;
  }

  /**
   * Get summary statistics
   */
  getSummary(userId) {
    const declarations = Array.from(storage.declarations.values())
      .filter(d => d.user_id === userId);

    const totalDeclarations = declarations.length;
    const totalValue = declarations.reduce((sum, d) => sum + (d.total_taxes_paid || 0), 0);
    const acceptedCount = declarations.filter(d => d.status === 'accepted').length;
    const releasedCount = declarations.filter(d => d.status === 'released').length;

    const recentImports = declarations
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);

    return {
      totalDeclarations,
      totalValue,
      acceptedCount,
      releasedCount,
      recentImports
    };
  }

  /**
   * Get import batches
   */
  getBatches(userId) {
    return Array.from(storage.batches.values())
      .filter(b => b.userId === userId)
      .sort((a, b) => new Date(b.imported_at) - new Date(a.imported_at));
  }

  /**
   * Get batch errors
   */
  getBatchErrors(batchId) {
    return Array.from(storage.errors.values())
      .filter(e => e.batchId === batchId)
      .sort((a, b) => (a.row_number || 0) - (b.row_number || 0));
  }

  /**
   * Save declaration from HMRC API
   */
  saveFromHMRC(userId, declaration) {
    const id = uuidv4();
    
    storage.declarations.set(id, {
      id,
      user_id: userId,
      mrn: declaration.mrn,
      entry_number: declaration.entry_number,
      acceptance_date: declaration.acceptance_date,
      declaration_type: declaration.declaration_type,
      trader_eori: declaration.trader_eori,
      importer_eori: declaration.importer_eori,
      procedure_code: declaration.procedure_code,
      status: declaration.status,
      total_duty_paid: declaration.total_duty_paid || 0,
      total_vat_paid: declaration.total_vat_paid || 0,
      total_excise_paid: declaration.total_excise_paid || 0,
      total_taxes_paid: (declaration.total_duty_paid || 0) + (declaration.total_vat_paid || 0) + (declaration.total_excise_paid || 0),
      declaration_source: 'hmrc_api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return id;
  }
}
