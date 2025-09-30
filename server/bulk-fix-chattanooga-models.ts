#!/usr/bin/env node
import { storage } from './storage';
import { GenericCSVMapper } from './generic-csv-mapper';
import type { Product } from '@shared/schema';

/**
 * Bulk fix script for 21,363 Chattanooga products with incorrect model extraction
 * Fixes the bug where model and manufacturerPartNumber were identical due to hardcoded mappings
 */

interface FixStats {
  total: number;
  processed: number;
  fixed: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
}

async function bulkFixChattanoogaModels(): Promise<FixStats> {
  console.log('🔧 Bulk Fix: Chattanooga Product Models');
  console.log('=====================================');
  
  const stats: FixStats = {
    total: 0,
    processed: 0,
    fixed: 0,
    skipped: 0,
    errors: 0,
    errorDetails: []
  };
  
  try {
    // Step 1: Find all Chattanooga products with identical model and manufacturerPartNumber
    console.log('\n📊 Step 1: Finding affected Chattanooga products...');
    
    const chattanoogaProducts = await findAffectedChattanoogaProducts();
    stats.total = chattanoogaProducts.length;
    
    console.log(`✅ Found ${stats.total} Chattanooga products with potential model extraction issues`);
    
    if (stats.total === 0) {
      console.log('🎉 No products need fixing!');
      return stats;
    }
    
    // Step 2: Process products in batches
    console.log('\n🔄 Step 2: Processing products with new model extraction...');
    
    const BATCH_SIZE = 100;
    for (let i = 0; i < chattanoogaProducts.length; i += BATCH_SIZE) {
      const batch = chattanoogaProducts.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(chattanoogaProducts.length/BATCH_SIZE)} (${batch.length} products)...`);
      
      for (const product of batch) {
        stats.processed++;
        
        try {
          const result = await fixProductModel(product);
          
          if (result.fixed) {
            stats.fixed++;
            console.log(`✅ Fixed UPC ${product.upc}: Model "${result.oldModel}" → "${result.newModel}"`);
          } else {
            stats.skipped++;
            if (result.reason) {
              console.log(`⏭️  Skipped UPC ${product.upc}: ${result.reason}`);
            }
          }
          
        } catch (error) {
          stats.errors++;
          const errorMsg = `UPC ${product.upc}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          stats.errorDetails.push(errorMsg);
          console.log(`❌ Error: ${errorMsg}`);
        }
        
        // Progress update every 50 products
        if (stats.processed % 50 === 0) {
          console.log(`📈 Progress: ${stats.processed}/${stats.total} processed, ${stats.fixed} fixed, ${stats.skipped} skipped, ${stats.errors} errors`);
        }
      }
    }
    
    // Step 3: Summary
    console.log('\n📋 Bulk Fix Summary');
    console.log('==================');
    console.log(`📊 Total products: ${stats.total}`);
    console.log(`✅ Successfully fixed: ${stats.fixed}`);
    console.log(`⏭️  Skipped (no change needed): ${stats.skipped}`);
    console.log(`❌ Errors: ${stats.errors}`);
    
    if (stats.errors > 0) {
      console.log('\n🚨 Error Details:');
      stats.errorDetails.slice(0, 10).forEach(error => console.log(`   - ${error}`));
      if (stats.errorDetails.length > 10) {
        console.log(`   ... and ${stats.errorDetails.length - 10} more errors`);
      }
    }
    
    const successRate = stats.total > 0 ? ((stats.fixed + stats.skipped) / stats.total * 100).toFixed(1) : '100';
    console.log(`\n🎯 Success rate: ${successRate}%`);
    
    if (stats.fixed > 0) {
      console.log(`\n🎉 SUCCESS: Fixed model extraction for ${stats.fixed} Chattanooga products!`);
      console.log('   Models are now properly separated from manufacturer part numbers.');
    }
    
  } catch (error) {
    console.error('💥 Bulk fix script failed:', error);
    stats.errors++;
    stats.errorDetails.push(error instanceof Error ? error.message : 'Script failed');
  }
  
  return stats;
}

/**
 * Find all Chattanooga products that need model extraction fixes
 */
async function findAffectedChattanoogaProducts(): Promise<Product[]> {
  // Get all products from Chattanooga Shooting Supplies source
  const allProducts = await storage.getAllProducts();
  
  return allProducts.filter(product => 
    product.source === 'Chattanooga Shooting Supplies' &&
    product.model &&
    product.manufacturerPartNumber &&
    product.model === product.manufacturerPartNumber // Bug: identical values
  );
}

/**
 * Fix model extraction for a single product
 */
async function fixProductModel(product: Product): Promise<{
  fixed: boolean;
  oldModel: string | null;
  newModel: string | null;
  reason?: string;
}> {
  const oldModel = product.model;
  
  // Create a mock CSV row for the generic mapper
  const mockCSVRow = {
    'UPC': product.upc,
    'Item Name': product.name,
    'Manufacturer': product.brand,
    'Manufacturer Item Number': product.manufacturerPartNumber,
    'Web Item Description': product.description || '',
    'Category': [product.category, product.subcategory1, product.subcategory2, product.subcategory3]
      .filter(Boolean)
      .join('|')
  };
  
  // Use GenericCSVMapper to extract the correct model
  const mappedData = await GenericCSVMapper.mapCSVRowToProduct(
    mockCSVRow,
    'Chattanooga Shooting Supplies',
    'Default'
  );
  
  if (!mappedData) {
    return {
      fixed: false,
      oldModel,
      newModel: null,
      reason: 'Mapping failed'
    };
  }
  
  const newModel = mappedData.model;
  
  // Check if model extraction improved the situation
  if (!newModel) {
    return {
      fixed: false,
      oldModel,
      newModel: null,
      reason: 'No model extracted'
    };
  }
  
  if (newModel === oldModel) {
    return {
      fixed: false,
      oldModel,
      newModel,
      reason: 'Model unchanged'
    };
  }
  
  if (newModel === product.manufacturerPartNumber) {
    return {
      fixed: false,
      oldModel,
      newModel,
      reason: 'Model still identical to manufacturer part'
    };
  }
  
  // Update only the model field, keep everything else unchanged
  await storage.updateProduct(product.id, {
    model: newModel
  });
  
  return {
    fixed: true,
    oldModel,
    newModel
  };
}

// Run script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  bulkFixChattanoogaModels()
    .then((stats) => {
      console.log('\n🏁 Bulk fix complete');
      process.exit(stats.errors > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('💥 Bulk fix script crashed:', error);
      process.exit(1);
    });
}

export { bulkFixChattanoogaModels };