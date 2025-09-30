import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { db } from './db';
import { products, companyVendorCredentials, vendorProductMappings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from './storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Demo organization ID
const DEMO_GUN_STORE_COMPANY_ID = 5;

export interface MicroBizProduct {
  'Product Name': string;
  'SKU': string;
  'Style': string;
  'Vendor Name': string;
  'Brand': string;
  'Main Category': string;
  'Sub-Category': string;
  'Product Class': string;
  'Sub-Class': string;
  'Prompt for Price': string;
  'Replacement Cost': string;
  'Average Cost': string;
  'Price': string;
  'MSRP': string;
  'MAP': string;
  'Special Price': string;
  'Product Tax Class': string;
  'UPC': string;
  'Alternate SKU': string;
  'Product ID': string;
  'Item No': string;
  'Bin Location': string;
  'Storage Location': string;
  'Reorder Qty': string;
  'Reorder Level': string;
  'Vendor Minimum Order Qty': string;
  'Vendor Discontinued': string;
  'Status': string;
  'Allow Fractions': string;
  'Allow Discounts': string;
  'Allow Returns': string;
  'Image Path': string;
  'Special Price Begin Date': string;
  'Special Price End Date': string;
  'Product Note': string;
}

/**
 * Parse MicroBiz CSV file
 */
export function parseMicroBizCatalog(csvContent: string): MicroBizProduct[] {
  try {
    console.log('MICROBIZ IMPORT: Parsing CSV content...');
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`MICROBIZ IMPORT: Parsed ${records.length} products`);
    return records as MicroBizProduct[];
  } catch (error) {
    console.error('MICROBIZ IMPORT: Parse error:', error);
    throw new Error(`Failed to parse MicroBiz catalog: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process MicroBiz catalog for Bill Hicks (Demo Gun Store)
 */
export async function processMicroBizCatalog(companyId: number, catalogProducts: MicroBizProduct[]) {
  console.log(`MICROBIZ IMPORT: Processing ${catalogProducts.length} products for company ${companyId}`);
  
  // Get Bill Hicks vendor ID dynamically
  const billHicksVendorId = await storage.getBillHicksVendorId();
  
  let newProductsCreated = 0;
  let existingProductsUpdated = 0;
  let recordsSkipped = 0;

  for (const product of catalogProducts) {
    try {
      // Validate required fields
      if (!product.UPC || !product['Product Name'] || !product.SKU) {
        console.log(`MICROBIZ IMPORT: Skipping product with missing UPC, name, or SKU: ${product['Product Name']}`);
        recordsSkipped++;
        continue;
      }

      const upc = product.UPC.trim();
      const vendorSku = product.SKU.trim();
      
      // Check if product exists in Master Product Catalog
      const [existingProduct] = await db.select().from(products).where(eq(products.upc, upc));
      
      let productId: number;
      
      if (existingProduct) {
        console.log(`MICROBIZ IMPORT: Found existing product for UPC ${upc} (ID: ${existingProduct.id})`);
        productId = existingProduct.id;
        existingProductsUpdated++;
      } else {
        // Create new product in Master Product Catalog
        const [newProduct] = await db.insert(products).values({
          upc: upc,
          name: product['Product Name'].trim(),
          brand: product.Brand?.trim() || '', // Required field
          manufacturer: product['Vendor Name']?.trim() || product.Brand?.trim() || '',
          model: product['Product Note']?.trim() || null, // Using Product Note as model
          category: product['Main Category']?.trim() || null,
          subcategory: product['Sub-Category']?.trim() || null,
          description: product['Product Name'].trim(),
          source: 'Bill Hicks & Co.',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();
        
        console.log(`MICROBIZ IMPORT: Created new product for UPC ${upc} (ID: ${newProduct.id})`);
        productId = newProduct.id;
        newProductsCreated++;
      }
      
      // Create or update vendor product mapping
      const [existingMapping] = await db.select()
        .from(vendorProductMappings)
        .where(
          and(
            eq(vendorProductMappings.supportedVendorId, billHicksVendorId),
            eq(vendorProductMappings.vendorSku, vendorSku),
            eq(vendorProductMappings.productId, productId)
          )
        );
      
      if (existingMapping) {
        console.log(`MICROBIZ IMPORT: Updated mapping for ${vendorSku} → product ${productId}`);
      } else {
        await db.insert(vendorProductMappings).values({
          supportedVendorId: billHicksVendorId,
          vendorSku: vendorSku,
          productId: productId,
          companyId: companyId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`MICROBIZ IMPORT: Created mapping for ${vendorSku} → product ${productId}`);
      }

    } catch (error) {
      console.error(`MICROBIZ IMPORT: Error processing product ${product['Product Name']}:`, error);
      recordsSkipped++;
    }
  }

  console.log(`MICROBIZ IMPORT: Catalog sync complete - New: ${newProductsCreated}, Updated: ${existingProductsUpdated}, Skipped: ${recordsSkipped}`);
  
  return {
    newProductsCreated,
    existingProductsUpdated,
    recordsSkipped
  };
}

/**
 * Import MicroBiz catalog file for Demo Gun Store
 */
export async function importMicroBizFile(companyId: number, catalogFilePath: string) {
  console.log(`MICROBIZ IMPORT: Starting import for company ${companyId}`);
  
  try {
    // Read and parse catalog file
    console.log('MICROBIZ IMPORT: Reading catalog file...');
    const catalogContent = readFileSync(catalogFilePath, 'utf-8');
    const catalogProducts = parseMicroBizCatalog(catalogContent);
    
    // Process catalog (company-specific)
    const catalogResult = await processMicroBizCatalog(companyId, catalogProducts);
    
    console.log('MICROBIZ IMPORT: Import complete');
    
    return {
      catalog: catalogResult
    };
    
  } catch (error) {
    console.error('MICROBIZ IMPORT: Import failed:', error);
    
    // Get Bill Hicks vendor ID dynamically for error handling
    const billHicksVendorId = await storage.getBillHicksVendorId();
    
    // Update credentials with error status
    await db.update(companyVendorCredentials)
      .set({
        catalogSyncStatus: 'error',
        catalogSyncError: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(companyVendorCredentials.companyId, companyId),
          eq(companyVendorCredentials.supportedVendorId, billHicksVendorId)
        )
      );
    
    throw error;
  }
}

async function runMicroBizImport() {
  try {
    console.log('='.repeat(60));
    console.log('MICROBIZ IMPORT: Starting import for Demo Gun Store');
    console.log('='.repeat(60));
    
    // File path for attached MicroBiz template
    const catalogFile = path.join(__dirname, '..', 'attached_assets', 'Simple-product - template v2.1 (10)_1755702215121.csv');
    
    console.log('MICROBIZ IMPORT: Catalog file:', catalogFile);
    
    // Import the file
    const result = await importMicroBizFile(DEMO_GUN_STORE_COMPANY_ID, catalogFile);
    
    console.log('='.repeat(60));
    console.log('MICROBIZ IMPORT: Import Results');
    console.log('='.repeat(60));
    console.log('CATALOG RESULTS:');
    console.log('  New products created:', result.catalog.newProductsCreated);
    console.log('  Existing products updated:', result.catalog.existingProductsUpdated);
    console.log('  Records skipped:', result.catalog.recordsSkipped);
    console.log('='.repeat(60));
    console.log('MICROBIZ IMPORT: Import completed successfully');
    
  } catch (error) {
    console.error('='.repeat(60));
    console.error('MICROBIZ IMPORT: Import failed:', error);
    console.error('='.repeat(60));
  }
}

// Run the import directly
runMicroBizImport().then(() => {
  console.log('Import script completed');
}).catch((error) => {
  console.error('Import script failed:', error);
});

export { runMicroBizImport };