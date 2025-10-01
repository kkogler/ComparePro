/**
 * Test Bill Hicks FTP Path Structure
 * Finds the actual location of MicroBiz_Daily_Catalog.csv
 */

import { Client as FTPClient } from 'basic-ftp';
import { storage } from './server/storage';

async function testBillHicksFTPPaths() {
  console.log('🔍 Testing Bill Hicks FTP Path Structure...\n');

  // Get admin credentials
  const billHicksVendorId = await storage.getBillHicksVendorId();
  const billHicksVendor = await storage.getSupportedVendorById(billHicksVendorId);
  
  if (!billHicksVendor?.adminCredentials) {
    console.error('❌ No admin credentials found');
    return;
  }

  const creds = billHicksVendor.adminCredentials;
  const ftpServer = creds.ftpServer || creds.ftp_server;
  const ftpUsername = creds.ftpUsername || creds.ftp_username;
  const ftpPassword = creds.ftpPassword || creds.ftp_password;

  console.log(`📡 Connecting to: ${ftpServer}`);
  console.log(`👤 Username: ${ftpUsername}\n`);

  const client = new FTPClient();
  client.ftp.verbose = true; // Show FTP protocol details

  try {
    // Clean hostname - remove protocol and trailing slashes
    const cleanHost = ftpServer
      .replace(/^https?:\/\//, '')  // Remove protocol
      .replace(/\/+$/, '');          // Remove trailing slashes
    
    console.log(`🔧 Cleaned hostname: ${cleanHost}\n`);
    
    // Connect
    await client.access({
      host: cleanHost,
      user: ftpUsername,
      password: ftpPassword,
      port: 21,
      secure: false
    });

    console.log('✅ Connected!\n');

    // Test different paths
    const pathsToTest = [
      '/',
      '/MicroBiz',
      '/MicroBiz/Feeds',
      '/files',
      '/files/path',
      '/files/path/MicroBiz',
      '/files/path/MicroBiz/Feeds',
      '/Feeds'
    ];

    for (const testPath of pathsToTest) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📁 Testing path: "${testPath}"`);
      console.log('='.repeat(60));

      try {
        await client.cd(testPath);
        const currentPath = await client.pwd();
        console.log(`✅ Successfully navigated to: "${currentPath}"`);

        const files = await client.list();
        console.log(`📂 Found ${files.length} items:`);
        
        files.forEach((file, index) => {
          const type = file.type === 1 ? '📄' : file.type === 2 ? '📁' : '❓';
          const size = file.size ? `(${(file.size / 1024).toFixed(2)} KB)` : '';
          console.log(`  ${index + 1}. ${type} ${file.name} ${size}`);
        });

        // Check for target files
        const targetFiles = [
          'MicroBiz_Daily_Catalog.csv',
          'MicroBiz_Product_Feed.csv',
          'MicroBiz_Hourly_Inventory.csv'
        ];

        const foundFiles = targetFiles.filter(target => 
          files.some(f => f.name === target)
        );

        if (foundFiles.length > 0) {
          console.log(`\n🎯 FOUND TARGET FILES IN "${currentPath}":`);
          foundFiles.forEach(f => console.log(`   ✅ ${f}`));
        }

      } catch (error: any) {
        console.log(`❌ Cannot access: ${error.message}`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('🏁 Test Complete!');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('❌ FTP Error:', error.message);
  } finally {
    client.close();
  }
}

// Run the test
testBillHicksFTPPaths()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

