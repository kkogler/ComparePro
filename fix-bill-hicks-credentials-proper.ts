/**
 * Fix Bill Hicks Credential Fields - PROPER VERSION
 * Remove the bogus sync fields that were incorrectly added to credentialFields
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

    // CORRECT credential fields - ONLY authentication credentials, NO sync settings
    const correctCredentialFields = [
      { name: 'ftp_server', label: 'FTP Server Host', type: 'text', required: true, placeholder: 'billhicksco.hostedftp.com' },
      { name: 'ftp_port', label: 'FTP Port', type: 'text', required: false, placeholder: '21' },
      { name: 'ftp_base_path', label: 'Base Directory', type: 'text', required: false, placeholder: '/MicroBiz/Feeds' },
      { name: 'ftp_username', label: 'FTP Username', type: 'text', required: true, placeholder: 'your_username' },
      { name: 'ftp_password', label: 'FTP Password', type: 'password', required: true, placeholder: 'your_password' }
    ];

    await storage.updateSupportedVendor(billHicksVendor.id, {
      credentialFields: correctCredentialFields
    });

    console.log('✅ Updated Bill Hicks credential fields');
    console.log('📋 New credential fields:', JSON.stringify(correctCredentialFields, null, 2));
    
    // Show what admin credentials are currently stored
    console.log('\n📋 Current admin credentials stored:');
    if (billHicksVendor.adminCredentials) {
      const creds = billHicksVendor.adminCredentials as any;
      console.log('  - ftp_server:', creds.ftp_server || creds.ftpServer || 'NOT SET');
      console.log('  - ftp_username:', creds.ftp_username || creds.ftpUsername || 'NOT SET');
      console.log('  - ftp_password:', (creds.ftp_password || creds.ftpPassword) ? '***HIDDEN***' : 'NOT SET');
      console.log('  - ftp_port:', creds.ftp_port || creds.ftpPort || '21 (default)');
      console.log('  - ftp_base_path:', creds.ftp_base_path || creds.ftpBasePath || 'NOT SET');
    } else {
      console.log('  ⚠️  NO ADMIN CREDENTIALS SET');
    }
    
    console.log('\n🎉 Done! The credential modal should now show ONLY the FTP authentication fields.');
    console.log('📝 Note: Sync settings are managed separately in the Bill Hicks Sync Settings section.');
    
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



