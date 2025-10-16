import fetch from 'node-fetch';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

export interface LipseyCredentials {
  email: string;
  password: string;
}

export interface LipseyProduct {
  itemNo: string;
  description1: string;
  description2: string;
  upc: string;
  manufacturerModelNo: string;
  msrp: number;
  model: string;
  caliberGauge: string;
  manufacturer: string;
  type: string;
  action: string;
  barrelLength: string;
  capacity: string;
  finish: string;
  overallLength: string;
  receiver: string;
  safety: string;
  sights: string;
  stockFrameGrips: string;
  magazine: string;
  weight: string;
  imageName: string;
  chamber: string;
  drilledAndTapped: boolean;
  rateOfTwist: string;
  itemType: string;
  additionalFeature1: string;
  additionalFeature2: string;
  additionalFeature3: string;
  shippingWeight: number;
  boundBookManufacturer: string;
  boundBookModel: string;
  boundBookType: string;
  nfaThreadPattern: string;
  nfaAttachmentMethod: string;
  nfaBaffleType: string;
  silencerCanBeDisassembled: boolean;
  silencerConstructionMaterial: string;
  nfaDbReduction: string;
  silencerOutsideDiameter: string;
  nfaForm3Caliber: string;
  opticMagnification: string;
  maintubeSize: string;
  adjustableObjective: boolean;
  objectiveSize: string;
  opticAdjustments: string;
  illuminatedReticle: boolean;
  reticle: string;
  exclusive: boolean;
  quantity: number;
  allocated: boolean;
  onSale: boolean;
  price: number;
  currentPrice: number;
  retailMap: number;
  fflRequired: boolean;
  sotRequired: boolean;
  scopeCoverIncluded: boolean;
  special: string;
  sightsType: string;
  case: string;
  choke: string;
  dbReduction: string;
  family: string;
  finishType: string;
  frame: string;
  gripType: string;
  handgunSlideMaterial: string;
  canDropship: boolean;
}

export interface LipseyPricingItem {
  itemNumber: string;
  upc: string;
  mfgModelNumber: string;
  quantity: number;
  allocated: boolean;
  onSale: boolean;
  price: number;
  currentPrice: number;
  retailMap: number;
  canDropship: boolean;
}

export interface LipseyValidationItem {
  qty: number;
  price: number;
  blocked: boolean;
  allocated: boolean;
  itemNumber: string;
  canDropship: boolean;
}

export interface LipseyApiResponse<T> {
  success: boolean;
  authorized: boolean;
  errors: string[];
  data: T;
}

export interface LipseyLoginResponse {
  token: string;
  econtact: {
    name: string;
    email: string;
    cusNo: string;
    shipTo: string;
    locationName: string;
    slm: string;
  };
}

export class LipseyAPI {
  private baseUrl = 'https://api.lipseys.com';
  private credentials: LipseyCredentials;
  private token: string | null = null;
  private proxyAgent: HttpsProxyAgent<string> | null = null;

  constructor(credentials: LipseyCredentials) {
    this.credentials = credentials;
    this.initializeProxy();
  }

  private initializeProxy() {
    // Check for proxy configuration in environment variables
    const proxyHost = process.env.PROXY_HOST;
    const proxyPort = process.env.PROXY_PORT || '3128';
    const proxyUsername = process.env.PROXY_USERNAME;
    const proxyPassword = process.env.PROXY_PASSWORD;

    if (proxyHost) {
      // Build proxy URL with authentication if credentials are provided
      const proxyAuth = proxyUsername && proxyPassword 
        ? `${proxyUsername}:${proxyPassword}@` 
        : '';
      const proxyUrl = `http://${proxyAuth}${proxyHost}:${proxyPort}`;
      
      this.proxyAgent = new HttpsProxyAgent(proxyUrl);
      console.log(`✅ LIPSEY PROXY: Configured to use proxy at ${proxyHost}:${proxyPort}`);
    } else {
      console.log('ℹ️  LIPSEY PROXY: No proxy configured, using direct connection');
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
    requireAuth: boolean = true
  ): Promise<LipseyApiResponse<T>> {
    try {
      // Authenticate if required and no token exists
      if (requireAuth && !this.token) {
        await this.authenticate();
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'RetailPlatform/1.0'
      };

      if (requireAuth && this.token) {
        headers['Token'] = this.token;
      }

      const requestOptions: any = {
        method,
        headers,
        timeout: 30000
      };

      // Add proxy agent if configured
      if (this.proxyAgent) {
        requestOptions.agent = this.proxyAgent;
      }

      if (body && method === 'POST') {
        requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      console.log(`LIPSEY API: Making request to: ${this.baseUrl}${endpoint}`);
      if (this.proxyAgent) {
        console.log(`LIPSEY API: Using proxy for request`);
      }
      console.log(`LIPSEY API: Request body:`, requestOptions.body);
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, requestOptions);
      
      console.log(`LIPSEY API: Response status: ${response.status}`);
      
      if (!response.ok) {
        // Try to get more detailed error information
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.text();
          if (errorBody) {
            errorMessage += ` - ${errorBody}`;
          }
        } catch (e) {
          // Ignore parsing errors
        }
        throw new Error(errorMessage);
      }

      const data = await response.json() as any;
      
      // Handle the direct token response format from Lipsey's API
      if (endpoint.includes('/Authentication/Login') && data.token) {
        return {
          success: true,
          authorized: true,
          errors: [],
          data: data
        } as LipseyApiResponse<T>;
      }
      
      return data as LipseyApiResponse<T>;

    } catch (error: any) {
      console.error(`Lipsey API Error [${endpoint}]:`, error.message);
      return {
        success: false,
        authorized: false,
        errors: [error.message],
        data: null as T
      };
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await this.makeRequest<LipseyLoginResponse>(
        '/api/Integration/Authentication/Login',
        'POST',
        {
          Email: this.credentials.email,
          Password: this.credentials.password
        },
        false // Don't require auth for login
      );

      if (response.success && response.data?.token) {
        this.token = response.data.token;
        return true;
      }

      // Handle the direct token response format from Lipsey's API docs
      if (response.data && (response.data as any).token) {
        this.token = (response.data as any).token;
        return true;
      }

      console.error('Lipsey authentication failed:', response.errors || 'Unknown error');
      return false;
    } catch (error: any) {
      console.error('Lipsey authentication error:', error.message);
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; dealerInfo?: any }> {
    try {
      console.log(`LIPSEY API: Testing connection for ${this.credentials.email}`);
      console.log(`LIPSEY API: Using endpoint: ${this.baseUrl}/api/Integration/Authentication/Login`);
      
      const response = await this.makeRequest<LipseyLoginResponse>(
        '/api/Integration/Authentication/Login',
        'POST',
        {
          Email: this.credentials.email,
          Password: this.credentials.password
        },
        false
      );

      console.log('LIPSEY API: Response received:', {
        success: response.success,
        authorized: response.authorized,
        hasErrors: response.errors?.length > 0,
        errors: response.errors
      });

      if (response.success && response.data?.token) {
        return {
          success: true,
          message: `Connected successfully as ${response.data.econtact?.name || 'dealer'}`,
          dealerInfo: response.data.econtact
        };
      }

      return {
        success: false,
        message: response.errors?.join(', ') || 'Authentication failed'
      };
    } catch (error: any) {
      console.error('LIPSEY API: Test connection error:', error.message);
      return {
        success: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }

  // Cache for catalog to avoid repeated downloads
  private static catalogCache: { data: LipseyProduct[]; timestamp: number } | null = null;
  private static readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  async getCatalogFeed(): Promise<LipseyProduct[]> {
    // Check if we have valid cached data
    if (LipseyAPI.catalogCache && 
        Date.now() - LipseyAPI.catalogCache.timestamp < LipseyAPI.CACHE_DURATION) {
      console.log('LIPSEY API: Using cached catalog with', LipseyAPI.catalogCache.data.length, 'items');
      return LipseyAPI.catalogCache.data;
    }

    console.log('LIPSEY API: Fetching fresh catalog...');
    const response = await this.makeRequest<LipseyProduct[]>('/api/Integration/Items/CatalogFeed');
    
    if (response.success && response.data) {
      // Cache the result
      LipseyAPI.catalogCache = {
        data: response.data,
        timestamp: Date.now()
      };
      console.log('LIPSEY API: Cached catalog with', response.data.length, 'items');
      

      
      return response.data;
    }

    console.error('Failed to fetch Lipsey catalog:', response.errors);
    return [];
  }

  async getCatalogItem(itemNumber: string): Promise<LipseyProduct | null> {
    // For UPC lookups, try as string first (preserve leading zeros), then as integer if that fails
    let body: string | number = itemNumber;
    
    console.log(`LIPSEY API: getCatalogItem called with: "${itemNumber}"`);
    console.log(`LIPSEY API: Using body for API call (preserving leading zeros):`, body);
    
    const response = await this.makeRequest<LipseyProduct>(
      '/api/Integration/Items/CatalogFeed/Item',
      'POST',
      body
    );

    console.log(`LIPSEY API: API response (string format):`, response);

    if (response.success && response.data) {
      console.log(`LIPSEY API: Found product with string format:`, response.data.itemNo, '-', response.data.description1);
      return response.data;
    }

    // If string format failed and this looks like a UPC, try integer format as fallback
    if (/^\d+$/.test(itemNumber) && typeof body === 'string') {
      const integerBody = parseInt(itemNumber, 10);
      console.log(`LIPSEY API: String format failed, trying integer format:`, integerBody);
      
      const fallbackResponse = await this.makeRequest<LipseyProduct>(
        '/api/Integration/Items/CatalogFeed/Item',
        'POST',
        integerBody
      );

      console.log(`LIPSEY API: API response (integer format):`, fallbackResponse);

      if (fallbackResponse.success && fallbackResponse.data) {
        console.log(`LIPSEY API: Found product with integer format:`, fallbackResponse.data.itemNo, '-', fallbackResponse.data.description1);
        return fallbackResponse.data;
      }
    }

    console.log(`LIPSEY API: No product found with either format`);
    return null;
  }

  async getPricingAndQuantity(): Promise<{ nextUpdate: string; items: LipseyPricingItem[] }> {
    const response = await this.makeRequest<{ nextUpdate: string; items: LipseyPricingItem[] }>(
      '/api/Integration/Items/PricingQuantityFeed'
    );

    if (response.success && response.data) {
      return response.data;
    }

    return { nextUpdate: '', items: [] };
  }



  async validateItem(itemNumber: string): Promise<LipseyValidationItem | null> {
    const response = await this.makeRequest<LipseyValidationItem[]>(
      '/api/Integration/Items/ValidateItem',
      'POST', 
      itemNumber
    );

    if (response.success && response.data && response.data.length > 0) {
      return response.data[0];
    }

    return null;
  }

  async searchProduct(params: { upc?: string; itemNumber?: string }): Promise<{
    success: boolean;
    message: string;
    product?: {
      name: string;
      sku: string;
      price: number;
      stock: number;
      upc?: string;
      partNumber?: string;
      brand?: string;
      model?: string;
      caliber?: string;
      weight?: number;
      msrp?: number;
      map?: number;
      retailMap?: number;
      imageUrl?: string;
      fflRequired?: boolean;
      canDropship?: boolean;
    };
  }> {
    try {
      if (!params.upc && !params.itemNumber) {
        return {
          success: false,
          message: 'UPC or item number required'
        };
      }

      let product: LipseyProduct | null = null;

      // If we have an item number, try to get the specific item
      if (params.itemNumber && /^\d+$/.test(params.itemNumber)) {
        product = await this.getCatalogItem(params.itemNumber);
      }
      
      // If we have a UPC, search the cached catalog to find the item number
      // This is more reliable than direct UPC lookup, which has inconsistent behavior
      if (!product && params.upc) {
        console.log('LIPSEY API: Searching catalog for UPC:', params.upc);
        
        // Get the full catalog (cached for 30 minutes)
        const catalog = await this.getCatalogFeed();
        
        // Search for product by UPC
        const catalogProduct = catalog.find(p => p.upc === params.upc);
        
        if (!catalogProduct) {
          console.log('LIPSEY API: UPC not found in catalog');
          return {
            success: false,
            message: 'Product not found in Lipsey catalog'
          };
        }
        
        console.log('LIPSEY API: Found in catalog - Item:', catalogProduct.itemNo, 'UPC:', catalogProduct.upc);
        
        // Use the catalog product directly (it has all the data we need)
        product = catalogProduct;
      }
      
      if (!product) {
        return {
          success: false,
          message: 'Product not found in Lipsey catalog'
        };
      }

      // Get current pricing and quantity using the item number
      const validation = await this.validateItem(product.itemNo);
      const currentPrice = validation?.price || product.price;
      const currentStock = validation?.qty || product.quantity;

      // Generate name using manufacturer + description1 format for consistency
      let productName = product.description1 || '';
      if (product.manufacturer && product.description1) {
        productName = `${product.manufacturer} ${product.description1}`;
      } else if (product.description1) {
        productName = product.description1;
      } else if (product.description2) {
        productName = product.description2;
      }

      return {
        success: true,
        message: 'Product found in Lipsey catalog',
        product: {
          name: productName,
          sku: product.itemNo,
          price: currentPrice,
          stock: currentStock,
          upc: product.upc,
          partNumber: product.manufacturerModelNo,
          brand: product.manufacturer,
          model: product.model,
          caliber: product.caliberGauge,
          weight: product.weight ? parseFloat(product.weight) : undefined,
          msrp: product.msrp,
          map: product.retailMap,
          retailMap: product.retailMap,
          imageUrl: product.imageName ? `https://www.lipseyscloud.com/images/${product.imageName}` : undefined,
          fflRequired: product.fflRequired,
          canDropship: product.canDropship
        }
      };

    } catch (error: any) {
      console.error('Lipsey search error:', error);
      return {
        success: false,
        message: `Search failed: ${error.message}`
      };
    }
  }

  // Transform Lipsey product to our standard product format
  static transformProduct(lipseyProduct: LipseyProduct): any {
    // Generate name using manufacturer + description1 format for consistency
    let name = lipseyProduct.description1 || '';
    if (lipseyProduct.manufacturer && lipseyProduct.description1) {
      name = `${lipseyProduct.manufacturer} ${lipseyProduct.description1}`;
    } else if (lipseyProduct.description1) {
      name = lipseyProduct.description1;
    } else if (lipseyProduct.description2) {
      name = lipseyProduct.description2;
    }
    
    return {
      upc: lipseyProduct.upc,
      name: name,
      brand: lipseyProduct.manufacturer,
      model: lipseyProduct.model,
      partNumber: lipseyProduct.manufacturerModelNo,
      caliber: lipseyProduct.caliberGauge || null,
      category: lipseyProduct.type || 'Firearms',
      weight: lipseyProduct.weight ? parseFloat(lipseyProduct.weight) : null,
      msrp: lipseyProduct.msrp || null,
      map: lipseyProduct.retailMap || null,
      imageUrl: lipseyProduct.imageName ? `https://www.lipseyscloud.com/images/${lipseyProduct.imageName}` : null,
      imageSource: 'lipseys', // Use vendor slug for internal consistency
      specifications: {
        action: lipseyProduct.action,
        barrelLength: lipseyProduct.barrelLength,
        capacity: lipseyProduct.capacity,
        finish: lipseyProduct.finish,
        overallLength: lipseyProduct.overallLength,
        receiver: lipseyProduct.receiver,
        safety: lipseyProduct.safety,
        sights: lipseyProduct.sights,
        stock: lipseyProduct.stockFrameGrips,
        magazine: lipseyProduct.magazine,
        chamber: lipseyProduct.chamber,
        twist: lipseyProduct.rateOfTwist,
        features: [
          lipseyProduct.additionalFeature1,
          lipseyProduct.additionalFeature2,
          lipseyProduct.additionalFeature3
        ].filter(Boolean)
      },
      customProperties: {
        itemType: lipseyProduct.itemType,
        exclusive: lipseyProduct.exclusive,
        special: lipseyProduct.special,
        family: lipseyProduct.family,
        drilledAndTapped: lipseyProduct.drilledAndTapped,
        shippingWeight: lipseyProduct.shippingWeight
      },
      fflRequired: lipseyProduct.fflRequired,
      serialized: lipseyProduct.fflRequired,
      dropShipAvailable: lipseyProduct.canDropship
    };
  }

  // Static method for order submission with store-specific shipping
  static async submitOrder(order: any, items: any[], credentials: LipseyCredentials, store?: any): Promise<{ success: boolean; message: string; response?: any; error?: any }> {
    try {
      const lipseyAPI = new LipseyAPI(credentials);
      
      // Authenticate first
      const authResult = await lipseyAPI.testConnection();
      if (!authResult.success) {
        return {
          success: false,
          message: `Lipsey's authentication failed: ${authResult.message}`,
          error: authResult.message
        };
      }

      // Format items for Lipsey's API
      const formattedItems = items.map(item => ({
        itemNumber: item.sku,
        quantity: item.quantity,
        price: parseFloat(item.unitCost)
      }));

      // Use store address if provided, otherwise fall back to order address
      const shippingAddress = store ? {
        name: store.name,
        address: store.address,
        phone: store.phone,
        fflNumber: store.fflNumber
      } : {
        name: 'Store Location',
        address: 'Store Address Required',
        phone: 'Phone Required'
      };

      const orderPayload = {
        customerPO: order.orderNumber,
        items: formattedItems,
        shippingAddress: shippingAddress,
        notes: order.notes || ''
      };

      console.log('Submitting Lipsey order:', JSON.stringify(orderPayload, null, 2));

      // Submit order to Lipsey's API (this would be the actual API call)
      const response = await lipseyAPI.makeRequest('/orders', 'POST', orderPayload);

      if (response.success) {
        return {
          success: true,
          message: 'Order successfully submitted to Lipsey\'s',
          response: response
        };
      } else {
        return {
          success: false,
          message: `Lipsey's order submission failed: ${response.errors?.join(', ') || 'Unknown error'}`,
          error: response.errors,
          response: response
        };
      }

    } catch (error: any) {
      console.error('Lipsey order submission error:', error);
      return {
        success: false,
        message: `Failed to submit order to Lipsey's: ${error.message}`,
        error: error.message
      };
    }
  }
}

// Export sync function for Master Catalog imports
export async function syncLipseyMasterCatalog(credentials: LipseyCredentials): Promise<{ success: boolean; message: string; stats?: any }> {
  try {
    console.log('Starting Lipsey Master Catalog sync...');
    
    const lipseyAPI = new LipseyAPI(credentials);
    
    // Test connection first
    const testResult = await lipseyAPI.testConnection();
    if (!testResult.success) {
      return {
        success: false,
        message: `Lipsey connection failed: ${testResult.message}`
      };
    }
    
    console.log('Lipsey connection successful, fetching catalog...');
    
    // Get catalog data (this would need to be implemented based on Lipsey's actual catalog endpoint)
    const catalogResult = await (lipseyAPI as any).getCatalog();
    
    if (!catalogResult.success || !catalogResult.data) {
      return {
        success: false,
        message: 'Failed to fetch Lipsey catalog data'
      };
    }
    
    const products = catalogResult.data;
    console.log(`Processing ${products.length} Lipsey products...`);
    
    // Import via standard import service with proper image URL conversion
    const { importService } = await import('./import-service');
    const { DEFAULT_RETAIL_VERTICAL } = await import('@shared/retail-vertical-config');
    
    // Convert Lipsey products to our standard format with image URLs
    const transformedProducts = products.map((product: LipseyProduct) => {
      const transformed = LipseyAPI.transformProduct(product);
      return {
        ...transformed,
        source: 'Lipsey\'s',
        retailVerticalId: DEFAULT_RETAIL_VERTICAL.id, // Use centralized retail vertical config
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });
    
    // Process import
    const importStats = await (importService as any).processBulkImport(transformedProducts, {
      source: 'Lipsey\'s',
      duplicateHandling: 'overwrite',
      retailVerticalId: DEFAULT_RETAIL_VERTICAL.id
    });
    
    console.log('Lipsey Master Catalog sync completed:', importStats);
    
    return {
      success: true,
      message: `Imported ${importStats.successfulRows} Lipsey products`,
      stats: importStats
    };
    
  } catch (error: any) {
    console.error('Lipsey Master Catalog sync error:', error);
    return {
      success: false,
      message: `Sync failed: ${error.message}`
    };
  }
}