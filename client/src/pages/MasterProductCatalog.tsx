import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Search, 
  Filter, 
  Settings2, 
  Eye, 
  EyeOff,
  Download,
  RefreshCw,
  Image as ImageIcon,
  X,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Edit,
  Save,
  X as Cancel
} from 'lucide-react';

interface Product {
  id: number;
  upc: string;
  name: string;
  brand: string;
  model: string;
  manufacturerPartNumber?: string;
  altId1?: string; // Alternative ID 1 for additional search capability
  altId2?: string; // Alternative ID 2 for additional search capability
  caliber?: string;
  barrelLength?: string;
  category?: string;
  subcategory1?: string;
  subcategory2?: string;
  subcategory3?: string;
  description?: string;
  imageUrl?: string;
  imageSource?: string;
  source?: string;
  retailVertical?: string; // Added retail vertical display name

  serialized: boolean;
  dropShipAvailable: boolean;
  allocated: boolean;

  status?: string;
  createdAt: string;
  updatedAt: string;
}

interface FilterOptions {
  brands: string[];
  categories: string[];
  subcategories1: string[];
  subcategories2: string[];
  subcategories3: string[];
  calibers: string[];
  imageSources: string[];
  sources: string[];
  statuses: string[];
  retailVerticals: Array<{ id: number; name: string }>; // Added retail verticals for filter
}

// Product edit form schema (excluding UPC and system fields)
const productEditSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().optional(),
  manufacturerPartNumber: z.string().optional(),
  altId1: z.string().optional(),
  altId2: z.string().optional(),
  caliber: z.string().optional(),
  barrelLength: z.string().optional(),
  category: z.string().optional(),
  subcategory1: z.string().optional(),
  subcategory2: z.string().optional(),
  subcategory3: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  serialized: z.boolean(),
  dropShipAvailable: z.boolean(),
  allocated: z.boolean(),
  status: z.string().optional(),
});

// Default visible columns
const DEFAULT_COLUMNS = ['name', 'upc', 'brand', 'model', 'manufacturerPartNumber', 'category', 'retailVertical', 'source', 'status', 'hasImage'];

// All available columns
const ALL_COLUMNS = [
  { key: 'name', label: 'Product Name', width: 'w-64' },
  { key: 'upc', label: 'UPC', width: 'w-32' },
  { key: 'brand', label: 'Brand', width: 'w-24' },
  { key: 'model', label: 'Model', width: 'w-32' },
  { key: 'manufacturerPartNumber', label: 'Manufacturer Part Number', width: 'w-40' },
  { key: 'altId1', label: 'Alt ID 1', width: 'w-24' },
  { key: 'altId2', label: 'Alt ID 2', width: 'w-24' },
  { key: 'category', label: 'Category', width: 'w-24' },
  { key: 'subcategory1', label: 'Subcategory 1', width: 'w-28' },
  { key: 'subcategory2', label: 'Subcategory 2', width: 'w-28' },
  { key: 'subcategory3', label: 'Subcategory 3', width: 'w-28' },
  { key: 'caliber', label: 'Caliber', width: 'w-20' },
  { key: 'barrelLength', label: 'Barrel Length', width: 'w-24' },
  { key: 'retailVertical', label: 'Retail Vertical', width: 'w-32' },

  { key: 'serialized', label: 'Serialized', width: 'w-20' },
  { key: 'description', label: 'Description', width: 'w-48' },
  { key: 'source', label: 'Source', width: 'w-28' },
  { key: 'status', label: 'Status', width: 'w-20' },
  { key: 'hasImage', label: 'Image', width: 'w-16' },
  { key: 'imageSource', label: 'Image Source', width: 'w-24' },
  { key: 'createdAt', label: 'Created', width: 'w-24' },
  { key: 'updatedAt', label: 'Updated', width: 'w-24' },
];



export default function MasterProductCatalog() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [brandFilter, setBrandFilter] = useState('__all_brands__');
  const [categoryFilter, setCategoryFilter] = useState('__all_categories__');
  const [imageFilter, setImageFilter] = useState('__all_products__');
  const [modelFilter, setModelFilter] = useState('__all_products__');
  const [imageSourceFilter, setImageSourceFilter] = useState('__all_image_sources__');
  const [sourceFilter, setSourceFilter] = useState('__all_sources__');
  const [statusFilter, setStatusFilter] = useState('__all_statuses__');
  const [retailVerticalFilter, setRetailVerticalFilter] = useState('__all_verticals__');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Export handler function
  const handleExport = async (limit?: number) => {
    try {
      const exportLimit = limit || 10000;
      toast({
        title: "Starting Export",
        description: `Generating CSV export (max ${exportLimit.toLocaleString()} products)...`,
      });

      // Build export URL with current filters
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      
      // Apply same auto-detection logic for export
      let effectiveSearchField = searchField;
      if (searchField === 'all' && searchTerm) {
        if (/^\d{10,14}$/.test(searchTerm.trim())) {
          effectiveSearchField = 'upc';
        } else {
          effectiveSearchField = 'name';
        }
      }
      
      if (effectiveSearchField && effectiveSearchField !== 'all') params.append('searchField', effectiveSearchField);
      if (brandFilter && brandFilter !== '__all_brands__') params.append('brand', brandFilter);
      if (categoryFilter && categoryFilter !== '__all_categories__') params.append('category', categoryFilter);
      if (imageFilter && imageFilter !== '__all_products__') params.append('imageFilter', imageFilter);
      if (modelFilter && modelFilter !== '__all_products__') params.append('modelFilter', modelFilter);
      if (imageSourceFilter && imageSourceFilter !== '__all_image_sources__') params.append('imageSource', imageSourceFilter);
      if (sourceFilter && sourceFilter !== '__all_sources__') params.append('source', sourceFilter);
      if (statusFilter && statusFilter !== '__all_statuses__') params.append('status', statusFilter);
      if (retailVerticalFilter && retailVerticalFilter !== '__all_verticals__') params.append('retailVertical', retailVerticalFilter);
      if (exportLimit !== 10000) params.append('limit', exportLimit.toString());

      // Make authenticated request for CSV export
      const exportUrl = `/api/admin/master-catalog/export?${params.toString()}`;
      
      const response = await fetch(exportUrl, {
        method: 'GET',
        credentials: 'include', // Include session cookies
        headers: {
          'Accept': 'text/csv',
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status} ${response.statusText}`);
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'master-catalog-export.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Convert response to blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      
      // Try multiple methods to trigger download
      try {
        link.click();
      } catch (e) {
        // Fallback: open in new window
        window.open(url, '_blank');
      }
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      toast({
        title: "Export Complete",
        description: `Downloaded ${filename} successfully.`,
      });
    } catch (error: any) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export catalog data",
        variant: "destructive",
      });
    }
  };

  // Form for editing products
  const form = useForm<z.infer<typeof productEditSchema>>({
    resolver: zodResolver(productEditSchema),
    defaultValues: {
      name: '',
      brand: '',
      model: '',
      manufacturerPartNumber: '',
      altId1: '',
      altId2: '',
      caliber: '',
      barrelLength: '',
      category: '',
      subcategory1: '',
      subcategory2: '',
      subcategory3: '',
      description: '',
      imageUrl: '',
      serialized: false,
      dropShipAvailable: false,
      allocated: false,
      status: 'active',
    },
  });



  // Fetch products with filtering and pagination
  const { data: productsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/master-catalog', {
      search: searchTerm,
      searchField,
      brand: brandFilter,
      category: categoryFilter,
      image: imageFilter,
      model: modelFilter,
      imageSource: imageSourceFilter,
      source: sourceFilter,
      status: statusFilter,
      retailVertical: retailVerticalFilter,
      page: currentPage,
      pageSize,
      sortField,
      sortDirection
    }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      
      // Use multi-field search when "all" is selected
      let effectiveSearchField = searchField;
      if (searchField === 'all' && searchTerm) {
        effectiveSearchField = 'multi_id'; // Search across all ID fields with partial matching
      }
      
      if (effectiveSearchField && effectiveSearchField !== 'all') params.append('searchField', effectiveSearchField);
      if (brandFilter) params.append('brand', brandFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (imageFilter) params.append('image', imageFilter);
      if (modelFilter) params.append('model', modelFilter);
      if (imageSourceFilter && imageSourceFilter !== '__all_image_sources__') params.append('imageSource', imageSourceFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (retailVerticalFilter) params.append('retailVertical', retailVerticalFilter);
      if (sortField) params.append('sortField', sortField);
      if (sortDirection) params.append('sortDirection', sortDirection);
      params.append('page', currentPage.toString());
      params.append('pageSize', pageSize.toString());
      
      const response = await fetch(`/api/admin/master-catalog?${params.toString()}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 30000, // 30 seconds
  });

  // Fetch filter options
  const { data: filterOptions } = useQuery<FilterOptions>({
    queryKey: ['/api/admin/master-catalog/filter-options'],
    queryFn: async () => {
      const response = await fetch('/api/admin/master-catalog/filter-options', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 300000, // 5 minutes
  });

  // Phase 1: Fetch retail vertical context for vertical-scoped search
  const { data: verticalContext } = useQuery({
    queryKey: ['/api/retail-verticals'],
    queryFn: async () => {
      const response = await fetch('/api/retail-verticals', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 300000, // 5 minutes
  });

  // Fetch supported vendors for short name mapping
  const { data: supportedVendors } = useQuery({
    queryKey: ['/api/admin/supported-vendors'],
    queryFn: async () => {
      const response = await fetch('/api/admin/supported-vendors', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 300000, // 5 minutes
  });

  const products = productsData?.products || [];
  const totalProducts = productsData?.totalCount || 0;
  const totalPages = Math.ceil(totalProducts / pageSize);

  // Get vendor short name from database - NO hardcoded mappings
  const getVendorShortName = (slugOrName: string): string => {
    if (!supportedVendors) return slugOrName;
    
    // Find matching vendor by slug (preferred) or name (fallback) and return their short code
    const vendor = supportedVendors.find((v: any) => 
      v.vendorSlug === slugOrName || v.name === slugOrName
    );
    return vendor?.vendorShortCode || slugOrName;
  };

  // Get vendor slug from short code - for filter queries
  const getVendorSlugFromShortCode = (shortCode: string): string => {
    if (!supportedVendors) return shortCode;
    
    // Find matching vendor by short code and return their slug
    const vendor = supportedVendors.find((v: any) => 
      v.vendorShortCode === shortCode
    );
    return vendor?.vendorSlug || shortCode;
  };



  // Bulk archive mutation
  const bulkArchiveMutation = useMutation({
    mutationFn: async ({ productIds, status }: { productIds: number[]; status: string }) => {
      return await apiRequest('/api/admin/master-catalog/bulk-archive', 'POST', { productIds, status });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/master-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/master-catalog/filter-options'] });
      setSelectedProducts(new Set());
      setBulkAction('');
      toast({
        title: "Bulk update complete",
        description: `${(data as any).updatedCount || 'Selected'} products updated successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to bulk update products",
        variant: "destructive",
      });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (productIds: number[]) => {
      return await apiRequest('/api/admin/master-catalog/bulk-delete', 'DELETE', { productIds });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/master-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/master-catalog/filter-options'] });
      setSelectedProducts(new Set());
      setBulkAction('');
      setDeleteConfirmOpen(false);
      setDeleteConfirmText('');
      toast({
        title: "Products deleted",
        description: `${(data as any).deletedCount || 'Selected'} products deleted successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete products",
        variant: "destructive",
      });
    },
  });

  // Edit product mutation
  const editMutation = useMutation({
    mutationFn: async ({ productId, updates }: { productId: number; updates: z.infer<typeof productEditSchema> }) => {
      return await apiRequest(`/api/admin/master-catalog/${productId}`, 'PATCH', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/master-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/master-catalog/filter-options'] });
      setEditModalOpen(false);
      setEditingProduct(null);
      form.reset();
      toast({
        title: "Product updated",
        description: "Product updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product",
        variant: "destructive",
      });
    },
  });

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchField, brandFilter, categoryFilter, imageFilter, modelFilter, sourceFilter, statusFilter, retailVerticalFilter]);

  const handleColumnToggle = (columnKey: string) => {
    setVisibleColumns(prev => {
      if (prev.includes(columnKey)) {
        return prev.filter(key => key !== columnKey);
      } else {
        return [...prev, columnKey];
      }
    });
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(products.map((p: Product) => p.id)));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleSelectProduct = (productId: number, checked: boolean) => {
    const newSelection = new Set(selectedProducts);
    if (checked) {
      newSelection.add(productId);
    } else {
      newSelection.delete(productId);
    }
    setSelectedProducts(newSelection);
  };

  const handleBulkAction = () => {
    if (selectedProducts.size === 0 || !bulkAction) return;
    
    const productIds = Array.from(selectedProducts);
    
    if (bulkAction === 'delete') {
      // Show confirmation dialog for delete action
      setDeleteConfirmOpen(true);
      return;
    }
    
    // Handle archive/unarchive actions
    bulkArchiveMutation.mutate({ productIds, status: bulkAction });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmText !== 'DELETE' || selectedProducts.size === 0) return;
    
    const productIds = Array.from(selectedProducts);
    bulkDeleteMutation.mutate(productIds);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    // Populate form with current product data
    form.reset({
      name: product.name || '',
      brand: product.brand || '',
      model: product.model || '',
      manufacturerPartNumber: product.manufacturerPartNumber || '',
      altId1: product.altId1 || '',
      altId2: product.altId2 || '',
      caliber: product.caliber || '',
      barrelLength: product.barrelLength || '',
      category: product.category || '',
      subcategory1: product.subcategory1 || '',
      subcategory2: product.subcategory2 || '',
      subcategory3: product.subcategory3 || '',
      description: product.description || '',
      imageUrl: product.imageUrl || '',
      serialized: product.serialized || false,
      dropShipAvailable: product.dropShipAvailable || false,
      allocated: product.allocated || false,
      status: product.status || 'active',
    });
    setEditModalOpen(true);
  };

  const handleSubmitEdit = (data: z.infer<typeof productEditSchema>) => {
    if (!editingProduct) return;
    editMutation.mutate({ productId: editingProduct.id, updates: data });
  };

  const handleCancelEdit = () => {
    setEditModalOpen(false);
    setEditingProduct(null);
    form.reset();
  };

  const handleImageClick = (imageUrl: string, productName: string) => {
    setSelectedImage({ url: imageUrl, name: productName });
    setImageError(false);
    setImageModalOpen(true);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSearchField('all');
    setBrandFilter('__all_brands__');
    setCategoryFilter('__all_categories__');
    setImageFilter('__all_products__');
    setImageSourceFilter('__all_image_sources__');
    setSourceFilter('__all_sources__');
    setRetailVerticalFilter('__all_verticals__');
    setStatusFilter('__all_statuses__');
    setSortField('');
    setSortDirection('asc');
    setCurrentPage(1);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, start with ascending
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />;
  };

  const renderCellValue = (product: Product, columnKey: string) => {
    switch (columnKey) {
      case 'name':
        return (
          <div className="max-w-64">
            <div className="font-medium truncate">{product.name}</div>
            {product.description && (
              <div className="text-xs text-gray-500 truncate">{product.description}</div>
            )}
          </div>
        );
      case 'hasImage':
        return product.imageUrl ? (
          <Badge 
            variant="secondary" 
            className="text-green-600 cursor-pointer hover:bg-green-100 transition-colors"
            onClick={() => handleImageClick(product.imageUrl!, product.name)}
            title="Click to view image"
          >
            <ImageIcon className="w-3 h-3 mr-1" />
            Yes
          </Badge>
        ) : (
          <Badge variant="outline" className="text-gray-500">No</Badge>
        );
      case 'serialized':
        // Handle null values properly for compliance fields
        if (product[columnKey] === null || product[columnKey] === undefined) {
          return <Badge variant="outline" className="text-gray-400">-</Badge>;
        }
        return product[columnKey] ? (
          <Badge variant="secondary" className="text-green-600">Y</Badge>
        ) : (
          <Badge variant="outline" className="text-red-600">N</Badge>
        );
      case 'dropShipAvailable':
      case 'allocated':
        return product[columnKey] ? (
          <Badge variant="secondary" className="text-green-600">Y</Badge>
        ) : (
          <Badge variant="outline" className="text-gray-500">N</Badge>
        );
      case 'mapPrice':
      case 'retailPrice':
        const price = (product as any)[columnKey];
        return price ? `$${parseFloat(price).toFixed(2)}` : '-';
      case 'barrelLength':
        return product.barrelLength || '-';
      case 'createdAt':
      case 'updatedAt':
        return new Date(product[columnKey]).toLocaleDateString();
      case 'status':
        const status = product.status || 'active';
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {status === 'active' ? 'Active' : 'Inactive'}
            </span>
            <Button
              variant="ghost"
              size="default"
              onClick={() => handleEditProduct(product)}
              className="h-8 px-3"
              title="Edit product"
            >
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        );
      case 'imageSource':
        if (!product.imageSource) {
          return <Badge variant="outline" className="text-gray-400">No Image</Badge>;
        }
        
        const imageSourceDisplayName = getVendorShortName(product.imageSource);
        
        return (
          <Badge 
            variant="secondary"
            className="text-blue-600 bg-blue-50 border-blue-200"
            title={`Image provided by ${imageSourceDisplayName}`}
            data-testid={`image-source-${product.id}`}
          >
            {imageSourceDisplayName}
          </Badge>
        );
      case 'retailVertical':
        return product.retailVertical || '-';
      case 'source':
        return product.source ? getVendorShortName(product.source) : '-';
      case 'model':
        // Critical field for firearms compliance - handle formatting and missing data properly
        const modelValue = product.model?.trim();
        if (!modelValue) {
          return <Badge variant="outline" className="text-red-600 border-red-300">Missing</Badge>;
        }
        return (
          <div className="max-w-32" title={modelValue}>
            <span className="font-medium truncate block">{modelValue}</span>
          </div>
        );
      case 'brand':
      case 'manufacturerPartNumber':
      case 'altId1':
      case 'altId2':
      case 'caliber':
      case 'category':
      case 'subcategory1':
      case 'subcategory2':
      case 'subcategory3':
        // Handle important text fields consistently
        const textValue = product[columnKey as keyof Product]?.toString()?.trim();
        return textValue || '-';
      default:
        return product[columnKey as keyof Product] || '-';
    }
  };

  const activeFiltersCount = [
    searchTerm, 
    brandFilter !== '__all_brands__' ? brandFilter : '', 
    categoryFilter !== '__all_categories__' ? categoryFilter : '', 
    imageFilter !== '__all_products__' ? imageFilter : '',
    modelFilter !== '__all_products__' ? modelFilter : '',
    imageSourceFilter !== '__all_image_sources__' ? imageSourceFilter : '',
    sourceFilter !== '__all_sources__' ? sourceFilter : '',
    statusFilter !== '__all_statuses__' ? statusFilter : '',
    retailVerticalFilter !== '__all_verticals__' ? retailVerticalFilter : ''
  ].filter(Boolean).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Master Product Catalog</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Manage and view all products across all vendor catalogs</span>
            {/* Phase 1: Show retail vertical context */}
            {verticalContext?.currentVertical && (
              <>
                <span className="text-muted-foreground">•</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {verticalContext.currentVertical.name} Vertical
                </Badge>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem onClick={() => handleExport(1000)}>
                Export 1,000 products (Fast)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem onClick={() => handleExport(5000)}>
                Export 5,000 products (Medium)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem onClick={() => handleExport(10000)}>
                Export 10,000 products (Recommended)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem onClick={() => handleExport(25000)}>
                Export 25,000 products (Slow)
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search & Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">{activeFiltersCount} active</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {/* Search */}
            <div className="lg:col-span-2 xl:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Search
              </label>
              <div className="flex gap-2">
                <Select value={searchField} onValueChange={setSearchField}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Fields</SelectItem>
                    <SelectItem value="name">Product Name</SelectItem>
                    <SelectItem value="upc">UPC</SelectItem>
                    <SelectItem value="brand">Brand</SelectItem>
                    <SelectItem value="model">Model</SelectItem>
                    <SelectItem value="manufacturerPartNumber">Manufacturer Part Number</SelectItem>
                    <SelectItem value="altId1">Alt ID 1</SelectItem>
                    <SelectItem value="altId2">Alt ID 2</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Brand Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Brand
              </label>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all_brands__">All Brands</SelectItem>
                  {filterOptions?.brands?.map(brand => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Category
              </label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all_categories__">All Categories</SelectItem>
                  {filterOptions?.categories?.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>



            {/* Image Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Image Status
              </label>
              <Select value={imageFilter} onValueChange={setImageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Image Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all_products__">All Products</SelectItem>
                  <SelectItem value="yes">With Images</SelectItem>
                  <SelectItem value="no">Without Images</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Image Source Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Image Source
              </label>
              <Select value={imageSourceFilter} onValueChange={setImageSourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Image Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all_image_sources__">All Image Sources</SelectItem>
                  {filterOptions?.imageSources?.map(imageSource => (
                    <SelectItem key={imageSource} value={imageSource} data-testid={`filter-image-source-${imageSource.toLowerCase().replace(/\s+/g, '-')}`}>
                      {getVendorShortName(imageSource)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Model Number
              </label>
              <Select value={modelFilter} onValueChange={setModelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Model Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all_products__">All Products</SelectItem>
                  <SelectItem value="yes">Has Model Number</SelectItem>
                  <SelectItem value="no">No Model Number</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Source Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Source
              </label>
              <Select value={sourceFilter} onValueChange={(value) => {
                console.log('SOURCE FILTER CHANGED:', { 
                  newValue: value, 
                  isSlug: value.includes('-'),
                  sources: filterOptions?.sources 
                });
                setSourceFilter(value);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all_sources__">All Sources</SelectItem>
                  {filterOptions?.sources?.map(source => (
                    <SelectItem key={source} value={source}>
                      {getVendorShortName(source)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Product Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Product Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all_statuses__">All Statuses</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="archived">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Retail Vertical Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Retail Vertical
              </label>
              <Select value={retailVerticalFilter} onValueChange={setRetailVerticalFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Retail Verticals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all_verticals__">All Retail Verticals</SelectItem>
                  {filterOptions?.retailVerticals?.map(vertical => (
                    <SelectItem key={vertical.id} value={vertical.id.toString()}>{vertical.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            <div className="lg:col-span-2">
              {activeFiltersCount > 0 && (
                <Button variant="outline" onClick={clearAllFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Clear All Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Products ({totalProducts.toLocaleString()} total)
              {selectedProducts.size > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({selectedProducts.size} selected)
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-4">
              {selectedProducts.size > 0 && (
                <div className="flex items-center gap-2">
                  <Select value={bulkAction} onValueChange={setBulkAction}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Bulk Actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Mark as Active</SelectItem>
                      <SelectItem value="archived">Mark as Inactive</SelectItem>
                      <SelectItem value="delete" className="text-red-600">Delete Selected Products</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleBulkAction}
                    disabled={!bulkAction || bulkArchiveMutation.isPending || bulkDeleteMutation.isPending}
                    size="sm"
                    className={bulkAction === 'delete' ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-orange-action'}
                  >
                    {bulkArchiveMutation.isPending || bulkDeleteMutation.isPending ? 'Processing...' : 'Apply'}
                  </Button>
                </div>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    Columns ({visibleColumns.length})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Show/Hide Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ALL_COLUMNS.map(column => (
                    <DropdownMenuCheckboxItem
                      key={column.key}
                      checked={visibleColumns.includes(column.key)}
                      onCheckedChange={() => handleColumnToggle(column.key)}
                    >
                      {column.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex items-center gap-2">
                <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">per page</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Loading products...
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedProducts.size === products.length && products.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      {ALL_COLUMNS.filter(col => visibleColumns.includes(col.key)).map(column => (
                        <TableHead key={column.key} className={column.width}>
                          {(column.key === 'category' || column.key === 'subcategory1' || column.key === 'subcategory2' || column.key === 'subcategory3' || column.key === 'serialized') ? (
                            <button
                              onClick={() => handleSort(column.key)}
                              className="flex items-center gap-1 hover:text-primary transition-colors text-left"
                              data-testid={`sort-${column.key}`}
                            >
                              {column.label}
                              {getSortIcon(column.key)}
                            </button>
                          ) : (
                            column.label
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product: Product) => (
                      <TableRow key={product.id}>
                        <TableCell className="w-12">
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                          />
                        </TableCell>
                        {ALL_COLUMNS.filter(col => visibleColumns.includes(col.key)).map(column => (
                          <TableCell key={column.key} className={column.width}>
                            {renderCellValue(product, column.key)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalProducts)} of {totalProducts} products
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = currentPage <= 3 
                          ? i + 1 
                          : currentPage >= totalPages - 2 
                            ? totalPages - 4 + i 
                            : currentPage - 2 + i;
                        
                        if (page < 1 || page > totalPages) return null;
                        
                        return (
                          <Button
                            key={page}
                            variant={page === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-8"
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Image Modal */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedImage?.name || 'Product Image'}</DialogTitle>
            <DialogDescription>
              Product image from vendor catalog
            </DialogDescription>
          </DialogHeader>
          {selectedImage && (
            <div className="flex justify-center">
              {!imageError ? (
                <img 
                  src={selectedImage.url} 
                  alt={selectedImage.name}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="text-center text-gray-500 py-8 px-4">
                  <div className="text-lg font-medium mb-2">Image Not Available</div>
                  <div className="text-sm">
                    This image URL appears to be broken or the image has been removed from the vendor's catalog.
                  </div>
                  <div className="text-xs text-gray-400 mt-2 break-all">
                    URL: {selectedImage.url}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Edit product information. UPC cannot be changed.
            </DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmitEdit)} className="space-y-4">
                {/* UPC - Read Only */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">UPC (Read Only)</label>
                    <Input 
                      value={editingProduct.upc} 
                      disabled 
                      className="bg-gray-100 text-gray-500"
                    />
                  </div>
                </div>

                {/* Basic Product Info */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Name *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manufacturerPartNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manufacturer Part Number</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Alt IDs for additional searchability */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="altId1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alt ID 1</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Additional search ID" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="altId2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alt ID 2</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Additional search ID" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Categories */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subcategory1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subcategory 1</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="subcategory2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subcategory 2</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subcategory3"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subcategory 3</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Physical Details */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="caliber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Caliber</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="barrelLength"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Barrel Length</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>



                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Image URL */}
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Boolean Fields */}
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="serialized"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Serialized</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dropShipAvailable"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Drop Ship Available</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allocated"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Allocated</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Status Field */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'active'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="archived">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Form Actions */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={editMutation.isPending}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={editMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {editMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <X className="w-5 h-5" />
              Confirm Bulk Delete
            </DialogTitle>
            <DialogDescription>
              You are about to permanently delete <strong>{selectedProducts.size}</strong> product{selectedProducts.size !== 1 ? 's' : ''} from the master catalog. 
              This action cannot be undone and will remove all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium">⚠️ WARNING</p>
              <p className="text-sm text-red-700 mt-1">
                This will permanently delete {selectedProducts.size} products from your catalog. 
                All product data, pricing history, and associations will be lost forever.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Type <code className="bg-gray-100 px-1 py-0.5 rounded text-red-600 font-mono">DELETE</code> to confirm:
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="font-mono"
                data-testid="delete-confirmation-input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeleteConfirmText('');
                setBulkAction('');
              }}
              disabled={bulkDeleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deleteConfirmText !== 'DELETE' || bulkDeleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="confirm-delete-button"
            >
              {bulkDeleteMutation.isPending ? 'Deleting...' : `Delete ${selectedProducts.size} Products`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}