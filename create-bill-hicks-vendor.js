import { storage } from './server/storage.js';

async function createBillHicksVendor() {
  try {
    console.log('Creating Bill Hicks vendor...');
    
    const billHicksVendor = {
      name: 'Bill Hicks & Co.',
      vendorShortCode: 'bill-hicks',
      description: 'FTP-based multi-tenant vendor for firearms and accessories',
      apiType: 'ftp',
      logoUrl: null,
      websiteUrl: 'https://www.billhicksco.com',
      documentationUrl: null,
      credentialFields: [
        { name: 'ftpHost', label: 'FTP Host', type: 'text', required: true, placeholder: 'ftp.billhicksco.com' },
        { name: 'ftpUsername', label: 'FTP Username', type: 'text', required: true, placeholder: 'your_username' },
        { name: 'ftpPassword', label: 'FTP Password', type: 'password', required: true, placeholder: 'your_password' },
        { name: 'storeName', label: 'Store Name', type: 'text', required: true, placeholder: 'Your Store Name' }
      ],
      features: {
        electronicOrdering: false,
        realTimePricing: false,
        inventorySync: true,
        catalogSync: true,
        imageSync: false,
        orderSubmission: false,
        orderTracking: false,
        returnsProcessing: false
      },
      isEnabled: true,
      sortOrder: 5,
      productRecordPriority: 5,
      // Bill Hicks specific fields
      billHicksMasterCatalogSyncEnabled: true,
      billHicksMasterCatalogSyncTime: '16:15', // 9:15 AM Pacific
      billHicksMasterCatalogSyncStatus: 'never_synced',
      billHicksMasterCatalogSyncError: null,
      billHicksInventorySyncEnabled: true,
      billHicksInventorySyncStatus: 'never_synced',
      billHicksInventorySyncError: null
    };
    
    const result = await storage.createSupportedVendor(billHicksVendor);
    console.log('Bill Hicks vendor created successfully:', result);
    
  } catch (error) {
    console.error('Error creating Bill Hicks vendor:', error);
  }
}

createBillHicksVendor();
