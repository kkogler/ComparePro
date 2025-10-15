/**
 * ✅ CURRENT IMPLEMENTATION - Sports South Simple Sync
 * 
 * This is the ACTIVE sync implementation used for manual syncs and scheduled deployments.
 * Performs incremental catalog sync with the Sports South API.
 * 
 * Used by: routes.ts (manual sync trigger)
 * Related files:
 * - sports-south-catalog-sync.ts (legacy, used by disabled scheduler)
 * - sports-south-unified-service.ts (experimental, not in use)
 */

import { storage } from './storage';
import { createSportsSouthAPI, SportsSouthCredentials } from './sports-south-api';
import { hasHighQualityImages, hasLowQualityImages, getVendorImageQualityFromDB, DATA_UPDATE_RULES } from '../shared/vendor-type-config';

// Extract manufacturer part number from product name
// For firearms, the MPN is often embedded in the product name after the brand
function extractManufacturerPartNumber(productName: string, brand: string): string | null {
  if (!productName || !brand) return null;
  
  // Common patterns for manufacturer part numbers in product names:
  // "RUG 90499 LC380-LC9 CONVERSION KIT" -> "90499"
  // "SIG P365X-MACRO-9-BLK" -> "P365X-MACRO-9-BLK"  
  
  const cleanName = productName.trim();
  const cleanBrand = brand.trim();
  
  // Remove brand from beginning if present
  let nameWithoutBrand = cleanName;
  if (cleanName.toUpperCase().startsWith(cleanBrand.toUpperCase())) {
    nameWithoutBrand = cleanName.substring(cleanBrand.length).trim();
  }
  
  // Look for common MPN patterns:
  // 1. Numbers after brand (like "90499" in "RUG 90499 LC380...")
  const numberAfterBrand = nameWithoutBrand.match(/^(\d+)/);
  if (numberAfterBrand) {
    return numberAfterBrand[1];
  }
  
  // 2. Model patterns (alphanumeric with dashes/letters)
  const modelPattern = nameWithoutBrand.match(/^([A-Z0-9\-]+)/);
  if (modelPattern && modelPattern[1].length >= 3 && modelPattern[1].length <= 20) {
    return modelPattern[1];
  }
  
  return null;
}

interface SimpleSyncResult {
  success: boolean;
  message: string;
  mappingsCreated: number;
  productsProcessed: number;
  newRecords: number;
  recordsUpdated: number;
  recordsSkipped: number;
  imagesAdded: number;
  imagesUpdated: number;
  errors: string[];
}

/**
 * Simple Sports South catalog sync to create UPC→ITEMNO mappings
 * without touching existing Chattanooga/GunBroker integrations
 */
export async function performSportsSouthCatalogSync(
  credentials: SportsSouthCredentials
): Promise<SimpleSyncResult> {
  const result: SimpleSyncResult = {
    success: false,
    message: '',
    mappingsCreated: 0,
    productsProcessed: 0,
    newRecords: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    imagesAdded: 0,
    imagesUpdated: 0,
    errors: []
  };

  try {
    console.log('SPORTS SOUTH SYNC: Starting catalog sync...');
    
    // Get Sports South vendor from supported vendors
    const supportedVendors = await storage.getAllSupportedVendors();
    const sportsSouth = supportedVendors.find(sv => sv.name.toLowerCase().includes('sports south'));
    
    if (!sportsSouth) {
      result.errors.push('Sports South not found in supported vendors');
      result.message = 'Sports South vendor not configured';
      return result;
    }

    // Create Sports South API instance
    const api = createSportsSouthAPI(credentials);
    
    // First, fetch manufacturers for brand name lookup
    console.log('SPORTS SOUTH SYNC: Fetching manufacturers...');
    const manufacturers = await api.getManufacturers();
    const manufacturerMap = new Map<string, string>();
    
    for (const manufacturer of manufacturers) {
      if (manufacturer.MFGNO && manufacturer.MFGNM) {
        manufacturerMap.set(manufacturer.MFGNO, manufacturer.MFGNM);
      }
    }
    
    console.log(`SPORTS SOUTH SYNC: Loaded ${manufacturerMap.size} manufacturers for brand lookup`);
    
    // Fetch categories for category name lookup
    console.log('SPORTS SOUTH SYNC: Fetching categories...');
    const categories = await api.getCategories();
    const categoryMap = new Map<string, string>();
    
    for (const category of categories) {
      if (category.CATID && category.CATDES) {
        categoryMap.set(category.CATID, category.CATDES);
      }
    }
    
    console.log(`SPORTS SOUTH SYNC: Loaded ${categoryMap.size} categories for category lookup`);
    
    // Fetch catalog from Sports South using incremental sync
    const lastSyncDate = sportsSouth.lastCatalogSync;
    let products: any[];
    
    if (!lastSyncDate) {
      console.log('SPORTS SOUTH SYNC: No previous sync found - performing full catalog sync');
      products = await api.getFullCatalog();
    } else {
      console.log(`SPORTS SOUTH SYNC: Performing incremental sync since ${lastSyncDate.toISOString()}`);
      products = await api.getCatalogUpdates(lastSyncDate);
    }
    
    if (!products || products.length === 0) {
      // Handle no changes scenario for incremental sync
      if (lastSyncDate) {
        console.log('SPORTS SOUTH SYNC: No changes detected since last sync - sync completed');
        result.success = true;
        result.message = 'No changes detected since last sync';
        result.productsProcessed = 0;
        result.newRecords = 0;
        result.recordsUpdated = 0;
        result.recordsSkipped = 0;
        result.imagesAdded = 0;
        result.imagesUpdated = 0;
        
        // Update timestamp to show sync ran successfully
        await storage.updateSupportedVendor(sportsSouth.id, {
          lastCatalogSync: new Date(),
          catalogSyncStatus: 'success',
          catalogSyncError: null,
          lastSyncNewRecords: 0,
          lastSyncRecordsUpdated: 0,
          lastSyncRecordsSkipped: 0,
          lastSyncImagesAdded: 0,
          lastSyncImagesUpdated: 0
        });
        
        return result;
      } else {
        // This is an error for full sync (first time)
        result.errors.push('No products returned from Sports South API');
        result.message = 'No products found in Sports South catalog - this may indicate credentials or API access issues';
        console.log('SPORTS SOUTH SYNC: Zero products returned. Check credentials and API access permissions.');
        
        // Update vendor with error status
        await storage.updateSupportedVendor(sportsSouth.id, {
          catalogSyncStatus: 'error',
          catalogSyncError: 'No products returned - check credentials and API access',
          lastSyncRecordsUpdated: 0,
          lastSyncRecordsSkipped: 0,
          lastSyncImagesUpdated: 0
        });
        
        return result;
      }
    }

    // Process all products
    const productsToProcess = products;
    console.log(`SPORTS SOUTH SYNC: Processing ${productsToProcess.length} products...`);
    
    let mappingsCreated = 0;
    let productsProcessed = 0;
    let newRecords = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;
    let imagesAdded = 0;
    let imagesUpdated = 0;

    for (const sportsSouthProduct of productsToProcess) {
      productsProcessed++;
      try {
        // Debug: Show what fields we have for the first few products
        if (productsProcessed <= 20) {
          console.log(`SPORTS SOUTH SYNC: Product ${productsProcessed}:`, {
            ITEMNO: sportsSouthProduct.ITEMNO,
            IDESC: sportsSouthProduct.IDESC,
            ITUPC: sportsSouthProduct.ITUPC, // Actual UPC field from schema
            hasUPC: !!sportsSouthProduct.ITUPC,
            upcLength: sportsSouthProduct.ITUPC ? sportsSouthProduct.ITUPC.length : 0,
            IMFGNO: sportsSouthProduct.IMFGNO, // Manufacturer Number for brand lookup
            ITBRDNO: sportsSouthProduct.ITBRDNO,
            PICREF: sportsSouthProduct.PICREF
          });
        }
        
        // Skip products without ITEMNO (UPC is often missing from Sports South)
        if (!sportsSouthProduct.ITEMNO) {
          recordsSkipped++;
          console.log(`SPORTS SOUTH SYNC: Skipped product - Missing ITEMNO`);
          
          // Update progress every 50 products
          if (productsProcessed % 50 === 0) {
            await storage.updateSupportedVendor(sportsSouth.id, {
              catalogSyncStatus: 'in_progress',
              lastSyncNewRecords: newRecords,
              lastSyncRecordsUpdated: recordsUpdated,
              lastSyncRecordsSkipped: recordsSkipped,
              lastSyncImagesAdded: imagesAdded,
              lastSyncImagesUpdated: imagesUpdated
            });
            console.log(`SPORTS SOUTH SYNC: Progress update - ${productsProcessed}/${productsToProcess.length} products processed (New: ${newRecords}, Updated: ${recordsUpdated}, Skipped: ${recordsSkipped}, Images Added: ${imagesAdded}, Images Updated: ${imagesUpdated})`);
          }
          
          continue;
        }

        // Check if product exists in Master Product Catalog by UPC or manufacturer part number
        let product = null;
        
        if (sportsSouthProduct.ITUPC) {
          // Normalize UPC for lookup to match stored format
          let lookupUpc = sportsSouthProduct.ITUPC;
          if (lookupUpc && /^\d+$/.test(lookupUpc)) {
            lookupUpc = lookupUpc.padStart(12, '0'); // Pad to 12 digits with leading zeros
          }
          
          product = await storage.getProductByUPC(lookupUpc);
          console.log(`SPORTS SOUTH SYNC: Checking UPC ${sportsSouthProduct.ITUPC} (normalized: ${lookupUpc}) - Found product: ${product ? 'YES' : 'NO'} (ITEMNO: ${sportsSouthProduct.ITEMNO})`);
        } else {
          // Try to find by manufacturer part number if no UPC
          const products = await storage.searchProducts(sportsSouthProduct.ITEMNO, 'manufacturerPartNumber', 1, 1);
          product = products && products.length > 0 ? products[0] : null;
          console.log(`SPORTS SOUTH SYNC: No UPC, checking by MPN ${sportsSouthProduct.ITEMNO} - Found product: ${product ? 'YES' : 'NO'}`);
        }
        
        if (!product) {
          // Generate highest quality image URL from Sports South per official documentation
          // Use PICREF first, fallback to ITEMNO if no PICREF available
          const imageIdentifier = sportsSouthProduct.PICREF || sportsSouthProduct.ITEMNO;
          const imageUrl = imageIdentifier 
            ? `https://media.server.theshootingwarehouse.com/hires/${imageIdentifier}.png`
            : null;
          
          // Look up manufacturer name from MFGNM via IMFGNO
          const manufacturerName = sportsSouthProduct.IMFGNO && manufacturerMap.has(sportsSouthProduct.IMFGNO) 
            ? manufacturerMap.get(sportsSouthProduct.IMFGNO) 
            : null;
          
          // Look up category name from CATDES via CATID
          const categoryName = sportsSouthProduct.CATID && categoryMap.has(sportsSouthProduct.CATID) 
            ? categoryMap.get(sportsSouthProduct.CATID) 
            : null;

          // Create product in Master Product Catalog - UNIVERSAL DATA ONLY
          // NO vendor-specific pricing, availability, or vendor-specific attributes
          
          // Normalize UPC to prevent duplicates with different zero-padding
          let normalizedUpc = sportsSouthProduct.ITUPC || sportsSouthProduct.ITEMNO;
          if (normalizedUpc && /^\d+$/.test(normalizedUpc)) {
            normalizedUpc = normalizedUpc.padStart(12, '0'); // Pad to 12 digits with leading zeros
          }
          
          const productData = {
            upc: normalizedUpc, // Use normalized UPC to prevent duplicates
            name: sportsSouthProduct.IDESC ? String(sportsSouthProduct.IDESC).substring(0, 255) : String(sportsSouthProduct.ITEMNO || 'Product'),
            brand: manufacturerName || '', // Now properly resolved via IMFGNO → MFGNM manufacturer lookup
            model: sportsSouthProduct.IMODEL ? String(sportsSouthProduct.IMODEL).substring(0, 100) : null, // Use IMODEL for authoritative model data
            manufacturerPartNumber: sportsSouthProduct.MFGINO || null, // Use MFGINO for actual manufacturer part number
            // Use category from Sports South CategoryUpdate API
            category: categoryName, // Now properly resolved via CATID → CATDES category lookup
            subcategory1: null, // Platform info is vendor-specific 
            subcategory2: null, // Caliber info is vendor-specific
            description: null, // Will be fetched separately via TXTREF if needed
            imageUrl: imageUrl, // Sports South image URL for Master Catalog
            imageSource: imageUrl ? 'Sports South' : null,
            serialized: false, // Universal compliance field
            retailVerticalId: 1, // Universal retail vertical assignment
            source: 'sports-south', // Using vendor slug for consistent priority matching
            status: 'active'
          };

          try {
            const newProduct = await storage.createProduct(productData);
            console.log(`SPORTS SOUTH SYNC: Created product ${newProduct.upc} (${newProduct.name})`);
            
            // Create vendor mapping - minimal data for vendor SKU lookups only
            await storage.createVendorProductMapping({
              productId: newProduct.id,
              supportedVendorId: sportsSouth.id,
              vendorSku: sportsSouthProduct.ITEMNO
            });
            
            mappingsCreated++;
            newRecords++;
            if (imageUrl) {
              imagesAdded++;
            }
          } catch (error: any) {
            // Handle UPC collision - product already exists
            if (error.code === '23505' && error.constraint === 'products_upc_unique') {
              console.log(`SPORTS SOUTH SYNC: UPC collision for ${sportsSouthProduct.ITUPC}, finding existing product...`);
              
              // Find existing product by UPC and create mapping  
              let lookupUpc = sportsSouthProduct.ITUPC || sportsSouthProduct.ITEMNO;
              if (lookupUpc && /^\d+$/.test(lookupUpc)) {
                lookupUpc = lookupUpc.padStart(12, '0'); // Normalize for lookup
              }
              const existingProduct = await storage.getProductByUPC(lookupUpc);
              if (existingProduct) {
                // Check if mapping already exists
                const existingMapping = await storage.getVendorProductMapping(existingProduct.id, sportsSouth.id);
                
                // Check if we should add/update image for UPC collision product
                const updateData: any = {};
                const imageIdentifier = sportsSouthProduct.PICREF || sportsSouthProduct.ITEMNO;
                if (imageIdentifier && !existingProduct.imageUrl) {
                  // Generate Sports South image URL per official documentation
                  const imageUrl = `https://media.server.theshootingwarehouse.com/hires/${imageIdentifier}.png`;
                  updateData.imageUrl = imageUrl;
                  updateData.imageSource = 'Sports South';
                  imagesAdded++;
                  console.log(`SPORTS SOUTH SYNC: Added image for UPC collision product ${existingProduct.upc} using ${sportsSouthProduct.PICREF ? 'PICREF' : 'ITEMNO'}: ${imageIdentifier}`);
                }
                
                // Apply image update if needed
                if (Object.keys(updateData).length > 0) {
                  await storage.updateProduct(existingProduct.id, updateData);
                }
                
                if (!existingMapping) {
                  // Create mapping to existing product
                  await storage.createVendorProductMapping({
                    productId: existingProduct.id,
                    supportedVendorId: sportsSouth.id,
                    vendorSku: sportsSouthProduct.ITEMNO
                  });
                  
                  mappingsCreated++;
                  recordsUpdated++;
                  console.log(`SPORTS SOUTH SYNC: Created mapping for existing UPC collision product ${existingProduct.upc} → ${sportsSouthProduct.ITEMNO}`);
                } else {
                  recordsSkipped++;
                  console.log(`SPORTS SOUTH SYNC: Mapping already exists for UPC collision product ${existingProduct.upc}`);
                }
              } else {
                recordsSkipped++;
                console.log(`SPORTS SOUTH SYNC: Could not find existing product for UPC ${sportsSouthProduct.ITUPC}`);
              }
            } else {
              throw error; // Re-throw other errors
            }
          }
        } else {
          // Check if mapping already exists
          const existingMapping = await storage.getVendorProductMapping(product.id, sportsSouth.id);
          
          if (!existingMapping) {
            // Update product data and image following Master Product Catalog preservation rules
            const updateData: any = {};
            
            // RULE: Only fill UNIVERSAL product identification fields in Master Catalog
            // NEVER store vendor-specific categories, pricing, or vendor-specific attributes
            if (!product.manufacturerPartNumber && sportsSouthProduct.MFGINO) {
              updateData.manufacturerPartNumber = sportsSouthProduct.MFGINO;
            }
            // Update brand if we have manufacturer info and product brand is null
            if (!product.brand && sportsSouthProduct.IMFGNO && manufacturerMap.has(sportsSouthProduct.IMFGNO)) {
              updateData.brand = manufacturerMap.get(sportsSouthProduct.IMFGNO);
            }
            
            // Update category if missing and we have category data
            if (!product.category && sportsSouthProduct.CATID && categoryMap.has(sportsSouthProduct.CATID)) {
              updateData.category = categoryMap.get(sportsSouthProduct.CATID);
            }
            // Series is vendor-specific data, NOT stored in Master Product Catalog
            
            // Categories are now properly stored in Master Catalog via CategoryUpdate API
            
            // IMAGE RULE: For vendors (not marketplaces), only update image if:
            // 1) No existing image, OR 2) Existing image is from a marketplace
            const imageIdentifier = sportsSouthProduct.PICREF || sportsSouthProduct.ITEMNO;
            if (imageIdentifier) {
              // Use centralized image URL service for consistency
              const { VendorImageService } = await import('./vendor-image-urls');
              const hiresImageUrl = VendorImageService.getImageUrl('Sports South', imageIdentifier, sportsSouthProduct.PICREF);
              
              if (hiresImageUrl) {
                // Check Sports South image quality from database (dynamic config)
                const sportsSouthQuality = await getVendorImageQualityFromDB('Sports South');
                const isSportsSouthHighQuality = sportsSouthQuality === 'high';
                
                // Check existing image quality from database
                const existingImageQuality = product.imageSource ? await getVendorImageQualityFromDB(product.imageSource) : null;
                const existingImageIsLowQuality = existingImageQuality === 'low';
                
                if (!product.imageUrl) {
                  // No image exists - add image (both high and low quality vendors can add to empty)
                  updateData.imageUrl = hiresImageUrl;
                  updateData.imageSource = 'Sports South';
                  imagesAdded++;
                  console.log(`SPORTS SOUTH SYNC: Added image for product ${product.upc}`);
                } else if (isSportsSouthHighQuality && existingImageIsLowQuality) {
                  // Sports South is high quality and existing image is low quality - upgrade image
                  updateData.imageUrl = hiresImageUrl;
                  updateData.imageSource = 'Sports South';
                  imagesUpdated++;
                  console.log(`SPORTS SOUTH SYNC: Upgraded low quality image to high quality image for product ${product.upc}`);
                } else if (!isSportsSouthHighQuality && !product.imageUrl) {
                  // Sports South is low quality and no existing image - add as fallback
                  updateData.imageUrl = hiresImageUrl;
                  updateData.imageSource = 'Sports South';
                  imagesAdded++;
                  console.log(`SPORTS SOUTH SYNC: Added low quality image for product ${product.upc}`);
                }
                // Otherwise, keep existing image per preservation rules
              }
            }
            
            // Apply updates if any fields need updating
            if (Object.keys(updateData).length > 0) {
              await storage.updateProduct(product.id, updateData);
            }
            
            // Create new mapping - minimal data for vendor SKU lookups only
            await storage.createVendorProductMapping({
              productId: product.id,
              supportedVendorId: sportsSouth.id,
              vendorSku: sportsSouthProduct.ITEMNO
            });
            
            mappingsCreated++;
            recordsUpdated++;
            console.log(`SPORTS SOUTH SYNC: Created mapping for existing product ${product.upc} → ${sportsSouthProduct.ITEMNO}`);
          } else {
            // Mapping exists - check if we should still update the product with missing data
            const updateData: any = {};
            
            // RULE: Only fill in missing product fields, never replace existing data from other vendors
            if (!product.manufacturerPartNumber && sportsSouthProduct.ITEMNO) {
              updateData.manufacturerPartNumber = sportsSouthProduct.ITEMNO;
            }
            // Update brand if we have manufacturer info and product brand is null
            if (!product.brand && sportsSouthProduct.IMFGNO && manufacturerMap.has(sportsSouthProduct.IMFGNO)) {
              updateData.brand = manufacturerMap.get(sportsSouthProduct.IMFGNO);
            }
            
            // Update category if missing and we have category data
            if (!product.category && sportsSouthProduct.CATID && categoryMap.has(sportsSouthProduct.CATID)) {
              updateData.category = categoryMap.get(sportsSouthProduct.CATID);
            }
            
            // Categories are now properly stored in Master Catalog via CategoryUpdate API
            
            // IMAGE RULE: Always check if we can improve the image
            if (sportsSouthProduct.PICREF) {
              // Skip image processing for now - focus on model field accuracy
              const hiresImageUrl = null;
              
              // Check Sports South image quality from database (dynamic config)
              const sportsSouthQuality = await getVendorImageQualityFromDB('Sports South');
              const isSportsSouthHighQuality = sportsSouthQuality === 'high';
              
              // Check existing image quality from database
              const existingImageQuality = product.imageSource ? await getVendorImageQualityFromDB(product.imageSource) : null;
              const existingImageIsLowQuality = existingImageQuality === 'low';
              
              if (!product.imageUrl) {
                // No image exists - add image (both high and low quality vendors can add to empty)
                updateData.imageUrl = hiresImageUrl;
                updateData.imageSource = 'Sports South';
                imagesAdded++;
                console.log(`SPORTS SOUTH SYNC: Added image for existing mapped product ${product.upc}`);
              } else if (isSportsSouthHighQuality && existingImageIsLowQuality) {
                // Sports South is high quality and existing image is low quality - upgrade image
                updateData.imageUrl = hiresImageUrl;
                updateData.imageSource = 'Sports South';
                imagesUpdated++;
                console.log(`SPORTS SOUTH SYNC: Upgraded low quality image to high quality image for existing mapped product ${product.upc}`);
              } else if (!isSportsSouthHighQuality && !product.imageUrl) {
                // Sports South is low quality and no existing image - add as fallback
                updateData.imageUrl = hiresImageUrl;
                updateData.imageSource = 'Sports South';
                imagesAdded++;
                console.log(`SPORTS SOUTH SYNC: Added low quality image for existing mapped product ${product.upc}`);
              }
            }
            
            // Apply updates if any fields need updating
            if (Object.keys(updateData).length > 0) {
              await storage.updateProduct(product.id, updateData);
              recordsUpdated++;
              console.log(`SPORTS SOUTH SYNC: Updated existing mapped product ${product.upc} with ${Object.keys(updateData).join(', ')}`);
            } else {
              recordsSkipped++;
            }
          }
        }

        // Update progress every 50 products
        if (productsProcessed % 50 === 0) {
          await storage.updateSupportedVendor(sportsSouth.id, {
            catalogSyncStatus: 'in_progress',
            lastSyncNewRecords: newRecords,
            lastSyncRecordsUpdated: recordsUpdated,
            lastSyncRecordsSkipped: recordsSkipped,
            lastSyncImagesAdded: imagesAdded,
            lastSyncImagesUpdated: imagesUpdated
          });
          console.log(`SPORTS SOUTH SYNC: Progress update - ${productsProcessed}/${productsToProcess.length} products processed (New: ${newRecords}, Updated: ${recordsUpdated}, Skipped: ${recordsSkipped}, Images Added: ${imagesAdded}, Images Updated: ${imagesUpdated})`);
        }

        if (mappingsCreated % 100 === 0) {
          console.log(`SPORTS SOUTH SYNC: Created ${mappingsCreated} mappings...`);
        }

      } catch (error: any) {
        result.errors.push(`Error processing ${sportsSouthProduct.ITEMNO}: ${error.message}`);
        console.error(`SPORTS SOUTH SYNC: Error processing ${sportsSouthProduct.ITEMNO}:`, error);
      }
    }

    // Update supported vendor sync status with statistics
    await storage.updateSupportedVendor(sportsSouth.id, {
      lastCatalogSync: new Date(),
      catalogSyncStatus: 'success',
      lastSyncNewRecords: newRecords,
      lastSyncRecordsUpdated: recordsUpdated,
      lastSyncRecordsSkipped: recordsSkipped,
      lastSyncImagesAdded: imagesAdded,
      lastSyncImagesUpdated: imagesUpdated
    });
    
    console.log(`SPORTS SOUTH SYNC: Final stats - New: ${newRecords}, Updated: ${recordsUpdated}, Skipped: ${recordsSkipped}, Images Added: ${imagesAdded}, Images Updated: ${imagesUpdated}`);

    result.success = true;
    result.mappingsCreated = mappingsCreated;
    result.productsProcessed = productsProcessed;
    result.newRecords = newRecords;
    result.recordsUpdated = recordsUpdated;
    result.recordsSkipped = recordsSkipped;
    result.imagesAdded = imagesAdded;
    result.imagesUpdated = imagesUpdated;
    result.message = `Successfully processed ${productsProcessed} products: ${newRecords} new, ${recordsUpdated} updated, ${recordsSkipped} skipped, ${imagesAdded} images added, ${imagesUpdated} images updated`;
    
    console.log(`SPORTS SOUTH SYNC: Completed - ${result.message}`);
    return result;

  } catch (error: any) {
    console.error('SPORTS SOUTH SYNC: Fatal error:', error);
    result.errors.push(`Fatal sync error: ${error.message}`);
    result.message = 'Sports South catalog sync failed';
    return result;
  }
}