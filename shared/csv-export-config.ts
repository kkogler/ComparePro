// CSV Export Configuration System
// Centralized configuration for CSV export functionality and email settings

export const CSV_EXPORT_CONFIG = {
  EMAIL_SETTINGS: {
    DEFAULT_SENDER: 'noreply@bestprice.com',
    DEFAULT_SENDER_NAME: 'BestPrice Platform',
    SUBJECT_PREFIX: 'Product Import File',
    ATTACHMENT_MIME_TYPE: 'text/csv'
  },

  FILENAME_SETTINGS: {
    DEFAULT_PREFIX: 'order',
    DEFAULT_SUFFIX: 'products',
    EXTENSION: '.csv',
    DATE_FORMAT: 'MM.DD.YYYY',
    FALLBACK_VENDOR_NAME: 'vendor'
  },

  CSV_HEADERS: [
    'Product Name', 'SKU', 'Style', 'Vendor Name', 'Brand', 'Main Category',
    'Sub-Category', 'Product Class', 'Sub-Class', 'Prompt for Price',
    'Replacement Cost', 'Average Cost', 'Price', 'MSRP', 'MAP', 'Special Price',
    'Product Tax Class', 'UPC', 'Alternate SKU', 'Product ID', 'Item No',
    'Bin Location', 'Storage Location', 'Reorder Qty', 'Reorder Level',
    'Vendor Minimum Order Qty', 'Vendor Discontinued', 'Status',
    'Allow Fractions', 'Allow Discounts', 'Allow Returns', 'Image Path',
    'Special Price Begin Date', 'Special Price End Date', 'Product Note'
  ],

  // Order Quantity Export CSV headers - simplified 3-column format
  ORDER_QUANTITY_HEADERS: [
    'Manu Part Number',
    'Quantity',
    'Total Cost'
  ],

  EMAIL_TEMPLATES: {
    SUBJECT: (orderNumber: string, vendorName: string) => 
      `${CSV_EXPORT_CONFIG.EMAIL_SETTINGS.SUBJECT_PREFIX} - Order ${orderNumber} from ${vendorName}`,
    
    BODY: (orderNumber: string, vendorName: string, itemCount: number) => 
      `Please find attached the product import files for Order ${orderNumber}.

Order Details:
- Order Number: ${orderNumber}
- Vendor: ${vendorName}
- Total Items: ${itemCount}

Attached Files:
1. Product Import File: Complete product information formatted for import into your POS system
2. Order Quantity Export: Simplified 3-column format with part numbers, quantities, and costs

Best regards,
BestPrice Platform Team`
  },

  FILENAME_GENERATORS: {
    ENHANCED: (vendorShortName: string, orderNumber: string, orderDate: Date) => {
      const formattedDate = `${String(orderDate.getMonth() + 1).padStart(2, '0')}.${String(orderDate.getDate()).padStart(2, '0')}.${orderDate.getFullYear()}`;
      const cleanVendorName = (vendorShortName || CSV_EXPORT_CONFIG.FILENAME_SETTINGS.FALLBACK_VENDOR_NAME).replace(/\s+/g, '');
      return `${cleanVendorName}_${orderNumber}_${formattedDate}${CSV_EXPORT_CONFIG.FILENAME_SETTINGS.EXTENSION}`;
    },

    ORDER_QUANTITY: (vendorShortName: string, orderNumber: string, orderDate: Date) => {
      const formattedDate = `${String(orderDate.getMonth() + 1).padStart(2, '0')}.${String(orderDate.getDate()).padStart(2, '0')}.${orderDate.getFullYear()}`;
      const cleanVendorName = (vendorShortName || CSV_EXPORT_CONFIG.FILENAME_SETTINGS.FALLBACK_VENDOR_NAME).replace(/\s+/g, '');
      return `${cleanVendorName}_${orderNumber}_${formattedDate}_OrderExport${CSV_EXPORT_CONFIG.FILENAME_SETTINGS.EXTENSION}`;
    },

    FALLBACK: (orderId: number) => 
      `${CSV_EXPORT_CONFIG.FILENAME_SETTINGS.DEFAULT_PREFIX}-${orderId}-${CSV_EXPORT_CONFIG.FILENAME_SETTINGS.DEFAULT_SUFFIX}${CSV_EXPORT_CONFIG.FILENAME_SETTINGS.EXTENSION}`
  }
} as const;

export type CSVEmailSettings = typeof CSV_EXPORT_CONFIG.EMAIL_SETTINGS;
export type CSVFilenameSettings = typeof CSV_EXPORT_CONFIG.FILENAME_SETTINGS;

export function getEmailSender(): string {
  return CSV_EXPORT_CONFIG.EMAIL_SETTINGS.DEFAULT_SENDER;
}

export function getEmailSenderName(companyName?: string): string {
  return companyName 
    ? `${companyName} - ${CSV_EXPORT_CONFIG.EMAIL_SETTINGS.DEFAULT_SENDER_NAME}`
    : CSV_EXPORT_CONFIG.EMAIL_SETTINGS.DEFAULT_SENDER_NAME;
}

export function generateEnhancedFilename(
  vendorShortName: string | null | undefined,
  orderNumber: string,
  orderDate: Date
): string {
  // Pass the original vendor name to the generator, let it handle the cleaning
  const vendorName = vendorShortName || CSV_EXPORT_CONFIG.FILENAME_SETTINGS.FALLBACK_VENDOR_NAME;
  return CSV_EXPORT_CONFIG.FILENAME_GENERATORS.ENHANCED(vendorName, orderNumber, orderDate);
}

export function generateFallbackFilename(orderId: number): string {
  return CSV_EXPORT_CONFIG.FILENAME_GENERATORS.FALLBACK(orderId);
}

export function getCSVHeaders(): string[] {
  return [...CSV_EXPORT_CONFIG.CSV_HEADERS];
}

export function generateEmailSubject(orderNumber: string, vendorName: string): string {
  return CSV_EXPORT_CONFIG.EMAIL_TEMPLATES.SUBJECT(orderNumber, vendorName);
}

export function generateEmailBody(orderNumber: string, vendorName: string, itemCount: number): string {
  return CSV_EXPORT_CONFIG.EMAIL_TEMPLATES.BODY(orderNumber, vendorName, itemCount);
}