// Common types used across the application
export interface DashboardStats {
  draftOrders: number;
  openOrders: number;
  openAsns: number;
  connectedVendors: number;
}

export interface RecentOrder {
  id: number;
  number: string;
  vendor: string;
  amount: string;
  date: string;
  status: string;
}

export interface VendorStatus {
  id: number;
  name: string;
  itemCount: number;
  status: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recentOrders: RecentOrder[];
  vendors: VendorStatus[];
}

export interface ProductSearchResult {
  id: number;
  upc: string;
  name: string;
  brand: string;
  model: string;
  partNumber: string;
  caliber?: string;
  category?: string;
  description?: string;
  msrp?: string;
  imageUrl?: string;
}

export interface VendorComparison {
  id: number;
  vendor: {
    id: number;
    name: string;
    electronicOrders: boolean;
  };
  sku: string;
  cost: string;
  stock: number;
  availability: string;
  msrp?: string;
  margin?: string;
}

export interface VendorComparisonData {
  product: ProductSearchResult;
  vendors: VendorComparison[];
}

export interface OrderWithVendor {
  id: number;
  orderNumber: string;
  vendorId: number;
  vendor: string;
  vendorShortCode?: string;
  storeId: number;
  storeName: string;
  status: string;
  orderDate: string;
  expectedDate?: string;
  totalAmount: string;
  itemCount: number;
  shippingCost: string;
  notes?: string;
  vendorInvoiceNumber?: string;
}

export interface ASNWithDetails {
  id: number;
  asnNumber: string;
  orderId: number;
  orderNumber: string;
  vendorId: number;
  vendor: string;
  status: string;
  shipDate?: string;
  trackingNumber?: string;
  itemsShipped: number;
  itemsTotal: number;
  shippingCost: string;
  notes?: string;
}

export interface VendorInfo {
  id: number;
  name: string;
  vendorShortCode?: string;
  type: string;
  status: string;
  connectionStatus: string;
  catalogItems: number;
  electronicOrders: boolean;
  lastUpdate?: string;
  credentials?: any;
  logoUrl?: string;
}

export interface UserSettings {
  id: number;
  companyId: number;
  platformAccountNumber: string;
  storeAddress?: string; // Legacy field for backward compatibility
  storeAddress1: string;
  storeAddress2?: string;
  storeCity: string;
  storeState: string;
  storeZipCode: string;
  microbizEndpoint?: string;
  microbizApiKey?: string;
  microbizEnabled: boolean;
  showVendorCosts: boolean;
  autoRefreshResults: boolean;
  includeUnmatchedUpcs: boolean;
  createdAt: string;
}
