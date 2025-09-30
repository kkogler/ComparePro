import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

export interface SportsSouthCredentials {
  userName: string;
  customerNumber: string;
  password: string;
  source: string;
}

export interface SportsSouthProduct {
  // Core product fields from ItemUpdate - UNIVERSAL DATA ONLY (from actual schema)
  ITEMNO: string;      // Item Number (xs:decimal, MaxLength="5")
  IDESC: string;       // Item Description (xs:string, MaxLength="38")
  ITUPC?: string;      // UPC (xs:decimal, MaxLength="12") - ACTUAL field name
  IMFGNO?: string;     // Manufacturer Number (xs:decimal, MaxLength="3")
  ITBRDNO?: string;    // Brand Id (xs:decimal, MaxLength="5,0")
  MFGINO?: string;     // Mfg Item Number (xs:string, MaxLength="12")
  CATID?: string; // Category ID (vendor-specific, stored in mapping only)
  
  // CRITICAL: NO PRICING OR INVENTORY FIELDS IN CATALOG DATA
  // PRC1: FORBIDDEN - catalog price comes from real-time API only
  // CPRC: FORBIDDEN - customer price comes from real-time API only
  // MFPRC: FORBIDDEN - MAP price comes from real-time API only  
  // QTYOH: FORBIDDEN - quantity on hand comes from real-time API only
  
  // Image fields
  PICREF?: string; // Primary image reference
  
  // Additional fields
  TXTREF?: string; // Text reference for long descriptions
  WEIGHT?: number;
  
  // Attributes
  ITATR1?: string;
  ITATR2?: string;
  ITATR3?: string;
  ITATR4?: string;
  ITATR5?: string;
  ITATR7?: string;  // Often platform (AR-15, etc.)
  ITATR20?: string; // Often additional capacity field
  
  // Additional fields from XML
  IMODEL?: string;  // Item Model Number - AUTHORITATIVE for firearms compliance
  SERIES?: string;
  LENGTH?: number;
  HEIGHT?: number;
  WIDTH?: number;
  CHGDTE?: string;  // Change date
  LOADDT?: string;  // Load date
}

interface SportsSouthCatalogSyncResult {
  success: boolean;
  message: string;
  productCount: number;
  newProducts: number;
  updatedProducts: number;
  errors: string[];
}

interface SportsSouthCategory {
  CATID: string;   // Category ID (matches CATID from ItemUpdate)
  CATDES: string;  // Category description (actual category name!)
  DEPID?: string;  // Department ID
  DEP?: string;    // Department description
  ATTR1?: string;  // Attribute 1 heading name
  ATTR2?: string;  // Attribute 2 heading name
  ATTR3?: string;  // Attribute 3 heading name
  ATTR4?: string;  // Attribute 4 heading name
  ATTR5?: string;  // Attribute 5 heading name
  ATTR6?: string;  // Attribute 6 heading name
  ATTR7?: string;  // Attribute 7 heading name
  ATTR8?: string;  // Attribute 8 heading name
  ATTR9?: string;  // Attribute 9 heading name
  ATTR0?: string;  // Attribute 10 heading name (ATTR0 = Attribute 10)
  ATTR11?: string; // Attribute 11 heading name
  ATTR12?: string; // Attribute 12 heading name
  ATTR13?: string; // Attribute 13 heading name
  ATTR14?: string; // Attribute 14 heading name
  ATTR15?: string; // Attribute 15 heading name
  ATTR16?: string; // Attribute 16 heading name
  ATTR17?: string; // Attribute 17 heading name
  ATTR18?: string; // Attribute 18 heading name
  ATTR19?: string; // Attribute 19 heading name
  ATTR20?: string; // Attribute 20 heading name
}

interface SportsSouthManufacturer {
  MFGNO: string;   // Manufacturer Number (matches IMFGNO from ItemUpdate)
  MFGNM: string;   // Manufacturer Name (actual brand name!)
  MFGSEQ?: string; // Manufacturer Sequence
  MFGURL?: string; // Manufacturer Website URL
}

interface SportsSouthInventoryItem {
  // Real-time pricing and inventory fields (from actual schema)
  ITEMNO: string;      // Item Number (xs:decimal, MaxLength="5")
  PRC1?: number;       // Catalog Price (xs:decimal, MaxLength="5,2") - VENDOR COST, NOT MSRP
  CPRC?: number;       // Customer Price (xs:decimal, MaxLength="5,2") - wholesale cost
  MFPRC?: number;      // MAP Price (xs:decimal, MaxLength="5,2") - Minimum Advertised Price
  QTYOH?: number;      // Quantity on hand (xs:decimal, MaxLength="4")
  
  // Product information fields
  IDESC?: string;      // Item Description (xs:string, MaxLength="38")
  ITUPC?: string;      // UPC (xs:decimal, MaxLength="12")
  IMODEL?: string;     // Item Model Number (xs:string, MaxLength="50")
  MFGINO?: string;     // Mfg Item Number (xs:string, MaxLength="12")
  SERIES?: string;     // Series description (xs:string, MaxLength="200")
  CATID?: string;      // Category ID (xs:decimal, MaxLength="5")
  
  // Physical dimensions
  LENGTH?: number;     // Item Length (xs:decimal, MaxLength="7")
  HEIGHT?: number;     // Item Height (xs:decimal, MaxLength="7")
  WIDTH?: number;      // Item Width (xs:decimal, MaxLength="7")
  WTPBX?: number;      // Weight per box (xs:decimal, MaxLength="5,3")
}

export class SportsSouthAPI {
  private credentials: SportsSouthCredentials;
  private baseUrl = 'http://webservices.theshootingwarehouse.com/smart';
  private proxyAgent: HttpProxyAgent<string> | null = null;

  constructor(credentials: SportsSouthCredentials) {
    this.credentials = credentials;
    this.initializeProxy();
  }

  private initializeProxy() {
    const proxyHost = process.env.PROXY_HOST;
    const proxyPort = process.env.PROXY_PORT || '3128';
    const proxyUsername = process.env.PROXY_USERNAME;
    const proxyPassword = process.env.PROXY_PASSWORD;

    if (proxyHost) {
      const proxyAuth = proxyUsername && proxyPassword 
        ? `${proxyUsername}:${proxyPassword}@` 
        : '';
      const proxyUrl = `http://${proxyAuth}${proxyHost}:${proxyPort}`;
      
      this.proxyAgent = new HttpProxyAgent(proxyUrl);
      console.log(`✅ SPORTS SOUTH PROXY: Configured to use proxy at ${proxyHost}:${proxyPort}`);
    }
  }

  // Mask helper: show first and last character only
  private maskValue(value?: string): string {
    if (!value) return '';
    if (value.length <= 2) return value;
    return `${value[0]}${'*'.repeat(value.length - 2)}${value[value.length - 1]}`;
  }

  /**
   * Generate image URL using centralized service
   * Uses PICREF first, falls back to ITEMNO
   * @deprecated Use VendorImageService.getImageUrl() instead
   */
  getImageUrl(picRef?: string, itemNo?: string, size: 'large' | 'small' | 'thumbnail' | 'hires' = 'hires'): string | null {
    // For backward compatibility, delegate to centralized service
    const identifier = picRef || itemNo;
    if (!identifier) return null;

    try {
      const { VendorImageService } = require('./vendor-image-urls');
      return VendorImageService.getImageUrl('Sports South', identifier, picRef);
    } catch (error) {
      console.error('Failed to get image URL from centralized service:', error);
      // Fallback to original logic
      const baseUrl = 'https://media.server.theshootingwarehouse.com';
      const extension = size === 'hires' ? 'png' : 'jpg';
      return `${baseUrl}/${size}/${identifier}.${extension}`;
    }
  }

  // Helper method to make API calls with timeout
  private async makeRequest(url: string, params: URLSearchParams): Promise<any> {
    const controller = new AbortController();
    // Longer timeout for full catalog requests (5 minutes)
    // Full catalog detection: LastUpdate=1/1/1990 indicates full sync regardless of LastItem value
    // This handles both pagination (LastItem='0', '1', etc.) and original approach (LastItem='-1')
    const isFullCatalog = params.get('LastUpdate') === '1/1/1990';
    const timeout = isFullCatalog ? 300000 : 30000; // 5 minutes for full catalog, 30 seconds for others
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const fetchOptions: any = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/xml',
          'User-Agent': 'BestPrice-Platform/1.0'
        },
        signal: controller.signal
      };

      // Add proxy agent if configured
      if (this.proxyAgent) {
        fetchOptions.agent = this.proxyAgent;
      }

      const response = await fetch(`${url}?${params}`, fetchOptions);
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - Sports South API took too long to respond');
      }
      throw error;
    }
  }

  async testConnection(): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      // Validate required credentials
      const missing: string[] = [];
      if (!this.credentials || !this.credentials.userName) missing.push('userName');
      if (!this.credentials || !this.credentials.customerNumber) missing.push('customerNumber');
      if (!this.credentials || !this.credentials.password) missing.push('password');
      if (!this.credentials || !this.credentials.source) missing.push('source');
      if (missing.length) {
        return { success: false, message: `Missing fields: ${missing.join(', ')}` };
      }

      // Use DailyItemUpdate as the auth probe (LookupItem can succeed without strict auth)
      const url = `${this.baseUrl}/inventory.asmx/DailyItemUpdate`;
      const today = new Date();
      const mm = (today.getMonth() + 1).toString().padStart(2, '0');
      const dd = today.getDate().toString().padStart(2, '0');
      const yyyy = today.getFullYear();
      const params = new URLSearchParams({
        UserName: this.credentials.userName,
        CustomerNumber: this.credentials.customerNumber,
        Password: this.credentials.password,
        Source: this.credentials.source,
        LastUpdate: `${mm}/${dd}/${yyyy}`,
        LastItem: '0'
      });

      // Log masked credentials for verification (first and last chars only)
      console.log('SPORTS SOUTH API: Auth params (masked):', {
        UserName: this.maskValue(this.credentials.userName),
        CustomerNumber: this.maskValue(this.credentials.customerNumber),
        Password: this.maskValue(this.credentials.password),
        Source: this.maskValue(this.credentials.source)
      });

      const response = await this.makeRequest(url, params);
      const xmlText = await response.text();
      console.log('SPORTS SOUTH API: Test response status:', response.status);
      console.log('SPORTS SOUTH API: Test response preview:', xmlText.substring(0, 300));

      if (!response.ok) {
        console.log('SPORTS SOUTH API: Test failed with status:', response.status);
        return { 
          success: false, 
          message: `HTTP ${response.status}: ${response.statusText}` 
        };
      }

      // Check if response contains error indicators (case-insensitive)
      const lower = xmlText.toLowerCase();
      if (lower.includes('invalid') || lower.includes('error') || lower.includes('failed') || lower.includes('unauthorized') || lower.includes('not authorized') || lower.includes('authentication')) {
        return { 
          success: false, 
          message: 'Authentication failed - invalid credentials' 
        };
      }

      return { 
        success: true, 
        message: 'Sports South API connection successful' 
      };

    } catch (error: any) {
      console.error('SPORTS SOUTH API: Test connection error:', error);
      return { 
        success: false, 
        message: error.message || 'Connection test failed' 
      };
    }
  }

  // Get full catalog using pagination approach (1000 products at a time)
  async getFullCatalog(): Promise<SportsSouthProduct[]> {
    try {
      console.log('SPORTS SOUTH API: Fetching full catalog using pagination approach...');
      let allProducts: SportsSouthProduct[] = [];
      let lastItem = '0';  // Start with 0, API expects a number
      let pageCount = 0;
      const maxPages = 100; // Safety limit to prevent infinite loops
      
      while (pageCount < maxPages) {
        console.log(`SPORTS SOUTH API: Fetching page ${pageCount + 1}, LastItem: ${lastItem || 'start'}`);
        
        const url = `${this.baseUrl}/inventory.asmx/DailyItemUpdate`;
        const params = new URLSearchParams({
          UserName: this.credentials.userName,
          CustomerNumber: this.credentials.customerNumber,
          Password: this.credentials.password,
          Source: this.credentials.source,
          LastUpdate: '1/1/1990',
          LastItem: lastItem
        });

        const response = await this.makeRequest(url, params);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const xmlText = await response.text();
        const parsed = await parseStringPromise(xmlText, { 
          explicitArray: true,
          ignoreAttrs: false,
          trim: true
        });

        const pageProducts = await this.parseProductsFromDailyUpdate(parsed);
        
        if (pageProducts.length === 0) {
          console.log('SPORTS SOUTH API: No more products, pagination complete');
          break;
        }
        
        allProducts.push(...pageProducts);
        console.log(`SPORTS SOUTH API: Page ${pageCount + 1} complete: ${pageProducts.length} products (total: ${allProducts.length})`);
        
        // Get last item number for next page
        const lastProduct = pageProducts[pageProducts.length - 1];
        lastItem = lastProduct.ITEMNO || '0';
        
        // If we got less than 1000 products, we're at the end
        if (pageProducts.length < 1000) {
          console.log('SPORTS SOUTH API: Last page reached (less than 1000 products)');
          break;
        }
        
        pageCount++;
      }
      
      console.log(`SPORTS SOUTH API: Paginated catalog fetch complete: ${allProducts.length} total products from ${pageCount + 1} pages`);
      return allProducts;

    } catch (error: any) {
      console.error('SPORTS SOUTH API: getFullCatalog error:', error);
      throw new Error(`Failed to fetch Sports South catalog: ${error.message}`);
    }
  }

  // Get catalog updates since a specific date
  async getCatalogUpdates(lastUpdate?: Date): Promise<SportsSouthProduct[]> {
    try {
      const url = `${this.baseUrl}/inventory.asmx/DailyItemUpdate`;
      const formattedDate = lastUpdate ? 
        `${(lastUpdate.getMonth() + 1).toString().padStart(2, '0')}/${lastUpdate.getDate().toString().padStart(2, '0')}/${lastUpdate.getFullYear()}` : 
        '1/1/1990'; // Use 1990 to get full catalog as per Sports South docs
      
      const params = new URLSearchParams({
        UserName: this.credentials.userName,
        CustomerNumber: this.credentials.customerNumber,
        Password: this.credentials.password,
        Source: this.credentials.source,
        LastUpdate: formattedDate,
        LastItem: '-1' // Use -1 to bypass 1000 product limit and get full catalog
      });

      if (lastUpdate) {
        console.log('SPORTS SOUTH API: Fetching catalog updates since:', formattedDate);
      } else {
        console.log('SPORTS SOUTH API: Fetching full catalog using LastUpdate=1/1/1990 and LastItem=-1');
      }

      const response = await this.makeRequest(url, params);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parsed = await parseStringPromise(xmlText, { 
        explicitArray: true,
        ignoreAttrs: false,
        trim: true
      });

      const products = await this.parseProductsFromDailyUpdate(parsed);
      
      console.log('SPORTS SOUTH API: Parsed updated product count:', products.length, 'since', formattedDate || 'beginning');

      return products;

    } catch (error: any) {
      console.error('SPORTS SOUTH API: getCatalogUpdates error:', error);
      throw new Error(`Failed to fetch Sports South catalog updates: ${error.message}`);
    }
  }

  // Get item updates using ItemUpdate API
  async getItemUpdates(): Promise<SportsSouthProduct[]> {
    try {
      const url = `${this.baseUrl}/inventory.asmx/ItemUpdate`;
      const params = new URLSearchParams({
        UserName: this.credentials.userName,
        CustomerNumber: this.credentials.customerNumber,
        Password: this.credentials.password,
        Source: this.credentials.source
      });

      console.log('SPORTS SOUTH API: Fetching item updates...');
      const response = await this.makeRequest(url, params);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parsed = await parseStringPromise(xmlText, { 
        explicitArray: true,
        ignoreAttrs: false,
        trim: true
      });

      const products = await this.parseProductsFromItemUpdate(parsed);
      console.log('SPORTS SOUTH API: Parsed item updates count:', products.length);

      return products;

    } catch (error: any) {
      console.error('SPORTS SOUTH API: getItemUpdates error:', error);
      throw new Error(`Failed to fetch Sports South item updates: ${error.message}`);
    }
  }

  // Test FullTextSearch endpoint for bulk SHDESC retrieval
  async testFullTextSearch(searchTerm: string = '*', brandId: number = 0, categoryId: number = 0): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/inventory.asmx/FullTextSearch`;
      const params = new URLSearchParams({
        UserName: this.credentials.userName,
        CustomerNumber: this.credentials.customerNumber,
        Password: this.credentials.password,
        Source: this.credentials.source,
        SearchString: searchTerm,
        BrandId: brandId.toString(),
        CategoryId: categoryId.toString()
      });

      console.log('SPORTS SOUTH API: Testing FullTextSearch endpoint...');
      console.log('SPORTS SOUTH API: FullTextSearch URL:', `${url}?${params}`);
      console.log('SPORTS SOUTH API: Search term:', searchTerm, 'BrandId:', brandId, 'CategoryId:', categoryId);
      
      const response = await this.makeRequest(url, params);

      if (!response.ok) {
        console.log(`SPORTS SOUTH API: FullTextSearch failed with status ${response.status}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      console.log('SPORTS SOUTH API: FullTextSearch response preview:', xmlText.substring(0, 500));
      
      const parsed = await parseStringPromise(xmlText, { 
        explicitArray: true,
        ignoreAttrs: false,
        trim: true
      });

      // Parse the response to look for SHDESC
      const results = await this.parseFullTextSearchResponse(parsed);
      console.log('SPORTS SOUTH API: FullTextSearch parsed result count:', results.length);

      return results;

    } catch (error: any) {
      console.error('SPORTS SOUTH API: testFullTextSearch error:', error);
      throw new Error(`Failed to test FullTextSearch: ${error.message}`);
    }
  }

  // Test DailyItemUpdateDS endpoint to see if it includes SHDESC data
  async testDailyItemUpdateDS(lastUpdate?: Date): Promise<SportsSouthProduct[]> {
    try {
      const url = `${this.baseUrl}/inventory.asmx/DailyItemUpdateDS`;
      const formattedDate = lastUpdate ? 
        `${(lastUpdate.getMonth() + 1).toString().padStart(2, '0')}/${lastUpdate.getDate().toString().padStart(2, '0')}/${lastUpdate.getFullYear()}` : 
        '1/1/1990';
      
      const params = new URLSearchParams({
        UserName: this.credentials.userName,
        CustomerNumber: this.credentials.customerNumber,
        Password: this.credentials.password,
        Source: this.credentials.source,
        LastUpdate: formattedDate,
        LastItem: '-1' // Get full catalog
      });

      console.log('SPORTS SOUTH API: Testing DailyItemUpdateDS endpoint...');
      console.log('SPORTS SOUTH API: DailyItemUpdateDS URL:', `${url}?${params}`);
      
      const response = await this.makeRequest(url, params);

      if (!response.ok) {
        console.log(`SPORTS SOUTH API: DailyItemUpdateDS failed with status ${response.status}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      console.log('SPORTS SOUTH API: DailyItemUpdateDS response preview:', xmlText.substring(0, 500));
      
      const parsed = await parseStringPromise(xmlText, { 
        explicitArray: true,
        ignoreAttrs: false,
        trim: true
      });

      // Try to parse with enhanced parser that looks for SHDESC
      const products = await this.parseProductsFromDailyUpdateDS(parsed);
      console.log('SPORTS SOUTH API: DailyItemUpdateDS parsed product count:', products.length);

      return products;

    } catch (error: any) {
      console.error('SPORTS SOUTH API: testDailyItemUpdateDS error:', error);
      throw new Error(`Failed to test DailyItemUpdateDS: ${error.message}`);
    }
  }

  // Get basic inventory data for testing
  async getBasicInventory(): Promise<SportsSouthProduct[]> {
    try {
      const url = `${this.baseUrl}/inventory.asmx/BasicInventory`;
      const params = new URLSearchParams({
        UserName: this.credentials.userName,
        CustomerNumber: this.credentials.customerNumber,
        Password: this.credentials.password,
        Source: this.credentials.source
      });

      console.log('SPORTS SOUTH API: Fetching basic inventory...');
      const response = await this.makeRequest(url, params);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parsed = await parseStringPromise(xmlText, { 
        explicitArray: true,
        ignoreAttrs: false,
        trim: true
      });

      const products = await this.parseProductsFromBasicInventory(parsed);
      console.log('SPORTS SOUTH API: Parsed basic inventory count:', products.length);

      return products;

    } catch (error: any) {
      console.error('SPORTS SOUTH API: getBasicInventory error:', error);
      throw new Error(`Failed to fetch Sports South basic inventory: ${error.message}`);
    }
  }

  // Get real-time inventory for a specific item (for price comparison)
  async getInventoryForItem(itemno: string, upc?: string): Promise<SportsSouthInventoryItem | null> {
    console.log(`SPORTS SOUTH API: Fetching inventory for item ${itemno}`);
    
    // Streamlined endpoint strategy - try most reliable endpoints first
    const endpoints = [
      {
        name: 'LookupItem_SearchString',
        url: `${this.baseUrl}/inventory.asmx/LookupItem`,
        params: { SearchString: itemno }
      },
      // Fallback: OnhandByItem with UPC if provided (some accounts require UPC for auth-scoped lookups)
      ...(upc ? [{
        name: 'OnhandByItem_UPC',
        url: `${this.baseUrl}/inventory.asmx/OnhandByItem`,
        params: { UPC: upc }
      }] as const : [])
    ];

    for (const endpoint of endpoints) {
      try {
        const baseParams = {
          UserName: this.credentials.userName,
          CustomerNumber: this.credentials.customerNumber,
          Password: this.credentials.password,
          Source: this.credentials.source
        };
        const allParams = { ...baseParams, ...endpoint.params };
        const params = new URLSearchParams();
        Object.entries(allParams).forEach(([key, value]) => {
          params.append(key, String(value));
        });

        console.log(`SPORTS SOUTH API: ${endpoint.name} using ${Object.keys(endpoint.params)[0]}="${Object.values(endpoint.params)[0]}"`);
        console.log(`SPORTS SOUTH API: Exact URL being called: ${endpoint.url}?${params}`);
        console.log(`SPORTS SOUTH API: Trying ${endpoint.name} endpoint for item ${itemno}`);
        
        const response = await this.makeRequest(endpoint.url, params);

        if (!response.ok) {
          console.log(`SPORTS SOUTH API: ${endpoint.name} failed with status ${response.status}`);
          continue; // Try next endpoint
        }

        const xmlText = await response.text();
        console.log(`SPORTS SOUTH API: ${endpoint.name} response preview:`, xmlText.substring(0, 300));
        
        const parsed = await parseStringPromise(xmlText, { 
          explicitArray: true,
          ignoreAttrs: false,
          trim: true
        });

        // Parse the response based on endpoint type
        const item = await this.parseInventoryResponse(parsed, itemno, endpoint.name);
        if (item) {
          console.log(`SPORTS SOUTH API: Successfully found item ${itemno} using ${endpoint.name}:`, item);
          return item;
        }

      } catch (error: any) {
        console.log(`SPORTS SOUTH API: ${endpoint.name} error:`, error.message);
        continue; // Try next endpoint
      }
    }

    console.log(`SPORTS SOUTH API: Failed to get inventory for ${itemno}: No working endpoint found`);
    throw new Error(`HTTP 500: Sports South server error - item may be discontinued or not available for pricing`);
  }


  /**
   * Fetch SHDESC (full description) for a product by ITEMNO
   * Used for bulk catalog updates
   */
  async fetchSHDESCForBulkUpdate(itemno: string): Promise<string | null> {
    try {
      const url = `${this.baseUrl}/inventory.asmx/LookupItem`;
      const params = new URLSearchParams({
        UserName: this.credentials.userName,
        CustomerNumber: this.credentials.customerNumber,
        Password: this.credentials.password,
        Source: this.credentials.source,
        SearchString: itemno
      });

      const response = await this.makeRequest(url, params);
      if (!response.ok) {
        return null;
      }

      const xmlText = await response.text();
      const parsed = await parseStringPromise(xmlText, { 
        explicitArray: true,
        ignoreAttrs: false,
        trim: true
      });

      // Extract SHDESC from nested XML structure
      if (parsed?.string?._) {
        const innerXml = parsed.string._;
        const innerParsed = await parseStringPromise(innerXml, { 
          explicitArray: true,
          ignoreAttrs: false,
          trim: true
        });

        const tables = innerParsed?.NewDataSet?.Table;
        if (tables && Array.isArray(tables) && tables.length > 0) {
          const table = tables[0];
          const shdesc = table.SHDESC?.[0];
          if (shdesc && typeof shdesc === 'string') {
            return shdesc.trim();
          }
        }
      }
      
      return null;
    } catch (error: any) {
      console.error(`SPORTS SOUTH API: Error fetching SHDESC for ${itemno}:`, error);
      return null;
    }
  }

  // Parse inventory response based on endpoint type
  private async parseInventoryResponse(parsed: any, itemno: string, endpointName: string): Promise<SportsSouthInventoryItem | null> {
    try {
      console.log(`SPORTS SOUTH API: Parsing ${endpointName} response structure:`, JSON.stringify(parsed, null, 2).substring(0, 1000));
      
      // Handle string response format (common in Sports South responses)
      if (parsed.string && parsed.string._) {
        const innerXml = parsed.string._;
        console.log(`SPORTS SOUTH API: Decoded inner XML:`, innerXml);
        
        // Check for empty dataset
        if (innerXml.includes('<NewDataSet />') || innerXml.includes('NewDataSet></NewDataSet>')) {
          console.log(`SPORTS SOUTH API: No dataset in ${endpointName} response`);
          return null;
        }
        
        // Try to parse the inner XML if it contains data
        try {
          // Sanitize XML by removing/fixing invalid characters
          const sanitizedXml = this.sanitizeXml(innerXml);
          const innerParsed = await parseStringPromise(sanitizedXml, { 
            explicitArray: true,
            ignoreAttrs: false,
            trim: true
          });
          
          console.log(`SPORTS SOUTH API: Inner parsed structure:`, JSON.stringify(innerParsed, null, 2).substring(0, 500));
          
          // Look for Table data in various structures
          const tables = innerParsed.NewDataSet?.Table || 
                        innerParsed.DataSet?.Table || 
                        innerParsed.Table || 
                        [];
          
          if (Array.isArray(tables) && tables.length > 0) {
            const table = tables[0];
            return this.parseTableToInventoryItem(table, itemno);
          }
          
        } catch (innerParseError: any) {
          console.log(`SPORTS SOUTH API: Failed to decode inner XML:`, innerParseError.message);
        }
      }
      
      // Direct table parsing (for direct XML responses)
      const directTables = parsed.NewDataSet?.Table || 
                          parsed.DataSet?.Table || 
                          parsed.Table || 
                          [];
                          
      if (Array.isArray(directTables) && directTables.length > 0) {
        const table = directTables[0];
        return this.parseTableToInventoryItem(table, itemno);
      }
      
      console.log(`SPORTS SOUTH API: No valid data structure found in ${endpointName} response`);
      return null;
      
    } catch (error: any) {
      console.log(`SPORTS SOUTH API: Error parsing ${endpointName} response:`, error.message);
      return null;
    }
  }

  // Parse table data to inventory item
  private parseTableToInventoryItem(table: any, itemno: string): SportsSouthInventoryItem | null {
    try {
      // Extract values, handling both array and direct value formats
      const getFieldValue = (field: any): string | undefined => {
        if (Array.isArray(field) && field.length > 0) {
          return String(field[0]);
        }
        return field ? String(field) : undefined;
      };

      const item: SportsSouthInventoryItem = {
        ITEMNO: getFieldValue(table.ITEMNO) || itemno,
        IDESC: getFieldValue(table.IDESC),     // Item Description
        ITUPC: getFieldValue(table.ITUPC),     // UPC - ACTUAL field name from schema
        IMODEL: getFieldValue(table.IMODEL),   // Item Model Number
        MFGINO: getFieldValue(table.MFGINO),   // Mfg Item Number
        SERIES: getFieldValue(table.SERIES),   // Series description
        CATID: getFieldValue(table.CATID),     // Category ID
        
        // Physical dimensions
        LENGTH: getFieldValue(table.LENGTH) ? parseFloat(String(getFieldValue(table.LENGTH))) : undefined,
        HEIGHT: getFieldValue(table.HEIGHT) ? parseFloat(String(getFieldValue(table.HEIGHT))) : undefined,
        WIDTH: getFieldValue(table.WIDTH) ? parseFloat(String(getFieldValue(table.WIDTH))) : undefined,
        WTPBX: getFieldValue(table.WTPBX) ? parseFloat(String(getFieldValue(table.WTPBX))) : undefined,
        
        // Real-time pricing and inventory (ACTUAL field names from schema)
        PRC1: getFieldValue(table.PRC1) ? parseFloat(String(getFieldValue(table.PRC1))) : undefined,      // Catalog Price
        CPRC: getFieldValue(table.CPRC) ? parseFloat(String(getFieldValue(table.CPRC))) : undefined,      // Customer Price
        MFPRC: getFieldValue(table.MFPRC) ? parseFloat(String(getFieldValue(table.MFPRC))) : undefined,   // MAP Price
        QTYOH: getFieldValue(table.QTYOH) ? parseInt(getFieldValue(table.QTYOH) as string) : undefined    // Quantity on hand
      };

      console.log(`SPORTS SOUTH API: Parsed inventory item:`, item);
      return item;
      
    } catch (error: any) {
      console.log(`SPORTS SOUTH API: Error parsing table to inventory item:`, error.message);
      return null;
    }
  }

  // Get a specific item by UPC/ItemNo for direct lookup
  async getItemByUPC(upc: string): Promise<SportsSouthInventoryItem | null> {
    try {
      const url = `${this.baseUrl}/inventory.asmx/OnhandByItem`;
      const params = new URLSearchParams({
        UserName: this.credentials.userName,
        CustomerNumber: this.credentials.customerNumber,
        Password: this.credentials.password,
        Source: this.credentials.source,
        UPC: upc
      });

      console.log(`SPORTS SOUTH API: Looking up item by UPC: ${upc}`);
      const response = await this.makeRequest(url, params);

      if (!response.ok) {
        console.error(`SPORTS SOUTH API: HTTP error ${response.status} for UPC ${upc}`);
        return null;
      }

      const xmlText = await response.text();
      console.log(`SPORTS SOUTH API: Raw XML response for ${upc}:`, xmlText.substring(0, 500));
      
      const parsed = await parseStringPromise(xmlText, { 
        explicitArray: true,
        ignoreAttrs: false,
        trim: true
      });

      return this.parseInventoryResponse(parsed, upc, 'OnhandByItem_UPC');
      
    } catch (error: any) {
      console.error(`SPORTS SOUTH API: Error getting item by UPC ${upc}:`, error);
      return null;
    }
  }

  // Get real-time pricing for a specific item (alias for getInventoryForItem)
  async getRealTimePricing(itemno: string): Promise<SportsSouthInventoryItem | null> {
    return await this.getInventoryForItem(itemno);
  }

  // Get all categories for category name lookup
  async getCategories(): Promise<SportsSouthCategory[]> {
    try {
      const url = `${this.baseUrl}/inventory.asmx/CategoryUpdate`;
      const params = new URLSearchParams({
        UserName: this.credentials.userName,
        CustomerNumber: this.credentials.customerNumber,
        Password: this.credentials.password,
        Source: this.credentials.source
      });

      console.log('SPORTS SOUTH API: Fetching categories...');
      const response = await this.makeRequest(url, params);

      if (!response.ok) {
        console.error(`SPORTS SOUTH API: Category update failed with status ${response.status}`);
        return [];
      }

      const xmlText = await response.text();
      console.log('SPORTS SOUTH API: Category response preview:', xmlText.substring(0, 300));
      
      const parsed = await parseStringPromise(xmlText, { 
        explicitArray: true,
        ignoreAttrs: false,
        trim: true
      });

      return await this.parseCategories(parsed);
      
    } catch (error: any) {
      console.error('SPORTS SOUTH API: Error fetching categories:', error);
      return [];
    }
  }

  // Parse categories from CategoryUpdate response
  private async parseCategories(parsed: any): Promise<SportsSouthCategory[]> {
    try {
      console.log('SPORTS SOUTH API: Parsing CategoryUpdate response...');
      
      // Handle string response format 
      let dataSet;
      if (parsed.string && parsed.string._) {
        const innerXml = parsed.string._;
        const sanitizedXml = this.sanitizeXml(innerXml);
        const innerParsed = await parseStringPromise(sanitizedXml, { 
          explicitArray: true,
          ignoreAttrs: false,
          trim: true
        });
        dataSet = innerParsed;
      } else {
        dataSet = parsed;
      }

      const tables = dataSet.NewDataSet?.Table || 
                    dataSet.DataSet?.Table || 
                    dataSet.Table || 
                    [];

      if (!Array.isArray(tables)) {
        console.log('SPORTS SOUTH API: No category tables found in dataset');
        return [];
      }

      console.log(`SPORTS SOUTH API: Found ${tables.length} category entries`);

      const categories: SportsSouthCategory[] = tables.map((table: any) => {
        const getValue = (field: any): string | undefined => {
          if (Array.isArray(field) && field.length > 0) {
            return String(field[0]);
          }
          return field ? String(field) : undefined;
        };

        return {
          CATID: getValue(table.CATID) || '',
          CATDES: getValue(table.CATDES) || '',
          DEPID: getValue(table.DEPID),
          DEP: getValue(table.DEP),
          ATTR1: getValue(table.ATTR1),
          ATTR2: getValue(table.ATTR2),
          ATTR3: getValue(table.ATTR3),
          ATTR4: getValue(table.ATTR4),
          ATTR5: getValue(table.ATTR5),
          ATTR6: getValue(table.ATTR6),
          ATTR7: getValue(table.ATTR7),
          ATTR8: getValue(table.ATTR8),
          ATTR9: getValue(table.ATTR9),
          ATTR0: getValue(table.ATTR0), // Attribute 10
          ATTR11: getValue(table.ATTR11),
          ATTR12: getValue(table.ATTR12),
          ATTR13: getValue(table.ATTR13),
          ATTR14: getValue(table.ATTR14),
          ATTR15: getValue(table.ATTR15),
          ATTR16: getValue(table.ATTR16),
          ATTR17: getValue(table.ATTR17),
          ATTR18: getValue(table.ATTR18),
          ATTR19: getValue(table.ATTR19),
          ATTR20: getValue(table.ATTR20)
        };
      });

      console.log(`SPORTS SOUTH API: Successfully parsed ${categories.length} categories`);
      return categories;

    } catch (error: any) {
      console.error('SPORTS SOUTH API: Error parsing CategoryUpdate response:', error);
      return [];
    }
  }

  // Get all manufacturers for brand name lookup
  async getManufacturers(): Promise<SportsSouthManufacturer[]> {
    try {
      const url = `${this.baseUrl}/inventory.asmx/ManufacturerUpdate`;
      const params = new URLSearchParams({
        UserName: this.credentials.userName,
        CustomerNumber: this.credentials.customerNumber,
        Password: this.credentials.password,
        Source: this.credentials.source
      });

      console.log('SPORTS SOUTH API: Fetching manufacturers...');
      const response = await this.makeRequest(url, params);

      if (!response.ok) {
        console.error(`SPORTS SOUTH API: Manufacturer update failed with status ${response.status}`);
        return [];
      }

      const xmlText = await response.text();
      console.log('SPORTS SOUTH API: Manufacturer response preview:', xmlText.substring(0, 300));
      
      const parsed = await parseStringPromise(xmlText, { 
        explicitArray: true,
        ignoreAttrs: false,
        trim: true
      });

      return await this.parseManufacturers(parsed);
      
    } catch (error: any) {
      console.error('SPORTS SOUTH API: Error fetching manufacturers:', error);
      return [];
    }
  }

  // Parse manufacturers from ManufacturerUpdate response
  private async parseManufacturers(parsed: any): Promise<SportsSouthManufacturer[]> {
    try {
      console.log('SPORTS SOUTH API: Parsing ManufacturerUpdate response...');
      
      // Handle string response format 
      let dataSet;
      if (parsed.string && parsed.string._) {
        const innerXml = parsed.string._;
        const sanitizedXml = this.sanitizeXml(innerXml);
        const innerParsed = await parseStringPromise(sanitizedXml, { 
          explicitArray: true,
          ignoreAttrs: false,
          trim: true
        });
        dataSet = innerParsed;
      } else {
        dataSet = parsed;
      }

      const tables = dataSet.NewDataSet?.Table || 
                    dataSet.DataSet?.Table || 
                    dataSet.Table || 
                    [];

      if (!Array.isArray(tables)) {
        console.log('SPORTS SOUTH API: No manufacturer tables found in dataset');
        return [];
      }

      console.log(`SPORTS SOUTH API: Found ${tables.length} manufacturer entries`);

      const manufacturers: SportsSouthManufacturer[] = tables.map((table: any) => {
        const getValue = (field: any): string | undefined => {
          if (Array.isArray(field) && field.length > 0) {
            return String(field[0]);
          }
          return field ? String(field) : undefined;
        };

        return {
          MFGNO: getValue(table.MFGNO) || '',
          MFGNM: this.decodeHtmlEntities(getValue(table.MFGNM) || ''), // Decode HTML entities in manufacturer names
          MFGSEQ: getValue(table.MFGSEQ),
          MFGURL: getValue(table.MFGURL)
        };
      });

      console.log(`SPORTS SOUTH API: Successfully parsed ${manufacturers.length} manufacturers`);
      return manufacturers;

    } catch (error: any) {
      console.error('SPORTS SOUTH API: Error parsing ManufacturerUpdate response:', error);
      return [];
    }
  }

  // Get a specific item by ItemNo for direct lookup  
  async getItemByItemNo(itemno: string): Promise<SportsSouthInventoryItem | null> {
    try {
      const url = `${this.baseUrl}/inventory.asmx/OnhandByItem`;
      const params = new URLSearchParams({
        UserName: this.credentials.userName,
        CustomerNumber: this.credentials.customerNumber,
        Password: this.credentials.password,
        Source: this.credentials.source,
        ItemNo: itemno
      });

      console.log(`SPORTS SOUTH API: Looking up item by ITEMNO: ${itemno}`);
      const response = await this.makeRequest(url, params);

      if (!response.ok) {
        console.error(`SPORTS SOUTH API: HTTP error ${response.status} for ITEMNO ${itemno}`);
        return null;
      }

      const xmlText = await response.text();
      console.log(`SPORTS SOUTH API: Raw XML response for ${itemno}:`, xmlText.substring(0, 500));
      
      const parsed = await parseStringPromise(xmlText, { 
        explicitArray: true,
        ignoreAttrs: false,
        trim: true
      });

      return this.parseInventoryResponse(parsed, itemno, 'OnhandByItem_ITEMNO');
      
    } catch (error: any) {
      console.error(`SPORTS SOUTH API: Error getting item by ITEMNO ${itemno}:`, error);
      return null;
    }
  }

  // Parse FullTextSearch response to look for SHDESC
  private async parseFullTextSearchResponse(parsed: any): Promise<any[]> {
    try {
      console.log('SPORTS SOUTH API: Parsing FullTextSearch response...');
      console.log('SPORTS SOUTH API: Parsed structure keys:', Object.keys(parsed));

      // Handle string response format 
      let dataSet;
      if (parsed.string && parsed.string._) {
        const innerXml = parsed.string._;
        const innerParsed = await parseStringPromise(innerXml, { 
          explicitArray: true,
          ignoreAttrs: false,
          trim: true
        });
        dataSet = innerParsed;
      } else {
        dataSet = parsed;
      }

      // Navigate through the XML structure to find Table elements
      const tables = dataSet.NewDataSet?.Table || 
                    dataSet.DataSet?.Table || 
                    dataSet.Table || 
                    [];

      if (!Array.isArray(tables)) {
        console.log('SPORTS SOUTH API: No tables found in FullTextSearch dataset');
        return [];
      }

      console.log(`SPORTS SOUTH API: Found ${tables.length} table entries in FullTextSearch`);

      // Check first few records for SHDESC field and other available fields
      if (tables.length > 0) {
        console.log('SPORTS SOUTH API: Sample FullTextSearch record fields:', Object.keys(tables[0]));
        if (tables[0].SHDESC) {
          console.log('SPORTS SOUTH API: ✅ SHDESC FIELD FOUND in FullTextSearch!');
          console.log('SPORTS SOUTH API: Sample SHDESC:', tables[0].SHDESC?.[0]?.substring(0, 100));
        } else {
          console.log('SPORTS SOUTH API: ❌ SHDESC field not found in FullTextSearch');
        }
        
        // Log all available fields for analysis
        console.log('SPORTS SOUTH API: All available fields in FullTextSearch:', Object.keys(tables[0]));
      }

      const results = tables.map((table: any) => {
        const getValue = (field: any): string | undefined => {
          if (Array.isArray(field) && field.length > 0) {
            return field[0];
          }
          return field;
        };

        return {
          ITEMNO: getValue(table.ITEMNO),
          IDESC: getValue(table.IDESC),
          SHDESC: getValue(table.SHDESC), // This is what we're looking for!
          ITUPC: getValue(table.ITUPC),
          MFGINO: getValue(table.MFGINO),
          availableFields: Object.keys(table) // For debugging
        };
      });

      console.log(`SPORTS SOUTH API: Successfully parsed ${results.length} results from FullTextSearch`);
      
      // Count how many have SHDESC
      const withSHDESC = results.filter(r => r.SHDESC && r.SHDESC.trim());
      console.log(`SPORTS SOUTH API: ${withSHDESC.length} out of ${results.length} results have SHDESC data`);
      
      return results;

    } catch (error: any) {
      console.error('SPORTS SOUTH API: Error parsing FullTextSearch response:', error);
      return [];
    }
  }

  // Parse products from DailyItemUpdateDS response - enhanced to look for SHDESC
  private async parseProductsFromDailyUpdateDS(parsed: any): Promise<SportsSouthProduct[]> {
    try {
      console.log('SPORTS SOUTH API: Parsing DailyItemUpdateDS response...');
      console.log('SPORTS SOUTH API: Parsed structure keys:', Object.keys(parsed));

      // Handle string response format 
      let dataSet;
      if (parsed.string && parsed.string._) {
        const innerXml = parsed.string._;
        const innerParsed = await parseStringPromise(innerXml, { 
          explicitArray: true,
          ignoreAttrs: false,
          trim: true
        });
        dataSet = innerParsed;
      } else {
        dataSet = parsed;
      }

      // Navigate through the XML structure to find Table elements
      const tables = dataSet.NewDataSet?.Table || 
                    dataSet.DataSet?.Table || 
                    dataSet.Table || 
                    [];

      if (!Array.isArray(tables)) {
        console.log('SPORTS SOUTH API: No tables found in DailyItemUpdateDS dataset');
        return [];
      }

      console.log(`SPORTS SOUTH API: Found ${tables.length} table entries in DailyItemUpdateDS`);

      // Check first few records for SHDESC field
      if (tables.length > 0) {
        console.log('SPORTS SOUTH API: Sample DailyItemUpdateDS record fields:', Object.keys(tables[0]));
        if (tables[0].SHDESC) {
          console.log('SPORTS SOUTH API: ✅ SHDESC FIELD FOUND in DailyItemUpdateDS!');
          console.log('SPORTS SOUTH API: Sample SHDESC:', tables[0].SHDESC?.[0]?.substring(0, 100));
        } else {
          console.log('SPORTS SOUTH API: ❌ SHDESC field not found in DailyItemUpdateDS');
        }
      }

      const products: SportsSouthProduct[] = tables.map((table: any) => {
        // Helper function to extract values from potentially nested arrays
        const getValue = (field: any): string | undefined => {
          if (Array.isArray(field) && field.length > 0) {
            return field[0];
          }
          return field;
        };

        // Normalize UPC to prevent duplicates with other vendors
        let normalizedUpc = getValue(table.ITUPC);
        if (normalizedUpc && /^\d+$/.test(normalizedUpc)) {
          normalizedUpc = normalizedUpc.padStart(12, '0'); // Pad to 12 digits with leading zeros
        }

        const product: SportsSouthProduct = {
          ITEMNO: getValue(table.ITEMNO) || '',
          IDESC: this.decodeHtmlEntities(getValue(table.IDESC) || ''), // Item Description - decode HTML entities
          ITUPC: normalizedUpc, // UPC - normalized to 12 digits to prevent duplicates
          IMFGNO: getValue(table.IMFGNO), // Manufacturer number (numeric ID)
          ITBRDNO: getValue(table.ITBRDNO), // Brand ID (numeric ID)
          MFGINO: getValue(table.MFGINO), // Mfg Item Number - ACTUAL manufacturer part number
          CATID: getValue(table.CATID),
          PICREF: getValue(table.PICREF), // Image reference
          TXTREF: this.decodeHtmlEntities(getValue(table.TXTREF) || ''), // Text reference - decode HTML entities
          WEIGHT: getValue(table.WEIGHT) ? parseFloat(getValue(table.WEIGHT) as string) : undefined,
          ITATR1: getValue(table.ITATR1),
          ITATR2: getValue(table.ITATR2),
          ITATR3: getValue(table.ITATR3),
          ITATR4: getValue(table.ITATR4),
          ITATR5: getValue(table.ITATR5),
          ITATR7: getValue(table.ITATR7), // Often platform
          ITATR20: getValue(table.ITATR20), // Often additional capacity
          IMODEL: getValue(table.IMODEL), // AUTHORITATIVE Item Model Number
          SERIES: getValue(table.SERIES),
          LENGTH: getValue(table.LENGTH) ? parseFloat(getValue(table.LENGTH) as string) : undefined,
          HEIGHT: getValue(table.HEIGHT) ? parseFloat(getValue(table.HEIGHT) as string) : undefined,
          WIDTH: getValue(table.WIDTH) ? parseFloat(getValue(table.WIDTH) as string) : undefined,
          CHGDTE: getValue(table.CHGDTE),
          LOADDT: getValue(table.LOADDT)
        };

        // CRITICAL: Check if SHDESC is available in bulk response
        const shdesc = getValue(table.SHDESC);
        if (shdesc) {
          console.log(`SPORTS SOUTH API: ✅ FOUND SHDESC for ${product.ITEMNO}: "${shdesc}"`);
          // Store SHDESC in TXTREF field temporarily for testing
          product.TXTREF = shdesc;
        } else if (product.ITEMNO === '144241') {
          // Special logging for the requested EOTech product
          console.log(`SPORTS SOUTH API: ❌ NO SHDESC found for requested product ${product.ITEMNO}`);
          console.log(`SPORTS SOUTH API: Available fields for ${product.ITEMNO}:`, Object.keys(table));
        }

        return product;
      });

      console.log(`SPORTS SOUTH API: Successfully parsed ${products.length} products from DailyItemUpdateDS`);
      return products;

    } catch (error: any) {
      console.error('SPORTS SOUTH API: Error parsing DailyItemUpdateDS response:', error);
      return [];
    }
  }

  // Parse products from DailyItemUpdate response
  private async parseProductsFromDailyUpdate(parsed: any): Promise<SportsSouthProduct[]> {
    try {
      console.log('SPORTS SOUTH API: Parsing DailyItemUpdate response...');
      console.log('SPORTS SOUTH API: Parsed structure keys:', Object.keys(parsed));

      // Handle string response format 
      let dataSet;
      if (parsed.string && parsed.string._) {
        const innerXml = parsed.string._;
        const innerParsed = await parseStringPromise(innerXml, { 
          explicitArray: true,
          ignoreAttrs: false,
          trim: true
        });
        dataSet = innerParsed;
      } else {
        dataSet = parsed;
      }

      // Navigate through the XML structure to find Table elements
      const tables = dataSet.NewDataSet?.Table || 
                    dataSet.DataSet?.Table || 
                    dataSet.Table || 
                    [];

      if (!Array.isArray(tables)) {
        console.log('SPORTS SOUTH API: No tables found in dataset');
        return [];
      }

      console.log(`SPORTS SOUTH API: Found ${tables.length} table entries`);

      const products: SportsSouthProduct[] = tables.map((table: any) => {
        // Helper function to extract values from potentially nested arrays
        const getValue = (field: any): string | undefined => {
          if (Array.isArray(field) && field.length > 0) {
            return field[0];
          }
          return field;
        };

        // Normalize UPC to prevent duplicates with other vendors
        let normalizedUpc = getValue(table.ITUPC);
        if (normalizedUpc && /^\d+$/.test(normalizedUpc)) {
          normalizedUpc = normalizedUpc.padStart(12, '0'); // Pad to 12 digits with leading zeros
        }

        // Extract SHDESC field from DailyItemUpdate (up to 80 characters - the high quality name we want!)
        const shdesc = this.decodeHtmlEntities(getValue(table.SHDESC) || '');

        const product: SportsSouthProduct = {
          ITEMNO: getValue(table.ITEMNO) || '',
          IDESC: this.decodeHtmlEntities(getValue(table.IDESC) || ''), // Item Description (38 chars max)
          ITUPC: normalizedUpc, // UPC - normalized to 12 digits to prevent duplicates
          IMFGNO: getValue(table.IMFGNO), // Manufacturer number (numeric ID)
          ITBRDNO: getValue(table.ITBRDNO), // Brand ID (numeric ID)
          MFGINO: getValue(table.MFGINO), // Mfg Item Number - ACTUAL manufacturer part number
          CATID: getValue(table.CATID),
          PICREF: getValue(table.PICREF), // Image reference
          TXTREF: shdesc || this.decodeHtmlEntities(getValue(table.TXTREF) || ''), // Store SHDESC in TXTREF for updates
          WEIGHT: getValue(table.WEIGHT) ? parseFloat(getValue(table.WEIGHT) as string) : undefined,
          ITATR1: getValue(table.ITATR1),
          ITATR2: getValue(table.ITATR2),
          ITATR3: getValue(table.ITATR3),
          ITATR4: getValue(table.ITATR4),
          ITATR5: getValue(table.ITATR5),
          ITATR7: getValue(table.ITATR7), // Often platform
          ITATR20: getValue(table.ITATR20), // Often additional capacity
          IMODEL: getValue(table.IMODEL), // AUTHORITATIVE Item Model Number
          SERIES: getValue(table.SERIES),
          LENGTH: getValue(table.LENGTH) ? parseFloat(getValue(table.LENGTH) as string) : undefined,
          HEIGHT: getValue(table.HEIGHT) ? parseFloat(getValue(table.HEIGHT) as string) : undefined,
          WIDTH: getValue(table.WIDTH) ? parseFloat(getValue(table.WIDTH) as string) : undefined,
          CHGDTE: getValue(table.CHGDTE),
          LOADDT: getValue(table.LOADDT)
        };

        // Special logging for the requested EOTech product
        if (product.ITEMNO === '144241') {
          console.log(`SPORTS SOUTH API: 🎯 FOUND REQUESTED PRODUCT ${product.ITEMNO}:`);
          console.log(`  IDESC (38 chars): "${product.IDESC}"`);
          console.log(`  SHDESC (80 chars): "${shdesc}" ${shdesc ? '✅' : '❌'}`);
          console.log(`  TXTREF (stored): "${product.TXTREF}"`);
          console.log(`  UPC: "${product.ITUPC}"`);
          console.log(`  Available fields:`, Object.keys(table));
        }

        return product;
      });

      console.log(`SPORTS SOUTH API: Successfully parsed ${products.length} products from DailyItemUpdate`);
      return products;

    } catch (error: any) {
      console.error('SPORTS SOUTH API: Error parsing DailyItemUpdate response:', error);
      return [];
    }
  }

  // Parse products from ItemUpdate response
  private async parseProductsFromItemUpdate(parsed: any): Promise<SportsSouthProduct[]> {
    // Similar parsing logic as DailyItemUpdate
    return await this.parseProductsFromDailyUpdate(parsed);
  }

  // Parse products from BasicInventory response
  private async parseProductsFromBasicInventory(parsed: any): Promise<SportsSouthProduct[]> {
    // Similar parsing logic as DailyItemUpdate
    return await this.parseProductsFromDailyUpdate(parsed);
  }

  // Decode HTML entities in text fields
  private decodeHtmlEntities(text: string): string {
    if (!text) return text;
    
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&lsquo;/g, "'")
      .replace(/&rsquo;/g, "'");
  }

  // Sanitize XML to fix common Sports South API formatting issues
  private sanitizeXml(xml: string): string {
    return xml
      // Fix invalid entity characters like &) or &( 
      .replace(/&\(/g, '&amp;(')
      .replace(/&\)/g, '&amp;)')
      .replace(/&(?![a-zA-Z0-9#];)/g, '&amp;')  // Fix unescaped & characters
      // Remove null characters and other control characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Fix common HTML entities that might be in product descriptions
      .replace(/&nbsp;/g, ' ')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&lsquo;/g, "'")
      .replace(/&rsquo;/g, "'");
  }
}

// Export factory function for Sports South API
export function createSportsSouthAPI(credentials: SportsSouthCredentials): SportsSouthAPI {
  return new SportsSouthAPI(credentials);
}