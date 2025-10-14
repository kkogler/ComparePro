import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, ArrowRight, ExternalLink, Filter, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight, FilterX } from 'lucide-react';
import { useLocation, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';

interface GunBrokerResult {
  id: number;
  title: string;
  currentPrice: number;
  buyNowPrice?: number;
  seller: string;
  timeLeft: string;
  condition: string;
  pictureCount: number;
}

interface Product {
  id: number;
  name: string;
  upc: string;
  brand: string;
  model: string;
  vendorSkus?: { vendorName: string; sku: string; }[];
  gunBrokerResults?: GunBrokerResult[];
}



export default function ProductSearch(): JSX.Element {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);

  const [searchPerformed, setSearchPerformed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [caliber, setCaliber] = useState('all');
  const [category, setCategory] = useState('all');
  const [condition, setCondition] = useState('all');
  const [brand, setBrand] = useState('all');

  // Extract organization slug from URL params
  const { slug: orgSlug } = useParams();

  // Get filter options
  const { data: filterOptions = {} } = useQuery({
    queryKey: [`/org/${orgSlug}/api/products/filter-options`],
    enabled: !!orgSlug,
  });

  // Get recent search history
  const { data: searchHistory } = useQuery({
    queryKey: [`/org/${orgSlug}/api/search-history`],
    enabled: !!orgSlug,
  });

  // Auto-detect UPC format and adjust search type (8-14 digits to match master catalog)
  const isUPC = /^\d{8,14}$/.test(searchQuery.trim());
  const effectiveSearchType = isUPC && searchType === 'name' ? 'upc' : searchType;

  // API search query
  const searchParams = new URLSearchParams();
  if (searchQuery) searchParams.set('query', searchQuery);
  if (effectiveSearchType) searchParams.set('type', effectiveSearchType);
  if (caliber && caliber !== 'all') searchParams.set('caliber', caliber);
  if (category && category !== 'all') searchParams.set('category', category);
  if (condition && condition !== 'all') searchParams.set('condition', condition);
  if (brand && brand !== 'all') searchParams.set('brand', brand);
  searchParams.set('page', currentPage.toString());
  searchParams.set('limit', '100');
  
  const { data: searchResponse, isLoading, error } = useQuery({
    queryKey: [`/org/${orgSlug}/api/products/search?${searchParams.toString()}`],
    enabled: !!searchQuery.trim() && !!orgSlug,
  });

  // Extract products and pagination data from response
  const searchResults = (searchResponse as any)?.products || [];
  const totalCount = (searchResponse as any)?.totalCount || 0;
  const totalPages = (searchResponse as any)?.totalPages || 0;
  const hasNextPage = (searchResponse as any)?.hasNextPage || false;
  const hasPrevPage = (searchResponse as any)?.hasPrevPage || false;



  const handleSearch = () => {
    setSearchPerformed(true);
    setCurrentPage(1); // Reset to first page on new search
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSearchHistoryClick = (historyItem: any) => {
    setSearchQuery(historyItem.searchQuery);
    setSearchType(historyItem.searchType);
    setCurrentPage(1); // Reset to first page
    setSearchPerformed(true);
  };

  // State to track if we're redirecting to comparison
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Auto-redirect to comparison page if there's exactly one search result
  useEffect(() => {
    if (searchPerformed && searchResults && searchResults.length === 1 && !isLoading && !error) {
      const singleProduct = searchResults[0];
      // Set redirecting state and redirect immediately
      setIsRedirecting(true);
      setLocation(`/org/${orgSlug}/compare?productId=${singleProduct.id}`);
    }
  }, [searchResults, searchPerformed, isLoading, error, setLocation, orgSlug]);

  const clearFilters = () => {
    setCaliber('all');
    setCategory('all');
    setCondition('all');
    setBrand('all');
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchPerformed(false);
    setCurrentPage(1);
  };

  const hasActiveFilters = caliber !== 'all' || category !== 'all' || brand !== 'all' || ((filterOptions as any)?.conditions?.length > 0 && condition !== 'all');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Product Search</h1>
          <p className="text-muted-foreground">Search and compare products across vendors</p>
        </div>
      </div>

      {/* Enhanced Search Form */}
      <Card className="border-2 border-gray-200 dark:border-gray-700 shadow-lg">
        <CardContent className="p-8">
          <div className="space-y-8">
            {/* Filters Button - Moved to top */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-6">
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="default"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-2"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                      Active
                    </Badge>
                  )}
                  {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
                
                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="default"
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground px-4 py-2"
                  >
                    <X className="w-3 h-3" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>

            {/* Filter Options */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-muted/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <label className="text-sm font-medium mb-3 block">Manufacturer/Brand</label>
                  <Select value={brand} onValueChange={setBrand}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Brands" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {(filterOptions as any)?.brands?.map((brandName: string) => (
                        <SelectItem key={brandName} value={brandName}>{brandName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-3 block">Caliber</label>
                  <Select value={caliber} onValueChange={setCaliber}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Calibers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Calibers</SelectItem>
                      {(filterOptions as any)?.calibers?.map((cal: string) => (
                        <SelectItem key={cal} value={cal}>{cal}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-3 block">Category</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {(filterOptions as any)?.categories?.map((cat: string) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {(filterOptions as any)?.conditions?.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-3 block">Condition</label>
                    <Select value={condition} onValueChange={setCondition}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Conditions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Conditions</SelectItem>
                        {(filterOptions as any)?.conditions?.map((cond: string) => (
                          <SelectItem key={cond} value={cond}>{cond}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-8">
              <div className="relative">
                <div className="flex gap-3 items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Enter product name, UPC, or part number"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="w-full pl-12 pr-4 py-7 text-lg font-medium border-[3px] border-gray-500 dark:border-gray-500 focus:border-blue-500 dark:focus:border-blue-400 rounded-lg shadow-sm"
                      data-testid="input-search-query"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="default"
                    onClick={clearSearch}
                    className="py-7 px-4 bg-gray-400 dark:bg-gray-600 hover:bg-gray-500 dark:hover:bg-gray-500 text-white rounded-lg border-[3px] border-gray-400 dark:border-gray-600"
                    data-testid="button-clear-search"
                  >
                    <FilterX className="w-5 h-5" />
                  </Button>
                  <Button onClick={handleSearch} className="btn-orange-action py-7 px-8 text-xl font-semibold shadow-lg hover:shadow-xl transition-shadow" disabled={isLoading} data-testid="button-search">
                    <Search className="w-6 h-6 mr-2" />
                    {isLoading ? 'Searching...' : 'Search'}
                  </Button>
                </div>
                {isUPC && searchType === 'name' && (
                  <div className="absolute -bottom-6 left-0 text-sm text-blue-600 dark:text-blue-400 font-medium">
                    Auto-detected UPC format
                  </div>
                )}
              </div>
              
              {/* Search Type Radio Buttons */}
              <div className="space-y-4">
                <Label className="text-base font-semibold text-gray-700 dark:text-gray-300">Search by:</Label>
                <RadioGroup 
                  value={searchType} 
                  onValueChange={setSearchType}
                  className="flex flex-col sm:flex-row gap-8"
                  data-testid="radio-group-search-type"
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="name" id="search-name" data-testid="radio-search-name" className="h-5 w-5" />
                    <Label htmlFor="search-name" className="text-base cursor-pointer font-medium">Product Name</Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="upc" id="search-upc" data-testid="radio-search-upc" className="h-5 w-5" />
                    <Label htmlFor="search-upc" className="text-base cursor-pointer font-medium">UPC</Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="manufacturerPartNumber" id="search-part" data-testid="radio-search-part" className="h-5 w-5" />
                    <Label htmlFor="search-part" className="text-base cursor-pointer font-medium">Manufacturer Part Number</Label>
                  </div>
                </RadioGroup>
              </div>
              
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Searches */}
      {searchHistory && (searchHistory as any[]).length > 0 && !searchQuery.trim() ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Searches</CardTitle>
            <CardDescription>Click on any search to repeat it</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(searchHistory as any[]).slice(0, 10).map((historyItem: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  onClick={() => handleSearchHistoryClick(historyItem)}
                >
                  <div className="flex items-center space-x-3">
                    <Search className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="font-medium">{historyItem.searchQuery}</div>
                      <div className="text-sm text-gray-500">
                        {historyItem.searchType === 'name' ? 'Product Name' : 
                         historyItem.searchType === 'upc' ? 'UPC' : 
                         historyItem.searchType === 'manufacturerPartNumber' ? 'Manufacturer Part Number' : 'Unknown'}
                        {historyItem.productName && (
                          <span className="ml-2">• Found: {historyItem.productName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(historyItem.searchedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Search Results */}
      {isLoading ? (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-center">
              <Search className="w-6 h-6 animate-spin mr-2" />
              Searching products across all vendors...
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Redirecting State */}
      {isRedirecting ? (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-center text-blue-600">
              <Search className="w-6 h-6 animate-spin mr-2" />
              Finding product record...
            </div>
          </CardContent>
        </Card>
      ) : null}

      {(searchResults as any[]).length > 0 && !isRedirecting ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>
                {searchResults.length === 1 ? (
                  <div className="flex items-center text-blue-600">
                    <ArrowRight className="w-4 h-4 mr-2 animate-pulse" />
                    Exact match found! Redirecting to price comparison...
                  </div>
                ) : (
                  <>
                    Showing {searchResults.length} of {totalCount.toLocaleString()} products found
                    {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
                  </>
                )}
              </CardDescription>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={!hasPrevPage}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!hasNextPage}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>UPC</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Model</TableHead>

                  <TableHead>Compare</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(searchResults as any[]).map((product: any) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="font-medium">{product.name}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{product.upc}</TableCell>
                    <TableCell>{product.brand}</TableCell>
                    <TableCell>{product.model}</TableCell>

                    <TableCell>
                      <Button 
                        size="sm" 
                        onClick={() => setLocation(`/org/${orgSlug}/compare?productId=${product.id}`)}
                        data-testid={`button-compare-${product.id}`}
                      >
                        <ArrowRight className="w-4 h-4 mr-1" />
                        Compare
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Bottom pagination for convenience */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={!hasPrevPage}
                  data-testid="button-prev-page-bottom"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Page {currentPage} of {totalPages} ({totalCount.toLocaleString()} total results)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!hasNextPage}
                  data-testid="button-next-page-bottom"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* No Results - Only show when search is complete (not loading) and no results */}
      {searchQuery.trim() && !isLoading && (searchResults as any[]).length === 0 && !error ? (
        <Card>
          <CardContent className="text-center py-8">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-500">Try adjusting your search criteria or search term.</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Error State */}
      {error ? (
        <Card>
          <CardContent className="text-center py-8">
            <h3 className="text-lg font-medium text-red-600 mb-2">Search Error</h3>
            <p className="text-gray-500">Unable to search products. Please try again.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}