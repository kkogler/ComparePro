import { MailService } from '@sendgrid/mail';
import { 
  CSV_EXPORT_CONFIG,
  getCSVHeaders, 
  generateEmailSubject, 
  generateEmailBody,
  getEmailSender,
  getEmailSenderName
} from '../shared/csv-export-config';
// PricingService removed - no calculated values allowed, only authentic vendor API data

interface OrderItemForExport {
  id: number;
  quantity: number;
  unitCost: string;
  totalCost: string;
  vendorSku: string | null;
  vendorMsrp: string | null;
  vendorMapPrice: string | null;
  retailPrice: string | null;
  product: {
    name: string;
    upc: string | null;
    brand: string | null;
    model: string | null;
    manufacturerPartNumber: string | null;
    category: string | null;
    subcategory1: string | null;
    subcategory2: string | null;
    subcategory3: string | null;
    description: string | null;
    imageUrl: string | null;
  };
}

interface OrderForExport {
  id: number;
  orderNumber: string;
  companyId: number;
  vendor: {
    name: string;
    vendorShortCode: string;
  };
  items: OrderItemForExport[];
}

export class CSVExportService {
  private mailService: MailService;

  constructor() {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY environment variable must be set");
    }
    
    this.mailService = new MailService();
    this.mailService.setApiKey(process.env.SENDGRID_API_KEY);
  }


  /**
   * Generate Order Quantity Export CSV (simplified 3-column format)
   */
  async generateOrderQuantityCSV(order: OrderForExport): Promise<string> {
    const headers = CSV_EXPORT_CONFIG.ORDER_QUANTITY_HEADERS;
    
    const rows = order.items.map(item => [
      // Manu Part Number (prioritize manufacturerPartNumber, fallback to SKU)
      this.escapeCSVField(item.product.manufacturerPartNumber || item.vendorSku || ''),
      
      // Quantity
      this.escapeCSVField(item.quantity.toString()),
      
      // Total Cost
      this.escapeCSVField(item.totalCost)
    ]);

    // Combine headers and rows
    const csvContent = [headers.join(',')];
    csvContent.push(...rows.map(row => row.join(',')));
    
    return csvContent.join('\n');
  }

  /**
   * Generate CSV content for order items based on the template mapping
   */
  async generateOrderCSV(order: OrderForExport): Promise<string> {
    
    // CSV Headers from centralized configuration
    const headers = getCSVHeaders();

    // Use already-calculated retail prices from order items (no recalculation needed)
    const rowsPromises = order.items.map(async (item) => {
      const unitCost = parseFloat(item.unitCost || '0');
      
      // Use stored retail price from order creation (already calculated using pricing rules)
      const retailPrice = parseFloat(item.retailPrice || '0');
      
      const productName = item.product.name || '';
      
      return [
        // Product Name > Name
        this.escapeCSVField(productName),
        
        // SKU > Manufacturer Part Number if available. If not use UPC
        this.escapeCSVField(item.product.manufacturerPartNumber || item.product.upc || ''),
        
        // Style > Model
        this.escapeCSVField(item.product.model || ''),
        
        // Vendor Name > Vendor Short Code used on the Customer Order
        (() => {
          console.log('CSV EXPORT SERVICE DEBUG: Vendor data:', {
            vendorShortCode: order.vendor.vendorShortCode,
            vendorName: order.vendor.name,
            fallback: order.vendor.vendorShortCode || order.vendor.name || ''
          });
          return this.escapeCSVField(order.vendor.vendorShortCode || order.vendor.name || '');
        })(),
        
        // Brand > Manufacturer (decode HTML entities)
        this.escapeCSVField(this.stripHtmlTags(item.product.brand || '')),
        
        // Main Category > Category
        this.escapeCSVField(item.product.category || ''),
        
        // Sub-Category > Subcategory 1
        this.escapeCSVField(item.product.subcategory1 || ''),
        
        // Product Class > Subcategory 2
        this.escapeCSVField(item.product.subcategory2 || ''),
        
        // Sub-Class > Subcategory 3
        this.escapeCSVField(item.product.subcategory3 || ''),
        
        // Prompt for Price > Omit
        '',
        
        // Replacement Cost > Cost
        this.escapeCSVField(item.unitCost || ''),
        
        // Average Cost Price > Omit
        '',
        
        // Price > Calculated retail price based on store pricing rules (same as webhook)
        this.escapeCSVField(retailPrice.toFixed(2)),
        
        // MSRP > MSRP
        this.escapeCSVField(item.vendorMsrp || ''),
        
        // MAP > MAP
        this.escapeCSVField(item.vendorMapPrice || ''),
        
        // Special Price > Omit
        '',
        
        // Product Tax Class > Omit
        '',
        
        // UPC > UPC (formatted as text to preserve leading zeros)
        this.formatUPCAsText(item.product.upc || ''),
        
        // Alternate SKU > Vendor SKU
        this.escapeCSVField(item.vendorSku || ''),
        
        // Product ID > Omit
        '',
        
        // Item No > Omit
        '',
        
        // Bin Location > Omit
        '',
        
        // Storage Location > Omit
        '',
        
        // Reorder Qty > Omit
        '',
        
        // Reorder Level > Omit
        '',
        
        // Vendor Minimum Order Qty > Omit
        '',
        
        // Vendor Discontinued > Omit
        '',
        
        // Status > Omit
        '',
        
        // Allow Fraction > Omit
        '',
        
        // Allow Discounts > Omit
        '',
        
        // Allow Returns > Omit
        '',
        
        // Image Path > Image URL
        this.escapeCSVField(item.product.imageUrl || ''),
        
        // Special Price Begin Date > Omit
        '',
        
        // Special Price End Date > Omit
        '',
        
        // Product Note > Description (HTML tags removed)
        this.escapeCSVField(this.stripHtmlTags(item.product.description || ''))
      ];
    });
    
    // Wait for all retail price calculations to complete
    const rows = await Promise.all(rowsPromises);

    // Combine headers and rows
    const csvContent = [headers.join(',')];
    csvContent.push(...rows.filter(row => row && Array.isArray(row)).map(row => row.join(',')));
    
    return csvContent.join('\n');
  }

  /**
   * Strip HTML tags and clean up text for CSV export
   */
  private stripHtmlTags(value: string): string {
    if (!value) return '';
    
    return String(value)
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Decode common HTML entities
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#39;/g, "'")
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Escape CSV field content to handle commas, quotes, and newlines
   */
  private escapeCSVField(value: string): string {
    if (!value) return '';
    
    // Convert to string and remove any existing quotes
    const stringValue = String(value).replace(/"/g, '""');
    
    // If field contains comma, quote, or newline, wrap in quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue}"`;
    }
    
    return stringValue;
  }

  /**
   * Format UPC field as text to prevent Excel from treating it as a number
   * This preserves leading zeros and ensures proper text formatting
   */
  private formatUPCAsText(value: string): string {
    if (!value) return '';
    
    // Clean the UPC value
    const cleanValue = String(value).trim();
    
    // Simple approach: just quote the value and let the column be treated as text
    // This preserves UPC codes as they are without visible formatting characters
    return `"${cleanValue}"`;
  }

  /**
   * Send both CSV files via email using SendGrid (Product Import + Order Quantity Export)
   */
  async sendOrderCSVEmail(
    order: OrderForExport,
    recipientEmail: string,
    csvContent: string,
    quantityExportContent: string,
    companyName?: string,
    customFileName?: string,
    customQuantityFileName?: string
  ): Promise<boolean> {
    try {
      const fileName = customFileName || `order-${order.orderNumber}-products.csv`;
      const quantityFileName = customQuantityFileName || `order-${order.orderNumber}-quantity-export.csv`;
      
      const base64Content = Buffer.from(csvContent).toString('base64');
      const base64QuantityContent = Buffer.from(quantityExportContent).toString('base64');
      
      const senderEmail = getEmailSender();
      const senderName = getEmailSenderName(companyName);
      const subject = generateEmailSubject(order.orderNumber, order.vendor.name);
      const emailBody = generateEmailBody(order.orderNumber, order.vendor.name, order.items.length);

      const emailContent = {
        to: recipientEmail,
        from: {
          email: senderEmail,
          name: senderName
        },
        subject,
        text: emailBody,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Product Import Files - Order ${order.orderNumber}</h2>
            
            <p>Please find attached the product import files for your vendor order.</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #555;">Order Details</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Order Number:</strong> ${order.orderNumber}</li>
                <li><strong>Vendor:</strong> ${order.vendor.name}</li>
                <li><strong>Total Items:</strong> ${order.items.length}</li>
              </ul>
            </div>
            
            <div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #555;">Attached Files</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Product Import File:</strong> Complete product information formatted for import into your POS system</li>
                <li><strong>Order Quantity Export:</strong> Simplified 3-column format with part numbers, quantities, and costs</li>
              </ul>
            </div>
            
            <h3 style="color: #555;">Instructions:</h3>
            <ol>
              <li>Download both attached CSV files</li>
              <li>Use the Product Import File for complete POS system import</li>
              <li>Use the Order Quantity Export for simplified quantity tracking</li>
              <li>Review and verify all imported products</li>
            </ol>
            
            <p>If you have any questions about these import files, please contact support.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>BestPrice Platform Team</strong>
            </p>
          </div>
        `,
        attachments: [
          {
            content: base64Content,
            filename: fileName,
            type: 'text/csv',
            disposition: 'attachment'
          },
          {
            content: base64QuantityContent,
            filename: quantityFileName,
            type: 'text/csv',
            disposition: 'attachment'
          }
        ]
      };

      await this.mailService.send(emailContent);
      console.log(`CSV export email sent successfully to ${recipientEmail} for order ${order.orderNumber}`);
      return true;
    } catch (error) {
      console.error('SendGrid email error:', error);
      return false;
    }
  }
}

export const csvExportService = new CSVExportService();