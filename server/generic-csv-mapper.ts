import { storage } from './storage';
import type { InsertProduct } from '@shared/schema';

/**
 * Generic CSV mapping engine that applies vendor field mappings from database
 * This replaces hardcoded field mappings in importers with configurable database mappings
 */
export class GenericCSVMapper {
  
  /**
   * Apply vendor field mapping to transform CSV row to product data
   * SECURITY: Only approved/active contracts allowed
   */
  static async mapCSVRowToProduct(
    csvRow: Record<string, any>, 
    vendorSource: string, 
    mappingName: string = 'Default'
  ): Promise<Partial<InsertProduct> | null> {
    
    // Get the field mapping from database
    const fieldMapping = await storage.getVendorFieldMapping(vendorSource, mappingName);
    if (!fieldMapping) {
      throw new Error(`SECURITY VIOLATION: No field mapping found for vendor: ${vendorSource}, mapping: ${mappingName}. Mappings must be pre-approved.`);
    }

    // CRITICAL CONTRACT VALIDATION: Only allow approved/active mappings
    if (fieldMapping.status !== 'approved' && fieldMapping.status !== 'active') {
      throw new Error(`SECURITY VIOLATION: Field mapping for ${vendorSource}:${mappingName} has status '${fieldMapping.status}'. Only 'approved' or 'active' mappings allowed for import.`);
    }

    const columnMappings = fieldMapping.columnMappings as Record<string, string>;
    const productData: Partial<InsertProduct> = {};

    // Apply basic field mappings
    for (const [productField, csvColumn] of Object.entries(columnMappings)) {
      const value = csvRow[csvColumn];
      if (value && typeof value === 'string' && value.trim()) {
        // Apply basic transforms and assign to product field
        productData[productField as keyof InsertProduct] = this.transformFieldValue(value.trim(), productField);
      }
    }

    // Update the mapping's last used timestamp
    await storage.updateVendorFieldMapping(fieldMapping.id, {
      lastUsed: new Date()
    });

    return productData;
  }

  /**
   * Apply basic field transformations
   */
  private static transformFieldValue(value: string, fieldName: string): any {
    switch (fieldName) {
      case 'upc':
        // Clean UPC - remove non-numeric characters
        return value.replace(/[^0-9]/g, '');
      
      case 'model':
        // Extract model from item name - look for common gun model patterns
        return this.extractGunModel(value);
      
      case 'description':
      case 'name':
        // Decode HTML entities and trim
        return this.decodeHtmlEntities(value);
      
      case 'caliber':
        // Extract caliber from text
        return this.extractCaliber(value);
      
      case 'serialized':
        // Determine if item requires serial tracking
        return this.determineSerializedStatus(value);
      
      default:
        return value;
    }
  }

  /**
   * Extract gun model from product name or description
   * ENHANCED: Avoids misclassifying calibers as models
   */
  private static extractGunModel(text: string): string | null {
    if (!text) return null;

    // CRITICAL: Filter out caliber patterns first to prevent misclassification
    const caliberExclusions = [
      // Common calibers that should NOT be treated as models
      /\b(9MM|22LR|223|556|762|40SW|45ACP|380ACP|12GA|20GA|16GA|10GA)\b/i,
      /\b(\d+MM|\d+GA|\d+GAUGE|\.\d+CAL)\b/i,
      /\b(\d+\.\d+MM)\b/i // e.g., 9.5mm, 6.5mm
    ];

    // SECURITY: Pre-filter caliber terms
    for (const pattern of caliberExclusions) {
      if (pattern.test(text)) {
        // If text contains caliber info, be more selective about model extraction
        return this.extractModelFromCaliberText(text);
      }
    }

    // Common gun model patterns for non-caliber text
    const modelPatterns = [
      // Specific known model patterns (e.g., "GX2", "PMX")
      /\b(GX2|PMX|AR15|AK47|M4A1|1911)\b/i,
      // Model with "Model" prefix
      /Model\s+([A-Z]+\d+[A-Z]*)/i,
      // Manufacturer model codes (letters followed by numbers)
      /\b([A-Z]{2,3}\d{2,4}[A-Z]?)\b/,
      // Dash-separated models (e.g., "AR-15", "AK-47")
      /\b([A-Z]{2,4}-\d+[A-Z]?)\b/
    ];

    for (const pattern of modelPatterns) {
      const match = text.match(pattern);
      if (match) {
        const model = match[1];
        // Enhanced filter to exclude more non-model terms
        const excludeTerms = [
          'UPC', 'SKU', 'NEW', 'BLACK', 'BLUE', 'RED', 'AUTO',
          'INCH', 'FEET', 'LBS', 'OZ', 'MM', 'GA', 'CAL'
        ];
        if (!excludeTerms.includes(model.toUpperCase())) {
          return model;
        }
      }
    }

    return null;
  }

  /**
   * Extract model from text that contains caliber information
   * More conservative approach to avoid caliber misclassification
   */
  private static extractModelFromCaliberText(text: string): string | null {
    // Only look for very specific model patterns when caliber is present
    const conservativePatterns = [
      // Explicit model callouts
      /Model\s+([A-Z]+\d+)/i,
      // Known gun model abbreviations
      /\b(GX2|PMX|AR15|AK47|M4A1|M16A4)\b/i
    ];

    for (const pattern of conservativePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null; // Conservative: return null if unsure
  }

  /**
   * Extract caliber from description
   */
  private static extractCaliber(description: string): string | null {
    const caliberPatterns = [
      /(\d+(?:\.\d+)?mm)/i,
      /(\.\d+\s*cal)/i,
      /(\d+ga)/i,
      /(\d+\s*gauge)/i,
      /(22lr|223|556|762|9mm|40sw|45acp|380acp)/i
    ];
    
    for (const pattern of caliberPatterns) {
      const match = description.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  /**
   * Determine if item requires serial number tracking
   */
  private static determineSerializedStatus(description: string): boolean {
    const serializedKeywords = [
      'rifle', 'pistol', 'revolver', 'firearm', 'gun', 'carbine', 
      'shotgun', 'receiver', 'frame', 'glock', 'ar-15', 'ak-47',
      'semi-auto', 'bolt action', 'handgun', 'submachine', 'machine gun',
      'assault rifle', 'sniper rifle', 'hunting rifle', 'target rifle'
    ];
    
    const text = description.toLowerCase();
    return serializedKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Decode HTML entities in text fields
   */
  private static decodeHtmlEntities(text: string): string {
    if (!text) return text;
    
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&mdash;/g, '—');
  }

  /**
   * Validate that required fields are present in mapping
   */
  static validateMapping(columnMappings: Record<string, string>, requiredFields: string[] = ['upc', 'name']): string[] {
    const errors: string[] = [];
    
    for (const field of requiredFields) {
      if (!columnMappings[field]) {
        errors.push(`Missing required field mapping: ${field}`);
      }
    }
    
    return errors;
  }

  /**
   * Preview mapping results for first N rows (dry-run)
   */
  static async previewMapping(
    csvRows: Record<string, any>[], 
    vendorSource: string, 
    mappingName: string = 'Default',
    limit: number = 5
  ): Promise<{ preview: any[], errors: string[] }> {
    const preview: any[] = [];
    const errors: string[] = [];

    const sampleRows = csvRows.slice(0, limit);
    
    for (let i = 0; i < sampleRows.length; i++) {
      try {
        const mapped = await this.mapCSVRowToProduct(sampleRows[i], vendorSource, mappingName);
        preview.push({
          row: i + 1,
          original: sampleRows[i],
          mapped
        });
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { preview, errors };
  }
}