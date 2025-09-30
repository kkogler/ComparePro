import { db } from './db';
import { organizations, users, billingEvents } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface ZohoOneConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  baseUrl: string;
}

export class ZohoOneIntegration {
  private config: ZohoOneConfig;

  constructor(config: ZohoOneConfig) {
    this.config = config;
  }

  // Generate OAuth URL for Zoho One authorization
  generateAuthUrl(organizationId: number): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      scope: this.config.scope,
      redirect_uri: this.config.redirectUri,
      state: organizationId.toString(), // Pass org ID in state for callback
      access_type: 'offline',
      prompt: 'consent'
    });

    return `${this.config.baseUrl}/oauth/v2/auth?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code: string, organizationId: number): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const tokenUrl = `${this.config.baseUrl}/oauth/v2/token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        code: code,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const tokenData = await response.json();

    // Store tokens in organization settings
    await db
      .update(organizations)
      .set({
        settings: {
          zohoAccessToken: tokenData.access_token,
          zohoRefreshToken: tokenData.refresh_token,
          zohoTokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
    };
  }

  // Refresh access token using refresh token
  async refreshAccessToken(organizationId: number): Promise<string> {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org?.settings?.zohoRefreshToken) {
      throw new Error('No refresh token available');
    }

    const tokenUrl = `${this.config.baseUrl}/oauth/v2/token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: org.settings.zohoRefreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const tokenData = await response.json();

    // Update stored access token
    await db
      .update(organizations)
      .set({
        settings: {
          ...org.settings,
          zohoAccessToken: tokenData.access_token,
          zohoTokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    return tokenData.access_token;
  }

  // Get valid access token (refresh if needed)
  async getValidAccessToken(organizationId: number): Promise<string> {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org?.settings?.zohoAccessToken) {
      throw new Error('No access token available. Organization needs to authorize Zoho integration.');
    }

    // Check if token is expired
    const expiryTime = new Date(org.settings.zohoTokenExpiry);
    const now = new Date();
    
    if (now >= expiryTime) {
      // Token expired, refresh it
      return await this.refreshAccessToken(organizationId);
    }

    return org.settings.zohoAccessToken;
  }

  // Sync orders to Zoho Inventory/Books
  async syncOrderToZoho(organizationId: number, order: any): Promise<void> {
    const accessToken = await this.getValidAccessToken(organizationId);

    // Create sales order in Zoho Inventory
    const salesOrderData = {
      customer_name: `Platform Order ${order.orderNumber}`,
      date: order.orderDate,
      reference_number: order.orderNumber,
      line_items: order.items?.map((item: any) => ({
        item_id: item.productId?.toString(),
        name: item.productName || 'Unknown Product',
        description: `${item.brand} ${item.model} - ${item.partNumber}`,
        rate: parseFloat(item.unitCost || '0'),
        quantity: item.quantity,
        unit: 'pcs',
      })) || [],
      notes: order.notes || '',
      terms: 'Net 30',
      custom_fields: [
        {
          label: 'Vendor',
          value: order.vendorName || 'Unknown Vendor',
        },
        {
          label: 'FFL Required',
          value: 'Yes',
        },
      ],
    };

    const response = await fetch('https://inventory.zoho.com/api/v1/salesorders', {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(salesOrderData),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync order to Zoho: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`Order ${order.orderNumber} synced to Zoho:`, result);
  }

  // Sync inventory to Zoho
  async syncInventoryToZoho(organizationId: number, products: any[]): Promise<void> {
    const accessToken = await this.getValidAccessToken(organizationId);

    for (const product of products) {
      try {
        const itemData = {
          name: product.name,
          sku: product.partNumber,
          description: product.description || `${product.brand} ${product.model}`,
          rate: parseFloat(product.msrp || '0'),
          unit: 'pcs',
          product_type: 'goods',
          item_type: 'inventory',
          track_quantity_and_value: true,
          initial_stock: product.totalStock || 0,
          initial_stock_rate: parseFloat(product.averageCost || '0'),
          custom_fields: [
            {
              label: 'UPC',
              value: product.upc,
            },
            {
              label: 'Brand',
              value: product.brand,
            },
            {
              label: 'Model',
              value: product.model,
            },
            {
              label: 'Caliber',
              value: product.caliber || 'N/A',
            },
          ],
        };

        const response = await fetch('https://inventory.zoho.com/api/v1/items', {
          method: 'POST',
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(itemData),
        });

        if (!response.ok && response.status !== 400) { // 400 might be duplicate item
          console.error(`Failed to sync product ${product.name} to Zoho:`, response.statusText);
        }
      } catch (error) {
        console.error(`Error syncing product ${product.name}:`, error);
      }
    }
  }

  // Create customer in Zoho CRM
  async createZohoCustomer(organizationId: number, customerData: {
    name: string;
    email: string;
    phone?: string;
    fflNumber: string;
    address: string;
  }): Promise<void> {
    const accessToken = await this.getValidAccessToken(organizationId);

    const contactData = {
      data: [{
        Last_Name: customerData.name,
        Email: customerData.email,
        Phone: customerData.phone || '',
        Mailing_Street: customerData.address,
        Description: `FFL Number: ${customerData.fflNumber}`,
        Lead_Source: 'Retail Management Platform',
        Account_Name: customerData.name,
        Industry: 'Firearms Retail',
      }],
    };

    const response = await fetch('https://www.zohoapis.com/crm/v2/Contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactData),
    });

    if (!response.ok) {
      throw new Error(`Failed to create Zoho customer: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Customer created in Zoho CRM:', result);
  }

  // Get organization info from Zoho
  async getZohoOrgInfo(organizationId: number): Promise<any> {
    const accessToken = await this.getValidAccessToken(organizationId);

    const response = await fetch('https://www.zohoapis.com/crm/v2/org', {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get Zoho org info: ${response.statusText}`);
    }

    return await response.json();
  }
}

// Configuration for Zoho One integration
export const zohoOneConfig: ZohoOneConfig = {
  clientId: process.env.ZOHO_CLIENT_ID || '1000.7XXV1AC0PMGZ0YMH8B691EX8F6Z1QX',
  clientSecret: process.env.ZOHO_CLIENT_SECRET || '1a0d78269fcbd6ced21429a84863fe888946c87c2d',
  redirectUri: process.env.ZOHO_REDIRECT_URI || 'http://localhost:5000/api/zoho/callback',
  scope: 'ZohoBilling.subscriptions.ALL,ZohoBilling.customers.ALL,ZohoInventory.FullAccess.all,ZohoCRM.modules.ALL,ZohoBooks.FullAccess.all',
  baseUrl: 'https://accounts.zoho.com',
};

export const zohoIntegration = new ZohoOneIntegration(zohoOneConfig);