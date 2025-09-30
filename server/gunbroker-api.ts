import { createHash } from 'crypto';

export interface GunBrokerCredentials {
  devKey: string;
  username: string;
  password: string;
  environment: 'sandbox' | 'production';
}

export interface GunBrokerSearchParams {
  upc?: string;
  sku?: string;
  partNumber?: string;
  brand?: string;
  model?: string;
  keywords?: string;
}

export interface GunBrokerSearchResult {
  success: boolean;
  product?: any;
  products?: any[];
  message: string;
  error?: string;
}

export class GunBrokerAPI {
  private baseUrl: string;
  private credentials: GunBrokerCredentials;
  private authToken: string | null = null;

  constructor(credentials: GunBrokerCredentials) {
    this.credentials = credentials;
    this.baseUrl = credentials.environment === 'production' 
      ? 'https://api.gunbroker.com/v1'
      : 'https://api.sandbox.gunbroker.com/v1';
  }

  /**
   * Test API connection and permissions
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('GUNBROKER API: Testing connection with DevKey:', this.credentials.devKey.substring(0, 8) + '...');
      
      // Test basic API access with DevKey - try Categories endpoint first
      const response = await fetch(`${this.baseUrl}/Categories`, {
        method: 'GET',
        headers: {
          'X-DevKey': this.credentials.devKey,
          'User-Agent': 'RetailPlatform/1.0',
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('GUNBROKER API: Connection successful, categories available:', data.length || 'Ready');
        
        return {
          success: true,
          message: `Connected to GunBroker ${this.credentials.environment} API successfully. Access to ${data.length || 'multiple'} categories confirmed.`
        };
      } else if (response.status === 401) {
        return {
          success: false,
          message: 'GunBroker API authentication failed - check DevKey credentials'
        };
      } else if (response.status === 403) {
        return {
          success: false,
          message: `GunBroker ${this.credentials.environment} API access forbidden - DevKey may need activation by GunBroker`
        };
      } else {
        const errorText = await response.text();
        return {
          success: false,
          message: `GunBroker API connection failed: HTTP ${response.status} - ${errorText.substring(0, 100)}`
        };
      }
    } catch (error: any) {
      console.error('GUNBROKER API: Connection test failed:', error.message);
      return {
        success: false,
        message: `GunBroker API connection error: ${error.message}`
      };
    }
  }

  /**
   * Authenticate and get access token
   */
  private async getAccessToken(): Promise<string | null> {
    // Optional: Only fetch access token if username/password are provided
    if (!this.credentials.username || !this.credentials.password) {
      return null; // DevKey-only mode
    }

    try {
      const response = await fetch(`${this.baseUrl}/Users/AccessToken`, {
        method: 'POST',
        headers: {
          'X-DevKey': this.credentials.devKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username: this.credentials.username,
          password: this.credentials.password
        })
      });

      if (response.ok) {
        const data = await response.json();
        this.authToken = data.accessToken;
        console.log('GUNBROKER API: Successfully authenticated');
        return this.authToken;
      } else {
        const error = await response.text();
        console.error('GUNBROKER API: Authentication failed:', error);
        return null;
      }
    } catch (error: any) {
      console.error('GUNBROKER API: Authentication error:', error.message);
      return null;
    }
  }

  /**
   * Search for items using GunBroker's Items/Search endpoint
   */
  async searchProduct(searchParams: GunBrokerSearchParams, buyNowOnly: boolean = true): Promise<GunBrokerSearchResult> {
    try {
      console.log(`GUNBROKER API: Searching for product:`, searchParams);

      // Get access token if we don't have one and account credentials were provided
      if (!this.authToken) {
        const token = await this.getAccessToken();
        // In DevKey-only mode token will be null; proceed with DevKey-only headers
        this.authToken = token;
      }

      // Build search query using GunBroker's official API parameters
      const queryParams = new URLSearchParams();
      
      // Prioritize UPC-only search for better results (avoid parameter conflicts)
      if (searchParams.upc) {
        queryParams.append('UPC', searchParams.upc);
        console.log(`GUNBROKER API: Using UPC-only search for: ${searchParams.upc}`);
      } else if (searchParams.sku) {
        // SKU search (API docs line 643-649)
        queryParams.append('SKU', searchParams.sku);
        console.log(`GUNBROKER API: Using SKU search for: ${searchParams.sku}`);
      } else {
        // Keywords search for brand/model/part numbers only when no UPC/SKU
        if (searchParams.keywords) {
          queryParams.append('Keywords', searchParams.keywords);
        } else {
          const keywords = [searchParams.brand, searchParams.model, searchParams.partNumber]
            .filter(Boolean).join(' ');
          if (keywords) {
            queryParams.append('Keywords', keywords);
          }
        }
        console.log(`GUNBROKER API: Using Keywords search`);
      }
      
      // Standard parameters for all searches
      if (queryParams.toString()) {
        queryParams.append('PageSize', '50'); // Increased from 25 to 50 for more results
        queryParams.append('PageIndex', '1');
        queryParams.append('Sort', '13'); // Featured and Relevance sorting
        
        // Apply Buy Now Only filter based on vendor settings
        if (buyNowOnly) {
          queryParams.append('BuyNowOnly', 'true'); // Only show Buy Now items, no auctions
          console.log('GUNBROKER API: Buy Now Only filter applied - excluding auctions');
        } else {
          console.log('GUNBROKER API: Showing all items - Buy Now and auctions');
        }
      }

      const url = `${this.baseUrl}/Items?${queryParams.toString()}`;
      console.log(`GUNBROKER API: Searching: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-DevKey': this.credentials.devKey,
          ...(this.authToken ? { 'X-AccessToken': this.authToken } : {}),
          'User-Agent': 'RetailPlatform/1.0',
          'Accept': 'application/json'
        }
      });

      console.log(`GUNBROKER API: Response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`GUNBROKER API: Search results:`, JSON.stringify(data, null, 2));
        
        const items = data.results || [];
        
        if (Array.isArray(items) && items.length > 0) {
          // Find best match by UPC/GTIN (API docs line 827-833) or take first result
          const product = items.find((item: any) => 
            searchParams.upc && (item.GTIN === searchParams.upc || item.gtin === searchParams.upc)
          ) || items[0];

          // Transform GunBroker response using actual API field names from response
          const transformedProduct = {
            id: product.itemID,
            name: product.title,
            description: product.subTitle,
            upc: product.gtin, // GTIN field contains UPC
            price: product.buyPrice || product.price, // Use actual response field names
            endingDate: product.endingDate,
            seller: product.seller?.username || null,
            condition: product.condition,
            quantity: product.quantity || 1, // Use actual response field name
            categoryId: product.categoryID,
            imageUrl: product.thumbnailURL || null, // Extract image URL from GunBroker
            pictureCount: product.pictureCount || 0,
            hasReserve: product.hasReserve,
            hasBuyNow: product.hasBuyNow,
            isFixedPrice: product.isFixedPrice,
            bidCount: product.bids
          };

          return {
            success: true,
            product: transformedProduct,
            products: items.map(item => ({
              id: item.itemID,
              name: item.title,
              price: item.buyPrice || item.price,
              endingDate: item.endingDate,
              seller: item.seller?.username,
              isFixedPrice: item.isFixedPrice,
              bidCount: item.bids
            })),
            message: `Found ${items.length} items on GunBroker marketplace - Best match: ${transformedProduct.name} - Seller: ${transformedProduct.seller}`
          };
        } else {
          return {
            success: false,
            message: 'No items found on GunBroker marketplace for search criteria'
          };
        }
      } else {
        const errorText = await response.text();
        let errorData: any = {};
        
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          console.log(`GUNBROKER API: Non-JSON error response:`, errorText.substring(0, 200));
        }

        if (response.status === 401) {
          return {
            success: false,
            message: this.authToken
              ? 'GunBroker authentication failed - access token invalid or expired'
              : 'GunBroker authentication failed - DevKey may be invalid or requires account credentials'
          };
        } else if (response.status === 403) {
          return {
            success: false,
            message: 'GunBroker access forbidden - DevKey may need activation'
          };
        } else if (response.status === 400) {
          return {
            success: false,
            message: `GunBroker search parameters invalid: ${errorData.message || 'Bad request'}`
          };
        } else if (response.status === 404) {
          return {
            success: false,
            message: `GunBroker ${this.credentials.environment} Search API not accessible - contact GunBroker support to activate search endpoints for your account`
          };
        } else {
          return {
            success: false,
            message: `GunBroker API error: ${errorData.message || errorText.substring(0, 100)}`
          };
        }
      }
    } catch (error: any) {
      console.error('GUNBROKER API: Search failed:', error.message);
      
      // Handle common network/API issues
      if (error.message?.includes('ENOTFOUND') || error.message?.includes('ECONNREFUSED')) {
        return {
          success: false,
          message: `GunBroker ${this.credentials.environment} API is currently unavailable - service may be down`
        };
      } else if (error.message?.includes('timeout')) {
        return {
          success: false,
          message: `GunBroker API request timeout - service may be experiencing issues`
        };
      } else {
        return {
          success: false,
          message: `GunBroker search error: ${error.message}`
        };
      }
    }
  }

  /**
   * Get item details by ID
   */
  async getItemDetails(itemId: string): Promise<GunBrokerSearchResult> {
    try {
      const url = `${this.baseUrl}/Items/${itemId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-DevKey': this.credentials.devKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const item = await response.json();
        
        const transformedProduct = {
          id: item.ItemID,
          name: item.Title,
          description: item.Description,
          upc: item.GTIN,
          price: item.BuyNowPrice || item.BuyPrice || item.BidPrice,
          endingDate: item.EndingDate,
          seller: item.SellerName,
          condition: item.Condition,
          quantity: item.Quantity || 1,
          hasReserve: item.HasReserve,
          hasBuyNow: item.HasBuyNow,
          isFixedPrice: item.IsFixedPrice
        };

        return {
          success: true,
          product: transformedProduct,
          message: `GunBroker item details retrieved: ${transformedProduct.name}`
        };
      } else {
        return {
          success: false,
          message: `Failed to get GunBroker item details: HTTP ${response.status}`
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `GunBroker item details error: ${error.message}`
      };
    }
  }

  /**
   * Check API capabilities and permissions
   */
  async getCapabilities(): Promise<string[]> {
    const capabilities = [
      'Product Search',
      'Marketplace Listings',
      'Real-time Pricing',
      'Item Details',
      'Seller Information'
    ];

    // Test additional capabilities if authenticated
    if (this.credentials.username && this.credentials.password) {
      capabilities.push('User Account Access', 'Bidding History', 'Watchlist Management');
    }

    return capabilities;
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{ status: string; message: string }> {
    try {
      const testResult = await this.testConnection();
      
      if (testResult.success) {
        return {
          status: 'healthy',
          message: `GunBroker ${this.credentials.environment} API operational`
        };
      } else {
        return {
          status: 'unhealthy', 
          message: testResult.message
        };
      }
    } catch (error: any) {
      return {
        status: 'error',
        message: `GunBroker API health check failed: ${error.message}`
      };
    }
  }

  /**
   * Get popular firearms categories for bulk import
   */
  async getPopularCategories(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/Categories`, {
        method: 'GET',
        headers: {
          'X-DevKey': this.credentials.devKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.log(`GUNBROKER API: Categories endpoint returned ${response.status} - no categories available`);
        // Return empty array - no fabricated categories
        return [];
      }

      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('GUNBROKER API: Categories error:', error);
      // Return empty array - no fabricated categories
      return [];
    }
  }

  /**
   * Bulk import products from GunBroker by category
   * @param categoryId - Category ID to import from
   * @param pageSize - Number of items per page (max 100)
   * @param maxPages - Maximum number of pages to retrieve (default 5 for 500 total items)
   */
  async bulkImportByCategory(categoryId: number, pageSize: number = 100, maxPages: number = 5): Promise<any[]> {
    try {
      console.log(`GUNBROKER API: Bulk importing from category ${categoryId}, page size ${pageSize}, max pages ${maxPages}`);

      // Get access token if we don't have one
      if (!this.authToken) {
        const token = await this.getAccessToken();
        if (!token) {
          throw new Error('GunBroker authentication failed');
        }
      }

      const allItems: any[] = [];
      let currentPage = 1;
      
      // Fetch multiple pages to get more products
      while (currentPage <= maxPages) {
        const queryParams = new URLSearchParams({
          'CategoryID': categoryId.toString(),
          'PageSize': Math.min(pageSize, 100).toString(), // Cap at 100 per API limits
          'PageIndex': currentPage.toString(),
          'Sort': '13', // Featured and then Relevance for better results
          'BuyNowOnly': 'true' // Focus on fixed price items
        });

        const url = `${this.baseUrl}/Items?${queryParams.toString()}`;
        console.log(`GUNBROKER API: Bulk import page ${currentPage}: ${url}`);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-DevKey': this.credentials.devKey,
            'X-AccessToken': this.authToken || '',
            'User-Agent': 'RetailPlatform/1.0',
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const items = data.results || [];
          
          console.log(`GUNBROKER API: Page ${currentPage} found ${items.length} items in category ${categoryId}`);
          
          if (items.length === 0) {
            console.log(`GUNBROKER API: No more items found, stopping at page ${currentPage}`);
            break;
          }
          
          // Transform items using official GunBroker API field names
          const transformedItems = items.map((item: any) => ({
            id: item.ItemID,
            name: item.Title,
            description: item.Description,
            upc: item.GTIN, // API docs line 827-833
            price: item.BuyNowPrice || item.BuyPrice || item.BidPrice,
            endingDate: item.EndingDate,
            seller: item.SellerName,
            condition: item.Condition,
            quantity: item.Quantity || 1,
            categoryId: item.CategoryID,
            hasReserve: item.HasReserve,
            hasBuyNow: item.HasBuyNow,
            isFixedPrice: item.IsFixedPrice,
            bidCount: item.Bids,
            pictureCount: item.PictureCount || 0
          }));
          
          allItems.push(...transformedItems);
          
          // Add small delay between pages to be respectful to API
          if (currentPage < maxPages) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } else {
          const errorText = await response.text();
          console.error(`GUNBROKER API: Page ${currentPage} failed: ${response.status} - ${errorText.substring(0, 200)}`);
          break;
        }
        
        currentPage++;
      }
      
      console.log(`GUNBROKER API: Bulk import complete - retrieved ${allItems.length} total items from ${currentPage - 1} pages`);
      return allItems;
    } catch (error: any) {
      console.error('GUNBROKER API: Bulk import error:', error.message);
      return [];
    }
  }

  /**
   * Import products from specific category with pagination
   */
  async importProductsFromCategory(categoryId: number, limit: number = 50): Promise<any[]> {
    try {
      console.log(`GUNBROKER API: Importing ${limit} products from category ${categoryId}`);
      
      const response = await fetch(`${this.baseUrl}/Items?CategoryID=${categoryId}&PageSize=${limit}&Sort=1`, {
        method: 'GET',
        headers: {
          'X-DevKey': this.credentials.devKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const items = data.results || [];
      
      console.log(`GUNBROKER API: Retrieved ${items.length} items from category ${categoryId}`);
      return items.map((item: any) => this.transformToProduct(item));
    } catch (error) {
      console.error('GUNBROKER API: Import error:', error);
      return [];
    }
  }

  /**
   * Transform GunBroker item to PriceCompare Pro product format
   */
  transformToProduct(item: any): any {
    return {
      upc: item.UPC || item.upc || item.gtin || null,
      name: item.title || item.Title || item.ItemTitle || null,
      brand: item.manufacturer || item.Manufacturer || item.ManufacturerName || null,
      model: item.model || item.Model || null,
      partNumber: item.manufacturerPartNumber || item.ManufacturerPartNumber || item.MPN || null,
      caliber: item.caliber || item.Caliber || item.CaliberGauge || null,
      description: item.description || item.Description || item.ItemDescription || null,
      msrp: item.msrp || item.MSRP || null,
      category: item.categoryName || item.CategoryName || null,
      image: item.pictureURL || item.PictureURL || item.Pictures?.[0]?.PictureURL || null,
      weight: item.shippingWeight || item.ShippingWeight || null,
      gunBrokerItemId: item.itemID || item.ItemID || item.ID,
      gunBrokerCategoryId: item.categoryID || item.CategoryID,
      marketplacePrice: item.buyNowPrice || item.BuyNowPrice || item.currentBid || item.CurrentBid || item.price,
      seller: item.seller?.username || item.Seller?.username || item.seller || item.Seller || null
    };
  }
}

export default GunBrokerAPI;