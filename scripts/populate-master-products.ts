import * as fs from 'fs';
import { db } from '../server/db';
import { products } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface ChattanoogaCSVRow {
  Manufacturer: string;
  'Manufacturer Item Number': string;
  'CSSI Item Number': string;
  'Item Description': string;
  'Qty On Hand': string;
  'UPC Code': string;
  'Item Weight': string;
  Price: string;
  MSRP: string;
  'Web Item Name': string;
  'Web Item Description': string;
  Category: string;
  'Retail MAP': string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function cleanPrice(priceStr: string): string | null {
  if (!priceStr || priceStr.trim() === '') return null;
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed.toFixed(2);
}

function extractCaliberFromDescription(description: string): string | null {
  const caliberPatterns = [
    /(9mm)/i,
    /(\.40\s*s&w|40\s*s&w)/i,
    /(\.45\s*acp|45\s*acp)/i,
    /(\.380\s*acp|380\s*acp)/i,
    /(10mm)/i,
    /(\.357\s*mag)/i,
    /(\.22\s*lr|22\s*lr)/i
  ];

  for (const pattern of caliberPatterns) {
    const match = description.match(pattern);
    if (match) {
      return match[0].replace(/\./g, '').trim();
    }
  }
  return null;
}

function extractModelFromName(name: string, manufacturer: string): string | null {
  // Remove manufacturer name and extract model
  const cleaned = name.replace(new RegExp(manufacturer, 'gi'), '').trim();
  const modelMatch = cleaned.match(/^([A-Z0-9-]+)/i);
  return modelMatch ? modelMatch[1] : null;
}

async function populateMasterProducts() {
  console.log('Populating master products database with Chattanooga Glock inventory...');
  
  const filePath = './attached_assets/itemInventory_1753159755061.csv';
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n');
  
  // Parse header
  const headers = parseCSVLine(lines[0]);
  console.log('Processing Chattanooga inventory...');
  
  let processedCount = 0;
  let createdCount = 0;
  
  // Process only Glock products for demonstration
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      const values = parseCSVLine(line);
      if (values.length < headers.length) continue;
      
      // Map CSV data to object
      const rowData: any = {};
      headers.forEach((header, index) => {
        rowData[header] = values[index]?.replace(/^"|"$/g, '') || '';
      });
      
      const manufacturer = rowData['Manufacturer']?.trim();
      const upc = rowData['UPC Code']?.trim();
      const webItemName = rowData['Web Item Name']?.trim();
      
      // Only process Glock products
      if (!manufacturer.toLowerCase().includes('glock') || !upc || upc === '0') {
        continue;
      }
      
      // Check if product already exists
      const [existingProduct] = await db.select().from(products).where(eq(products.upc, upc));
      
      if (!existingProduct) {
        const partNumber = rowData['Manufacturer Item Number']?.trim() || null;
        const msrp = cleanPrice(rowData['MSRP']);
        const map = cleanPrice(rowData['Retail MAP']);
        const caliber = extractCaliberFromDescription(webItemName);
        const model = extractModelFromName(webItemName, manufacturer);
        
        // Create new product in master database
        await db.insert(products).values({
          name: webItemName,
          brand: manufacturer,
          upc: upc,
          model: model,
          partNumber: partNumber,
          caliber: caliber,
          category: 'Handguns', // Most Glock products are handguns
          description: rowData['Web Item Description'] || null,
          msrp: msrp,
          map: map,
          weight: null,
          imageUrl: 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=60',
          createdAt: new Date()
        });
        
        createdCount++;
        console.log(`Created: ${webItemName} (UPC: ${upc})`);
      }
      
      processedCount++;
      
      // Progress update
      if (processedCount % 100 === 0) {
        console.log(`Processed ${processedCount} Glock products, created ${createdCount} new products`);
      }
      
    } catch (error) {
      console.error(`Error processing line ${i + 1}:`, error);
    }
  }
  
  console.log(`\nMaster products population completed:`);
  console.log(`- Glock products processed: ${processedCount}`);
  console.log(`- New products created: ${createdCount}`);
}

// Run the population
populateMasterProducts().then(() => {
  console.log('Master products population finished');
  process.exit(0);
}).catch(error => {
  console.error('Population failed:', error);
  process.exit(1);
});