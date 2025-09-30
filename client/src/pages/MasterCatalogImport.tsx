import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Check, X, AlertTriangle, Eye, Download, Info, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ImportPreview {
  headers: string[];
  sampleRows: any[];
  totalRows: number;
  detectedMappings: Record<string, string>;
  duplicateUPCs: string[];
  validationErrors: string[];
}

interface ImportJob {
  id: string;
  filename: string;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  errorRows: number;
  skippedRows?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errors: Array<{ row: number; error: string; data: any }>;
  startTime: string;
  endTime?: string;
  settings: ImportSettings;
}

interface ImportSettings {
  duplicateHandling: 'ignore' | 'overwrite';
  source: string;
  columnMapping: Record<string, string>;
  requiredFields: string[];
}

export default function MasterCatalogImport() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [selectedVerticalId, setSelectedVerticalId] = useState<string>('');
  const [settings, setSettings] = useState<ImportSettings>({
    duplicateHandling: 'ignore',
    source: 'CSV Import',
    columnMapping: {},
    requiredFields: ['upc', 'name']
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Required field options for mapping
  const requiredFields = [
    { key: 'upc', label: 'UPC Code', required: true },
    { key: 'name', label: 'Product Name', required: true },
    { key: 'brand', label: 'Brand/Manufacturer', required: false },
    { key: 'model', label: 'Model', required: false },
    { key: 'manufacturerPartNumber', label: 'Manufacturer Part Number', required: false },
    { key: 'category', label: 'Category', required: false },
    { key: 'subcategory1', label: 'Subcategory 1', required: false },
    { key: 'subcategory2', label: 'Subcategory 2', required: false },
    { key: 'subcategory3', label: 'Subcategory 3', required: false },
    { key: 'caliber', label: 'Caliber', required: false },
    { key: 'barrelLength', label: 'Barrel Length', required: false },
    { key: 'description', label: 'Description', required: false },
    { key: 'imageField', label: 'Image/Photo Field', required: false, tooltip: 'Raw image data that will be converted to URLs based on vendor' }
  ];

  // Fetch import jobs
  const { data: jobs = [] } = useQuery<ImportJob[]>({
    queryKey: ['/api/admin/import/jobs'],
    refetchInterval: false, // Disable automatic polling - only refetch on demand
  });

  // Fetch retail verticals for vertical selection
  const { data: retailVerticals = [] } = useQuery<any[]>({
    queryKey: ['/api/retail-verticals'],
  });

  // Fetch supported vendors for vendor selection  
  const { data: supportedVendors = [] } = useQuery<any[]>({
    queryKey: ['/api/supported-vendors'],
  });

  // Filter vendors by selected retail vertical
  const filteredVendors = selectedVerticalId 
    ? supportedVendors.filter(vendor => vendor.retailVerticalId?.toString() === selectedVerticalId)
    : supportedVendors;

  // Fetch saved field mappings for current vendor
  const { data: savedMappings } = useQuery({
    queryKey: ['/api/admin/vendor-field-mappings', settings.source],
    enabled: !!settings.source && settings.source !== 'CSV Import',
  });

  // Fetch current job status if we have a job ID
  const { data: currentJob } = useQuery({
    queryKey: ['/api/admin/import/status', currentJobId],
    enabled: !!currentJobId,
    refetchInterval: false, // Disable automatic polling - only refetch on demand
  });

  // Apply saved mappings when both preview and savedMappings are available
  useEffect(() => {
    if (preview && savedMappings && savedMappings.length > 0 && settings.source !== 'CSV Import') {
      const defaultMapping = savedMappings.find((m: any) => m.mappingName === 'Default');
      if (defaultMapping && Object.keys(defaultMapping.columnMappings).length > 0) {
        setSettings(prev => ({ 
          ...prev, 
          columnMapping: defaultMapping.columnMappings 
        }));
        toast({
          title: "Mappings Applied",
          description: `Loaded saved field mappings for ${settings.source}`,
        });
      }
    }
  }, [preview, savedMappings, settings.source]);

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/admin/import/preview', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Preview failed: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (data: ImportPreview) => {
      setPreview(data);
      setSettings(prev => ({
        ...prev,
        columnMapping: data.detectedMappings
      }));
      toast({
        title: "Preview Generated",
        description: `Found ${data.totalRows} rows with ${data.headers.length} columns`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Preview Failed",
        description: error.message,
      });
    }
  });

  const startImportMutation = useMutation({
    mutationFn: async ({ file, settings }: { file: File; settings: ImportSettings }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('settings', JSON.stringify(settings));
      
      const response = await fetch('/api/admin/import/start', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentJobId(data.jobId);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/import/jobs'] });
      
      // Save field mappings for vendor if not generic CSV import
      if (settings.source !== 'CSV Import' && Object.keys(settings.columnMapping).length > 0) {
        saveMappingMutation.mutate({
          vendorSource: settings.source,
          mappingName: 'Default',
          columnMappings: settings.columnMapping
        });
      }
      
      toast({
        title: "Import Started",
        description: "Your import is now processing in the background",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message,
      });
    }
  });

  const saveMappingMutation = useMutation({
    mutationFn: async (mappingData: { vendorSource: string; mappingName: string; columnMappings: Record<string, string> }) => {
      return apiRequest('/api/admin/vendor-field-mappings', 'POST', mappingData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/vendor-field-mappings', settings.source] });
      toast({
        title: "Mapping Saved",
        description: `Field mapping saved for ${settings.source}`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message,
      });
    }
  });

  const clearCompletedMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/import/jobs/completed', 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/import/jobs'] });
      toast({
        title: "Jobs Cleared",
        description: "Completed import jobs have been cleared",
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please select a CSV file",
        });
        return;
      }
      
      setFile(selectedFile);
      setPreview(null);
      setCurrentJobId(null);
    }
  };

  const handlePreview = () => {
    if (file) {
      previewMutation.mutate(file);
    }
  };

  const handleStartImport = () => {
    if (file && preview) {
      // Validate required mappings
      const missingRequired = requiredFields
        .filter(field => field.required && !settings.columnMapping[field.key])
        .map(field => field.label);

      if (missingRequired.length > 0) {
        toast({
          variant: "destructive",
          title: "Missing Required Mappings",
          description: `Please map: ${missingRequired.join(', ')}`,
        });
        return;
      }

      startImportMutation.mutate({ file, settings });
    }
  };

  const updateColumnMapping = (fieldKey: string, columnHeader: string) => {
    setSettings(prev => ({
      ...prev,
      columnMapping: {
        ...prev.columnMapping,
        [fieldKey]: columnHeader === '__none__' ? '' : columnHeader
      }
    }));
  };

  const getProgressPercentage = (job: ImportJob) => {
    if (job.totalRows === 0) return 0;
    return Math.round((job.processedRows / job.totalRows) * 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'processing': return 'bg-blue-500';
      default: return 'bg-yellow-500';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Master Catalog Import</h1>
          <p className="text-muted-foreground">Import product catalogs from vendor CSV files</p>
        </div>
        <Button
          variant="outline"
          onClick={() => clearCompletedMutation.mutate()}
          disabled={clearCompletedMutation.isPending}
        >
          Clear Completed Jobs
        </Button>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList>
          <TabsTrigger value="upload">Upload & Configure</TabsTrigger>
          <TabsTrigger value="jobs">Import Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle>1. Select CSV File</CardTitle>
              <CardDescription>
                Choose a vendor catalog CSV file to import into the Master Product Catalog
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Select CSV File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {file && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm">{file.name}</span>
                    <Badge variant="secondary">{(file.size / 1024 / 1024).toFixed(2)} MB</Badge>
                  </div>
                )}
              </div>

              {file && (
                <div className="mt-4 space-y-2">
                  <Button
                    onClick={handlePreview}
                    disabled={previewMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    {previewMutation.isPending ? 'Analyzing File...' : 'Preview & Map Columns'}
                  </Button>
                  {previewMutation.isPending && (
                    <div className="text-sm text-muted-foreground">
                      Processing {(file.size / 1024 / 1024).toFixed(1)}MB file. Large files may take a moment...
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Import Configuration */}
          {preview && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>2. Import Configuration</CardTitle>
                  <CardDescription>
                    Select the retail vertical and vendor source for this import
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Retail Vertical Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="retail-vertical" data-testid="label-retail-vertical">Retail Vertical</Label>
                      <Select 
                        value={selectedVerticalId} 
                        onValueChange={(value) => {
                          setSelectedVerticalId(value);
                          // Reset source when vertical changes
                          setSettings(prev => ({ ...prev, source: 'CSV Import', columnMapping: {} }));
                        }}
                        data-testid="select-retail-vertical"
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a retail vertical" />
                        </SelectTrigger>
                        <SelectContent>
                          {retailVerticals.map((vertical) => (
                            <SelectItem key={vertical.id} value={vertical.id.toString()}>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: vertical.color }}
                                />
                                {vertical.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Vendor Source Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="vendor-source" data-testid="label-vendor-source">Vendor Source</Label>
                      <Select
                        value={settings.source}
                        onValueChange={(value) => {
                          setSettings(prev => ({ ...prev, source: value }));
                          // Note: Saved mappings will be applied automatically by useEffect when available
                        }}
                        disabled={!selectedVerticalId}
                        data-testid="select-vendor-source"
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={selectedVerticalId ? "Select a vendor" : "Select retail vertical first"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CSV Import">Generic CSV Import</SelectItem>
                          {filteredVendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.vendor_short_code || vendor.name}>
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {selectedVerticalId && filteredVendors.length === 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        No vendors found for the selected retail vertical. You can still use "Generic CSV Import".
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>3. Preview & Validation</CardTitle>
                  <CardDescription>
                    Review the data structure and resolve any issues before importing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{preview.totalRows}</div>
                      <div className="text-sm text-muted-foreground">Total Rows</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{preview.headers.length}</div>
                      <div className="text-sm text-muted-foreground">Columns</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{preview.duplicateUPCs.length}</div>
                      <div className="text-sm text-muted-foreground">Duplicate UPCs</div>
                    </div>
                  </div>

                  {preview.validationErrors.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-medium mb-2">Validation Issues:</div>
                        <ul className="list-disc list-inside space-y-1">
                          {preview.validationErrors.map((error, index) => (
                            <li key={index} className="text-sm">{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {preview.duplicateUPCs.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Found {preview.duplicateUPCs.length} duplicate UPCs in file. Configure duplicate handling below.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Sample Data Preview */}
                  <div>
                    <h4 className="font-medium mb-2">Sample Data (first 5 rows):</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {preview.headers.slice(0, 6).map((header) => (
                              <TableHead key={header} className="text-xs">{header}</TableHead>
                            ))}
                            {preview.headers.length > 6 && <TableHead className="text-xs">...</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.sampleRows.slice(0, 5).map((row, index) => (
                            <TableRow key={index}>
                              {preview.headers.slice(0, 6).map((header) => (
                                <TableCell key={header} className="text-xs max-w-32 truncate">
                                  {row[header]}
                                </TableCell>
                              ))}
                              {preview.headers.length > 6 && <TableCell className="text-xs">...</TableCell>}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>4. Column Mapping</CardTitle>
                      <CardDescription>
                        Map CSV columns to product fields. Required fields must be mapped.
                      </CardDescription>
                    </div>
                    
                    {/* Saved Mappings and Manual Save */}
                    <div className="flex items-center gap-2 text-sm">
                      {savedMappings && savedMappings.length > 0 && (
                        <div className="text-gray-600" data-testid="saved-mappings-info">
                          💾 {savedMappings.length} saved mapping{savedMappings.length !== 1 ? 's' : ''} for {settings.source}
                        </div>
                      )}
                      
                      {settings.source !== 'CSV Import' && Object.keys(settings.columnMapping).length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            saveMappingMutation.mutate({
                              vendorSource: settings.source,
                              mappingName: 'Default',
                              columnMappings: settings.columnMapping
                            });
                          }}
                          disabled={saveMappingMutation.isPending}
                          data-testid="button-save-mapping"
                        >
                          {saveMappingMutation.isPending ? 'Saving...' : 'Save Mapping'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {requiredFields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label className="flex items-center gap-2">
                          {field.label}
                          {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                          {field.tooltip && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{field.tooltip}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </Label>
                        <Select
                          value={settings.columnMapping[field.key] || '__none__'}
                          onValueChange={(value) => updateColumnMapping(field.key, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {preview.headers.filter(header => header && header.trim() !== '').map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>5. Import Settings</CardTitle>
                  <CardDescription>
                    Configure how to handle duplicates and track import source
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">Duplicate Handling</Label>
                    <RadioGroup
                      value={settings.duplicateHandling}
                      onValueChange={(value: 'ignore' | 'overwrite') => 
                        setSettings(prev => ({ ...prev, duplicateHandling: value }))
                      }
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ignore" id="ignore" />
                        <Label htmlFor="ignore">Ignore duplicates (skip existing UPCs)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="overwrite" id="overwrite" />
                        <Label htmlFor="overwrite">Overwrite existing products</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-4">

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">Import Purpose</h4>
                      <p className="text-sm text-blue-800 mb-3">
                        Products imported here are added to the Master Product Catalog, making them searchable by all organizations. 
                        Real-time pricing comes from each organization's connected vendor APIs.
                      </p>
                      <div className="text-xs text-blue-700 space-y-1">
                        <div>• <strong>Master Catalog:</strong> Universal product database (UPC, name, specs)</div>
                        <div>• <strong>Organization Vendors:</strong> Each org connects to their own distributors</div>
                        <div>• <strong>Real-Time Pricing:</strong> Live API calls to org's connected vendors only</div>
                        <div>• <strong>Search Methods:</strong> Products found by UPC, Manufacturer Part Number, or Product Name</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>6. Start Import</CardTitle>
                  <CardDescription>
                    Begin importing your catalog data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleStartImport}
                    disabled={startImportMutation.isPending}
                    className="btn-orange-action flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {startImportMutation.isPending ? 'Starting Import...' : 'Start Import'}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Import Jobs</CardTitle>
                  <CardDescription>
                    Monitor import progress and view completed jobs
                  </CardDescription>
                </div>
                {jobs.some(job => job.status === 'completed' || job.status === 'failed') && (
                  <Button
                    onClick={() => clearCompletedMutation.mutate()}
                    disabled={clearCompletedMutation.isPending}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    {clearCompletedMutation.isPending ? 'Removing...' : 'Remove Completed Imports'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {jobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No import jobs yet. Upload a CSV file to get started.
                  </div>
                ) : (
                  jobs.map((job) => (
                    <Card key={job.id} className="relative">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5" />
                            <div>
                              <div className="font-medium">{job.filename}</div>
                              <div className="text-sm text-muted-foreground">
                                Started {new Date(job.startTime).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <Badge className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                        </div>

                        {job.status === 'processing' && (
                          <div className="mb-4">
                            <div className="flex justify-between text-sm mb-2">
                              <span>Progress</span>
                              <span>{getProgressPercentage(job)}%</span>
                            </div>
                            <Progress value={getProgressPercentage(job)} />
                          </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                          <div>
                            <div className="font-medium">Total Rows</div>
                            <div className="text-muted-foreground">{job.totalRows}</div>
                          </div>
                          <div>
                            <div className="font-medium">Successful</div>
                            <div className="text-green-600">{job.successfulRows}</div>
                          </div>
                          <div>
                            <div className="font-medium">Duplicate-Skipped</div>
                            <div className="text-blue-600">{job.skippedRows || 0}</div>
                          </div>
                          <div>
                            <div className="font-medium">Errors</div>
                            <div className="text-red-600">{job.errorRows}</div>
                          </div>
                          <div>
                            <div className="font-medium">Processed</div>
                            <div className="text-muted-foreground">{job.processedRows}</div>
                          </div>
                        </div>

                        {job.skippedRows > 0 && (
                          <Alert className="mt-4">
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                              <div className="font-medium mb-1">Duplicate-Skipped Products ({job.skippedRows}):</div>
                              <div className="text-xs text-muted-foreground">
                                These products already exist in the catalog and were skipped due to duplicate handling settings.
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}

                        {job.errors.length > 0 && (
                          <Alert className="mt-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-medium">Import Errors ({job.errors.length}):</div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    window.open(`/api/admin/import/jobs/${job.id}/errors/export`, '_blank');
                                  }}
                                  className="flex items-center gap-1"
                                  data-testid={`button-download-errors-${job.id}`}
                                >
                                  <Download className="h-3 w-3" />
                                  Download Errors
                                </Button>
                              </div>
                              <div className="max-h-32 overflow-y-auto space-y-1">
                                {job.errors.slice(0, 5).map((error, index) => (
                                  <div key={index} className="text-xs">
                                    Row {error.row}: {error.error}
                                  </div>
                                ))}
                                {job.errors.length > 5 && (
                                  <div className="text-xs text-muted-foreground">
                                    ... and {job.errors.length - 5} more errors
                                  </div>
                                )}
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}