import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { storage } from './storage';
import type { InsertProduct } from '@shared/schema';
import { shouldReplaceProduct } from './simple-quality-priority';
import { GenericCSVMapper } from './generic-csv-mapper';

interface ChattanoogaCSVRow {
  SKU: string;
  'Item Name': string;
  'Quantity In Stock': string;
  Price: string;
  UPC: string;
  'Web Item Name': string;
  'Web Item Description': string;
  'Drop Ship Flag': string;
  'Drop Ship Price': string;
  Category: string;
  'Ship Weight': string;
  'Image Location': string;
  Manufacturer: string;
  'Manufacturer Item Number': string;
  Length: string;
  Width: string;
  Height: string;
  MAP: string;
  MSRP: string;
  'Available Drop Ship Delivery Options': string;
  'Allocated Item?': string;
  Specifications: string;
  'Retail MAP': string;
}

export class ChattanoogaCSVImporter {
  
  static async importFromCSV(csvFilePath: string): Promise<{ 
    imported: number; 
    skipped: number; 
    errors: string[];
  }> {
    console.log('🔄 Starting Chattanooga CSV import with contract-based mapping...');
    
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[]
    };

    // STRICT CONTRACT ENFORCEMENT: Check for approved mapping
    await this.validateApprovedMapping();

    try {
      // Read and clean CSV file content
      let csvContent = fs.readFileSync(csvFilePath, 'utf-8');
      
      // Clean malformed quotes and non-printable characters that cause parsing errors
      csvContent = csvContent
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove non-printable chars
        .replace(/\"\s*[^\"\r\n,]+\s*\"/g, (match) => {
          // Fix quotes with content after closing quote
          return match.replace(/\"\s*([^\"\r\n,]+)\s*\"/, '"$1"');
        });

      let records: ChattanoogaCSVRow[] = [];
      
      try {
        records = parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          quote: '"',
          escape: '"',
          relax_quotes: true, // Allow unescaped quotes
          relax_column_count: true // Allow inconsistent column counts
        });
      } catch (parseError: any) {
        console.log('❌ Primary CSV parsing failed, trying more relaxed parsing...');
        console.log('Parse error:', parseError.message);
        
        // Try with more relaxed settings
        try {
          records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            quote: '',  // Disable quote handling entirely
            relax_quotes: true,
            relax_column_count: true
          });
        } catch (secondaryError: any) {
          console.error('❌ Secondary CSV parsing also failed:', secondaryError.message);
          results.errors.push(`CSV parsing failed: ${secondaryError.message}`);
          return results;
        }
      }

      console.log(`📊 Found ${records.length} products in CSV`);

      // Deduplicate records by UPC (keep last occurrence for most recent data)
      const deduplicatedRecords = new Map<string, ChattanoogaCSVRow>();
      for (const record of records) {
        if (record.UPC && record.UPC.trim()) {
          deduplicatedRecords.set(record.UPC.trim(), record);
        }
      }
      
      const duplicatesRemoved = records.length - deduplicatedRecords.size;
      if (duplicatesRemoved > 0) {
        console.log(`🔄 Removed ${duplicatesRemoved} duplicate UPC entries (${deduplicatedRecords.size} unique products)`);
      }
      
      const uniqueRecords = Array.from(deduplicatedRecords.values());

      for (let index = 0; index < uniqueRecords.length; index++) {
        const row = uniqueRecords[index];
        try {
          // Validate required fields
          if (!row.UPC || !row['Item Name'] || !row.Manufacturer) {
            results.skipped++;
            results.errors.push(`Row ${index + 1}: Missing required fields (UPC, Item Name, or Manufacturer)`);
            continue;
          }

          // Clean and validate UPC
          const cleanUPC = row.UPC.replace(/[^0-9]/g, '');
          if (cleanUPC.length !== 12) {
            results.skipped++;
            results.errors.push(`Row ${index + 1}: Invalid UPC format: ${row.UPC}`);
            continue;
          }

          // Check if product already exists
          const existingProduct = await storage.getProductByUPC(cleanUPC);
          
          // Parse numeric fields safely
          const parsePrice = (priceStr: string): number | null => {
            if (!priceStr || priceStr.trim() === '') return null;
            const cleaned = priceStr.replace(/[$,]/g, '');
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? null : parsed;
          };

          const parseWeight = (weightStr: string): number | null => {
            if (!weightStr || weightStr.trim() === '') return null;
            const parsed = parseFloat(weightStr);
            return isNaN(parsed) ? null : parsed;
          };

          // Decode HTML entities in text fields
          const decodeHtmlEntities = (text: string): string => {
            if (!text) return text;
            
            return text
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&nbsp;/g, ' ')
              .replace(/&mdash;/g, '—');
          };

          // Parse category hierarchy from combined category|subcategory strings
          const parseCategoryHierarchy = (categoryStr: string): {
            category: string | null;
            subcategory1: string | null;
            subcategory2: string | null;
            subcategory3: string | null;
          } => {
            if (!categoryStr) {
              return { category: null, subcategory1: null, subcategory2: null, subcategory3: null };
            }

            // Decode HTML entities first
            const decoded = decodeHtmlEntities(categoryStr.trim());
            
            // Split by pipe separator
            const parts = decoded.split('|').map(part => part.trim()).filter(part => part.length > 0);
            
            return {
              category: parts[0] || null,
              subcategory1: parts[1] || null,
              subcategory2: parts[2] || null,
              subcategory3: parts[3] || null
            };
          };

          // Extract caliber from description if possible
          const extractCaliber = (description: string): string | null => {
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
          };

          // Parse category hierarchy
          const categoryHierarchy = parseCategoryHierarchy(row.Category);

          // Apply vendor field mapping using generic engine
          const mappedData = await GenericCSVMapper.mapCSVRowToProduct(
            row as Record<string, any>,
            'Chattanooga Shooting Supplies',
            'Default'
          );

          if (!mappedData) {
            results.skipped++;
            results.errors.push(`Row ${index + 1}: Failed to map CSV data using vendor field mapping`);
            continue;
          }

          // STRICT CONTRACT ENFORCEMENT - NO CSV FALLBACKS ALLOWED
          // Validate ALL required mapped fields exist
          if (!mappedData.name || !mappedData.brand) {
            results.skipped++;
            results.errors.push(`Row ${index + 1}: Contract mapping failed - missing required fields (name: ${!!mappedData.name}, brand: ${!!mappedData.brand})`);
            continue;
          }

          // Create product object (NO PRICING - pricing goes to vendorProductMappings)
          const productData: InsertProduct = {
            upc: cleanUPC,
            name: mappedData.name, // STRICT: Only use mapped data, no fallbacks
            brand: mappedData.brand, // STRICT: Only use mapped data, no fallbacks
            model: mappedData.model, // Use mapped model (could be null if extraction fails)
            manufacturerPartNumber: mappedData.manufacturerPartNumber, // STRICT: Only use mapped data, no fallbacks
            category: categoryHierarchy.category,
            subcategory1: categoryHierarchy.subcategory1,
            subcategory2: categoryHierarchy.subcategory2,
            subcategory3: categoryHierarchy.subcategory3,
            caliber: mappedData.caliber, // STRICT: Only use mapped data, no fallbacks
            description: mappedData.description, // STRICT: Only use mapped data, no fallbacks
            specifications: null,
            serialized: mappedData.serialized ?? this.determineSerializedStatus(row['Item Name'], row.Category),
            retailVerticalId: (await import('@shared/retail-vertical-config')).DEFAULT_RETAIL_VERTICAL.id,
            source: 'chattanooga', // Using vendor slug for consistent priority matching
            imageUrl: row['Image Location']?.trim() || null, // Initial Chattanooga image - fallback will be applied later
            imageSource: (row['Image Location']?.trim()) ? 'chattanooga' : null // Use vendor slug for internal references
          };

          if (existingProduct) {
            // Use simple quality-based priority system
            if (await shouldReplaceProduct(existingProduct, productData, 'chattanooga')) {
              // Update product with new data (no complex metadata)
              await storage.updateProduct(existingProduct.id, productData);
              console.log(`CHATTANOOGA CSV: Replaced existing product data for UPC ${cleanUPC}`);
              results.imported++;
            } else {
              results.skipped++;
            }
          } else {
            // Create new product (no complex metadata)
            await storage.createProduct(productData);
            results.imported++;
          }

          // Apply image fallback logic only if needed (respects existing images)
          try {
            const { ImageFallbackService } = await import('./image-fallback-service');
            
            // Only apply fallback if the product needs it (no existing image)
            const needsFallback = await ImageFallbackService.needsImageFallback(cleanUPC);
            if (needsFallback) {
              await ImageFallbackService.updateProductImageWithFallback(cleanUPC, 'Chattanooga Shooting Supplies');
              console.log(`CHATTANOOGA CSV: Applied image fallback for UPC ${cleanUPC}`);
            } else {
              console.log(`CHATTANOOGA CSV: Skipping image fallback for UPC ${cleanUPC} - image already exists`);
            }
          } catch (error: any) {
            console.error(`CHATTANOOGA CSV: Image fallback failed for UPC ${cleanUPC}:`, error.message);
            // Continue processing - image fallback failure shouldn't stop the import
          }

          // Progress logging
          if (results.imported % 100 === 0) {
            console.log(`📦 Imported ${results.imported} products...`);
          }

        } catch (error) {
          results.errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          results.skipped++;
        }
      }

      console.log(`✅ Import complete: ${results.imported} imported, ${results.skipped} skipped`);
      if (results.errors.length > 0) {
        console.log(`⚠️  Errors encountered: ${results.errors.length}`);
        results.errors.slice(0, 10).forEach(error => console.log(`   ${error}`));
        if (results.errors.length > 10) {
          console.log(`   ... and ${results.errors.length - 10} more errors`);
        }
      }

    } catch (error) {
      console.error('❌ CSV import failed:', error);
      results.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return results;
  }

  /**
   * STRICT CONTRACT VALIDATION: Check for approved vendor field mapping
   * SECURITY: No auto-creation allowed - must use pre-approved contracts only
   */
  private static async validateApprovedMapping(): Promise<void> {
    const vendorSource = 'Chattanooga Shooting Supplies';
    const mappingName = 'Default';
    
    const existingMapping = await storage.getVendorFieldMapping(vendorSource, mappingName);
    
    if (!existingMapping) {
      throw new Error(`SECURITY VIOLATION: No vendor field mapping found for ${vendorSource}:${mappingName}. Mappings must be pre-approved by admin. Auto-creation is disabled for security.`);
    }
    
    // CRITICAL: Check contract approval status
    if (existingMapping.status !== 'approved' && existingMapping.status !== 'active') {
      throw new Error(`SECURITY VIOLATION: Vendor field mapping for ${vendorSource}:${mappingName} has status '${existingMapping.status}'. Only 'approved' or 'active' mappings allowed.`);
    }
    
    // Validate mapping has required fields
    const requiredFields = ['upc', 'name', 'brand'];
    const columnMappings = existingMapping.columnMappings as Record<string, string>;
    
    for (const field of requiredFields) {
      if (!columnMappings[field]) {
        throw new Error(`SECURITY VIOLATION: Approved mapping for ${vendorSource}:${mappingName} missing required field mapping: ${field}`);
      }
    }
    
    console.log(`✅ APPROVED contract found for ${vendorSource}:${mappingName} (status: ${existingMapping.status})`);
  }

  private static determineSerializedStatus(description: string, category: string): boolean {
    // Firearms that require serial number tracking
    const serializedKeywords = [
      'rifle', 'pistol', 'revolver', 'firearm', 'gun', 'carbine', 
      'shotgun', 'receiver', 'frame', 'glock', 'ar-15', 'ak-47',
      'semi-auto', 'bolt action', 'handgun', 'submachine', 'machine gun',
      'assault rifle', 'sniper rifle', 'hunting rifle', 'target rifle'
    ];
    
    const combinedText = `${description} ${category}`.toLowerCase();
    return serializedKeywords.some(keyword => combinedText.includes(keyword));
  }
}