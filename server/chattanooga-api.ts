import fetch from 'node-fetch';
import { createHash } from 'crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';

interface ChattanoogaCredentials {
  accountNumber: string;
  username: string;
  password: string;
  sid: string;
  token: string;
}

interface ChattanoogaProduct {
  // Core product fields
  cssi_id: string;
  name: string;
  upc?: string;
  manufacturer?: string;
  model?: string;
  
  // Pricing fields
  custom_price?: number;
  retail_price?: number;
  map_price?: number;
  retail_map_price?: number;
  msrp?: number;
  drop_ship_price?: number;
  
  // Inventory fields
  inventory?: number;
  in_stock_flag?: number;
  
  // Firearms compliance fields
  serialized_flag?: number;
  ffl_flag?: number;
  allocated?: number;
  
  // Drop shipping fields
  drop_ship_flag?: number;
  available_drop_ship_delivery_options?: string;
  
  // Enhanced data
  specifications?: any;
  custom_properties?: any;
  weight?: number;
  
  // Image fields (enhanced testing for all possible API image fields)
  image?: string;
  image_url?: string;
  imageUrl?: string;
  imagePath?: string;
  picture?: string;
  photo?: string;
  photoUrl?: string;
  img_url?: string;
  product_image?: string;
  thumbnail?: string;

}

interface ChattanoogaApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class ChattanoogaAPI {
  private baseUrl = 'https://api.chattanoogashooting.com/rest/v5'; // CORRECT API endpoint
  private credentials: ChattanoogaCredentials;
  private authToken: string | null = null;
  private proxyAgent: HttpsProxyAgent<string> | null = null;

  constructor(credentials: ChattanoogaCredentials) {
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
      
      this.proxyAgent = new HttpsProxyAgent(proxyUrl);
      console.log(`✅ CHATTANOOGA PROXY: Configured to use proxy at ${proxyHost}:${proxyPort}`);
    }
  }

  private getFetchOptions(options: any = {}): any {
    if (this.proxyAgent) {
      return { ...options, agent: this.proxyAgent };
    }
    return options;
  }

  /**
   * Create Basic Auth header with direct SID:MD5(Token) format (NO Base64 encoding)
   * 
   * CRITICAL: Chattanooga changed authentication format on ~January 24, 2025
   * - OLD FORMAT (BROKEN): Basic Base64(SID:MD5Hash) - Returns 401 Unauthorized
   * - NEW FORMAT (WORKING): Basic SID:MD5Hash - Returns 200 Success
   * 
   * DO NOT MODIFY WITHOUT READING: CHATTANOOGA_AUTHENTICATION_CRITICAL.md
   * 
   * Last verified working: January 25, 2025
   * Test with: tsx debug-current-credentials.js
   */
  private createBasicAuth(): string {
    // ✅ ENHANCED: Add comprehensive token validation and debugging
    console.log(`🔍 CHATTANOOGA AUTH DEBUG: Starting authentication process`);
    console.log(`🔍 CHATTANOOGA AUTH DEBUG: Token length: ${this.credentials.token?.length || 0}`);
    console.log(`🔍 CHATTANOOGA AUTH DEBUG: Token format check: ${this.credentials.token?.substring(0, 8)}...`);
    console.log(`🔍 CHATTANOOGA AUTH DEBUG: SID format check: ${this.credentials.sid?.substring(0, 8)}...`);
    
    // Validate token format
    if (!this.credentials.token || this.credentials.token.length !== 32) {
      console.error(`❌ CHATTANOOGA AUTH: Invalid token length. Expected 32, got ${this.credentials.token?.length || 0}`);
      console.error(`❌ CHATTANOOGA AUTH: Token value: ${this.credentials.token}`);
    }
    
    if (!this.credentials.token || !/^[A-F0-9]+$/i.test(this.credentials.token)) {
      console.error(`❌ CHATTANOOGA AUTH: Invalid token format. Expected hex string, got: ${this.credentials.token}`);
    }
    
    // Validate SID format
    if (!this.credentials.sid || this.credentials.sid.length !== 32) {
      console.error(`❌ CHATTANOOGA AUTH: Invalid SID length. Expected 32, got ${this.credentials.sid?.length || 0}`);
    }
    
    const tokenHash = createHash('md5').update(this.credentials.token).digest('hex'); // lowercase hex required
    const authString = `Basic ${this.credentials.sid}:${tokenHash}`; // Direct format, NO Base64 encoding
    
    console.log(`CHATTANOOGA AUTH: Using VERIFIED working direct authentication format`);
    console.log(`CHATTANOOGA AUTH: SID=${this.credentials.sid.substring(0, 8)}...`);
    console.log(`CHATTANOOGA AUTH: Token=${this.credentials.token.substring(0, 8)}...`);
    console.log(`CHATTANOOGA AUTH: MD5 Hash=${tokenHash.substring(0, 8)}...`);
    console.log(`CHATTANOOGA AUTH: Auth format: Basic SID:MD5(Token) (direct, no Base64) - VERIFIED WORKING`);
    console.log(`CHATTANOOGA AUTH: Expected token: A3B1F814A833F40CFD2A800E0EE4CA81`);
    console.log(`CHATTANOOGA AUTH: Actual token: ${this.credentials.token}`);
    console.log(`CHATTANOOGA AUTH: Token match: ${this.credentials.token === 'A3B1F814A833F40CFD2A800E0EE4CA81' ? '✅ CORRECT' : '❌ MISMATCH'}`);
    console.log(`CHATTANOOGA AUTH: If this fails, see CHATTANOOGA_AUTHENTICATION_CRITICAL.md`);
    
    return authString;
  }

  private hashToken(token: string): string {
    return createHash('md5').update(token).digest('hex');
  }

  /**
   * Retrieve full product feed from Chattanooga API using the product-feed endpoint
   * This endpoint is specifically designed to return ALL products as a CSV download URL
   */
  async getProductFeed(): Promise<ChattanoogaApiResponse<any[]>> {
    try {
      console.log('CHATTANOOGA API: Requesting full product feed from /items/product-feed endpoint');
      
      const authHeader = this.createBasicAuth();
      console.log(`CHATTANOOGA API: Using Basic Auth with SID:MD5(Token) - SID: ${this.credentials.sid}`);
      
      // First get the CSV download URL
      const params = new URLSearchParams({
        'optional_columns': 'specifications,retail_map',
        'return_custom_properties': '1'
      });
      
      const response = await fetch(`${this.baseUrl}/items/product-feed?${params.toString()}`, this.getFetchOptions({
        method: 'GET',
        headers: {
          'Authorization': authHeader, // authHeader already includes "Basic " prefix
          'Accept': 'application/json',
          'User-Agent': 'RetailPlatform/1.0',
          'Content-Type': 'application/json'
        },
      }));

      console.log(`CHATTANOOGA API: Product feed response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`CHATTANOOGA API: Product feed failed - ${response.status}: ${errorText}`);
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          message: `Product feed request failed with status ${response.status}`
        };
      }

      const contentType = response.headers.get('content-type');
      console.log(`CHATTANOOGA API: Response content type: ${contentType}`);

      if (contentType?.includes('application/json')) {
        const data: any = await response.json();
        console.log(`CHATTANOOGA API: Product feed response:`, JSON.stringify(data, null, 2));
        
        // Check if we got a CSV download URL
        if (data.product_feed && data.product_feed.url) {
          const csvUrl = data.product_feed.url;
          console.log(`CHATTANOOGA API: Got CSV download URL: ${csvUrl}`);
          
          // Download the CSV file
          const csvResponse = await fetch(csvUrl, this.getFetchOptions({
            method: 'GET',
            headers: {
              'Authorization': authHeader,
              'User-Agent': 'RetailPlatform/1.0'
            }
          }));
          
          if (!csvResponse.ok) {
            throw new Error(`Failed to download CSV: ${csvResponse.status} ${csvResponse.statusText}`);
          }
          
          const csvContent = await csvResponse.text();
          const lines = csvContent.split('\n').filter(line => line.trim());
          console.log(`CHATTANOOGA API: Successfully downloaded CSV with ${lines.length} lines (including header)`);
          
          return {
            success: true,
            data: csvContent,
            message: `Product feed CSV downloaded successfully with ${lines.length - 1} products`
          };
        } else {
          console.error('CHATTANOOGA API: No product_feed.url found in response');
          return {
            success: false,
            error: 'No CSV download URL found in response',
            message: 'Product feed endpoint did not return expected CSV URL'
          };
        }
      } else if (contentType?.includes('text/csv') || contentType?.includes('text/plain')) {
        const csvData = await response.text();
        console.log(`CHATTANOOGA API: Successfully retrieved CSV product feed - ${csvData.split('\n').length} lines`);
        return {
          success: true,
          data: csvData as any,
          message: `CSV product feed retrieved successfully`
        };
      } else {
        const textData = await response.text();
        console.log(`CHATTANOOGA API: Retrieved product feed with content type: ${contentType}`);
        return {
          success: true,
          data: textData as any,
          message: `Product feed retrieved (${contentType})`
        };
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('CHATTANOOGA API: Product feed request failed:', error);
      return {
        success: false,
        error: errorMessage,
        message: `Failed to retrieve product feed: ${errorMessage}`
      };
    }
  }

  /**
   * Transform Chattanooga API product data to PriceCompare Pro product format
   */
  static async transformProduct(chattanoogaProduct: ChattanoogaProduct): Promise<any> {
    // Use centralized vendor field mapping for consistent field extraction
    const { extractProductName, extractField } = await import('@shared/vendor-field-mappings');
    
    // Parse drop ship options from comma-separated string
    const dropShipOptions = chattanoogaProduct.available_drop_ship_delivery_options
      ? chattanoogaProduct.available_drop_ship_delivery_options.split('|').filter(opt => opt.trim())
      : [];

    // Extract fields using centralized mappings
    const brandName = extractField(chattanoogaProduct, 'brand', 'chattanooga') || '';
    const productName = extractProductName(chattanoogaProduct, 'chattanooga', brandName);
    const upcCode = extractField(chattanoogaProduct, 'upc', 'chattanooga') || '';
    const modelName = extractField(chattanoogaProduct, 'model', 'chattanooga') || '';

    return {
      upc: upcCode,
      name: productName, // ✅ Using centralized field mapping
      brand: brandName, // ✅ Using centralized field mapping
      model: modelName, // ✅ Using centralized field mapping
      partNumber: chattanoogaProduct.cssi_id || '', // Using Chattanooga ID as part number
      caliber: null, // Would need to extract from specifications or name
      category: null, // Would need category mapping
      description: productName, // ✅ Using centralized field mapping
      weight: chattanoogaProduct.weight || null,
      imageUrl: chattanoogaProduct.image_url || 
                chattanoogaProduct.imageUrl || 
                chattanoogaProduct.imagePath ||
                chattanoogaProduct.image || 
                chattanoogaProduct.picture || 
                chattanoogaProduct.photo || 
                chattanoogaProduct.photoUrl ||
                chattanoogaProduct.img_url || 
                chattanoogaProduct.product_image ||
                chattanoogaProduct.thumbnail ||
                null, // Check for various possible image field names
      
      // Enhanced Chattanooga fields
      fflRequired: Boolean(chattanoogaProduct.ffl_flag),
      serialized: Boolean(chattanoogaProduct.serialized_flag),
      mapPrice: chattanoogaProduct.map_price || null,
      retailPrice: chattanoogaProduct.retail_price || null,
      dropShipAvailable: Boolean(chattanoogaProduct.drop_ship_flag),
      dropShipOptions: dropShipOptions,
      allocated: Boolean(chattanoogaProduct.allocated),
      specifications: chattanoogaProduct.specifications || null,

      customProperties: chattanoogaProduct.custom_properties || null,
    };
  }

  /**
   * Search for a specific product and log raw response to investigate image fields
   */
  async searchProductByUPC(upc: string): Promise<ChattanoogaApiResponse<any>> {
    try {
      console.log(`CHATTANOOGA: 🔍 Searching for UPC ${upc} to investigate image fields...`);
      
      const response = await fetch(`${this.baseUrl}/items?upc=${upc}&per_page=1`, this.getFetchOptions({
        method: 'GET',
        headers: {
          'Authorization': this.createBasicAuth(),
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'RetailPlatform/1.0'
        }
      }));

      console.log(`CHATTANOOGA: Search response status: ${response.status}`);
      
      if (response.status === 200) {
        const data = await response.json();
        console.log('CHATTANOOGA: Raw API response fields for UPC', upc, ':', Object.keys((Array.isArray(data) && data[0]) || data || {}));
        console.log('CHATTANOOGA: Full raw response:', JSON.stringify(data, null, 2));
        
        return {
          success: true,
          data: Array.isArray(data) ? data : [data],
          message: 'Product search successful'
        };
      } else {
        const errorText = await response.text();
        console.error(`CHATTANOOGA: Search failed - ${response.status}: ${errorText}`);
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          message: `Search failed with status ${response.status}`
        };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('CHATTANOOGA: Search request failed:', error);
      return {
        success: false,
        error: errorMessage,
        message: `Search failed: ${errorMessage}`
      };
    }
  }

  /**
   * Test API connection and authentication using official v5 API specification
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('CHATTANOOGA: 🔍 Testing connection with official v5 API...');
      
      // Use the official documented API endpoint and authentication format
      const response = await fetch(`${this.baseUrl}/items?per_page=1`, this.getFetchOptions({
        method: 'GET',
        headers: {
          'Authorization': this.createBasicAuth(), // Already includes "Basic " prefix
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'RetailPlatform/1.0'
        }
      }));

      console.log(`CHATTANOOGA: API Response Status: ${response.status}`);
      
      if (response.status === 200) {
        console.log('CHATTANOOGA: ✅ Connection successful - API access confirmed');
        return {
          success: true,
          message: 'Connection successful - Chattanooga API is accessible'
        };
      } else if (response.status === 401) {
        const responseText = await response.text();
        let errorData: any = {};
        
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          // Response is not JSON
        }
        
        if (errorData.error_code === 4001) {
          console.error('CHATTANOOGA: ❌ Account requires activation');
          return {
            success: false,
            message: '🔐 Account activation required: Your Chattanooga API credentials are valid but need to be activated by Chattanooga IT. Contact your sales representative to activate API access. (Error 4001)'
          };
        } else {
          console.error('CHATTANOOGA: ❌ Authentication failed:', responseText);
          return {
            success: false,
            message: '❌ Authentication failed: Please verify your SID and Token credentials with Chattanooga support'
          };
        }
      } else {
        const errorText = await response.text();
        console.error(`CHATTANOOGA: ❌ Unexpected response ${response.status}:`, errorText);
        return {
          success: false,
          message: `API error: ${response.status} ${response.statusText}`
        };
      }
    } catch (error: any) {
      console.error('CHATTANOOGA: ❌ Connection test failed:', error);
      return {
        success: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }

  /**
   * Get available API endpoints
   */
  async getEndpoints(): Promise<{ success: boolean; endpoints?: string[]; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/endpoints`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.credentials.sid}:${this.credentials.token}`,
          'Content-Type': 'application/json',
          'X-Account-Number': this.credentials.accountNumber
        }
      });

      if (response.ok) {
        const data: any = await response.json();
        return {
          success: true,
          endpoints: data.endpoints || data.available_endpoints || [],
          message: 'Endpoints retrieved successfully'
        };
      } else {
        return {
          success: false,
          message: `Failed to retrieve endpoints: ${response.status}`
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Error retrieving endpoints: ${error.message}`
      };
    }
  }

  /**
   * Get shipments by order numbers
   */
  async getShipmentsByOrder(orderNumbers: string[], options: {
    drop_ship_flag?: boolean;
    only_return_unreceived_shipments?: boolean;
    page?: number;
    per_page?: number;
  } = {}): Promise<any> {
    try {
      const params = new URLSearchParams();
      params.append('order_numbers', orderNumbers.join(','));
      
      if (options.drop_ship_flag !== undefined) {
        params.append('drop_ship_flag', options.drop_ship_flag ? '1' : '0');
      }
      if (options.only_return_unreceived_shipments) {
        params.append('only_return_unreceived_shipments', '1');
      }
      if (options.page) {
        params.append('page', options.page.toString());
      }
      if (options.per_page) {
        params.append('per_page', options.per_page.toString());
      }

      const authHeader = `Basic ${Buffer.from(`${this.credentials.sid}:${this.hashToken(this.credentials.token)}`).toString('base64')}`;

      const response = await fetch(`${this.baseUrl}/shipments/by-order?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return await response.json();
      } else {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }
    } catch (error: any) {
      console.error('CHATTANOOGA API: Error getting shipments by order:', error);
      throw error;
    }
  }

  /**
   * Get shipments by purchase order numbers
   */
  async getShipmentsByPurchaseOrder(purchaseOrderNumbers: string[], options: {
    drop_ship_flag?: boolean;
    only_return_unreceived_shipments?: boolean;
    page?: number;
    per_page?: number;
  } = {}): Promise<any> {
    try {
      const params = new URLSearchParams();
      params.append('purchase_order_numbers', purchaseOrderNumbers.join(','));
      
      if (options.drop_ship_flag !== undefined) {
        params.append('drop_ship_flag', options.drop_ship_flag ? '1' : '0');
      }
      if (options.only_return_unreceived_shipments) {
        params.append('only_return_unreceived_shipments', '1');
      }
      if (options.page) {
        params.append('page', options.page.toString());
      }
      if (options.per_page) {
        params.append('per_page', options.per_page.toString());
      }

      const authHeader = `Basic ${Buffer.from(`${this.credentials.sid}:${this.hashToken(this.credentials.token)}`).toString('base64')}`;

      const response = await fetch(`${this.baseUrl}/shipments/by-purchase-order?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return await response.json();
      } else {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }
    } catch (error: any) {
      console.error('CHATTANOOGA API: Error getting shipments by purchase order:', error);
      throw error;
    }
  }

  /**
   * Mark shipments as received
   */
  async markShipmentsAsReceived(orderNumbers: number[]): Promise<any> {
    try {
      const authHeader = `Basic ${Buffer.from(`${this.credentials.sid}:${this.hashToken(this.credentials.token)}`).toString('base64')}`;

      const response = await fetch(`${this.baseUrl}/shipments/mark-as-received`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order_numbers: orderNumbers
        })
      });

      if (response.ok) {
        return await response.json();
      } else {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }
    } catch (error: any) {
      console.error('CHATTANOOGA API: Error marking shipments as received:', error);
      throw error;
    }
  }

  /**
   * Test product catalog access (without importing)
   */
  async testCatalogAccess(): Promise<{ success: boolean; productCount?: number; message: string }> {
    try {
      // Try common product catalog endpoints with different authentication methods
      const endpointPatterns = [
        {
          path: '/products',
          auth: `Basic ${Buffer.from(`${this.credentials.sid}:${this.credentials.token}`).toString('base64')}`
        },
        {
          path: '/catalog',
          auth: `Bearer ${this.credentials.sid}:${this.credentials.token}`
        },
        {
          path: '/inventory',
          auth: `Basic ${Buffer.from(`${this.credentials.sid}:${this.credentials.token}`).toString('base64')}`
        },
        {
          path: '/items',
          auth: `Bearer ${this.credentials.token}`
        }
      ];

      for (const pattern of endpointPatterns) {
        try {
          console.log(`CHATTANOOGA API: Testing catalog endpoint: ${pattern.path}`);
          
          const response = await fetch(`${this.baseUrl}${pattern.path}?limit=1`, {
            method: 'GET',
            headers: {
              'Authorization': pattern.auth,
              'Content-Type': 'application/json',
              'X-Account-Number': this.credentials.accountNumber,
              'X-Username': this.credentials.username
            }
          });

          if (response.ok) {
            const data: any = await response.json();
            const productCount = data.total || data.count || (data.products ? data.products.length : 0) || (data.items ? data.items.length : 0);
            
            return {
              success: true,
              productCount,
              message: `Catalog access successful via ${pattern.path}. Available products: ${productCount || 'Ready for import'}`
            };
          } else if (response.status === 401) {
            return {
              success: false,
              message: `Catalog access denied - credentials may need activation or have insufficient permissions`
            };
          }
        } catch (endpointError) {
          console.log(`CHATTANOOGA API: Endpoint ${pattern.path} failed, trying next...`);
          continue;
        }
      }

      return {
        success: false,
        message: 'Catalog endpoints could not be accessed - API may require dealer account activation'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Catalog access test failed: ${error.message}`
      };
    }
  }

  /**
   * Search for a specific product by UPC, SKU, or part number
   */
  async searchProduct(searchParams: {
    upc?: string;
    sku?: string;
    partNumber?: string;
    brand?: string;
  }): Promise<{ success: boolean; product?: any; message: string }> {
    try {
      console.log('CHATTANOOGA API: Searching for product:', searchParams);
      
      // First try to authenticate with POST, then search
      console.log('CHATTANOOGA API: Attempting authentication first...');
      
      try {
        // Step 1: Try authentication with Chattanooga login system
        await this.authenticate();
      } catch (authError) {
        console.log('CHATTANOOGA API: Authentication failed, trying direct API calls...');
      }

      // Use Chattanooga's official API base URL
      const baseUrl = 'https://api.chattanoogashooting.com/rest/v5';

      // Use Chattanooga's official /items endpoint as documented
      const searchEndpoints = [
        { path: '/items', method: 'GET' as const }
      ];

      for (const endpoint of searchEndpoints) {
        try {
          // Build query parameters using Chattanooga's documented format
          const params = new URLSearchParams();
          
          // Use UPC codes parameter for UPC search (only if valid UPC format)
          // IMPORTANT: Don't mix UPC search with item_ids - use one OR the other
          if (searchParams.upc && searchParams.upc.match(/^\d{12,13}$/)) {
            console.log('CHATTANOOGA API: FIXED VERSION - Using UPC-only search, NOT adding item_ids');
            params.append('upc_codes', searchParams.upc);
          } 
          // Use item_ids parameter for SKU/item ID search or part number search (only if no UPC)
          else if (searchParams.sku) {
            console.log('CHATTANOOGA API: Using SKU search only');
            params.append('item_ids', searchParams.sku);
          } else if (searchParams.partNumber) {
            console.log('CHATTANOOGA API: Using part number search only');
            params.append('item_ids', searchParams.partNumber);
          }
          
          // Set reasonable pagination limits
          params.append('per_page', '50');
          params.append('page', '1');
          
          const url = `${baseUrl}${endpoint.path}?${params.toString()}`;
          console.log(`CHATTANOOGA API: Trying official endpoint: ${url}`);
          console.log(`CHATTANOOGA API: Using search parameter: ${searchParams.upc ? 'UPC-only search' : 'SKU/Item ID search'}`);
          
          // Use Chattanooga's working authentication format: Direct Basic SID:MD5Hash (no Base64)
          const md5Token = createHash('md5').update(this.credentials.token).digest('hex'); // lowercase
          const authString = `Basic ${this.credentials.sid}:${md5Token}`; // Direct format with Basic prefix
          
          console.log(`CHATTANOOGA API: Using correct authentication format`);
          console.log(`  SID: ${this.credentials.sid}`);
          console.log(`  Token: ${this.credentials.token}`);
          console.log(`  MD5 Hash: ${md5Token}`);
          console.log(`  Auth String: ${authString}`);
          console.log(`  Expected: Basic D1EEB7BB0C58A27C6FEA7B4339F5251C:6D7012A0C5AC75A7252684A0ACE91579`);
          
          const headers: Record<string, string> = {
            'Authorization': authString, // authString already includes "Basic " prefix
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'RetailPlatform/1.0'
          };

          const response = await fetch(url, {
            method: endpoint.method,
            headers,
          });

          console.log(`CHATTANOOGA API: Response status: ${response.status} for ${endpoint.path}`);
          
          if (response.ok) {
            const data: any = await response.json();
            console.log(`CHATTANOOGA API: Success! Response data:`, JSON.stringify(data, null, 2));
            
            // Handle Chattanooga's documented response format
            const items = data.items || [];
            
            if (Array.isArray(items) && items.length > 0) {
              // When searching by UPC via upc_codes parameter, Chattanooga returns 
              // matching products but doesn't include UPC field in response.
              // Since we searched specifically by UPC, any returned item is a match.
              const product = items[0];
              
              
              console.log('CHATTANOOGA IMAGE DEBUG: Product fields:', Object.keys(product));
              console.log('CHATTANOOGA IMAGE DEBUG: Full product data:', JSON.stringify(product, null, 2));
              console.log('CHATTANOOGA IMAGE DEBUG: Looking for image fields...');
              ['image', 'image_url', 'picture', 'photo', 'img_url', 'thumbnail', 'photo_url', 'product_image', 'product_photo'].forEach(field => {
                if (product[field]) {
                  console.log(`CHATTANOOGA IMAGE DEBUG: Found ${field}:`, product[field]);
                }
              });
              
              // Transform Chattanooga's response using CORRECT API field mappings
              
              console.log(`\n=== CHATTANOOGA API RESPONSE DEBUG ===`);
              console.log(`Product: ${product.name}`);
              console.log(`RAW API Fields:`);
              console.log(`  custom_price (maps to Vendor Cost): ${product.custom_price} (${typeof product.custom_price})`);
              console.log(`  retail_price (VENDOR COST - NOT MSRP): ${product.retail_price} (${typeof product.retail_price})`);  
              console.log(`  map_price (old field): ${product.map_price} (${typeof product.map_price})`);
              console.log(`  retail_map_price (CORRECT MAP field): ${product.retail_map_price} (${typeof product.retail_map_price})`);
              console.log(`Other available pricing fields:`, {
                msrp: product.msrp,
                drop_ship_price: product.drop_ship_price
              });
              console.log(`=== END CHATTANOOGA DEBUG ===\n`);

              const transformedProduct = {
                sku: product.cssi_id,                    // cssi_id → Vendor SKU
                name: product.name,
                price: product.custom_price,             // custom_price → Vendor Cost
                msrp: null,     // Chattanooga doesn't provide authentic MSRP data - retail_price is vendor cost
                stock: product.inventory,
                inStock: product.in_stock_flag === 1,
                dropShip: product.drop_ship_flag === 1,
                dropShipPrice: product.drop_ship_price,
                mapPrice: product.retail_map_price,      // retail_map_price → MAP (CORRECTED)
                fflRequired: product.ffl_flag === 1,
                serialized: product.serialized_flag === 1
              };
              
              return {
                success: true,
                product: transformedProduct,
                message: `Product found in Chattanooga inventory: ${product.name} - Stock: ${product.inventory}, Price: $${product.custom_price}`
              };
            } else {
              console.log(`CHATTANOOGA API: No items found in response`);
              return {
                success: false,
                message: 'Product not found in Chattanooga inventory'
              };
            }
          } else {
            const errorText = await response.text();
            let errorData: any = {};
            
            try {
              errorData = JSON.parse(errorText);
            } catch (e) {
              console.log(`CHATTANOOGA API: Non-JSON error response:`, errorText.substring(0, 200));
              continue;
            }
            
            // Handle Chattanooga's documented error format
            if (errorData.error_code) {
              console.log(`CHATTANOOGA API: Error Code ${errorData.error_code}: ${errorData.message}`);
              
              if (errorData.errors && Array.isArray(errorData.errors)) {
                errorData.errors.forEach((error: any) => {
                  console.log(`  - Subcode ${error.subcode}: ${error.message} (Property: ${error.property})`);
                });
              }
              
              // Handle specific error codes
              switch (errorData.error_code) {
                case 4001:
                  console.log('CHATTANOOGA API: Invalid authorization - check SID/Token format');
                  return {
                    success: false,
                    message: 'Authentication failed - invalid SID or Token credentials'
                  };
                case 4003:
                  console.log('CHATTANOOGA API: Permission denied - account may need API access');
                  return {
                    success: false,
                    message: 'Access forbidden - account may need API access activation'
                  };
                case 8000:
                case 60001:
                  console.log('CHATTANOOGA API: No records found for search criteria');
                  return {
                    success: false,
                    message: 'Product not found in Chattanooga catalog'
                  };
                case 9000:
                  console.log('CHATTANOOGA API: Data validation failed');
                  return {
                    success: false,
                    message: 'Invalid search parameters - data validation failed'
                  };
                default:
                  console.log(`CHATTANOOGA API: Unhandled error code ${errorData.error_code}`);
                  return {
                    success: false,
                    message: `API error: ${errorData.message}`
                  };
              }
            } else {
              console.log(`CHATTANOOGA API: HTTP ${response.status} error for ${endpoint.path}:`, errorText.substring(0, 200));
              continue; // Try next endpoint
            }
          }
        } catch (endpointError: any) {
          console.log(`CHATTANOOGA API: Network error for ${endpoint.path}:`, endpointError.message);
          continue; // Try next endpoint
        }
      }



      return {
        success: false,
        message: 'Product not found in Chattanooga catalog - no matching items returned from /items endpoint'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Product search failed: ${error.message}`
      };
    }
  }

  /**
   * Submit order to Chattanooga Shooting Supplies
   */
  async submitOrder(orderData: {
    items: Array<{
      sku: string;
      quantity: number;
      customerReference?: string;
    }>;
    shippingAddress: {
      name: string;
      address: string;
      city: string;
      state: string;
      zip: string;
      phone?: string;
    };
    customerPO?: string;
    dropShip?: boolean;
    customer?: string;
    deliveryOption?: string;
  }): Promise<{ success: boolean; orderNumber?: number; message: string }> {
    try {
      console.log('CHATTANOOGA API: Submitting order with items:', orderData.items.length);
      console.log('CHATTANOOGA API: Using corrected endpoint:', `${this.baseUrl}/orders`);
      
      const authString = this.createBasicAuth();
      
      // Build request payload according to official API specification
      const requestPayload: any = {
        purchase_order_number: orderData.customerPO,
        ship_to_address: {
          name: orderData.shippingAddress.name,
          line_1: orderData.shippingAddress.address,
          line_2: '',
          city: orderData.shippingAddress.city,
          state_code: orderData.shippingAddress.state,
          zip: orderData.shippingAddress.zip
        },
        order_items: orderData.items.map(item => ({
          item_number: item.sku,
          order_quantity: item.quantity,
          customer_reference: item.customerReference || ''
        }))
      };

      // Add drop ship options if specified
      if (orderData.dropShip) {
        requestPayload.drop_ship_flag = 1;
        requestPayload.customer = orderData.customer;
        requestPayload.delivery_option = orderData.deliveryOption || 'ground';
      }
      
      console.log('CHATTANOOGA API: Request payload:', JSON.stringify(requestPayload, null, 2));
      
      const response = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'RetailPlatform/1.0'
        },
        body: JSON.stringify(requestPayload)
      });

      console.log(`CHATTANOOGA API: Order submission response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`CHATTANOOGA API: Order submission failed - ${response.status}: ${errorText}`);
        
        // Handle specific authentication errors
        if (response.status === 401) {
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error_code === 4001) {
              return {
                success: false,
                message: 'Chattanooga Order Submission Requires Additional Permissions: Your account has product search access but needs ORDER SUBMISSION permissions activated. Product searches work fine, but order placement requires additional API permissions from Chattanooga IT. Contact your sales representative to activate order submission permissions.'
              };
            }
          } catch (e) {
            // Not JSON, continue with generic error
          }
        }
        
        return {
          success: false,
          message: `Order submission failed (${response.status}): ${errorText}`
        };
      }

      const responseText = await response.text();
      console.log('CHATTANOOGA API: Raw response:', responseText.substring(0, 200) + '...');
      
      // Check if response is HTML (web interface) or JSON (API)
      if (responseText.trim().startsWith('<')) {
        // HTML response indicates the endpoint exists but may be returning a web interface
        console.log('CHATTANOOGA API: Received HTML response instead of JSON');
        
        return {
          success: false,
          message: 'Order submission failed: Chattanooga API returned HTML instead of JSON. This may indicate the API endpoint requires different authentication or the order submission feature needs to be activated for your account.'
        };
      }
      
      // Try to parse as JSON
      try {
        const result: any = JSON.parse(responseText);
        
        // Parse official API response format
        if (result.orders && result.orders.length > 0) {
          const order = result.orders[0];
          console.log(`CHATTANOOGA API: Order submitted successfully - Order Number: ${order.order_number}`);
          return {
            success: true,
            orderNumber: order.order_number,
            message: `Order submitted successfully. Chattanooga Order Number: ${order.order_number}`
          };
        } else {
          return {
            success: false,
            message: 'Order submission failed - no order returned in response'
          };
        }
      } catch (jsonError) {
        console.log('CHATTANOOGA API: Failed to parse response as JSON:', jsonError);
        return {
          success: false,
          message: 'Order submission received invalid response format'
        };
      }

    } catch (error: any) {
      console.error('CHATTANOOGA API: Order submission error:', error);
      return {
        success: false,
        message: `Failed to submit order: ${error.message}`
      };
    }
  }

  /**
   * Get order status and tracking information
   */
  async getOrderStatus(orderNumber: number): Promise<{ success: boolean; order?: any; shipments?: any; message: string }> {
    try {
      console.log(`CHATTANOOGA API: Fetching order status for Order Number: ${orderNumber}`);
      
      const authString = this.createBasicAuth();
      
      // Get order details using official API endpoint
      const response = await fetch(`${this.baseUrl}/orders/${orderNumber}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `Failed to fetch order status (${response.status}): ${errorText}`
        };
      }

      const orderResult: any = await response.json();
      
      if (!orderResult.orders || orderResult.orders.length === 0) {
        return {
          success: false,
          message: `Order ${orderNumber} not found`
        };
      }

      const order = orderResult.orders[0];
      
      // Also fetch shipment information using official shipments endpoint
      let shipments = null;
      try {
        const shipmentsResponse = await fetch(`https://api.chattanoogashooting.com/rest/v5/orders/${orderNumber}/shipments`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (shipmentsResponse.ok) {
          const shipmentsResult: any = await shipmentsResponse.json();
          shipments = shipmentsResult.order_shipments;
          console.log(`CHATTANOOGA API: Found ${shipments?.length || 0} shipments for order ${orderNumber}`);
        }
      } catch (shipmentsError) {
        console.log('CHATTANOOGA API: Could not fetch shipment details, order may not be shipped yet');
      }

      return {
        success: true,
        order: order,
        shipments: shipments,
        message: `Order ${orderNumber} status: ${order.status}. ${shipments?.length ? `Shipments: ${shipments.length}` : 'No shipments yet'}`
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('CHATTANOOGA API: Order status fetch error:', error);
      return {
        success: false,
        message: `Failed to fetch order status: ${errorMessage}`
      };
    }
  }

  /**
   * Authenticate with Chattanooga API system
   */
  private async authenticate(): Promise<void> {
    try {
      // Try Chattanooga's login endpoint
      const loginResponse = await fetch('https://login.chattanoogashooting.com/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username: this.credentials.username,
          password: this.credentials.password,
          account: this.credentials.accountNumber
        })
      });

      if (loginResponse.ok) {
        const loginData: any = await loginResponse.json();
        if (loginData.token || loginData.access_token) {
          this.authToken = loginData.token || loginData.access_token;
          console.log('CHATTANOOGA API: Authentication successful, got token');
        }
      } else {
        console.log(`CHATTANOOGA API: Login failed with status ${loginResponse.status}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`CHATTANOOGA API: Authentication error: ${errorMessage}`);
    }
  }

  /**
   * Get vendor capabilities and status
   */
  async getVendorCapabilities(): Promise<{
    success: boolean;
    capabilities: {
      hasProducts: boolean;
      hasInventory: boolean;
      hasOrdering: boolean;
      hasPricing: boolean;
      supportedFormats: string[];
    };
    message: string;
  }> {
    try {
      const connectionTest = await this.testConnection();
      const catalogTest = await this.testCatalogAccess();
      const endpointsTest = await this.getEndpoints();

      return {
        success: connectionTest.success,
        capabilities: {
          hasProducts: catalogTest.success,
          hasInventory: catalogTest.success,
          hasOrdering: false, // Would need to test order endpoints
          hasPricing: catalogTest.success,
          supportedFormats: ['JSON', 'API']
        },
        message: `Connection: ${connectionTest.message}. Catalog: ${catalogTest.message}`
      };
    } catch (error: any) {
      return {
        success: false,
        capabilities: {
          hasProducts: false,
          hasInventory: false,
          hasOrdering: false,
          hasPricing: false,
          supportedFormats: []
        },
        message: `Capabilities check failed: ${error.message}`
      };
    }
  }

  /**
   * Get products by brand for incremental catalog synchronization
   * This method supports brand-by-brand API calls for better performance
   */
  async getProductsByBrand(brand: string): Promise<ChattanoogaProduct[]> {
    try {
      console.log(`CHATTANOOGA API: Fetching products for brand: ${brand}`);
      
      const authString = this.createBasicAuth();
      const response = await fetch(`${this.baseUrl}/items?manufacturer=${encodeURIComponent(brand)}&per_page=1000`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`CHATTANOOGA API: Brand products error ${response.status}: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: any = await response.json();
      
      if (data.items && Array.isArray(data.items)) {
        console.log(`CHATTANOOGA API: Successfully fetched ${data.items.length} products for brand: ${brand}`);
        return data.items;
      } else {
        console.log(`CHATTANOOGA API: No products found for brand: ${brand}`);
        return [];
      }

    } catch (error) {
      console.error(`CHATTANOOGA API: Error fetching products for brand ${brand}:`, error);
      throw error;
    }
  }

  /**
   * Get list of available brands in catalog
   * Used to determine which brands to sync
   */
  async getBrands(): Promise<string[]> {
    try {
      console.log('CHATTANOOGA API: Fetching available brands');
      
      const authString = this.createBasicAuth();
      // Use items endpoint to get all products and extract unique manufacturers/brands
      const response = await fetch(`${this.baseUrl}/items?per_page=1000`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`CHATTANOOGA API: Brands fetch error ${response.status}: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: any = await response.json();
      
      if (data.items && Array.isArray(data.items)) {
        // Extract unique manufacturers/brands from product data
        const brandsSet = new Set(data.items
          .map((item: any) => item.manufacturer || item.brand)
          .filter((brand: string) => brand && brand.trim())
        );
        const brands = Array.from(brandsSet).sort() as string[];
        
        console.log(`CHATTANOOGA API: Successfully extracted ${brands.length} unique brands from catalog`);
        return brands;
      } else {
        console.log('CHATTANOOGA API: No items found in catalog');
        return [];
      }

    } catch (error) {
      console.error('CHATTANOOGA API: Error fetching brands:', error);
      throw error;
    }
  }

  /**
   * Download product feed CSV using official API endpoint
   * Official API Documentation: GET /items/product-feed
   */
  async downloadCatalogCSV(): Promise<{ success: boolean; csvPath?: string; message: string }> {
    try {
      console.log('CHATTANOOGA API: Starting product feed download using official API...');
      
      // Use official API endpoint for bulk product feed
      const authString = this.createBasicAuth();
      
      // Build query parameters for product feed request
      const params = new URLSearchParams({
        // Include retail map pricing for accurate MAP values
        'optional_columns': 'specifications,retail_map',
        // Return custom properties for additional data
        'return_custom_properties': '1'
      });
      
      const url = `${this.baseUrl}/items/product-feed?${params.toString()}`;
      console.log(`CHATTANOOGA API: Requesting product feed from: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authString,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'RetailPlatform/1.0'
        }
      });

      console.log(`CHATTANOOGA API: Product feed response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`CHATTANOOGA API: Product feed failed - ${response.status}: ${errorText}`);
        
        // Handle rate limiting specifically
        if (response.status === 429) {
          const errorData = JSON.parse(errorText);
          console.error(`CHATTANOOGA API: Rate limited! ${errorData.message}`);
          return {
            success: false,
            message: `Product feed request failed with status ${response.status}`,
            rateLimited: true,
            errorData
          };
        }
        
        return {
          success: false,
          message: `Product feed request failed with status ${response.status}: ${errorText}`
        };
      }

      const data: any = await response.json();
      console.log('CHATTANOOGA API: Response content type:', response.headers.get('content-type'));
      console.log('CHATTANOOGA API: Product feed response:', JSON.stringify(data, null, 2));
      
      if (!data.product_feed || !data.product_feed.url) {
        console.error('CHATTANOOGA API: No product feed URL in response');
        console.error('CHATTANOOGA API: Response structure:', JSON.stringify(data, null, 2));
        
        // Try alternative response structures
        if (data.url) {
          console.log('CHATTANOOGA API: Found alternative URL structure, using data.url');
          data.product_feed = { url: data.url };
        } else if (typeof data === 'string' && data.startsWith('http')) {
          console.log('CHATTANOOGA API: Response is direct URL string');
          data.product_feed = { url: data };
        } else {
          return {
            success: false,
            message: `Product feed response missing download URL. Response: ${JSON.stringify(data)}`
          };
        }
      }

      const csvUrl = data.product_feed.url;
      console.log(`CHATTANOOGA API: Got CSV download URL: ${csvUrl}`);

      // Download the CSV file from the provided URL
      const csvResponse = await fetch(csvUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'RetailPlatform/1.0'
        }
      });

      if (!csvResponse.ok) {
        console.error(`CHATTANOOGA API: CSV download failed - ${csvResponse.status}`);
        return {
          success: false,
          message: `CSV download failed with status ${csvResponse.status}`
        };
      }

      // Save CSV to temporary file
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      
      const tempDir = os.tmpdir();
      const csvPath = path.join(tempDir, `chattanooga-catalog-${Date.now()}.csv`);
      
      const csvData = await csvResponse.text();
      await fs.promises.writeFile(csvPath, csvData);
      
      console.log(`CHATTANOOGA API: Successfully downloaded catalog CSV to ${csvPath}`);
      console.log(`CHATTANOOGA API: CSV file size: ${csvData.length} characters`);
      
      return {
        success: true,
        csvPath: csvPath,
        message: 'Product feed CSV downloaded successfully via official API'
      };

    } catch (error: any) {
      console.error('CHATTANOOGA API: Product feed download failed:', error);
      return {
        success: false,
        message: `Product feed download error: ${error.message}`
      };
    }
  }

  /**
   * Login to Chattanooga dealer portal website
   */
  private async loginToDealerPortal(): Promise<{ success: boolean; sessionCookies?: string; message: string }> {
    try {
      console.log('CHATTANOOGA LOGIN: Authenticating with dealer portal website...');
      
      // Step 1: Get login page to capture any CSRF tokens or session cookies
      const loginPageUrl = 'https://chattanoogashooting.com/account';
      console.log(`CHATTANOOGA LOGIN: Fetching login page: ${loginPageUrl}`);
      
      const loginPageResponse = await fetch(loginPageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'RetailPlatform/1.0'
        }
      });

      const initialCookies = loginPageResponse.headers.get('set-cookie') || '';
      const loginPageHtml = await loginPageResponse.text();
      
      console.log(`CHATTANOOGA LOGIN: Login page status: ${loginPageResponse.status}`);
      console.log(`CHATTANOOGA LOGIN: Page content preview: ${loginPageHtml.substring(0, 500)}`);
      
      // Extract form action and method
      const formMatch = loginPageHtml.match(/<form[^>]*action="([^"]*)"[^>]*>/i);
      const formAction = formMatch ? formMatch[1] : '/account/login';
      
      // Look for all input fields in the form more precisely
      const inputRegex = /<input[^>]*name="([^"]*)"[^>]*>/gi;
      const inputMatches: string[] = [];
      let match;
      while ((match = inputRegex.exec(loginPageHtml)) !== null) {
        inputMatches.push(match[1]);
      }
      const allInputs = inputMatches;
      
      console.log(`CHATTANOOGA LOGIN: All form inputs found: ${allInputs.join(', ')}`);
      
      // Let's look at the actual form HTML to understand the structure better
      const formHtml = loginPageHtml.match(/<form[^>]*>[\s\S]*?<\/form>/i);
      if (formHtml) {
        console.log(`CHATTANOOGA LOGIN: Complete form HTML: ${formHtml[0].substring(0, 800)}`);
      }
      
      // Look for input field names
      const usernameFieldMatch = loginPageHtml.match(/<input[^>]*name="([^"]*)"[^>]*(?:username|email|user)/i);
      const passwordFieldMatch = loginPageHtml.match(/<input[^>]*name="([^"]*)"[^>]*(?:password|pass)/i);
      const accountFieldMatch = loginPageHtml.match(/<input[^>]*name="([^"]*)"[^>]*(?:account|acct)/i);
      
      const usernameField = usernameFieldMatch ? usernameFieldMatch[1] : 'cred[username]';
      const passwordField = passwordFieldMatch ? passwordFieldMatch[1] : 'cred[password]';
      const accountField = accountFieldMatch ? accountFieldMatch[1] : 'account_number';
      
      console.log(`CHATTANOOGA LOGIN: Form action: ${formAction}`);
      console.log(`CHATTANOOGA LOGIN: Username field: ${usernameField}`);
      console.log(`CHATTANOOGA LOGIN: Password field: ${passwordField}`);
      console.log(`CHATTANOOGA LOGIN: Account field: ${accountField}`);
      
      // Extract CSRF token if present
      const csrfMatch = loginPageHtml.match(/name="([^"]*token[^"]*)"[^>]*value="([^"]+)"/i);
      const csrfFieldName = csrfMatch ? csrfMatch[1] : '';
      const csrfToken = csrfMatch ? csrfMatch[2] : '';
      
      console.log(`CHATTANOOGA LOGIN: CSRF field: ${csrfFieldName}, token ${csrfToken ? 'found' : 'not found'}`);
      
      // Step 2: Submit login credentials
      const loginUrl = formAction.startsWith('http') ? formAction : `https://chattanoogashooting.com${formAction}`;
      console.log(`CHATTANOOGA LOGIN: Submitting credentials to: ${loginUrl}`);
      
      const loginData = new URLSearchParams();
      loginData.append(usernameField, this.credentials.username);
      loginData.append(passwordField, this.credentials.password);
      
      // Extract values for hidden fields from the form HTML
      const methodMatch = loginPageHtml.match(/<input[^>]*name="_method"[^>]*value="([^"]*)"/i);
      const destMatch = loginPageHtml.match(/<input[^>]*name="dest"[^>]*value="([^"]*)"/i);
      
      // Add all other form fields found with their correct values
      if (allInputs.includes('_method')) {
        const methodValue = methodMatch ? methodMatch[1] : 'post';
        loginData.append('_method', methodValue);
        console.log(`CHATTANOOGA LOGIN: Added _method: ${methodValue}`);
      }
      if (allInputs.includes('dest')) {
        const destValue = destMatch ? destMatch[1] : 'cs-web';
        loginData.append('dest', destValue);
        console.log(`CHATTANOOGA LOGIN: Added dest: ${destValue}`);
      }
      if (allInputs.includes('submitLoginForm')) {
        loginData.append('submitLoginForm', 'Login');
      }
      
      // Always try to add account number if we have the field name
      if (allInputs.includes('account_number') || allInputs.includes('cred[account_number]')) {
        const actualAccountField = allInputs.includes('cred[account_number]') ? 'cred[account_number]' : 'account_number';
        loginData.append(actualAccountField, this.credentials.accountNumber);
        console.log(`CHATTANOOGA LOGIN: Added account number field: ${actualAccountField}`);
      }
      
      // Add CSRF token if found
      if (csrfToken && csrfFieldName) {
        loginData.append(csrfFieldName, csrfToken);
      }
      
      console.log(`CHATTANOOGA LOGIN: Complete form data: ${loginData.toString()}`);
      console.log(`CHATTANOOGA LOGIN: Using username: ${this.credentials.username}`);
      console.log(`CHATTANOOGA LOGIN: Testing credentials validity...`);

      const loginResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'RetailPlatform/1.0',
          'Cookie': initialCookies,
          'Referer': loginPageUrl
        },
        body: loginData.toString(),
        redirect: 'manual' // Handle redirects manually to capture cookies
      });

      const loginCookies = loginResponse.headers.get('set-cookie') || '';
      const allCookies = [initialCookies, loginCookies].filter(Boolean).join('; ');
      
      console.log(`CHATTANOOGA LOGIN: Login response status: ${loginResponse.status}`);
      
      if (loginResponse.status === 302) {
        const location = loginResponse.headers.get('location') || '';
        console.log(`CHATTANOOGA LOGIN: Redirect to: ${location}`);
        
        // Follow the redirect to see what happens
        if (location && !location.includes('/login')) {
          const redirectUrl = location.startsWith('http') ? location : `https://chattanoogashooting.com${location}`;
          console.log(`CHATTANOOGA LOGIN: Following redirect to: ${redirectUrl}`);
          
          const redirectResponse = await fetch(redirectUrl, {
            method: 'GET',
            headers: {
              'Cookie': allCookies,
              'User-Agent': 'RetailPlatform/1.0'
            }
          });
          
          const redirectCookies = redirectResponse.headers.get('set-cookie') || '';
          const finalCookies = [allCookies, redirectCookies].filter(Boolean).join('; ');
          
          const redirectContent = await redirectResponse.text();
          console.log(`CHATTANOOGA LOGIN: Redirect page content preview: ${redirectContent.substring(0, 300)}`);
          
          if (redirectContent.includes('inventory-file-download') || 
              redirectContent.includes('account') || 
              redirectContent.includes('logout')) {
            console.log('CHATTANOOGA LOGIN: Portal authentication successful - found account features');
            return {
              success: true,
              sessionCookies: finalCookies,
              message: 'Portal login successful'
            };
          }
        }
        
        if (location.includes('/login')) {
          console.log('CHATTANOOGA LOGIN: Redirected back to login - checking for error message');
          
          // Follow the redirect to see if there's an error message
          const errorPageUrl = location.startsWith('http') ? location : `https://chattanoogashooting.com${location}`;
          const errorResponse = await fetch(errorPageUrl, {
            method: 'GET',
            headers: {
              'Cookie': allCookies,
              'User-Agent': 'RetailPlatform/1.0'
            }
          });
          
          const errorContent = await errorResponse.text();
          
          // Look for error messages in the response
          const errorMatch = errorContent.match(/<div[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)</i) ||
                           errorContent.match(/<span[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)</i) ||
                           errorContent.match(/Invalid.*?(?:username|password|credentials)/i) ||
                           errorContent.match(/Login.*?failed/i);
          
          const errorMessage = errorMatch ? errorMatch[1] || errorMatch[0] : 'Authentication failed';
          
          console.log(`CHATTANOOGA LOGIN: Error page content preview: ${errorContent.substring(0, 400)}`);
          
          return {
            success: false,
            message: `Authentication failed: ${errorMessage.trim()}`
          };
        }
      }
      
      if (loginResponse.status === 200) {
        const responseText = await loginResponse.text();
        if (responseText.includes('inventory-file-download') || responseText.includes('account/inventory')) {
          console.log('CHATTANOOGA LOGIN: Portal authentication successful - account page loaded');
          return {
            success: true,
            sessionCookies: allCookies,
            message: 'Portal login successful'
          };
        }
      }
      
      const responseText = await loginResponse.text();
      console.log(`CHATTANOOGA LOGIN: Authentication failed - Status: ${loginResponse.status}`);
      console.log(`CHATTANOOGA LOGIN: Response preview: ${responseText.substring(0, 300)}`);
      
      return {
        success: false,
        message: `Portal login failed - check credentials`
      };

    } catch (error: any) {
      console.error('CHATTANOOGA LOGIN: Error during portal login:', error);
      return {
        success: false,
        message: `Portal login error: ${error.message}`
      };
    }
  }

  /**
   * Download CSV file from dealer portal after authentication
   */
  private async downloadCSVFromPortal(sessionCookies: string): Promise<{ success: boolean; csvPath?: string; message: string }> {
    try {
      console.log('CHATTANOOGA DOWNLOAD: Fetching catalog CSV from dealer portal...');
      
      // Use the specific inventory file download URL provided
      const csvUrl = 'https://chattanoogashooting.com/account/inventory-file-download';
      console.log(`CHATTANOOGA DOWNLOAD: Downloading from: ${csvUrl}`);
      
      const response = await fetch(csvUrl, {
        method: 'GET',
        headers: {
          'Cookie': sessionCookies,
          'User-Agent': 'RetailPlatform/1.0',
          'Referer': 'https://chattanoogashooting.com/account'
        }
      });

      console.log(`CHATTANOOGA DOWNLOAD: Response status: ${response.status}`);
      console.log(`CHATTANOOGA DOWNLOAD: Content-Type: ${response.headers.get('content-type')}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`CHATTANOOGA DOWNLOAD: Error response: ${errorText.substring(0, 300)}`);
        return {
          success: false,
          message: `Download failed with status ${response.status}`
        };
      }

      const contentType = response.headers.get('content-type') || '';
      const contentDisposition = response.headers.get('content-disposition') || '';
      
      console.log(`CHATTANOOGA DOWNLOAD: Content-Disposition: ${contentDisposition}`);
      
      // Check if this is a CSV download
      if (contentType.includes('csv') || 
          contentType.includes('text/plain') || 
          contentType.includes('application/octet-stream') ||
          contentDisposition.includes('.csv')) {
        
        const content = await response.text();
        
        // Verify CSV content structure
        const lines = content.split('\n');
        const firstLine = lines[0] || '';
        
        console.log(`CHATTANOOGA DOWNLOAD: First line preview: ${firstLine.substring(0, 100)}`);
        console.log(`CHATTANOOGA DOWNLOAD: Total lines: ${lines.length}`);
        
        if (firstLine.toLowerCase().includes('item') || 
            firstLine.toLowerCase().includes('upc') ||
            firstLine.toLowerCase().includes('manufacturer') ||
            lines.length > 10) {
          
          // Save CSV to temporary file
          const fs = await import('fs');
          const path = await import('path');
          const timestamp = Date.now();
          const csvPath = path.join(process.cwd(), 'temp', `chattanooga-catalog-${timestamp}.csv`);
          
          // Ensure temp directory exists
          const tempDir = path.dirname(csvPath);
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          fs.writeFileSync(csvPath, content);
          
          console.log(`CHATTANOOGA DOWNLOAD: CSV saved to ${csvPath} (${content.length} characters, ${lines.length} lines)`);
          return {
            success: true,
            csvPath: csvPath,
            message: `CSV downloaded successfully from inventory-file-download`
          };
        } else {
          console.log(`CHATTANOOGA DOWNLOAD: Content doesn't appear to be valid CSV`);
          return {
            success: false,
            message: 'Downloaded content is not a valid CSV file'
          };
        }
      } else {
        const content = await response.text();
        console.log(`CHATTANOOGA DOWNLOAD: Non-CSV response: ${content.substring(0, 300)}`);
        
        // Check if we're redirected back to login
        if (content.includes('login') || content.includes('username') || content.includes('password')) {
          return {
            success: false,
            message: 'Session expired - authentication required'
          };
        }
        
        return {
          success: false,
          message: 'Download endpoint returned HTML instead of CSV - check session or permissions'
        };
      }

    } catch (error: any) {
      console.error('CHATTANOOGA DOWNLOAD: Error downloading from portal:', error);
      return {
        success: false,
        message: `Portal download error: ${error.message}`
      };
    }
  }

}

// Export factory function for creating API instance
export function createChattanoogaAPI(credentials: ChattanoogaCredentials): ChattanoogaAPI {
  return new ChattanoogaAPI(credentials);
}