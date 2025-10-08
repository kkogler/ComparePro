import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function resetAdminPassword() {
  try {
    console.log('=== Resetting Admin Password ===');
    
    // Check if admin user exists
    const adminUsers = await db.select().from(users).where(eq(users.username, 'admin'));
    
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    
    if (adminUsers.length === 0) {
      console.log('❌ Admin user not found. Creating new admin user...');
      await db.insert(users).values({
        username: 'admin',
        email: 'admin@pricecomparehub.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('✅ Admin user created!');
    } else {
      console.log('✅ Admin user exists. Resetting password...');
      await db.update(users)
        .set({ 
          password: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(users.username, 'admin'));
      console.log('✅ Password reset successfully!');
    }
    
    console.log('');
    console.log('✅ Admin credentials:');
    console.log('   Username: admin');
    console.log('   Password: Admin123!');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetAdminPassword();

