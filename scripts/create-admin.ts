#!/usr/bin/env tsx

import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function createAdminUser() {
  // Import admin configuration
  const { ADMIN_CONFIG } = await import('../shared/admin-config');
  
  console.log(`Creating/updating ${ADMIN_CONFIG.DEFAULT_ADMIN.ROLE} user...`);
  
  const hashedPassword = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'changeme123', 10);
  
  // Delete existing admin user if exists
  await db.delete(users).where(eq(users.username, ADMIN_CONFIG.DEFAULT_ADMIN.USERNAME));
  
  // Create new admin user with null companyId (admin indicator)
  const [admin] = await db.insert(users).values({
    username: ADMIN_CONFIG.DEFAULT_ADMIN.USERNAME,
    password: hashedPassword,
    companyId: ADMIN_CONFIG.COMPANY_INDICATORS.ADMIN_COMPANY_ID
  }).returning();
  
  console.log(`✅ ${ADMIN_CONFIG.DEFAULT_ADMIN.ROLE} user created: ${admin.username} (ID: ${admin.id})`);
  console.log(`Credentials: ${ADMIN_CONFIG.DEFAULT_ADMIN.USERNAME} / ${process.env.DEFAULT_ADMIN_PASSWORD || 'changeme123'}`);
}

createAdminUser().catch(console.error);