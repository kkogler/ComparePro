import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Check, Clock, X, Minus, ShoppingCart, Building2, Store, Truck, Plus, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getVendorIdentifier } from "@/lib/vendor-utils";

export default function VendorComparison() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const productId = searchParams.get('productId');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Extract organization slug from URL params
  const { slug: orgSlug } = useParams();
  

  
  // Order modal state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderDetails, setOrderDetails] = useState<{
    vendor: any;
    product: any;
    vendorProduct: any;
    quantity: number;
    unitCost: string;
    totalCost: string;
  } | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("new");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [manualPriceMode, setManualPriceMode] = useState(false);
  const [manualPrice, setManualPrice] = useState('');
  const [manualGrossMargin, setManualGrossMargin] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Get current user to set default store
  const { data: currentUser } = useQuery({
    queryKey: [`/org/${orgSlug}/api/user`],
    queryFn: async () => {
      const response = await fetch(`/org/${orgSlug}/api/user`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!orgSlug,
    staleTime: 60000, // 1 minute
  });

  // Fetch product categories for the dropdown
  const { data: productCategories = [] } = useQuery({
    queryKey: [`/org/${orgSlug}/api/categories`],
    queryFn: async () => {
      const response = await fetch(`/org/${orgSlug}/api/categories`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!orgSlug,
    staleTime: 60000, // 1 minute
  });

  // Get pricing configurations to show correct footnote
  const { data: pricingConfigurations } = useQuery({
    queryKey: [`/org/${orgSlug}/api/pricing-configurations`],
    queryFn: async () => {
      const response = await fetch(`/org/${orgSlug}/api/pricing-configurations`, { 
        credentials: "include" 
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!orgSlug,
    staleTime: 300000, // 5 minutes
  });
  
  // Get organization settings to check if category is required
  const { data: organization } = useQuery({
    queryKey: [`/org/${orgSlug}/api/organization`],
    queryFn: async () => {
      const response = await fetch(`/org/${orgSlug}/api/organization`, { 
        credentials: "include" 
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!orgSlug,
    staleTime: 60000, // 1 minute
  });

  const requireCategory = organization?.settings?.requireCategoryOnVendorOrders ?? true;
  
  console.log('🔍 VENDOR COMPARISON: requireCategory =', requireCategory, ', organization.settings =', organization?.settings);
  

  const { data: vendorComparison, isLoading, error } = useQuery({
    queryKey: ['/api/products', productId, 'vendors'],
    queryFn: async () => {
      // First, get the list of available vendors
      const response = await fetch(`/org/${orgSlug}/api/products/${productId}/vendors`, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      const vendorListData = await response.json();
      
      console.log('🔍 VENDOR COMPARISON: API Response:', vendorListData);
      console.log('🔍 VENDOR COMPARISON: Vendors returned:', vendorListData.vendors?.length || 0);
      if (vendorListData.vendors) {
        console.log('🔍 VENDOR COMPARISON: Vendor names:', vendorListData.vendors.map((v: any) => v.name));
        console.log('🔍 VENDOR COMPARISON: Vendor slugs:', vendorListData.vendors.map((v: any) => ({ name: v.name, slug: v.slug, shortCode: v.vendorShortCode, id: v.id })));
      }
      
      // Call all vendor price APIs in parallel for faster response
      const vendorPromises = (vendorListData.vendors || []).map(async (vendor: any) => {
        // Create a robust vendor fallback object for consistent error handling
        const vendorFallback = {
          id: vendor.id || `unknown-${Math.random()}`,
          name: vendor.name || 'Unknown Vendor', 
          logoUrl: vendor.logoUrl || null,
          electronicOrders: vendor.electronicOrders || false
        };

        try {
          // Add timeout protection for hanging requests (30 seconds)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          // ✅ STANDARDIZED: Use vendor utility to get correct identifier
          const vendorIdentifier = getVendorIdentifier(vendor);
          console.log(`🔍 VENDOR API CALL: Making request for ${vendor.name} using identifier: ${vendorIdentifier}`);
          console.log(`🔍 VENDOR API CALL: URL: /org/${orgSlug}/api/products/${productId}/vendors/${vendorIdentifier}/price`);
          const vendorResponse = await fetch(`/org/${orgSlug}/api/products/${productId}/vendors/${vendorIdentifier}/price`, {
            credentials: "include",
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (vendorResponse.ok) {
            const vendorData = await vendorResponse.json();
            console.log(`✅ VENDOR API SUCCESS: ${vendor.name} returned:`, vendorData);
            // Ensure consistent vendor data structure
            return {
              ...vendorData,
              vendor: {
                ...vendorFallback,
                ...vendorData.vendor
              }
            };
          } else {
            console.log(`❌ VENDOR API ERROR: ${vendor.name} returned status ${vendorResponse.status}`);
            // Handle different HTTP error codes appropriately
            let errorMessage = `HTTP ${vendorResponse.status} error`;
            let availability = 'api_error';
            let sku = 'API Error';
            
            if (vendorResponse.status === 404) {
              availability = 'not_found';
              sku = 'Not Found';
              errorMessage = 'Vendor API endpoint not found';
            } else if (vendorResponse.status === 401 || vendorResponse.status === 403) {
              availability = 'auth_required';
              sku = 'Auth Required';
              errorMessage = 'Vendor API authentication required';
            } else if (vendorResponse.status >= 500) {
              availability = 'server_error';
              sku = 'Server Error';
              errorMessage = 'Vendor API server error';
            }
            
            return {
              vendor: vendorFallback,
              sku,
              cost: 'N/A',
              stock: 0,
              availability,
              apiMessage: errorMessage
            };
          }
        } catch (error: any) {
          console.error(`❌ VENDOR API EXCEPTION: ${vendor.name}:`, error);
          // Handle different error types robustly
          let errorMessage = 'Network connection failed';
          let availability = 'network_error';
          let sku = 'Network Error';
          
          if (error.name === 'AbortError') {
            availability = 'timeout';
            sku = 'Timeout';
            errorMessage = 'Request timeout - vendor API took too long to respond';
          } else if (error.message?.includes('Failed to fetch')) {
            availability = 'network_error';
            sku = 'Network Error';
            errorMessage = 'Network connection failed - check internet connection';
          } else if (error.message?.includes('401')) {
            availability = 'auth_required';
            sku = 'Auth Required';
            errorMessage = 'Authentication required for vendor API';
          }
          
          return {
            vendor: vendorFallback,
            sku,
            cost: 'N/A',
            stock: 0,
            availability,
            apiMessage: errorMessage
          };
        }
      });

      // Wait for all vendor API calls to complete in parallel
      const vendorResults = await Promise.all(vendorPromises);
      
      console.log('🔍 VENDOR COMPARISON: Final results:', vendorResults);
      console.log('🔍 VENDOR COMPARISON: Results count:', vendorResults.length);
      
      return {
        product: vendorListData.product,
        vendors: vendorResults
      };
    },
    enabled: !!productId && !!orgSlug,
    staleTime: 0, // No cache - always fetch fresh data
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error && error.message.includes('401')) {
        return false;
      }
      return failureCount < 2;
    }
  });



  // Query for draft orders (for selected vendor)
  const { data: draftOrders } = useQuery({
    queryKey: ['/api/orders', 'draft', orderDetails?.vendor?.id],
    queryFn: async () => {
      if (!orderDetails?.vendor?.id) return [];
      const response = await fetch(`/org/${orgSlug}/api/orders?status=draft&vendorId=${orderDetails.vendor.id}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!orderDetails?.vendor?.id && isOrderModalOpen && !!orgSlug,
    staleTime: 10000 // 10 seconds
  });

  // Query for user's assigned stores
  const { data: userStores } = useQuery({
    queryKey: ['/api/user/stores'],
    queryFn: async () => {
      const response = await fetch(`/org/${orgSlug}/api/user/stores`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!orgSlug,
    staleTime: 30000 // 30 seconds
  });

  // Extract stores from user store assignments
  const stores = userStores?.map((assignment: any) => assignment.store) || [];
  
  // Smart defaults for store selection based on requirements:
  // Priority: User's defaultStoreId > Single store > No default
  const getDefaultStoreId = () => {

    
    // Priority 1: Use user's default store if set and available in stores
    if (currentUser?.defaultStoreId) {
      const defaultStore = stores.find((store: any) => store.id === currentUser.defaultStoreId);
      if (defaultStore) {

        return currentUser.defaultStoreId.toString();
      }
    }
    
    // Priority 2: If only one store available, default to that store
    if (stores.length === 1) {

      return stores[0].id.toString();
    }
    

    return ""; // No default for multiple stores without user preference
  };

  const addItemToOrderMutation = useMutation({
    mutationFn: async (orderData: { orderId?: number; vendorId: number; productId: number; vendorProductId?: number; gunBrokerItemId?: string; quantity: number; unitCost: string; vendorSku?: string; vendorMsrp?: string; vendorMapPrice?: string; category?: string }) => {
      return await apiRequest(`/org/${orgSlug}/api/orders/add-item`, 'POST', orderData);
    },
    onSuccess: (data) => {
      toast({
        title: "Item Added to Order",
        description: `Product successfully added to ${selectedOrderId === "new" ? "new" : "existing"} order`,
      });
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      // Also invalidate the specific draft orders query for this vendor
      if (orderDetails?.vendor?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/orders', 'draft', orderDetails.vendor.id] });
      }
      setIsOrderModalOpen(false);
      
      // Redirect to Product Search screen after successful order creation
      setTimeout(() => {
        setLocation(`/org/${orgSlug}/search`);
      }, 1000); // 1 second delay to allow user to see the success message
    },
    onError: (error: any) => {
      console.error('Error adding item to order:', error);
      toast({
        title: "Order Creation Failed",
        description: `Failed to add item to order: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const handleCreateOrder = async (vendor: any) => {
    if (!vendorComparison?.product) {
      console.error('No product data available for order creation');
      return;
    }
    
    const unitCost = vendor.cost;
    const quantity = 1;
    const totalCost = unitCost ? (parseFloat(String(unitCost).replace('$', '')) * quantity).toFixed(2) : '0.00';
    
    // Initialize manual price fields when entering manual mode
    const isGunBroker = vendor.vendor.name.includes('GunBroker');
    const calculatedPrice = isGunBroker ? vendor.cost : (vendor.calculatedRetailPrice || vendor.msrp || '');
    setManualPrice(calculatedPrice);
    
    // Calculate initial gross margin
    if (calculatedPrice && vendor.cost && vendor.cost !== 'N/A' && vendor.cost !== null) {
      const cost = parseFloat(String(vendor.cost).replace('$', ''));
      const price = parseFloat(String(calculatedPrice));
      const margin = ((price - cost) / price * 100);
      setManualGrossMargin(margin.toFixed(0));
    }

    setOrderDetails({
      vendor: vendor.vendor,
      product: vendorComparison.product,
      vendorProduct: vendor,
      quantity,
      unitCost,
      totalCost: `$${totalCost}`
    });
    setOrderQuantity(quantity);
    
    // Reset category selection - user must manually choose
    setSelectedCategory('');
    console.log('🔍 MODAL OPENING: Category cleared, user must select. requireCategory:', requireCategory);
    
    setSelectedOrderId("new"); // Reset to new order
    setSelectedStoreId(getDefaultStoreId()); // Set smart default for store selection
    setManualPriceMode(false); // Reset to automatic pricing
    setIsOrderModalOpen(true);
  };

  const handleSaveOrder = async () => {
    if (!orderDetails) {
      console.error('No order details available');
      return;
    }

    if (!orgSlug) {
      console.error('No organization slug available');
      toast({
        title: "Error",
        description: "Organization information is missing",
        variant: "destructive",
      });
      return;
    }

    // Validate category requirement based on company settings
    // Use selectedCategory directly - do NOT fall back to product.category for validation
    const effectiveCategory = selectedCategory || '';
    console.log('🔍 CATEGORY VALIDATION:');
    console.log('  - requireCategory:', requireCategory);
    console.log('  - selectedCategory:', selectedCategory);
    console.log('  - orderDetails.product.category:', orderDetails.product.category);
    console.log('  - effectiveCategory:', effectiveCategory);
    console.log('  - effectiveCategory.trim():', effectiveCategory.trim());
    console.log('  - Validation check (requireCategory && !effectiveCategory.trim()):', requireCategory && !effectiveCategory.trim());
    
    if (requireCategory && !effectiveCategory.trim()) {
      console.log('❌ CATEGORY REQUIRED - Blocking save');
      toast({
        title: "Category Required",
        description: "Please select a product category before adding to order. This requirement can be changed in Company Settings.",
        variant: "destructive"
      });
      return;
    }
    
    console.log('✅ CATEGORY VALIDATION PASSED - Proceeding with save');

    // Store selection is required for all orders (new and existing)
    if (!selectedStoreId) {
      toast({
        title: "Store Required",
        description: "Please select a store for delivery",
        variant: "destructive",
      });
      return;
    }
    
    // Handle GunBroker marketplace orders differently
    const isGunBroker = orderDetails.vendor.name === 'GunBroker';
    const gunBrokerItemId = isGunBroker ? orderDetails.vendorProduct.sku : undefined;
    
    // Calculate the actual retail price using the same logic as the price display
    let calculatedRetailPrice = 0;
    if (manualPriceMode) {
      calculatedRetailPrice = parseFloat(manualPrice || '0');
    } else {
      // Use the same pricing calculation logic
      const defaultPricingConfig = pricingConfigurations?.find((config: any) => config.isDefault);
      if (defaultPricingConfig && orderDetails.vendorProduct.cost) {
        try {
          const cost = parseFloat(orderDetails.vendorProduct.cost.toString().replace('$', ''));
          const msrp = orderDetails.vendorProduct.msrp ? parseFloat(orderDetails.vendorProduct.msrp.toString().replace('$', '')) : undefined;
          const mapPrice = orderDetails.vendorProduct.map ? parseFloat(orderDetails.vendorProduct.map.toString().replace('$', '')) : undefined;
          
          // Cross-vendor fallback logic
          let effectiveMsrp = msrp;
          let effectiveMapPrice = mapPrice;
          
          const extractPrice = (vendor: any, priceField: string): number | null => {
            try {
              if (!vendor || typeof vendor !== 'object') return null;
              const priceValue = vendor[priceField];
              if (priceValue === null || priceValue === undefined || priceValue === 'N/A' || priceValue === '') return null;
              const priceString = String(priceValue).replace(/[$,\s]/g, '');
              const parsedPrice = parseFloat(priceString);
              return (!isNaN(parsedPrice) && parsedPrice > 0) ? parsedPrice : null;
            } catch (error) {
              return null;
            }
          };
          
          if (defaultPricingConfig?.useCrossVendorFallback && defaultPricingConfig.strategy === 'msrp' && !effectiveMsrp) {
            try {
              const otherVendors = Array.isArray(vendorComparison?.vendors) ? vendorComparison.vendors : [];
              const availableMsrps = otherVendors
                .map(vendor => extractPrice(vendor, 'msrp'))
                .filter((price): price is number => price !== null);
              
              if (availableMsrps.length > 0) {
                effectiveMsrp = Math.max(...availableMsrps);
              }
            } catch (error) {
              console.warn('Error in cross-vendor MSRP fallback for order:', error);
            }
          }
          
          if (defaultPricingConfig?.useCrossVendorFallback && defaultPricingConfig.strategy === 'map' && !effectiveMapPrice) {
            try {
              const otherVendors = Array.isArray(vendorComparison?.vendors) ? vendorComparison.vendors : [];
              const availableMaps = otherVendors
                .map(vendor => extractPrice(vendor, 'map'))
                .filter((price): price is number => price !== null);
              
              if (availableMaps.length > 0) {
                effectiveMapPrice = Math.max(...availableMaps);
              }
            } catch (error) {
              console.warn('Error in cross-vendor MAP fallback for order:', error);
            }
          }
          
          // Calculate price using same strategy as price display
          switch (defaultPricingConfig.strategy) {
            case 'msrp':
              calculatedRetailPrice = effectiveMsrp || cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
              break;
            case 'map':
              calculatedRetailPrice = effectiveMapPrice || cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
              break;
            case 'percentage_markup':
              if (isGunBroker) {
                calculatedRetailPrice = cost;
              } else {
                calculatedRetailPrice = cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
              }
              break;
            case 'targeted_margin':
              if (isGunBroker) {
                calculatedRetailPrice = cost;
              } else {
                const targetMargin = defaultPricingConfig.targetMarginPercentage || 20;
                calculatedRetailPrice = cost / (1 - targetMargin / 100);
              }
              break;
            case 'premium_over_map':
              if (isGunBroker) {
                calculatedRetailPrice = cost;
              } else if (effectiveMapPrice) {
                calculatedRetailPrice = effectiveMapPrice + (defaultPricingConfig.premiumAmount || 0);
              } else {
                calculatedRetailPrice = cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
              }
              break;
            case 'discount_to_msrp':
              if (isGunBroker) {
                calculatedRetailPrice = cost;
              } else if (effectiveMsrp) {
                calculatedRetailPrice = effectiveMsrp * (1 - (defaultPricingConfig.discountPercentage || 0) / 100);
              } else {
                calculatedRetailPrice = cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
              }
              break;
            default:
              if (isGunBroker) {
                calculatedRetailPrice = cost;
              } else {
                calculatedRetailPrice = cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
              }
          }
        } catch (error) {
          console.warn('Error calculating retail price for order:', error);
          calculatedRetailPrice = parseFloat(orderDetails.vendorProduct.msrp || '0');
        }
      }
    }
    
    const orderData = {
      orderId: selectedOrderId === "new" ? undefined : parseInt(selectedOrderId),
      vendorId: orderDetails.vendor.id,
      productId: parseInt(productId!),
      vendorProductId: isGunBroker ? undefined : orderDetails.vendorProduct.id,
      gunBrokerItemId,
      quantity: orderQuantity,
      unitCost: orderDetails.unitCost,
      storeId: parseInt(selectedStoreId),
      vendorSku: orderDetails.vendorProduct.sku, // Add vendor SKU from the real-time API result
      vendorMsrp: orderDetails.vendorProduct.msrp, // Add MSRP from vendor API response
      vendorMapPrice: orderDetails.vendorProduct.map, // Add MAP from vendor API response
      priceOnPO: calculatedRetailPrice, // Use the actual calculated price from pricing rules
      category: effectiveCategory // Include selected category for webhook and CSV export
    };
    
    addItemToOrderMutation.mutate(orderData);
  };

  const getAvailabilityIcon = (availability: string) => {
    switch (availability) {
      case 'in_stock':
        return <Check className="h-4 w-4 mr-1" />;
      case 'low_stock':
        return <Clock className="h-4 w-4 mr-1" />;
      case 'out_of_stock':
        return <X className="h-4 w-4 mr-1" />;
      case 'not_available':
        return <Minus className="h-4 w-4 mr-1" />;
      default:
        return null;
    }
  };

  const getAvailabilityText = (availability: string, stock: number) => {
    switch (availability) {
      case 'in_stock':
        return `${stock} In Stock`;
      case 'low_stock':
        return `${stock} Available`;
      case 'out_of_stock':
        return 'Out of Stock';
      case 'not_available':
        return 'Not Carried';
      case 'config_required':
        return 'Config Required';
      case 'disabled':
        return 'Disabled';
      case 'api_error':
        return 'API Error';
      case 'auth_required':
        return 'Auth Required';
      case 'network_error':
        return 'Network Error';
      case 'timeout':
        return 'Timeout';
      default:
        return 'Unknown';
    }
  };

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'in_stock':
        return 'text-green-600';
      case 'low_stock':
        return 'text-yellow-600';
      case 'out_of_stock':
        return 'text-red-600';
      case 'config_required':
        return 'text-blue-600';
      case 'disabled':
        return 'text-gray-500';
      case 'api_error':
      case 'auth_required':
      case 'network_error':
      case 'timeout':
        return 'text-red-500';
      default:
        return 'text-gray-600';
    }
  };

  const getVendorLogo = (vendor: any) => {
    if (!vendor) return <Building2 className="h-6 w-6" />;
    
    // Check if vendor has a logo URL from the API response
    if (vendor.logoUrl) {
      return (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center justify-center w-20 h-12 rounded border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50 dark:bg-gray-800">
            <img 
              src={vendor.logoUrl} 
              alt={`${vendor.name} logo`}
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{vendor.name}</span>
        </div>
      );
    }
    
    // Show vendor name with icon/initials
    const initials = vendor.name?.split(' ').map((word: string) => word[0]).join('').slice(0, 2).toUpperCase() || vendor.vendorShortCode?.slice(0, 2).toUpperCase() || '?';
    const bgColor = 'bg-gray-100 dark:bg-gray-800';
    const textColor = 'text-gray-600 dark:text-gray-400';
    
    return (
      <div className="flex flex-col items-center gap-1">
        <div className={`flex items-center justify-center w-20 h-12 rounded border border-gray-200 dark:border-gray-600 ${bgColor}`}>
          <span className={`text-sm font-bold ${textColor}`}>{initials}</span>
        </div>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center">{vendor.name || vendor.vendorShortCode}</span>
      </div>
    );
  };


  // Helper function to remove HTML tags from text
  const stripHtmlTags = (html: string) => {
    if (!html) return '';
    // Remove HTML tags and decode common entities
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&amp;/g, '&')  // Replace &amp; with &
      .replace(/&lt;/g, '<')   // Replace &lt; with <
      .replace(/&gt;/g, '>')   // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'")  // Replace &#39; with '
      .trim(); // Remove leading and trailing whitespace
  };

  const sortedVendors = vendorComparison?.vendors?.sort((a: any, b: any) => {
    // First priority: In stock items come before out of stock items
    const isInStockA = a.availability === 'in_stock';
    const isInStockB = b.availability === 'in_stock';
    
    if (isInStockA && !isInStockB) {
      return -1; // a (in stock) comes before b (out of stock)
    }
    if (!isInStockA && isInStockB) {
      return 1; // b (in stock) comes before a (out of stock)
    }
    
    // Second priority: Within each stock status group, sort by lowest cost first
    // Handle both formats: "$123.45" and "123.45", plus null values
    const costA = parseFloat(a.cost === 'N/A' || a.cost === null || a.cost === undefined ? '999999' : String(a.cost).replace('$', ''));
    const costB = parseFloat(b.cost === 'N/A' || b.cost === null || b.cost === undefined ? '999999' : String(b.cost).replace('$', ''));
    return costA - costB;
  });

  // Find the lowest cost among all vendors
  const lowestCost = sortedVendors?.reduce((min: number, vendor: any) => {
    if (vendor.cost === 'N/A' || vendor.cost === null || vendor.cost === undefined) return min;
    const cost = parseFloat(String(vendor.cost).replace('$', ''));
    return cost < min ? cost : min;
  }, Infinity);

  if (!productId) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
          <Button onClick={() => setLocation(`/org/${orgSlug}/search`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Search
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={() => setLocation(`/org/${orgSlug}/search`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Search
          </Button>
        </div>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Retrieving vendor price and available stock...</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.log('VENDOR COMPARISON: Error occurred:', error);
    return (
      <div className="p-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={() => setLocation(`/org/${orgSlug}/search`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Search
          </Button>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Vendor Data</h1>
          <p className="text-gray-600 mb-4">Error: {error.message}</p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!vendorComparison) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={() => setLocation(`/org/${orgSlug}/search`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Search
          </Button>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Vendor Data Found</h1>
          <p className="text-gray-600">Unable to load vendor comparison for this product.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Admin Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vendor Comparison</h1>
          <p className="text-muted-foreground">Compare product pricing and availability across vendors</p>
        </div>
      </div>

      {/* Header with Back Button */}
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => setLocation(`/org/${orgSlug}/search`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Search
        </Button>
      </div>

      {/* Product Information */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row items-start space-y-4 lg:space-y-0 lg:space-x-6">
            {/* Product Image */}
            <div className="flex-shrink-0 w-full lg:w-auto">
              {vendorComparison.product?.imageUrl ? (
                <div className="w-full max-w-sm lg:w-64 lg:h-64 border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 mx-auto lg:mx-0">
                  <img 
                    src={vendorComparison.product.imageUrl} 
                    alt={vendorComparison.product.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-full max-w-sm lg:w-64 lg:h-64 border-2 border-gray-200 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 mx-auto lg:mx-0">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📦</div>
                    <div className="text-sm">No Image Available</div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Product Details */}
            <div className="flex-1 w-full">
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                {vendorComparison.product?.name}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">UPC:</span> {vendorComparison.product?.upc}
                </div>
                <div>
                  <span className="font-medium">Brand:</span> {stripHtmlTags(vendorComparison.product?.brand || '')}
                </div>
                <div>
                  <span className="font-medium">Model:</span> {vendorComparison.product?.model}
                </div>
                <div>
                  <span className="font-medium">Part #:</span> {vendorComparison.product?.manufacturerPartNumber}
                </div>
                {vendorComparison.product?.caliber && (
                  <div>
                    <span className="font-medium">Caliber:</span> {vendorComparison.product.caliber}
                  </div>
                )}
                {vendorComparison.product?.weight && (
                  <div>
                    <span className="font-medium">Weight:</span> {vendorComparison.product.weight} lbs
                  </div>
                )}
              </div>
              
              {vendorComparison.product?.description && (
                <p className="mt-4 text-sm text-gray-600 leading-relaxed">
                  {stripHtmlTags(vendorComparison.product.description)}
                </p>
              )}
              
              {/* Firearms Compliance Badges */}
              {(vendorComparison.product?.fflRequired || vendorComparison.product?.serialized || vendorComparison.product?.allocated) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {vendorComparison.product?.fflRequired && (
                    <Badge variant="destructive" className="text-xs">
                      FFL Required
                    </Badge>
                  )}
                  {vendorComparison.product?.serialized && (
                    <Badge variant="secondary" className="text-xs">
                      Serialized Item
                    </Badge>
                  )}
                  {vendorComparison.product?.allocated && (
                    <Badge variant="outline" className="text-xs">
                      Allocation Item
                    </Badge>
                  )}
                </div>
              )}
              
              {/* Pricing Information */}
              {(vendorComparison.product?.mapPrice || vendorComparison.product?.retailPrice) && (
                <div className="mt-4 text-sm text-gray-600">
                  {vendorComparison.product?.mapPrice && (
                    <div>
                      <span className="font-medium">MAP Price:</span> ${parseFloat(vendorComparison.product.mapPrice).toFixed(2)}
                    </div>
                  )}
                  {vendorComparison.product?.retailPrice && (
                    <div>
                      <span className="font-medium">Retail Price:</span> ${parseFloat(vendorComparison.product.retailPrice).toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendor Comparison Table */}
      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Vendor SKU</TableHead>
                  <TableHead>MSRP</TableHead>
                  <TableHead>MAP</TableHead>
                  <TableHead>Vendor Cost</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVendors?.map((vendor: any) => {
                  return (
                    <TableRow key={vendor.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getVendorLogo(vendor.vendor)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{vendor.sku}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {vendor.msrp ? `$${parseFloat(vendor.msrp).toFixed(2)}` : '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {vendor.map ? `$${parseFloat(vendor.map).toFixed(2)}` : '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">
                            {vendor.cost === 'N/A' || vendor.cost === null || vendor.cost === undefined ? '-' : `$${parseFloat(String(vendor.cost).replace('$', '')).toFixed(2)}`}
                          </div>
                          {vendor.cost !== 'N/A' && vendor.cost !== null && vendor.cost !== undefined && parseFloat(String(vendor.cost).replace('$', '')) === lowestCost && (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center text-sm ${getAvailabilityColor(vendor.availability)}`} title={vendor.apiMessage || ''}>
                          {getAvailabilityIcon(vendor.availability)}
                          <span className="cursor-help">{getAvailabilityText(vendor.availability, vendor.stock || 0)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {vendor.vendor?.name === 'GunBroker' ? (
                          <Badge variant="outline" className="text-xs">
                            Pricing Only
                          </Badge>
                        ) : vendor.availability === 'in_stock' ? (
                          <Button 
                            size="sm" 
                            disabled={addItemToOrderMutation.isPending}
                            className="flex items-center"
                            onClick={() => handleCreateOrder(vendor)}
                          >
                            <ShoppingCart className="h-4 w-4 mr-1" />
                            {addItemToOrderMutation.isPending ? 'Creating...' : 'Order'}
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {(!sortedVendors || sortedVendors.length === 0) && (
            <div className="text-center py-8">
              <p className="text-gray-500">No vendor data available for this product.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Confirmation Modal */}
      <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Add to Order</DialogTitle>
          </DialogHeader>
          {orderDetails && (
            <>
              {/* Product Name spanning full width */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900" data-testid="text-product-name">
                  {orderDetails.product.name}
                </h2>
              </div>
              
              <div className="grid grid-cols-3 gap-6">
                {/* Left Column - Product Image & Details Only */}
                <div className="space-y-4">
                  {/* Product Image */}
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-center">
                      <img
                        src={orderDetails.product.imageUrl || '/api/placeholder/200/150'}
                        alt={orderDetails.product.name}
                        className="w-full max-w-[200px] h-40 object-contain rounded border shadow-sm"
                        data-testid="img-product"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (target.src !== '/api/placeholder/200/150') {
                            target.src = '/api/placeholder/200/150';
                          }
                        }}
                      />
                    </div>
                    
                    {/* Product Details */}
                    <div className="mt-4 space-y-2">
                      <div className="text-sm">
                        <span className="font-medium text-gray-700">UPC:</span>
                        <span className="ml-2 text-gray-600" data-testid="text-upc">{orderDetails.product.upc}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-700">Model:</span>
                        <span className="ml-2 text-gray-600" data-testid="text-model">{orderDetails.product.model}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-700">Part #:</span>
                        <span className="ml-2 text-gray-600" data-testid="text-part-number">{orderDetails.product.manufacturerPartNumber}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-700">SKU:</span>
                        <span className="ml-2 text-gray-600" data-testid="text-sku">{orderDetails.vendorProduct.sku}</span>
                      </div>
                      {orderDetails.product.brand && (
                        <div className="text-sm">
                          <span className="font-medium text-gray-700">Brand:</span>
                          <span className="ml-2 text-gray-600" data-testid="text-brand">{stripHtmlTags(orderDetails.product.brand || '')}</span>
                        </div>
                      )}
                    </div>
                  </div>
              </div>

              {/* Center Column - Vendor, Category, Price and Cost */}
              <div className="space-y-4">
                {/* Vendor Tile */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Vendor</Label>
                      <div className="text-lg font-semibold text-gray-900" data-testid="text-vendor-name">
                        {orderDetails.vendor.vendorShortCode || orderDetails.vendor.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <Label className="text-sm font-medium text-gray-700">Vendor Stock</Label>
                      <div className="text-lg font-semibold" data-testid="text-vendor-stock">
                        {orderDetails.vendorProduct.stock?.toLocaleString() || 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Category Tile */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Category{requireCategory && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger className={`w-full ${requireCategory && !selectedCategory ? 'border-red-500' : ''}`} data-testid="select-category">
                      <SelectValue placeholder={requireCategory ? "Category required - Select one..." : "Select category..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {productCategories && productCategories.length > 0 ? (
                        productCategories
                          .filter((cat: any) => cat.isActive !== false)
                          .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
                          .map((category: any) => (
                            <SelectItem key={category.slug} value={category.slug}>
                              {category.displayName}
                            </SelectItem>
                          ))
                      ) : (
                        <SelectItem value="no-categories" disabled>
                          No categories available - Add categories in Store Settings
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  
                  {/* Display product's category from Master Catalog as reference */}
                  {orderDetails.product.category && (
                    <p className="text-xs text-gray-600 mt-1 italic">
                      Vendor Category: <span className="font-medium">{orderDetails.product.category}</span>
                    </p>
                  )}
                </div>
                
                {/* Price Section */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center gap-4 mb-3">
                    <h3 className="text-lg font-semibold">Price</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">MSRP</span> {orderDetails.vendorProduct.msrp ? `$${orderDetails.vendorProduct.msrp}` : 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">MAP</span> {orderDetails.vendorProduct.map ? `$${orderDetails.vendorProduct.map}` : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <Label className="text-sm font-medium">Price (1)</Label>
                      {!manualPriceMode ? (
                        <div className="text-lg font-semibold text-green-600">
                          {(() => {
                            // Check if this is GunBroker - they may have special pricing logic but should still respect pricing strategy
                            const isGunBroker = orderDetails.vendor.name.includes('GunBroker');
                            
                            // Apply pricing rules to calculate retail price
                            const defaultPricingConfig = pricingConfigurations?.find((config: any) => config.isDefault);
                            if (defaultPricingConfig && orderDetails.vendorProduct.cost) {
                              try {
                                const cost = parseFloat(orderDetails.vendorProduct.cost.toString().replace('$', ''));
                                const msrp = orderDetails.vendorProduct.msrp ? parseFloat(orderDetails.vendorProduct.msrp.toString().replace('$', '')) : undefined;
                                const mapPrice = orderDetails.vendorProduct.map ? parseFloat(orderDetails.vendorProduct.map.toString().replace('$', '')) : undefined;
                                
                                // Cross-vendor MSRP fallback logic
                                let effectiveMsrp = msrp;
                                let effectiveMapPrice = mapPrice;
                                
                                // Helper function to safely extract and parse price values
                                const extractPrice = (vendor: any, priceField: string): number | null => {
                                  try {
                                    if (!vendor || typeof vendor !== 'object') return null;
                                    
                                    const priceValue = vendor[priceField];
                                    if (priceValue === null || priceValue === undefined || priceValue === 'N/A' || priceValue === '') return null;
                                    
                                    const priceString = String(priceValue).replace(/[$,\s]/g, '');
                                    const parsedPrice = parseFloat(priceString);
                                    
                                    return (!isNaN(parsedPrice) && parsedPrice > 0) ? parsedPrice : null;
                                  } catch (error) {
                                    console.warn(`Error parsing ${priceField} from vendor:`, error);
                                    return null;
                                  }
                                };
                                
                                if (defaultPricingConfig?.useCrossVendorFallback && defaultPricingConfig.strategy === 'msrp' && !effectiveMsrp) {
                                  try {
                                    const otherVendors = Array.isArray(vendorComparison?.vendors) ? vendorComparison.vendors : [];
                                    const availableMsrps = otherVendors
                                      .map(vendor => extractPrice(vendor, 'msrp'))
                                      .filter((price): price is number => price !== null);
                                    
                                    if (availableMsrps.length > 0) {
                                      effectiveMsrp = Math.max(...availableMsrps);
                                    }
                                  } catch (error) {
                                    console.warn('Error in cross-vendor MSRP fallback:', error);
                                  }
                                }
                                
                                if (defaultPricingConfig?.useCrossVendorFallback && defaultPricingConfig.strategy === 'map' && !effectiveMapPrice) {
                                  try {
                                    const otherVendors = Array.isArray(vendorComparison?.vendors) ? vendorComparison.vendors : [];
                                    const availableMaps = otherVendors
                                      .map(vendor => extractPrice(vendor, 'map'))
                                      .filter((price): price is number => price !== null);
                                    
                                    if (availableMaps.length > 0) {
                                      effectiveMapPrice = Math.max(...availableMaps);
                                    }
                                  } catch (error) {
                                    console.warn('Error in cross-vendor MAP fallback:', error);
                                  }
                                }
                                
                                
                                // Apply pricing strategy
                                let calculatedPrice = null;
                                
                                switch (defaultPricingConfig.strategy) {
                                  case 'msrp':
                                    // For MSRP strategy, use cross-vendor MSRP fallback for all vendors including GunBroker
                                    calculatedPrice = effectiveMsrp || cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
                                    break;
                                  case 'map':
                                    calculatedPrice = effectiveMapPrice || cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
                                    break;
                                  case 'percentage_markup':
                                    // For non-MSRP strategies, GunBroker uses marketplace price (cost) as selling price
                                    if (isGunBroker) {
                                      calculatedPrice = cost;
                                    } else {
                                      calculatedPrice = cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
                                    }
                                    break;
                                  case 'targeted_margin':
                                    if (isGunBroker) {
                                      calculatedPrice = cost;
                                    } else {
                                      const targetMargin = defaultPricingConfig.targetMarginPercentage || 20;
                                      calculatedPrice = cost / (1 - targetMargin / 100);
                                    }
                                    break;
                                  case 'premium_over_map':
                                    if (isGunBroker) {
                                      calculatedPrice = cost;
                                    } else if (effectiveMapPrice) {
                                      calculatedPrice = effectiveMapPrice + (defaultPricingConfig.premiumAmount || 0);
                                    } else {
                                      calculatedPrice = cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
                                    }
                                    break;
                                  case 'discount_to_msrp':
                                    if (isGunBroker) {
                                      calculatedPrice = cost;
                                    } else if (effectiveMsrp) {
                                      calculatedPrice = effectiveMsrp * (1 - (defaultPricingConfig.discountPercentage || 0) / 100);
                                    } else {
                                      calculatedPrice = cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
                                    }
                                    break;
                                  default:
                                    if (isGunBroker) {
                                      calculatedPrice = cost;
                                    } else {
                                      calculatedPrice = cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
                                    }
                                }
                                
                                if (calculatedPrice && calculatedPrice > 0) {
                                  return `$${calculatedPrice.toFixed(2)}`;
                                }
                              } catch (error) {
                                console.warn('Error calculating retail price:', error);
                              }
                            }
                            
                            // Fallback to MSRP if available
                            if (orderDetails.vendorProduct.msrp) {
                              return `$${orderDetails.vendorProduct.msrp}`;
                            }
                            
                            return 'Price Rules Required';
                          })()}
                        </div>
                      ) : (
                        <div className="text-lg font-semibold text-green-600">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={manualPrice}
                            placeholder="0.00"
                            onChange={(e) => {
                              setManualPrice(e.target.value);
                              // Recalculate gross margin when price changes
                              if (e.target.value && orderDetails.unitCost !== 'N/A' && orderDetails.unitCost !== null && orderDetails.unitCost !== undefined) {
                                const cost = parseFloat(String(orderDetails.unitCost).replace('$', ''));
                                const price = parseFloat(e.target.value);
                                if (!isNaN(cost) && !isNaN(price) && price > 0) {
                                  // Calculate margin: Margin = ((Price - Cost) / Price) * 100
                                  const margin = ((price - cost) / price * 100);
                                  setManualGrossMargin(margin.toFixed(1));
                                }
                              }
                            }}
                            className="w-24 text-lg font-semibold text-green-600 border-green-300"
                            data-testid="input-manual-price"
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <Label className="text-sm font-medium">Gross Margin</Label>
                      {!manualPriceMode ? (
                        <div className="text-lg font-semibold text-green-600">
                          {(() => {
                            const isGunBroker = orderDetails.vendor.name.includes('GunBroker');
                            
                            // Use the same pricing logic as the price calculation to get the effective price
                            const defaultPricingConfig = pricingConfigurations?.find((config: any) => config.isDefault);
                            if (defaultPricingConfig && orderDetails.vendorProduct.cost && orderDetails.unitCost !== 'N/A' && orderDetails.unitCost !== null && orderDetails.unitCost !== undefined) {
                              try {
                                const cost = parseFloat(orderDetails.vendorProduct.cost.toString().replace('$', ''));
                                const unitCost = parseFloat(String(orderDetails.unitCost).replace('$', ''));
                                const msrp = orderDetails.vendorProduct.msrp ? parseFloat(orderDetails.vendorProduct.msrp.toString().replace('$', '')) : undefined;
                                const mapPrice = orderDetails.vendorProduct.map ? parseFloat(orderDetails.vendorProduct.map.toString().replace('$', '')) : undefined;
                                
                                // Cross-vendor fallback logic (same as price calculation)
                                let effectiveMsrp = msrp;
                                let effectiveMapPrice = mapPrice;
                                
                                const extractPrice = (vendor: any, priceField: string): number | null => {
                                  try {
                                    if (!vendor || typeof vendor !== 'object') return null;
                                    const priceValue = vendor[priceField];
                                    if (priceValue === null || priceValue === undefined || priceValue === 'N/A' || priceValue === '') return null;
                                    const priceString = String(priceValue).replace(/[$,\s]/g, '');
                                    const parsedPrice = parseFloat(priceString);
                                    return (!isNaN(parsedPrice) && parsedPrice > 0) ? parsedPrice : null;
                                  } catch (error) {
                                    return null;
                                  }
                                };
                                
                                if (defaultPricingConfig?.useCrossVendorFallback && defaultPricingConfig.strategy === 'msrp' && !effectiveMsrp) {
                                  try {
                                    const otherVendors = Array.isArray(vendorComparison?.vendors) ? vendorComparison.vendors : [];
                                    const availableMsrps = otherVendors
                                      .map(vendor => extractPrice(vendor, 'msrp'))
                                      .filter((price): price is number => price !== null);
                                    
                                    if (availableMsrps.length > 0) {
                                      effectiveMsrp = Math.max(...availableMsrps);
                                    }
                                  } catch (error) {
                                    // Ignore error for margin calculation
                                  }
                                }
                                
                                if (defaultPricingConfig?.useCrossVendorFallback && defaultPricingConfig.strategy === 'map' && !effectiveMapPrice) {
                                  try {
                                    const otherVendors = Array.isArray(vendorComparison?.vendors) ? vendorComparison.vendors : [];
                                    const availableMaps = otherVendors
                                      .map(vendor => extractPrice(vendor, 'map'))
                                      .filter((price): price is number => price !== null);
                                    
                                    if (availableMaps.length > 0) {
                                      effectiveMapPrice = Math.max(...availableMaps);
                                    }
                                  } catch (error) {
                                    // Ignore error for margin calculation
                                  }
                                }
                                
                                // Calculate price using same strategy as price display
                                let calculatedPrice = null;
                                switch (defaultPricingConfig.strategy) {
                                  case 'msrp':
                                    calculatedPrice = effectiveMsrp || cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
                                    break;
                                  case 'map':
                                    calculatedPrice = effectiveMapPrice || cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
                                    break;
                                  case 'percentage_markup':
                                    if (isGunBroker) {
                                      calculatedPrice = cost;
                                    } else {
                                      calculatedPrice = cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
                                    }
                                    break;
                                  case 'targeted_margin':
                                    if (isGunBroker) {
                                      calculatedPrice = cost;
                                    } else {
                                      const targetMargin = defaultPricingConfig.targetMarginPercentage || 20;
                                      calculatedPrice = cost / (1 - targetMargin / 100);
                                    }
                                    break;
                                  case 'premium_over_map':
                                    if (isGunBroker) {
                                      calculatedPrice = cost;
                                    } else if (effectiveMapPrice) {
                                      calculatedPrice = effectiveMapPrice + (defaultPricingConfig.premiumAmount || 0);
                                    } else {
                                      calculatedPrice = cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
                                    }
                                    break;
                                  case 'discount_to_msrp':
                                    if (isGunBroker) {
                                      calculatedPrice = cost;
                                    } else if (effectiveMsrp) {
                                      calculatedPrice = effectiveMsrp * (1 - (defaultPricingConfig.discountPercentage || 0) / 100);
                                    } else {
                                      calculatedPrice = cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
                                    }
                                    break;
                                  default:
                                    if (isGunBroker) {
                                      calculatedPrice = cost;
                                    } else {
                                      calculatedPrice = cost * (1 + (defaultPricingConfig.markupPercentage || 20) / 100);
                                    }
                                }
                                
                                if (calculatedPrice && calculatedPrice > 0 && !isNaN(unitCost)) {
                                  const margin = ((calculatedPrice - unitCost) / calculatedPrice * 100);
                                  return `${margin.toFixed(0)}%`;
                                }
                              } catch (error) {
                                console.warn('Error calculating margin:', error);
                              }
                            }
                            
                            return 'N/A';
                          })()}
                        </div>
                      ) : (
                        <div className="text-lg font-semibold text-green-600 flex items-center">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            value={manualGrossMargin || ''}
                            placeholder="0"
                            onChange={(e) => {
                              const marginValue = e.target.value;
                              setManualGrossMargin(marginValue);
                              
                              const margin = parseFloat(marginValue);
                              if (!isNaN(margin) && orderDetails.unitCost !== 'N/A' && orderDetails.unitCost !== null && orderDetails.unitCost !== undefined && margin >= 0) {
                                const cost = parseFloat(String(orderDetails.unitCost).replace('$', ''));
                                if (!isNaN(cost)) {
                                  // Calculate price from margin: Price = Cost / (1 - Margin/100)
                                  // For margins >= 100%, this formula still works correctly
                                  const newPrice = cost / (1 - margin / 100);
                                  setManualPrice(newPrice.toFixed(2));
                                }
                              }
                            }}
                            className="w-16 text-center text-lg font-semibold text-green-600 border-green-300"
                            data-testid="input-manual-margin"
                          />
                          <span className="ml-1 text-sm">%</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex items-center">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="manual-price"
                          checked={manualPriceMode}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setManualPriceMode(isChecked);
                            
                            // If unchecking, clear manual price and margin to return to calculated price
                            if (!isChecked) {
                              setManualPrice('');
                              setManualGrossMargin('');
                            }
                          }}
                          className="text-blue-600"
                          data-testid="checkbox-manual-price"
                        />
                        <Label htmlFor="manual-price" className="text-sm font-medium">
                          Manually adjust price
                        </Label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    {(() => {
                      const isGunBroker = orderDetails.vendor.name.includes('GunBroker');
                      const defaultPricingConfig = pricingConfigurations?.find((config: any) => config.isDefault);
                      
                      // Generate dynamic footnote based on how price was calculated
                      if (isGunBroker) {
                        return '1) Price from GunBroker marketplace listing';
                      } else if (defaultPricingConfig && orderDetails.vendorProduct.cost) {
                        // Pricing configuration is available and being used
                        const strategyDisplayNames = {
                          'msrp': 'MSRP',
                          'map': 'MAP',
                          'percentage_markup': `${defaultPricingConfig.markupPercentage || 20}% markup`,
                          'targeted_margin': `${defaultPricingConfig.targetMarginPercentage || 20}% margin`,
                          'premium_over_map': `MAP + $${defaultPricingConfig.premiumAmount || 0}`,
                          'discount_to_msrp': `${defaultPricingConfig.discountPercentage || 0}% off MSRP`
                        };
                        const strategyName = strategyDisplayNames[defaultPricingConfig.strategy as keyof typeof strategyDisplayNames] || defaultPricingConfig.strategy;
                        const configName = defaultPricingConfig.name || 'Default Pricing';
                        return `1) Price calculated using "${configName}" (${strategyName})`;
                      } else if (orderDetails.vendorProduct.msrp) {
                        return '1) Price based on vendor MSRP (fallback)';
                      } else {
                        return '1) Price calculation requires configuration';
                      }
                    })()}
                  </div>
                </div>

                {/* Cost Section */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="text-lg font-semibold mb-3">Cost</h3>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Unit Cost</Label>
                      <div className="text-lg font-semibold text-red-600">
                        ${orderDetails.unitCost ? parseFloat(String(orderDetails.unitCost).replace('$', '')).toFixed(2) : '0.00'}
                      </div>
                    </div>
                    <div className="text-center">
                      <Label className="text-sm font-medium">Quantity</Label>
                      <Input
                        type="number"
                        value={orderQuantity}
                        onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)}
                        min="1"
                        className="w-20 mx-auto"
                        data-testid="input-quantity"
                      />
                    </div>
                    <div className="text-right">
                      <Label className="text-sm font-medium">Total Cost</Label>
                      <div className="text-lg font-semibold text-red-600">
                        ${orderDetails.unitCost ? (parseFloat(String(orderDetails.unitCost).replace('$', '')) * orderQuantity).toFixed(2) : '0.00'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Order Selection Only */}
              <div className="space-y-4">
                {/* Select Order Tile */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <Label className="text-sm font-medium text-gray-700 mb-3 block">Select Order</Label>
                  <RadioGroup value={selectedOrderId} onValueChange={setSelectedOrderId}>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="new" id="new" />
                        <Label htmlFor="new" className="text-sm font-medium">Create New Order</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
                
                {/* Delivery Store Selection - Only shown when creating new order */}
                {selectedOrderId === "new" && (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <Label className="text-sm font-medium text-gray-700 mb-3 block">Delivery Store</Label>
                    <Select 
                      value={selectedStoreId} 
                      onValueChange={setSelectedStoreId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Main Store..." />
                      </SelectTrigger>
                      <SelectContent>
                        {stores?.map((store: any) => (
                          <SelectItem key={store.id} value={store.id.toString()}>
                            {store.name} ({store.shortName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* Existing Draft Orders - Only for non-new orders */}
                {draftOrders && draftOrders.length > 0 && (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <Label className="text-sm font-medium text-gray-700 mb-3 block">Existing Draft Orders for {orderDetails.vendor.vendorShortCode || orderDetails.vendor.name}</Label>
                    <RadioGroup value={selectedOrderId} onValueChange={setSelectedOrderId}>
                      <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="w-8"></TableHead>
                              <TableHead className="text-xs font-medium">Order ID</TableHead>
                              <TableHead className="text-xs font-medium">Date</TableHead>
                              <TableHead className="text-xs font-medium"># Items</TableHead>
                              <TableHead className="text-xs font-medium text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {draftOrders.map((order: any) => (
                              <TableRow key={order.id} className="hover:bg-gray-50">
                                <TableCell className="py-1">
                                  <RadioGroupItem value={order.id.toString()} id={order.id.toString()} />
                                </TableCell>
                                <TableCell className="py-1">
                                  <Label htmlFor={order.id.toString()} className="text-xs font-medium cursor-pointer">
                                    {order.orderNumber}
                                  </Label>
                                </TableCell>
                                <TableCell className="py-1">
                                  <Label htmlFor={order.id.toString()} className="text-xs cursor-pointer">
                                    {(() => {
                                      // Helper function to safely format dates
                                      const formatDate = (dateString: string | null | undefined) => {
                                        if (!dateString) return 'No Date';
                                        try {
                                          const date = new Date(dateString);
                                          return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric'
                                          });
                                        } catch (error) {
                                          return 'Invalid Date';
                                        }
                                      };
                                      return formatDate(order.orderDate || order.createdAt);
                                    })()}
                                  </Label>
                                </TableCell>
                                <TableCell className="py-1">
                                  <Label htmlFor={order.id.toString()} className="text-xs cursor-pointer">
                                    {order.itemCount || 0}
                                  </Label>
                                </TableCell>
                                <TableCell className="py-1 text-right">
                                  <Label htmlFor={order.id.toString()} className="text-xs font-medium cursor-pointer">
                                    ${parseFloat(order.totalAmount || '0').toFixed(2)}
                                  </Label>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </RadioGroup>
                  </div>
                )}
              </div>
            </div>
            </>
          )}
          <DialogFooter className="flex-col items-start gap-3">
            {requireCategory && (
              <p className="text-xs text-gray-500 w-full">
                * Category required. See Company Settings to change.
              </p>
            )}
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" onClick={() => setIsOrderModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveOrder} 
                disabled={
                  addItemToOrderMutation.isPending || 
                  !orgSlug || 
                  (selectedOrderId === "new" && !selectedStoreId)
                }
                className="btn-orange-action"
              >
                {addItemToOrderMutation.isPending ? 'Adding...' : 'Add to Order'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}