#!/usr/bin/env tsx

import { storage } from '../server/storage';

async function testAdminSettings() {
  console.log('Testing admin settings...');
  
  try {
    // Test getting admin settings
    console.log('1. Testing getAdminSettings()...');
    const adminSettings = await storage.getAdminSettings();
    console.log('✅ Admin settings retrieved:', {
      id: adminSettings?.id,
      companyName: adminSettings?.companyName,
      systemTimeZone: adminSettings?.systemTimeZone,
      createdAt: adminSettings?.createdAt
    });
    
    // Test updating admin settings
    console.log('2. Testing updateAdminSettings()...');
    const updatedSettings = await storage.updateAdminSettings({
      systemTimeZone: 'America/Los_Angeles',
      companyName: 'Test Company'
    });
    console.log('✅ Admin settings updated:', {
      id: updatedSettings?.id,
      companyName: updatedSettings?.companyName,
      systemTimeZone: updatedSettings?.systemTimeZone
    });
    
    console.log('✅ All admin settings tests passed!');
    
  } catch (error) {
    console.error('❌ Admin settings test failed:', error);
  }
}

testAdminSettings().catch(console.error);



























