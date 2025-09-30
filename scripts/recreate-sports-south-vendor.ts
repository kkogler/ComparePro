#!/usr/bin/env tsx

import { storage } from '../server/storage';
import { db } from '../server/db';
import { supportedVendors } from '../shared/schema';

async function recreateSportsSouthVendor() {
  console.log('🔧 Recreating Sports South vendor record...');
  
  try {
    // Check if Sports South already exists
    const existingVendors = await storage.getAllSupportedVendors();
    const existingSportsSouth = existingVendors.find(v => 
      v.name.toLowerCase().includes('sports south')
    );
    
    if (existingSportsSouth) {
      console.log('✅ Sports South vendor already exists:', existingSportsSouth.name);
      return;
    }
    
    // Get the next available priority
    const allVendors = await storage.getAllSupportedVendors();
    const nextPriority = allVendors.length + 1;
    
    console.log(`📊 Total existing vendors: ${allVendors.length}`);
    console.log(`📊 Next priority will be: ${nextPriority}`);
    
    // Create Sports South vendor with proper configuration
    const sportsSouthVendor = {
      name: 'Sports South',
      vendorShortCode: 'sports-south',
      description: 'Sports South wholesale distributor for firearms and accessories',
      apiType: 'soap',
      logoUrl: null,
      websiteUrl: 'https://www.sportssouth.com',
      documentationUrl: null,
      credentialFields: [
        {
          name: 'userName',
          label: 'Username',
          type: 'text',
          required: true,
          placeholder: 'Enter your Sports South username',
          description: 'Your Sports South API username'
        },
        {
          name: 'customerNumber',
          label: 'Customer Number',
          type: 'text',
          required: true,
          placeholder: 'Enter your customer number',
          description: 'Your Sports South customer number'
        },
        {
          name: 'password',
          label: 'Password',
          type: 'password',
          required: true,
          placeholder: 'Enter your password',
          description: 'Your Sports South API password'
        },
        {
          name: 'source',
          label: 'Source',
          type: 'text',
          required: true,
          placeholder: 'Enter source identifier',
          description: 'Source identifier for API requests'
        }
      ],
      features: {
        electronicOrdering: true,
        realTimePricing: true,
        inventorySync: true,
        productCatalog: true
      },
      adminCredentials: null,
      adminConnectionStatus: 'not_configured',
      lastCatalogSync: null,
      catalogSyncStatus: 'never_synced',
      catalogSyncError: null,
      lastSyncNewRecords: 0,
      // Sports South specific scheduling
      sportsSouthScheduleEnabled: false,
      sportsSouthScheduleTime: '14:00', // 2:00 PM default
      sportsSouthScheduleFrequency: 'daily',
      lastSyncRecordsUpdated: 0,
      lastSyncRecordsSkipped: 0,
      lastSyncRecordsFailed: 0,
      lastSyncImagesAdded: 0,
      lastSyncImagesUpdated: 0,
      vendorType: 'vendor',
      isEnabled: true,
      sortOrder: nextPriority,
      productRecordPriority: nextPriority,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('🏗️ Creating Sports South vendor with configuration:');
    console.log(`  - Name: ${sportsSouthVendor.name}`);
    console.log(`  - API Type: ${sportsSouthVendor.apiType}`);
    console.log(`  - Priority: ${sportsSouthVendor.productRecordPriority}`);
    console.log(`  - Features: ${JSON.stringify(sportsSouthVendor.features)}`);
    console.log(`  - Credential Fields: ${sportsSouthVendor.credentialFields.length} fields`);
    
    // Create the vendor
    const newVendor = await storage.createSupportedVendor(sportsSouthVendor);
    
    console.log('✅ Sports South vendor created successfully!');
    console.log(`  - ID: ${newVendor.id}`);
    console.log(`  - Name: ${newVendor.name}`);
    console.log(`  - Priority: ${newVendor.productRecordPriority}`);
    console.log(`  - Status: ${newVendor.adminConnectionStatus}`);
    
    console.log('\n🎉 Sports South vendor has been restored!');
    console.log('📝 Next steps:');
    console.log('  1. Go to Admin Supported Vendors page');
    console.log('  2. Configure Sports South admin credentials');
    console.log('  3. Test the connection');
    console.log('  4. Set up sync scheduling if needed');
    
  } catch (error) {
    console.error('❌ Error recreating Sports South vendor:', error);
    throw error;
  }
}

// Run the script
recreateSportsSouthVendor()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });


























