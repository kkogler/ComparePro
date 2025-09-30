const { storage } = require('./server/storage.js');

async function testAdminSettings() {
  try {
    console.log('Testing admin settings...');

    // Check if we can get admin settings
    const settings = await storage.getAdminSettings();
    console.log('Current admin settings:', settings);

    if (!settings) {
      console.log('No admin settings found. Creating new record...');
      const newSettings = await storage.createAdminSettings({
        sendgridApiKey: 'test',
        systemEmail: 'test@example.com',
        maintenanceMode: false,
        registrationEnabled: true,
        maxCompanies: 1000,
        supportEmail: 'support@example.com',
        companyName: 'Test Platform'
      });
      console.log('Created new admin settings:', newSettings);
    } else {
      console.log('Admin settings exist, trying to update...');
      const updated = await storage.updateAdminSettings({
        sendgridApiKey: 'test-updated',
        systemEmail: 'test-updated@example.com'
      });
      console.log('Updated admin settings:', updated);
    }

  } catch (error) {
    console.error('Error testing admin settings:', error);
    console.error('Error stack:', error.stack);
  }
}

testAdminSettings();
