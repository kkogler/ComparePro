#!/usr/bin/env tsx

import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createAdminUser() {
  // Import admin configuration
  const { ADMIN_CONFIG } = await import('../shared/admin-config');
  
  console.log(`Creating/updating ${ADMIN_CONFIG.DEFAULT_ADMIN.ROLE} user with scrypt...`);
  
  const hashedPassword = await hashPassword(process.env.DEFAULT_ADMIN_PASSWORD || 'changeme123');
  console.log('Generated scrypt hash:', hashedPassword.substring(0, 20) + '...');
  
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
  console.log('Password format: scrypt with salt');
}

createAdminUser().catch(console.error);