import { db } from './server/db.js';
import { supportedVendors } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function restoreBillHicksPassword() {
  try {
    console.log('Restoring Bill Hicks admin password...');
    
    const correctCredentials = {
      ftpServer: 'billhicksco.hostedftp.com',
      ftpUsername: 'kevin@thegunbarnes.com',
      ftpPassword: 'MicroBiz01',
      ftpPort: 21
    };
    
    await db.update(supportedVendors)
      .set({ 
        adminCredentials: correctCredentials,
        adminConnectionStatus: 'pending_test'
      })
      .where(eq(supportedVendors.name, 'Bill Hicks & Co.'));
    
    console.log('✅ Bill Hicks admin credentials restored:');
    console.log('   ftpServer:', correctCredentials.ftpServer);
    console.log('   ftpUsername:', correctCredentials.ftpUsername);
    console.log('   ftpPassword:', correctCredentials.ftpPassword);
    console.log('   ftpPort:', correctCredentials.ftpPort);
    console.log('\n✅ Your password has been restored! Test Connection should now work.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

restoreBillHicksPassword();

