import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { db } from './db';
import { products, vendorProducts, importJobs } from '@shared/schema';
import { sql, inArray, desc, eq } from 'drizzle-orm';
import { ImageConversionService } from './image-conversion-service';

export interface ImportJobStatus {
  id: string;
  filename: string;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  errorRows: number;
  skippedRows: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errors: Array<{ row: number; error: string; data: any }>;
  startTime: Date;
  endTime?: Date;
  settings: ImportSettings;
}

export interface ImportSettings {
  duplicateHandling: 'ignore' | 'overwrite';
  source: string;
  columnMapping: Record<string, string>;
  requiredFields: string[];
  retailVerticalId?: number; // Add retail vertical support for imports
}

export interface ImportPreview {
  headers: string[];
  sampleRows: any[];
  totalRows: number;
  detectedMappings: Record<string, string>;
  duplicateUPCs: string[];
  validationErrors: string[];
}

export class ImportService {
  private jobs = new Map<string, ImportJobStatus>();

  async previewCSV(filePath: string): Promise<ImportPreview> {
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    return this.previewCSVData(csvContent);
  }

  async previewCSVData(csvContent: string): Promise<ImportPreview> {
    try {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        from_line: 1,
        to_line: 11 // Only read first 10 data rows for preview
      });

      // For large files, parse just first 1000 rows to get total count and check duplicates
      const sampleSize = Math.min(1000, csvContent.split('\n').length - 1);
      const sampleRecords = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        from_line: 1,
        to_line: sampleSize + 1
      });

      // Get total row count without parsing entire file for performance
      const totalRows = csvContent.split('\n').length - 1; // Subtract header row

      const headers = Object.keys(records[0] || {});
      
      // Auto-detect column mappings based on common field names
      const detectedMappings = this.detectColumnMappings(headers);
      
      // Check for potential UPC duplicates in sample only for performance
      const upcColumn = detectedMappings.upc;
      const duplicateUPCs = upcColumn ? this.findDuplicateUPCs(sampleRecords, upcColumn) : [];
      
      // Validate required fields are mappable
      const validationErrors = this.validateMappings(detectedMappings, headers);

      return {
        headers,
        sampleRows: records.slice(0, 10),
        totalRows: totalRows,
        detectedMappings,
        duplicateUPCs,
        validationErrors
      };
    } catch (error: any) {
      throw new Error(`Failed to preview CSV: ${error.message}`);
    }
  }

  private detectColumnMappings(headers: string[]): Record<string, string> {
    const mappings: Record<string, string> = {};
    const lowerHeaders = headers.map(h => h.toLowerCase());

    // UPC detection patterns
    const upcPatterns = ['upc', 'upc code', 'upc_code', 'universal product code', 'barcode'];
    mappings.upc = this.findBestMatch(lowerHeaders, upcPatterns, headers);

    // Name detection patterns
    const namePatterns = ['name', 'product name', 'item name', 'description', 'item description', 'title'];
    mappings.name = this.findBestMatch(lowerHeaders, namePatterns, headers);

    // Brand detection patterns
    const brandPatterns = ['brand', 'manufacturer', 'make', 'mfg', 'vendor'];
    mappings.brand = this.findBestMatch(lowerHeaders, brandPatterns, headers);

    // Model detection patterns
    const modelPatterns = ['model', 'model number'];
    mappings.model = this.findBestMatch(lowerHeaders, modelPatterns, headers);

    // Part Number detection patterns (separate from model)
    const partNumberPatterns = ['part number', 'part_number', 'sku', 'item number'];
    mappings.partNumber = this.findBestMatch(lowerHeaders, partNumberPatterns, headers);

    // Manufacturer Part Number detection patterns
    const mfgPartNumberPatterns = ['manufacturer part number', 'mfg part number', 'manufacturer_part_number', 'mfg_part_number'];
    mappings.manufacturerPartNumber = this.findBestMatch(lowerHeaders, mfgPartNumberPatterns, headers);

    // Category detection patterns
    const categoryPatterns = ['category', 'type', 'class', 'group', 'department'];
    mappings.category = this.findBestMatch(lowerHeaders, categoryPatterns, headers);

    // Price detection patterns
    const msrpPatterns = ['msrp', 'retail price', 'list price', 'suggested retail'];
    mappings.msrp = this.findBestMatch(lowerHeaders, msrpPatterns, headers);

    const mapPatterns = ['map', 'minimum advertised price', 'retail map'];
    mappings.map = this.findBestMatch(lowerHeaders, mapPatterns, headers);

    // Weight detection patterns
    const weightPatterns = ['weight', 'item weight', 'shipping weight'];
    mappings.weight = this.findBestMatch(lowerHeaders, weightPatterns, headers);

    // Caliber detection patterns
    const caliberPatterns = ['caliber', 'calibre', 'gauge', 'cal'];
    mappings.caliber = this.findBestMatch(lowerHeaders, caliberPatterns, headers);

    // Image field detection patterns
    const imagePatterns = ['image', 'imagename', 'image_name', 'photo', 'picture', 'pic', 'img'];
    mappings.imageField = this.findBestMatch(lowerHeaders, imagePatterns, headers);

    return mappings;
  }

  private findBestMatch(lowerHeaders: string[], patterns: string[], originalHeaders: string[]): string {
    for (const pattern of patterns) {
      const index = lowerHeaders.findIndex(h => h.includes(pattern));
      if (index !== -1) {
        return originalHeaders[index];
      }
    }
    return '';
  }

  private findDuplicateUPCs(records: any[], upcColumn: string): string[] {
    if (!upcColumn) return [];
    
    const upcCounts = new Map<string, number>();
    const duplicates: string[] = [];

    for (const record of records) {
      const upc = this.cleanUPC(record[upcColumn]);
      if (upc && upc.length === 12) {
        const count = upcCounts.get(upc) || 0;
        upcCounts.set(upc, count + 1);
        if (count === 1) {
          duplicates.push(upc);
        }
      }
    }

    return duplicates;
  }

  private validateMappings(mappings: Record<string, string>, headers: string[]): string[] {
    const errors: string[] = [];

    if (!mappings.upc) {
      errors.push('UPC field is required but could not be auto-detected');
    }

    if (!mappings.name) {
      errors.push('Product Name field is required but could not be auto-detected');
    }

    return errors;
  }

  async checkExistingUPCs(upcs: string[]): Promise<string[]> {
    if (upcs.length === 0) return [];

    const existingUPCs: string[] = [];
    const batchSize = 1000; // Process UPCs in smaller batches

    // Process UPCs in batches to avoid PostgreSQL parameter limits
    for (let i = 0; i < upcs.length; i += batchSize) {
      const batch = upcs.slice(i, i + batchSize);
      
      try {
        const existing = await db.select({ upc: products.upc })
          .from(products)
          .where(inArray(products.upc, batch));

        existingUPCs.push(...existing.map(p => p.upc));
      } catch (error) {
        console.error(`Error checking UPC batch ${i}-${i + batch.length}:`, error);
        
        // Fall back to individual checks for this batch
        for (const upc of batch) {
          try {
            const result = await db.select({ upc: products.upc })
              .from(products)
              .where(sql`upc = ${upc}`)
              .limit(1);
            if (result.length > 0) {
              existingUPCs.push(result[0].upc);
            }
          } catch (individualError) {
            console.error(`Error checking individual UPC ${upc}:`, individualError);
          }
        }
      }
    }

    return existingUPCs;
  }

  async startImport(
    filePath: string, 
    settings: ImportSettings, 
    organizationId?: number
  ): Promise<string> {
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const filename = path.basename(filePath);
    const { getDefaultAdminUserId } = await import('@shared/import-config');
    const adminUserId = await getDefaultAdminUserId();
    return this.startImportFromData(csvContent, filename, settings, adminUserId, organizationId);
  }

  async startImportFromData(
    csvContent: string,
    filename: string,
    settings: ImportSettings, 
    userId: number,
    organizationId?: number
  ): Promise<string> {
    const jobId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    // Ensure all products are assigned to Firearms1 vertical for Phase 1 implementation
    if (!settings.retailVerticalId) {
      settings.retailVerticalId = (await import('@shared/retail-vertical-config')).DEFAULT_RETAIL_VERTICAL.id; // Use centralized retail vertical configuration
    }

    const job: ImportJobStatus = {
      id: jobId,
      filename: filename,
      totalRows: records.length,
      processedRows: 0,
      successfulRows: 0,
      errorRows: 0,
      skippedRows: 0,
      status: 'pending',
      errors: [],
      startTime: new Date(),
      settings
    };

    // Store in memory for active tracking
    this.jobs.set(jobId, job);

    // Also persist to database
    await db.insert(importJobs).values({
      id: jobId,
      organizationId,
      filename,
      totalRows: records.length,
      processedRows: 0,
      successfulRows: 0,
      errorRows: 0,
      skippedRows: 0,
      status: 'pending',
      settings: {
        duplicateHandling: settings.duplicateHandling,
        columnMapping: settings.columnMapping,
        requiredFields: settings.requiredFields,
        createVendorRelationships: false,
        retailVerticalId: settings.retailVerticalId
      },
      errors: [],
      createdBy: userId
    });

    // Start processing in background
    this.processImport(jobId, records, settings, organizationId).catch(error => {
      job.status = 'failed';
      job.errors.push({ row: -1, error: error.message, data: null });
      job.endTime = new Date();
      this.updateJobInDatabase(job);
    });

    return jobId;
  }

  private async processImport(
    jobId: string, 
    records: any[], 
    settings: ImportSettings,
    organizationId?: number
  ): Promise<void> {
    const job = this.jobs.get(jobId)!;
    job.status = 'processing';
    
    // Update status in database
    await this.updateJobInDatabase(job);

    const batchSize = 100;
    const { columnMapping, duplicateHandling, source } = settings;

    // For large imports, check duplicates individually during processing
    // instead of loading all existing UPCs upfront

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      for (const record of batch) {
        try {
          const productData = this.mapRecordToProduct(record, columnMapping, settings.retailVerticalId);
          
          // Add source tracking
          productData.source = settings.source;
          
          // Convert image data if present and vendor-specific conversion is needed
          if (productData.imageUrl && productData.imageSource === 'Pending Conversion') {
            const imageConversion = ImageConversionService.convertImageData(productData.imageUrl, settings.source);
            if (imageConversion.imageUrl) {
              productData.imageUrl = imageConversion.imageUrl;
              productData.imageSource = imageConversion.imageSource;
            } else if (imageConversion.error) {
              // Log conversion error but don't fail the import
              console.warn(`Image conversion failed for UPC ${productData.upc}:`, imageConversion.error);
              productData.imageUrl = null;
              productData.imageSource = null;
            }
          }
          
          if (!productData.upc || !productData.name) {
            const rawUpc = record[columnMapping.upc];
            const rawName = record[columnMapping.name];
            const availableColumns = Object.keys(record).join(', ');
            
            job.errors.push({
              row: job.processedRows + 1,
              error: `Missing required fields - UPC mapping: "${columnMapping.upc}" -> "${rawUpc}" (cleaned: "${productData.upc}"), Name mapping: "${columnMapping.name}" -> "${rawName}". Available columns: [${availableColumns}]`,
              data: record
            });
            job.errorRows++;
            job.processedRows++;
            continue;
          }

          // Handle duplicates by checking individually
          if (duplicateHandling === 'ignore') {
            const existing = await db.select({ id: products.id })
              .from(products)
              .where(sql`upc = ${productData.upc}`)
              .limit(1);
            
            if (existing.length > 0) {
              job.skippedRows++;
              job.processedRows++;
              continue;
            }
          }

          // Insert or update product
          let insertedProduct;
          if (duplicateHandling === 'overwrite') {
            // Try to update existing product first
            const existing = await db.select().from(products).where(sql`upc = ${productData.upc}`).limit(1);
            
            if (existing.length > 0) {
              await db.update(products)
                .set(productData)
                .where(sql`upc = ${productData.upc}`);
              insertedProduct = { id: existing[0].id, ...productData };
            } else {
              [insertedProduct] = await db.insert(products).values(productData).returning();
            }
          } else {
            [insertedProduct] = await db.insert(products).values(productData).returning();
          }

          // Products are added to Master Catalog for universal access
          // Real-time pricing comes from organization-specific vendor API connections

          job.successfulRows++;
        } catch (error: any) {
          job.errors.push({
            row: job.processedRows + 1,
            error: error.message,
            data: record
          });
          job.errorRows++;
        }

        job.processedRows++;
        
        // Update database every 50 rows for progress tracking
        if (job.processedRows % 50 === 0) {
          await this.updateJobInDatabase(job);
        }
      }

      // Update database after each batch
      await this.updateJobInDatabase(job);

      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    job.status = 'completed';
    job.endTime = new Date();
    
    // Final database update with completion status
    await this.updateJobInDatabase(job);
  }

  private parseCategoryHierarchy(categoryText: string): { category?: string; subcategory1?: string; subcategory2?: string; subcategory3?: string } {
    if (!categoryText || typeof categoryText !== 'string') {
      return {};
    }

    // Split on forward slashes and clean up each part
    const parts = categoryText.split('/').map(part => part.trim()).filter(part => part.length > 0);
    
    return {
      category: parts[0] || undefined,
      subcategory1: parts[1] || undefined,
      subcategory2: parts[2] || undefined,
      subcategory3: parts[3] || undefined
    };
  }

  private mapRecordToProduct(record: any, mapping: Record<string, string>, retailVerticalId?: number): any {
    const parsePrice = (value: string): number | null => {
      if (!value || value.trim() === '') return null;
      const cleaned = value.toString().replace(/[$,]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    };

    const parseWeight = (value: string): number | null => {
      if (!value || value.trim() === '') return null;
      const parsed = parseFloat(value.toString());
      return isNaN(parsed) ? null : parsed;
    };

    const extractCaliber = (description: string): string | null => {
      if (!description) return null;
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

    const determineFfl = (name: string, category?: string): boolean => {
      const fflKeywords = ['rifle', 'pistol', 'revolver', 'firearm', 'gun', 'carbine', 'shotgun', 'receiver', 'frame'];
      const combinedText = `${name} ${category || ''}`.toLowerCase();
      return fflKeywords.some(keyword => combinedText.includes(keyword));
    };

    // Process image field if mapped
    let imageUrl = null;
    let imageSource = null;
    if (mapping.imageField && record[mapping.imageField]) {
      const imageData = record[mapping.imageField]?.trim();
      if (imageData) {
        // Note: Source will be set by calling method, so we'll defer conversion
        // The conversion will happen in processImport method where we have access to vendor source
        imageUrl = imageData; // Store raw data temporarily
        imageSource = 'Pending Conversion';
      }
    }

    return {
      upc: this.cleanUPC(record[mapping.upc]),
      name: record[mapping.name]?.trim() || '',
      brand: record[mapping.brand]?.trim() || null,
      model: record[mapping.model]?.trim() || record[mapping.brand]?.trim() || null,
      partNumber: record[mapping.partNumber]?.trim() || record[mapping.model]?.trim() || null,
      manufacturerPartNumber: record[mapping.manufacturerPartNumber]?.trim() || null,
      ...this.parseCategoryHierarchy(record[mapping.category]),
      caliber: record[mapping.caliber] || extractCaliber(record[mapping.name] || ''),
      weight: parseWeight(record[mapping.weight]),
      mapPrice: parsePrice(record[mapping.map]),
      retailPrice: null, // NO MSRP MAPPING - User requires authentic vendor data only
      description: record[mapping.description]?.trim() || null,
      imageUrl,
      imageSource,
      specifications: mapping.specifications ? JSON.stringify({
        originalData: record[mapping.specifications]
      }) : null,
      fflRequired: determineFfl(record[mapping.name] || '', record[mapping.category]),
      serialized: determineFfl(record[mapping.name] || '', record[mapping.category]),
      dropShipAvailable: true,
      retailVerticalId: retailVerticalId || null,
      source: null // Will be set by the calling method
    };
  }

  private cleanUPC(upc: string): string | null {
    if (!upc || upc.trim() === '') return null;
    
    const cleaned = upc.toString().trim().replace(/[^0-9]/g, '');
    
    // Accept UPCs of different lengths and pad to 12 digits
    if (cleaned.length === 12) return cleaned;
    if (cleaned.length === 11) return '0' + cleaned; // Add leading zero
    if (cleaned.length === 10) return '00' + cleaned; // Add two leading zeros
    if (cleaned.length === 9) return '000' + cleaned; // Add three leading zeros
    if (cleaned.length === 8) return '0000' + cleaned; // Add four leading zeros
    if (cleaned.length === 13) return cleaned.substring(1); // Remove first digit (sometimes EAN-13)
    
    // For debugging - don't reject, just return null
    console.log(`UPC validation failed - Original: "${upc}", Cleaned: "${cleaned}", Length: ${cleaned.length}`);
    return null;
  }

  getJobStatus(jobId: string): ImportJobStatus | null {
    return this.jobs.get(jobId) || null;
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'processing') {
      job.status = 'failed';
      job.endTime = new Date();
      job.errors.push({
        row: job.processedRows,
        error: 'Import cancelled by user',
        data: {}
      });
      return true;
    }
    return false;
  }

  clearAllJobs(): void {
    this.jobs.clear();
  }

  async getAllJobs(): Promise<ImportJobStatus[]> {
    // Return empty array if table has schema issues
    try {
      // Get last 10 jobs from database, ordered by start time descending
      const dbJobs = await db.select()
        .from(importJobs)
        .orderBy(desc(importJobs.startTime))
        .limit(10);

      // Convert database jobs to ImportJobStatus format
      return dbJobs.map(dbJob => ({
      id: dbJob.id,
      filename: dbJob.filename,
      totalRows: dbJob.totalRows,
      processedRows: dbJob.processedRows || 0,
      successfulRows: dbJob.successfulRows || 0,
      errorRows: dbJob.errorRows || 0,
      skippedRows: dbJob.skippedRows || 0,
      status: dbJob.status as 'pending' | 'processing' | 'completed' | 'failed',
      errors: dbJob.errors || [],
      startTime: dbJob.startTime,
      endTime: dbJob.endTime || undefined,
      settings: {
        duplicateHandling: dbJob.settings.duplicateHandling,
        source: '', // Add source from settings if available
        columnMapping: dbJob.settings.columnMapping,
        requiredFields: dbJob.settings.requiredFields
      }
    }));
    } catch (error) {
      console.log('Import jobs table schema issue, returning empty array:', error);
      return [];
    }
  }

  // Alias for API compatibility
  async getJobs(): Promise<ImportJobStatus[]> {
    return this.getAllJobs();
  }

  async clearCompletedJobs(): Promise<void> {
    // Remove completed and failed jobs from database
    await db.delete(importJobs)
      .where(
        sql`${importJobs.status} IN ('completed', 'failed')`
      );

    // Also clear from memory
    const jobEntries = Array.from(this.jobs.entries());
    for (const [jobId, job] of jobEntries) {
      if (job.status === 'completed' || job.status === 'failed') {
        this.jobs.delete(jobId);
      }
    }
  }

  private async updateJobInDatabase(job: ImportJobStatus): Promise<void> {
    try {
      await db.update(importJobs)
        .set({
          processedRows: job.processedRows,
          successfulRows: job.successfulRows,
          errorRows: job.errorRows,
          skippedRows: job.skippedRows,
          status: job.status,
          errors: job.errors,
          endTime: job.endTime
        })
        .where(eq(importJobs.id, job.id));
    } catch (error) {
      console.error('Failed to update job in database:', error);
    }
  }
}

export const importService = new ImportService();