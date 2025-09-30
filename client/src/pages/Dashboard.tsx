import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Search, Download, ChevronDown, ChevronUp, Settings, Clock, X } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { format, subDays, startOfYear, endOfYear, startOfMonth, endOfMonth, subYears, startOfQuarter, endOfQuarter, subMonths } from "date-fns";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { slug } = useParams();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [recordsPerPage, setRecordsPerPage] = useState("10");

  const handleSearch = () => {
    setActiveSearchTerm(searchTerm);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setActiveSearchTerm("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleOrderClick = (orderId: number) => {
    // Navigate to vendor orders page with order ID to auto-open the order details modal
    setLocation(`/org/${slug}/orders?orderId=${orderId}`);
  };
  
  // Individual optional column states
  const [showVendorSku, setShowVendorSku] = useState(true);
  const [showUpc, setShowUpc] = useState(true);
  const [showModel, setShowModel] = useState(false);
  const [showBrand, setShowBrand] = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const [showSubcategory1, setShowSubcategory1] = useState(false);
  const [showSubcategory2, setShowSubcategory2] = useState(false);
  const [showSubcategory3, setShowSubcategory3] = useState(false);
  
  // Filter states
  const [selectedVendor, setSelectedVendor] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState("all");
  
  // Date range state - default to year to date
  const [startDate, setStartDate] = useState<Date>(startOfYear(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());
  
  // Report type state
  const [reportType, setReportType] = useState<'draft' | 'open' | 'complete'>('draft');
  
  // Filters visibility state - default to closed
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Quick date range options
  const getDateRange = (range: string) => {
    const now = new Date();
    switch (range) {
      case 'last7':
        return { start: subDays(now, 7), end: now };
      case 'last30':
        return { start: subDays(now, 30), end: now };
      case 'last90':
        return { start: subDays(now, 90), end: now };
      case 'thisMonth':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'thisQuarter':
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case 'thisYear':
        return { start: startOfYear(now), end: now };
      case 'lastYear':
        const lastYear = subYears(now, 1);
        return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
      default:
        return { start: subDays(now, 30), end: now };
    }
  };

  const handleQuickDateRange = (range: string) => {
    const { start, end } = getDateRange(range);
    setStartDate(start);
    setEndDate(end);
  };

  const { data: reportData = {}, isLoading } = useQuery({
    queryKey: [`/org/${slug}/api/reports/ordered-items`, reportType, startDate, endDate, activeSearchTerm],
    queryFn: () => {
      const params = new URLSearchParams({
        reportType: reportType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      if (activeSearchTerm.trim()) {
        params.append("search", activeSearchTerm.trim());
      }
      return fetch(`/org/${slug}/api/reports/ordered-items?${params}`).then(res => res.json());
    },
    enabled: !!slug,
  });

  const orderedItems = reportData?.items || [];
  const totalRecords = orderedItems.length;

  // Extract unique values for filters
  const uniqueVendors = Array.from(new Set(orderedItems.map((item: any) => item.vendor).filter(Boolean))).sort();
  const uniqueBrands = Array.from(new Set(orderedItems.map((item: any) => item.brand).filter(Boolean))).sort();
  const uniqueCategories = Array.from(new Set(orderedItems.map((item: any) => item.category).filter(Boolean))).sort();
  const uniqueSubcategories = Array.from(new Set(orderedItems.map((item: any) => item.subcategory1).filter(Boolean))).sort();

  // Apply filters and search
  const filteredItems = orderedItems.filter((item: any) => {
    // Apply dropdown filters
    if (selectedVendor !== "all" && item.vendor !== selectedVendor) return false;
    if (selectedBrand !== "all" && item.brand !== selectedBrand) return false;
    if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
    if (selectedSubcategory !== "all" && item.subcategory1 !== selectedSubcategory) return false;
    
    // Apply search filter
    if (!activeSearchTerm.trim()) return true;
    const searchLower = activeSearchTerm.toLowerCase();
    return (
      item.itemName?.toLowerCase().includes(searchLower) ||
      item.mfgPartNo?.toLowerCase().includes(searchLower) ||
      item.orderNumber?.toLowerCase().includes(searchLower) ||
      item.vendorSku?.toLowerCase().includes(searchLower) ||
      item.upc?.toLowerCase().includes(searchLower) ||
      item.brand?.toLowerCase().includes(searchLower) ||
      item.model?.toLowerCase().includes(searchLower) ||
      item.category?.toLowerCase().includes(searchLower)
    );
  });

  // Paginate results
  const itemsPerPage = parseInt(recordsPerPage);
  const currentPage = 1; // For simplicity, showing first page
  const paginatedItems = filteredItems.slice(0, itemsPerPage);

  const handleExport = () => {
    const headers = [
      "Item Name", 
      "Mfg Part No.",
      ...(showModel ? ["Model"] : []),
      ...(showUpc ? ["UPC"] : []),
      ...(showVendorSku ? ["Vendor SKU"] : []),
      "Vendor",
      ...(showBrand ? ["Brand"] : []),
      ...(showCategory ? ["Category"] : []),
      ...(showSubcategory1 ? ["Subcategory 1"] : []),
      ...(showSubcategory2 ? ["Subcategory 2"] : []),
      ...(showSubcategory3 ? ["Subcategory 3"] : []),
      "Order Date", 
      "Order No.",
      "Unit Cost", 
      "# Ordered", 
      "Total Cost"
    ];
    
    const csvContent = [
      headers.join(","),
      ...filteredItems.map((item: any) => {
        const row = [
          `"${item.itemName || ''}"`,
          `"${item.mfgPartNo || ''}"`,
          ...(showModel ? [`"${item.model || ''}"`] : []),
          ...(showUpc ? [`"${item.upc || ''}"`] : []),
          ...(showVendorSku ? [`"${item.vendorSku || ''}"`] : []),
          `"${item.vendor || ''}"`,
          ...(showBrand ? [`"${item.brand || ''}"`] : []),
          ...(showCategory ? [`"${item.category || ''}"`] : []),
          ...(showSubcategory1 ? [`"${item.subcategory1 || ''}"`] : []),
          ...(showSubcategory2 ? [`"${item.subcategory2 || ''}"`] : []),
          ...(showSubcategory3 ? [`"${item.subcategory3 || ''}"`] : []),
          item.orderDate || '',
          `"${item.orderNumber || ''}"`,
          item.unitCost || '',
          item.quantityOrdered || '',
          item.totalCost || ''
        ];
        
        return row.join(",");
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `items-ordered-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="p-6">Loading report...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Items Ordered</h1>
          <p className="text-muted-foreground">
            {reportType === 'draft' && 'Items on draft orders (not yet submitted)'}
            {reportType === 'open' && 'Items on open orders (submitted to vendors)'}
            {reportType === 'complete' && 'Items received (orders marked complete)'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Quick Date Range Selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Clock className="h-4 w-4 mr-2" />
                Quick Ranges
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="end">
              <div className="space-y-1">
                <h4 className="font-medium text-sm mb-2">Quick Date Ranges</h4>
                <div className="space-y-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-sm h-auto py-2"
                    onClick={() => handleQuickDateRange('last7')}
                    data-testid="quick-range-last7"
                  >
                    Last 7 days
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-sm h-auto py-2"
                    onClick={() => handleQuickDateRange('last30')}
                    data-testid="quick-range-last30"
                  >
                    Last 30 days
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-sm h-auto py-2"
                    onClick={() => handleQuickDateRange('last90')}
                    data-testid="quick-range-last90"
                  >
                    Last 90 days
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-sm h-auto py-2"
                    onClick={() => handleQuickDateRange('thisMonth')}
                    data-testid="quick-range-thismonth"
                  >
                    This month
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-sm h-auto py-2"
                    onClick={() => handleQuickDateRange('lastMonth')}
                    data-testid="quick-range-lastmonth"
                  >
                    Last month
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-sm h-auto py-2"
                    onClick={() => handleQuickDateRange('thisQuarter')}
                    data-testid="quick-range-thisquarter"
                  >
                    This quarter
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-sm h-auto py-2"
                    onClick={() => handleQuickDateRange('thisYear')}
                    data-testid="quick-range-thisyear"
                  >
                    Year to date
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-sm h-auto py-2"
                    onClick={() => handleQuickDateRange('lastYear')}
                    data-testid="quick-range-lastyear"
                  >
                    Last year
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Date Range Pickers */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "MM/dd/yyyy") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <span className="text-muted-foreground">to</span>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "MM/dd/yyyy") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => date && setEndDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Export and Optional Columns */}
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Columns
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Optional Columns</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="vendor-sku" 
                      checked={showVendorSku} 
                      onCheckedChange={(checked) => setShowVendorSku(checked === true)}
                    />
                    <label htmlFor="vendor-sku" className="text-sm">Vendor SKU</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="upc" 
                      checked={showUpc} 
                      onCheckedChange={(checked) => setShowUpc(checked === true)}
                    />
                    <label htmlFor="upc" className="text-sm">UPC</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="model" 
                      checked={showModel} 
                      onCheckedChange={(checked) => setShowModel(checked === true)}
                    />
                    <label htmlFor="model" className="text-sm">Model</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="brand" 
                      checked={showBrand} 
                      onCheckedChange={(checked) => setShowBrand(checked === true)}
                    />
                    <label htmlFor="brand" className="text-sm">Brand</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="category" 
                      checked={showCategory} 
                      onCheckedChange={(checked) => setShowCategory(checked === true)}
                    />
                    <label htmlFor="category" className="text-sm">Category</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="subcategory1" 
                      checked={showSubcategory1} 
                      onCheckedChange={(checked) => setShowSubcategory1(checked === true)}
                    />
                    <label htmlFor="subcategory1" className="text-sm">Subcategory 1</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="subcategory2" 
                      checked={showSubcategory2} 
                      onCheckedChange={(checked) => setShowSubcategory2(checked === true)}
                    />
                    <label htmlFor="subcategory2" className="text-sm">Subcategory 2</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="subcategory3" 
                      checked={showSubcategory3} 
                      onCheckedChange={(checked) => setShowSubcategory3(checked === true)}
                    />
                    <label htmlFor="subcategory3" className="text-sm">Subcategory 3</label>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Report Type Toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center rounded-lg bg-muted p-1">
          <button
            onClick={() => setReportType('draft')}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
              reportType === 'draft'
                ? "bg-orange-100 text-orange-800 shadow-sm"
                : "text-muted-foreground hover:bg-orange-50 hover:text-orange-700"
            )}
          >
            Items on Draft Orders
          </button>
          <button
            onClick={() => setReportType('open')}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
              reportType === 'open'
                ? "bg-green-100 text-green-800 shadow-sm"
                : "text-muted-foreground hover:bg-green-50 hover:text-green-700"
            )}
          >
            Items on Open Orders
          </button>
          <button
            onClick={() => setReportType('complete')}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
              reportType === 'complete'
                ? "bg-blue-100 text-blue-800 shadow-sm"
                : "text-muted-foreground hover:bg-blue-50 hover:text-blue-700"
            )}
          >
            Items Received
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="border rounded-lg bg-muted/30">
        <div className="flex justify-between items-center p-4 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Filters</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setFiltersVisible(!filtersVisible)}
              className="text-xs h-auto px-2 py-1"
              data-testid="button-toggle-filters"
            >
              {filtersVisible ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Show
                </>
              )}
            </Button>
          </div>
          {filtersVisible && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setSelectedVendor("all");
                setSelectedBrand("all");
                setSelectedCategory("all");
                setSelectedSubcategory("all");
              }}
              className="text-xs h-auto px-2 py-1"
              data-testid="button-clear-filters"
            >
              Clear All
            </Button>
          )}
        </div>
        {filtersVisible && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Vendor</label>
            <Select value={selectedVendor} onValueChange={setSelectedVendor}>
              <SelectTrigger data-testid="select-vendor">
                <SelectValue placeholder="All Vendors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {uniqueVendors.map((vendor) => (
                  <SelectItem key={vendor as string} value={vendor as string}>{vendor as string}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Brand</label>
            <Select value={selectedBrand} onValueChange={setSelectedBrand}>
              <SelectTrigger data-testid="select-brand">
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {uniqueBrands.map((brand) => (
                  <SelectItem key={brand as string} value={brand as string}>{brand as string}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="select-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map((category) => (
                  <SelectItem key={category as string} value={category as string}>{category as string}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Subcategory</label>
            <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
              <SelectTrigger data-testid="select-subcategory">
                <SelectValue placeholder="All Subcategories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subcategories</SelectItem>
                {uniqueSubcategories.map((subcategory) => (
                  <SelectItem key={subcategory as string} value={subcategory as string}>{subcategory as string}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
            </div>
          </div>
        )}
      </div>

      {/* Search Bar and Results Info */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="relative w-[420px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Part #, Item Name, Order Number, or UPC"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-9 pr-10 border-2 border-gray-400 focus:border-gray-600 focus:ring-2 focus:ring-gray-200"
              data-testid="input-search"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-gray-100"
                onClick={handleClearSearch}
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button 
            onClick={handleSearch}
            className="btn-orange-action"
            data-testid="button-search"
          >
            Search
          </Button>
          {activeSearchTerm && (
            <span className="text-sm text-muted-foreground">
              Searching for: "<strong>{activeSearchTerm}</strong>"
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {filteredItems.length} of {totalRecords} items
        </div>
      </div>

      {/* Status and Date Range Label */}
      <div className="text-center py-4">
        <h2 className="text-lg font-semibold text-foreground">
          {reportType === 'draft' && 'Draft Items'} 
          {reportType === 'open' && 'Ordered Items'} 
          {reportType === 'complete' && 'Received Items'} 
          {startDate && endDate && (
            <span className="text-muted-foreground ml-2">
              {format(startDate, "M/d/yy")} - {format(endDate, "M/d/yy")}
            </span>
          )}
        </h2>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Item Name</TableHead>
              <TableHead className="font-semibold">Mfg Part No.</TableHead>
              {showModel && <TableHead className="font-semibold">Model</TableHead>}
              {showUpc && <TableHead className="font-semibold">UPC</TableHead>}
              {showVendorSku && <TableHead className="font-semibold">Vendor SKU</TableHead>}
              <TableHead className="font-semibold">Vendor</TableHead>
              {showBrand && <TableHead className="font-semibold">Brand</TableHead>}
              {showCategory && <TableHead className="font-semibold">Category</TableHead>}
              {showSubcategory1 && <TableHead className="font-semibold">Subcategory 1</TableHead>}
              {showSubcategory2 && <TableHead className="font-semibold">Subcategory 2</TableHead>}
              {showSubcategory3 && <TableHead className="font-semibold">Subcategory 3</TableHead>}
              <TableHead className="font-semibold">Order Date</TableHead>
              <TableHead className="font-semibold">Order No.</TableHead>
              <TableHead className="font-semibold text-right">Unit Cost</TableHead>
              <TableHead className="font-semibold"># Ordered</TableHead>
              <TableHead className="font-semibold text-right">Total Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.length > 0 ? (
              paginatedItems.map((item: any, index: number) => (
                <TableRow key={index} data-testid={`row-item-${index}`}>
                  <TableCell className="font-medium">{item.itemName || '-'}</TableCell>
                  <TableCell>{item.mfgPartNo || '-'}</TableCell>
                  {showModel && <TableCell>{item.model || '-'}</TableCell>}
                  {showUpc && <TableCell>{item.upc || '-'}</TableCell>}
                  {showVendorSku && <TableCell>{item.vendorSku || '-'}</TableCell>}
                  <TableCell>{item.vendor || '-'}</TableCell>
                  {showBrand && <TableCell>{item.brand || '-'}</TableCell>}
                  {showCategory && <TableCell>{item.category || '-'}</TableCell>}
                  {showSubcategory1 && <TableCell>{item.subcategory1 || '-'}</TableCell>}
                  {showSubcategory2 && <TableCell>{item.subcategory2 || '-'}</TableCell>}
                  {showSubcategory3 && <TableCell>{item.subcategory3 || '-'}</TableCell>}
                  <TableCell>{item.orderDate ? format(new Date(item.orderDate), "MM/dd/yyyy") : '-'}</TableCell>
                  <TableCell>
                    {item.orderNumber ? (
                      <button
                        onClick={() => handleOrderClick(item.orderId)}
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        data-testid={`link-order-${item.orderNumber}`}
                      >
                        {item.orderNumber}
                      </button>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right">{item.unitCost ? `$${parseFloat(item.unitCost).toFixed(2)}` : '-'}</TableCell>
                  <TableCell>{item.quantityOrdered || '-'}</TableCell>
                  <TableCell className="text-right">{item.totalCost ? `$${parseFloat(item.totalCost).toFixed(2)}` : '-'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell 
                  colSpan={8 + (showVendorSku ? 1 : 0) + (showUpc ? 1 : 0) + (showModel ? 1 : 0) + (showBrand ? 1 : 0) + (showCategory ? 1 : 0) + (showSubcategory1 ? 1 : 0) + (showSubcategory2 ? 1 : 0) + (showSubcategory3 ? 1 : 0)} 
                  className="text-center py-8 text-muted-foreground"
                >
                  No records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer with Records Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={recordsPerPage} onValueChange={setRecordsPerPage}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">Items</span>
        </div>
        
        <div className="text-sm text-muted-foreground">
          Records {filteredItems.length > 0 ? "1" : "0"} - {Math.min(itemsPerPage, filteredItems.length)} of {filteredItems.length}
        </div>
      </div>
    </div>
  );
}