/**
 * Product Catalog Migration Script: Dev → Production
 * 
 * Safely migrates product catalog from one database to another with:
 * - Conflict resolution (UPC uniqueness)
 * - Foreign key remapping
 * - Detailed logging
 * - Dry-run mode
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { products, vendorProductMappings, vendorInventory } from './shared/schema';
import { eq, inArray } from 'drizzle-orm';
import ws from 'ws';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

interface MigrationConfig {
  source: {
    connectionString: string;
    label: string;
  };
  target: {
    connectionString: string;
    label: string;
  };
  options: {
    dryRun: boolean;
    updateExisting: boolean;  // Update existing products or skip?
    batchSize: number;
    includeCompanySpecific: boolean;  // Migrate Bill Hicks company-specific pricing?
  };
}

interface MigrationStats {
  productsProcessed: number;
  productsInserted: number;
  productsUpdated: number;
  productsSkipped: number;
  mappingsInserted: number;
  inventoryInserted: number;
  errors: string[];
}

async function migrateProductCatalog(config: MigrationConfig): Promise<MigrationStats> {
  const stats: MigrationStats = {
    productsProcessed: 0,
    productsInserted: 0,
    productsUpdated: 0,
    productsSkipped: 0,
    mappingsInserted: 0,
    inventoryInserted: 0,
    errors: []
  };

  console.log(`\n🚀 MIGRATION START: ${config.source.label} → ${config.target.label}`);
  console.log(`Mode: ${config.options.dryRun ? '🔍 DRY RUN' : '✅ LIVE'}\n`);

  // Connect to source database
  const sourcePool = new Pool({ connectionString: config.source.connectionString });
  const sourceDb = drizzle(sourcePool);
  console.log(`✅ Connected to SOURCE: ${config.source.label}`);

  // Connect to target database
  const targetPool = new Pool({ connectionString: config.target.connectionString });
  const targetDb = drizzle(targetPool);
  console.log(`✅ Connected to TARGET: ${config.target.label}\n`);

  try {
    // Step 1: Fetch all products from source
    console.log('📥 Step 1: Fetching products from source...');
    const sourceProducts = await sourceDb.select().from(products);
    console.log(`   Found ${sourceProducts.length} products in source\n`);

    // Step 2: Get existing products in target (for conflict detection)
    console.log('🔍 Step 2: Checking for existing products in target...');
    const targetProducts = await targetDb.select().from(products);
    const targetProductsByUPC = new Map(targetProducts.map(p => [p.upc, p]));
    console.log(`   Found ${targetProducts.length} existing products in target\n`);

    // Step 3: Process products in batches
    console.log('⚙️  Step 3: Processing products...');
    const oldIdToNewIdMap = new Map<number, number>();

    for (const sourceProduct of sourceProducts) {
      stats.productsProcessed++;

      try {
        const existingProduct = targetProductsByUPC.get(sourceProduct.upc);

        if (existingProduct) {
          // Product exists - update or skip
          if (config.options.updateExisting) {
            if (!config.options.dryRun) {
              await targetDb
                .update(products)
                .set({
                  name: sourceProduct.name,
                  brand: sourceProduct.brand,
                  model: sourceProduct.model,
                  manufacturerPartNumber: sourceProduct.manufacturerPartNumber,
                  caliber: sourceProduct.caliber,
                  category: sourceProduct.category,
                  description: sourceProduct.description,
                  imageUrl: sourceProduct.imageUrl,
                  imageSource: sourceProduct.imageSource,
                  source: sourceProduct.source,
                  specifications: sourceProduct.specifications,
                  updatedAt: new Date()
                })
                .where(eq(products.id, existingProduct.id));
            }
            oldIdToNewIdMap.set(sourceProduct.id, existingProduct.id);
            stats.productsUpdated++;
            console.log(`   ✏️  Updated: ${sourceProduct.upc} - ${sourceProduct.name}`);
          } else {
            oldIdToNewIdMap.set(sourceProduct.id, existingProduct.id);
            stats.productsSkipped++;
          }
        } else {
          // Product doesn't exist - insert
          if (!config.options.dryRun) {
            const [newProduct] = await targetDb
              .insert(products)
              .values({
                upc: sourceProduct.upc,
                name: sourceProduct.name,
                brand: sourceProduct.brand,
                model: sourceProduct.model,
                manufacturerPartNumber: sourceProduct.manufacturerPartNumber,
                altId1: sourceProduct.altId1,
                altId2: sourceProduct.altId2,
                caliber: sourceProduct.caliber,
                category: sourceProduct.category,
                subcategory1: sourceProduct.subcategory1,
                subcategory2: sourceProduct.subcategory2,
                subcategory3: sourceProduct.subcategory3,
                description: sourceProduct.description,
                barrelLength: sourceProduct.barrelLength,
                imageUrl: sourceProduct.imageUrl,
                imageSource: sourceProduct.imageSource,
                source: sourceProduct.source,
                serialized: sourceProduct.serialized,
                allocated: sourceProduct.allocated,
                specifications: sourceProduct.specifications,
                priorityScore: sourceProduct.priorityScore,
                prioritySource: sourceProduct.prioritySource,
                dataHash: sourceProduct.dataHash,
                customProperties: sourceProduct.customProperties,
                status: sourceProduct.status,
                retailVerticalId: sourceProduct.retailVerticalId
              })
              .returning();
            oldIdToNewIdMap.set(sourceProduct.id, newProduct.id);
          }
          stats.productsInserted++;
          console.log(`   ➕ Inserted: ${sourceProduct.upc} - ${sourceProduct.name}`);
        }
      } catch (error: any) {
        const errorMsg = `Failed to process product ${sourceProduct.upc}: ${error.message}`;
        stats.errors.push(errorMsg);
        console.error(`   ❌ ${errorMsg}`);
      }

      // Log progress every 100 products
      if (stats.productsProcessed % 100 === 0) {
        console.log(`   Progress: ${stats.productsProcessed}/${sourceProducts.length} products`);
      }
    }
    console.log(`\n   ✅ Products complete: ${stats.productsInserted} inserted, ${stats.productsUpdated} updated, ${stats.productsSkipped} skipped\n`);

    // Step 4: Migrate vendor product mappings
    if (!config.options.dryRun && oldIdToNewIdMap.size > 0) {
      console.log('📥 Step 4: Migrating vendor product mappings...');
      const sourceMappings = await sourceDb.select().from(vendorProductMappings);
      console.log(`   Found ${sourceMappings.length} mappings in source`);

      // Filter based on config options
      const mappingsToMigrate = config.options.includeCompanySpecific
        ? sourceMappings
        : sourceMappings.filter(m => m.companyId === null);

      console.log(`   Migrating ${mappingsToMigrate.length} mappings (${config.options.includeCompanySpecific ? 'including' : 'excluding'} company-specific)`);

      for (const mapping of mappingsToMigrate) {
        const newProductId = oldIdToNewIdMap.get(mapping.productId);
        if (!newProductId) {
          console.log(`   ⚠️  Skipping mapping for product ID ${mapping.productId} (not migrated)`);
          continue;
        }

        try {
          await targetDb
            .insert(vendorProductMappings)
            .values({
              productId: newProductId,
              supportedVendorId: mapping.supportedVendorId,
              companyId: mapping.companyId,
              vendorSku: mapping.vendorSku,
              vendorCost: mapping.vendorCost,
              mapPrice: mapping.mapPrice,
              msrpPrice: mapping.msrpPrice,
              lastPriceUpdate: mapping.lastPriceUpdate
            })
            .onConflictDoUpdate({
              target: [vendorProductMappings.productId, vendorProductMappings.supportedVendorId, vendorProductMappings.companyId],
              set: {
                vendorSku: mapping.vendorSku,
                vendorCost: mapping.vendorCost,
                mapPrice: mapping.mapPrice,
                msrpPrice: mapping.msrpPrice,
                lastPriceUpdate: mapping.lastPriceUpdate,
                updatedAt: new Date()
              }
            });
          stats.mappingsInserted++;
        } catch (error: any) {
          const errorMsg = `Failed to insert mapping for product ${newProductId}: ${error.message}`;
          stats.errors.push(errorMsg);
          console.error(`   ❌ ${errorMsg}`);
        }
      }
      console.log(`   ✅ Mappings complete: ${stats.mappingsInserted} inserted/updated\n`);

      // Step 5: Migrate vendor inventory
      console.log('📥 Step 5: Migrating vendor inventory...');
      const sourceInventory = await sourceDb.select().from(vendorInventory);
      console.log(`   Found ${sourceInventory.length} inventory records in source`);

      for (const inv of sourceInventory) {
        try {
          await targetDb
            .insert(vendorInventory)
            .values({
              supportedVendorId: inv.supportedVendorId,
              vendorSku: inv.vendorSku,
              quantityAvailable: inv.quantityAvailable,
              lastUpdated: inv.lastUpdated
            })
            .onConflictDoUpdate({
              target: [vendorInventory.supportedVendorId, vendorInventory.vendorSku],
              set: {
                quantityAvailable: inv.quantityAvailable,
                lastUpdated: inv.lastUpdated
              }
            });
          stats.inventoryInserted++;
        } catch (error: any) {
          const errorMsg = `Failed to insert inventory for SKU ${inv.vendorSku}: ${error.message}`;
          stats.errors.push(errorMsg);
        }
      }
      console.log(`   ✅ Inventory complete: ${stats.inventoryInserted} inserted/updated\n`);
    } else if (config.options.dryRun) {
      console.log('🔍 Step 4-5: Skipped (dry run mode)\n');
    }

  } finally {
    await sourcePool.end();
    await targetPool.end();
  }

  return stats;
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

async function main() {
  // Example: Dev → Production migration
  const config: MigrationConfig = {
    source: {
      connectionString: process.env.DEV_DATABASE_URL || '',
      label: 'Development'
    },
    target: {
      connectionString: process.env.PROD_DATABASE_URL || '',
      label: 'Production'
    },
    options: {
      dryRun: true,  // Set to false for actual migration
      updateExisting: true,  // Update existing products
      batchSize: 100,
      includeCompanySpecific: false  // Don't migrate Bill Hicks company-specific pricing
    }
  };

  // Validate configuration
  if (!config.source.connectionString || !config.target.connectionString) {
    console.error('❌ ERROR: Missing database connection strings');
    console.error('Set DEV_DATABASE_URL and PROD_DATABASE_URL environment variables');
    process.exit(1);
  }

  try {
    const stats = await migrateProductCatalog(config);

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`Products Processed: ${stats.productsProcessed}`);
    console.log(`  ➕ Inserted:      ${stats.productsInserted}`);
    console.log(`  ✏️  Updated:       ${stats.productsUpdated}`);
    console.log(`  ⏭️  Skipped:       ${stats.productsSkipped}`);
    console.log(`Mappings Inserted:  ${stats.mappingsInserted}`);
    console.log(`Inventory Inserted: ${stats.inventoryInserted}`);
    console.log(`Errors:             ${stats.errors.length}`);
    
    if (stats.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      stats.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    console.log('='.repeat(70) + '\n');

    if (config.options.dryRun) {
      console.log('🔍 DRY RUN COMPLETE - No changes were made');
      console.log('   Set dryRun: false to perform actual migration\n');
    } else {
      console.log('✅ MIGRATION COMPLETE\n');
    }

  } catch (error: any) {
    console.error('\n❌ MIGRATION FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { migrateProductCatalog, MigrationConfig, MigrationStats };


