// System-level Chattanooga catalog cache service
// Downloads and caches Chattanooga product catalog for shared use across all organizations

import fs from 'fs/promises';
import path from 'path';
import csv from 'csv-parser';
import { createReadStream } from 'fs';

export interface ChattanoogaCatalogItem {
  manufacturer: string;
  manufacturerItemNumber: string;
  cssiItemNumber: string;
  itemDescription: string;
  qtyOnHand: number;
  upcCode: string;
  itemWeight: number;
  price: number;
  msrp: number;
  webItemName: string;
  webItemDescription: string;
  category: string;
  retailMap: number;
}

export class ChattanoogaCatalogCache {
  private static instance: ChattanoogaCatalogCache;
  private cacheDir = path.join(process.cwd(), 'catalog-cache');
  private cacheFile = path.join(this.cacheDir, 'chattanooga-catalog.csv');
  private cacheDuration = 24 * 60 * 60 * 1000; // 24 hours
  private catalogData: ChattanoogaCatalogItem[] = [];
  private lastRefresh: Date | null = null;

  private constructor() {}

  static getInstance(): ChattanoogaCatalogCache {
    if (!ChattanoogaCatalogCache.instance) {
      ChattanoogaCatalogCache.instance = new ChattanoogaCatalogCache();
    }
    return ChattanoogaCatalogCache.instance;
  }

  async ensureCacheDirectory(): Promise<void> {
    try {
      await fs.access(this.cacheDir);
    } catch {
      await fs.mkdir(this.cacheDir, { recursive: true });
      console.log('CHATTANOOGA CACHE: Created cache directory');
    }
  }

  async isCacheValid(): Promise<boolean> {
    try {
      const stats = await fs.stat(this.cacheFile);
      const age = Date.now() - stats.mtime.getTime();
      return age < this.cacheDuration;
    } catch {
      return false;
    }
  }

  async refreshCatalog(): Promise<void> {
    console.log('CHATTANOOGA CACHE: Starting catalog refresh...');
    await this.ensureCacheDirectory();

    try {
      // Use the authentic CSV data provided by user
      const sourceFile = path.join(process.cwd(), 'attached_assets', 'itemInventory_1753159755061.csv');
      
      // Copy the authentic CSV to cache location
      const sourceData = await fs.readFile(sourceFile);
      await fs.writeFile(this.cacheFile, sourceData);
      
      console.log('CHATTANOOGA CACHE: Authentic catalog data cached successfully');
      
      // Load the data into memory
      await this.loadCatalogData();
      
    } catch (error) {
      console.error('CHATTANOOGA CACHE: Failed to refresh catalog:', error);
      throw new Error(`Catalog refresh failed: ${error.message}`);
    }
  }

  async loadCatalogData(): Promise<void> {
    return new Promise((resolve, reject) => {
      const items: ChattanoogaCatalogItem[] = [];
      
      createReadStream(this.cacheFile)
        .pipe(csv({
          mapHeaders: ({ header }) => {
            // Map CSV headers to our interface
            const headerMap: Record<string, string> = {
              'Manufacturer': 'manufacturer',
              'Manufacturer Item Number': 'manufacturerItemNumber',
              'CSSI Item Number': 'cssiItemNumber',
              'Item Description': 'itemDescription',
              'Qty On Hand': 'qtyOnHand',
              'UPC Code': 'upcCode',
              'Item Weight': 'itemWeight',
              'Price': 'price',
              'MSRP': 'msrp',
              'Web Item Name': 'webItemName',
              'Web Item Description': 'webItemDescription',
              'Category': 'category',
              'Retail MAP': 'retailMap'
            };
            return headerMap[header] || header.toLowerCase().replace(/\s+/g, '');
          }
        }))
        .on('data', (row) => {
          try {
            const item: ChattanoogaCatalogItem = {
              manufacturer: row.manufacturer || '',
              manufacturerItemNumber: row.manufacturerItemNumber || '',
              cssiItemNumber: row.cssiItemNumber || '',
              itemDescription: row.itemDescription || '',
              qtyOnHand: parseInt(row.qtyOnHand) || 0,
              upcCode: row.upcCode || '',
              itemWeight: parseFloat(row.itemWeight) || 0,
              price: parseFloat(row.price) || 0,
              msrp: parseFloat(row.msrp) || 0,
              webItemName: row.webItemName || '',
              webItemDescription: row.webItemDescription || '',
              category: row.category || '',
              retailMap: parseFloat(row.retailMap) || 0
            };
            
            if (item.upcCode && item.itemDescription) {
              items.push(item);
            }
          } catch (error) {
            console.warn('CHATTANOOGA CACHE: Error parsing row:', error);
          }
        })
        .on('end', () => {
          this.catalogData = items;
          this.lastRefresh = new Date();
          console.log(`CHATTANOOGA CACHE: Loaded ${items.length} catalog items`);
          resolve();
        })
        .on('error', (error) => {
          console.error('CHATTANOOGA CACHE: Error loading catalog data:', error);
          reject(error);
        });
    });
  }

  async getCatalogData(): Promise<ChattanoogaCatalogItem[]> {
    // Check if cache needs refresh
    if (!await this.isCacheValid() || this.catalogData.length === 0) {
      await this.refreshCatalog();
    }
    
    return this.catalogData;
  }

  async searchByUPC(upc: string): Promise<ChattanoogaCatalogItem | null> {
    const catalog = await this.getCatalogData();
    return catalog.find(item => item.upcCode === upc) || null;
  }

  async searchByManufacturer(manufacturer: string): Promise<ChattanoogaCatalogItem[]> {
    const catalog = await this.getCatalogData();
    return catalog.filter(item => 
      item.manufacturer.toLowerCase().includes(manufacturer.toLowerCase())
    );
  }

  async searchByPartNumber(partNumber: string): Promise<ChattanoogaCatalogItem[]> {
    const catalog = await this.getCatalogData();
    return catalog.filter(item => 
      item.manufacturerItemNumber.toLowerCase().includes(partNumber.toLowerCase()) ||
      item.cssiItemNumber.toLowerCase().includes(partNumber.toLowerCase())
    );
  }

  async searchByDescription(description: string): Promise<ChattanoogaCatalogItem[]> {
    const catalog = await this.getCatalogData();
    const searchTerm = description.toLowerCase();
    return catalog.filter(item => 
      item.itemDescription.toLowerCase().includes(searchTerm) ||
      item.webItemName.toLowerCase().includes(searchTerm)
    );
  }

  getCacheInfo(): { lastRefresh: Date | null, itemCount: number, cacheValid: boolean } {
    return {
      lastRefresh: this.lastRefresh,
      itemCount: this.catalogData.length,
      cacheValid: this.lastRefresh ? (Date.now() - this.lastRefresh.getTime()) < this.cacheDuration : false
    };
  }

  async forceRefresh(): Promise<void> {
    console.log('CHATTANOOGA CACHE: Forcing catalog refresh...');
    await this.refreshCatalog();
  }
}