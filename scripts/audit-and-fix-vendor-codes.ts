#!/usr/bin/env tsx
/**
 * VENDOR CODE AUDIT AND FIX
 * 
 * This script audits and fixes the vendor code mismatches that have been causing recurring issues.
 * 
 * The problem: 
 * - Documentation says use hyphens (bill-hicks)
 * - Database may have underscores (bill_hicks)  
 * - Vendor registry was using hyphens
 * - Code has workarounds trying to match both
 * 
 * The solution:
 * - Establish ONE canonical format: UNDERSCORES (because that's what's in the slug migration docs)
 * - Update ALL code to match
 * - Remove ALL workarounds
 */

import { db } from '../server/db';
import { supportedVendors, vendors } from '../shared/schema';
import { vendorRegistry } from '../server/vendor-registry';
import { eq } from 'drizzle-orm';

interface VendorAuditResult {
  database: {
    supportedVendors: Array<{
      id: number;
      name: string;
      vendorShortCode: string | null;
    }>;
    organizationVendors: Array<{
      id: number;
      name: string;
      vendorShortCode: string | null;
      slug: string;
      supportedVendorId: number | null;
    }>;
  };
  registry: {
    handlers: Array<{
      vendorId: string;
      vendorName: string;
    }>;
  };
  mismatches: Array<{
    vendorName: string;
    databaseCode: string | null;
    registryCode: string | null;
    match: boolean;
  }>;
}

async function auditVendorCodes(): Promise<VendorAuditResult> {
  console.log('🔍 Starting vendor code audit...\n');
  
  // Initialize vendor registry
  await vendorRegistry.initialize();
  
  // Get database state
  const supportedVendorsDb = await db.select({
    id: supportedVendors.id,
    name: supportedVendors.name,
    vendorShortCode: supportedVendors.vendorShortCode,
  }).from(supportedVendors);
  
  const organizationVendors = await db.select({
    id: vendors.id,
    name: vendors.name,
    vendorShortCode: vendors.vendorShortCode,
    slug: vendors.slug,
    supportedVendorId: vendors.supportedVendorId,
  }).from(vendors);
  
  // Get registry state
  const handlers = vendorRegistry.getAllHandlers().map(h => ({
    vendorId: h.vendorId,
    vendorName: h.vendorName,
  }));
  
  // Find mismatches
  const mismatches: VendorAuditResult['mismatches'] = [];
  
  for (const sv of supportedVendorsDb) {
    const handler = handlers.find(h => 
      h.vendorName.toLowerCase() === sv.name.toLowerCase() ||
      h.vendorId.replace(/_/g, '-') === sv.vendorShortCode?.replace(/_/g, '-') ||
      h.vendorId.replace(/-/g, '_') === sv.vendorShortCode?.replace(/-/g, '_')
    );
    
    const databaseCode = sv.vendorShortCode;
    const registryCode = handler?.vendorId || null;
    const match = databaseCode === registryCode;
    
    mismatches.push({
      vendorName: sv.name,
      databaseCode,
      registryCode,
      match,
    });
  }
  
  return {
    database: {
      supportedVendors: supportedVendorsDb,
      organizationVendors,
    },
    registry: {
      handlers,
    },
    mismatches,
  };
}

async function fixVendorCodes(dryRun: boolean = true) {
  console.log(`\n${'🔧'.repeat(40)}`);
  console.log(`${dryRun ? '🔍 DRY RUN MODE' : '⚠️  LIVE MODE - MAKING CHANGES'}`);
  console.log(`${'🔧'.repeat(40)}\n`);
  
  const audit = await auditVendorCodes();
  
  // Define the canonical format (HYPHENS for multi-word vendors)
  const canonicalCodes: Record<string, string> = {
    "Bill Hicks & Co.": "bill-hicks",
    "Lipsey's Inc.": "lipseys",
    "Lipsey's": "lipseys",  // Handle DB name variant
    "Sports South": "sports-south",  
    "Chattanooga Shooting Supplies Inc.": "chattanooga",
    "Chattanooga Shooting Supplies": "chattanooga",  // Handle DB name variant
    "GunBroker.com LLC": "gunbroker",
    "GunBroker": "gunbroker",  // Handle DB name variant
  };
  
  console.log('📊 AUDIT RESULTS:\n');
  console.log('Supported Vendors:');
  console.table(audit.database.supportedVendors.map(sv => ({
    ID: sv.id,
    Name: sv.name,
    ShortCode: sv.vendorShortCode || '(null)',
    Canonical: canonicalCodes[sv.name] || '?',
    NeedsFix: sv.vendorShortCode !== canonicalCodes[sv.name] ? '❌' : '✅',
  })));
  
  console.log('\nVendor Registry Handlers:');
  console.table(audit.registry.handlers.map(h => ({
    VendorID: h.vendorId,
    VendorName: h.vendorName,
  })));
  
  console.log('\nMismatches:');
  const mismatchTable = audit.mismatches.map(m => ({
    Vendor: m.vendorName,
    Database: m.databaseCode || '(null)',
    Registry: m.registryCode || '(not found)',
    Match: m.match ? '✅' : '❌',
  }));
  console.table(mismatchTable);
  
  // Apply fixes
  const fixes: Array<{vendor: string, from: string | null, to: string}> = [];
  
  for (const sv of audit.database.supportedVendors) {
    const canonical = canonicalCodes[sv.name];
    if (canonical && sv.vendorShortCode !== canonical) {
      fixes.push({
        vendor: sv.name,
        from: sv.vendorShortCode,
        to: canonical,
      });
      
      if (!dryRun) {
        await db.update(supportedVendors)
          .set({ vendorShortCode: canonical })
          .where(eq(supportedVendors.id, sv.id));
        
        console.log(`✅ Updated ${sv.name}: "${sv.vendorShortCode}" → "${canonical}"`);
      }
    }
  }
  
  // Update organization vendors too
  for (const ov of audit.database.organizationVendors) {
    const sv = audit.database.supportedVendors.find(s => s.id === ov.supportedVendorId);
    if (sv) {
      const canonical = canonicalCodes[sv.name];
      if (canonical && ov.vendorShortCode !== canonical) {
        if (!dryRun) {
          await db.update(vendors)
            .set({ vendorShortCode: canonical })
            .where(eq(vendors.id, ov.id));
          
          console.log(`✅ Updated org vendor ${ov.name} (ID ${ov.id}): "${ov.vendorShortCode}" → "${canonical}"`);
        }
      }
    }
  }
  
  console.log('\n📝 FIXES NEEDED:');
  if (fixes.length === 0) {
    console.log('✅ No fixes needed! All vendor codes are correct.');
  } else {
    console.table(fixes);
    
    if (dryRun) {
      console.log('\n💡 To apply these fixes, run:');
      console.log('   tsx scripts/audit-and-fix-vendor-codes.ts --fix');
    } else {
      console.log('\n✅ All fixes applied!');
    }
  }
  
  console.log('\n🔧 NEXT STEPS:');
  console.log('1. Update vendor-registry.ts to use matching vendorIds');
  console.log('2. Update VENDOR_NAMING_STANDARD.md with actual standard');
  console.log('3. Remove workaround code (alias matching, etc.)');
}

// Run the script
const args = process.argv.slice(2);
const fix = args.includes('--fix');

fixVendorCodes(!fix)
  .then(() => {
    console.log('\n✅ Audit complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

