#!/usr/bin/env tsx
import { db } from '../server/db';
import { products } from '../shared/schema';
import { eq } from 'drizzle-orm';

const upc = process.argv[2] || '810188102300';

const result = await db.select().from(products).where(eq(products.upc, upc)).limit(1);

if (result.length > 0) {
  const p = result[0];
  console.log('='.repeat(80));
  console.log(`Product Data for UPC ${upc}:`);
  console.log('='.repeat(80));
  console.log('Name:', p.name);
  console.log('Brand:', p.brand);
  console.log('Model (type):', typeof p.model);
  console.log('Model (raw):', p.model);
  console.log('Model (JSON):', JSON.stringify(p.model));
  console.log('MPN:', p.manufacturerPartNumber);
  console.log('Image URL:', p.imageUrl || 'NO IMAGE');
  console.log('Image Source:', p.imageSource);
  console.log('Source:', p.source);
  console.log('='.repeat(80));
} else {
  console.log(`Product with UPC ${upc} not found in database`);
}

process.exit(0);

