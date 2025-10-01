/**
 * Fix Bill Hicks Credential Fields
 * Add missing ftpPort and ftpBasePath fields to the credential schema
 */

import { storage } from './server/storage';

async function fixBillHicksCredentialFields() {
  try {
    console.log('🔧 Fixing Bill Hicks credential fields...');
    
    // Get Bill Hicks vendor
    const billHicksVendor = await storage.getSupportedVendorByName('Bill Hicks & Co.');
    if (!billHicksVendor) {
      console.error('❌ Bill Hicks vendor not found');
      return;
    }

    console.log('✅ Found Bill Hicks vendor');
    console.log('📋 Current credential fields:', JSON.stringify(billHicksVendor.credentialFields, null, 2));

    // Update credential fields to include all necessary FTP fields
    // IMPORTANT: Use snake_case names to match what the frontend sends and database expects
    const updatedCredentialFields = [
      { name: 'ftp_server', label: 'FTP Server Host', type: 'text', required: true, placeholder: 'billhicksco.hostedftp.com' },
      { name: 'ftp_port', label: 'FTP Port', type: 'text', required: false, placeholder: '21' },
      { name: 'ftp_base_path', label: 'Base Directory', type: 'text', required: false, placeholder: '/MicroBiz/Feeds' },
      { name: 'ftp_username', label: 'FTP Username', type: 'text', required: true, placeholder: 'your_username' },
      { name: 'ftp_password', label: 'FTP Password', type: 'password', required: true, placeholder: 'your_password' },
      { name: 'catalog_sync_enabled', label: 'Enable Catalog Sync', type: 'text', required: false, placeholder: 'true' },
      { name: 'catalog_sync_schedule', label: 'Catalog Sync Schedule', type: 'text', required: false, placeholder: '30 1 * * *' },
      { name: 'inventory_sync_enabled', label: 'Enable Inventory Sync', type: 'text', required: false, placeholder: 'true' }
    ];

    await storage.updateSupportedVendor(billHicksVendor.id, {
      credentialFields: updatedCredentialFields
    });

    console.log('✅ Updated Bill Hicks credential fields');
    console.log('📋 New credential fields:', JSON.stringify(updatedCredentialFields, null, 2));
    console.log('🎉 Done! The ftpBasePath field should now save correctly.');
    
  } catch (error) {
    console.error('❌ Error fixing Bill Hicks credential fields:', error);
  }
}

fixBillHicksCredentialFields()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

