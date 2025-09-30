import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Eye, CheckCircle, XCircle, Clock, AlertTriangle, Download } from "lucide-react";

interface VendorFieldMapping {
  id: number;
  vendorSource: string;
  mappingName: string;
  columnMappings: Record<string, string>;
  status: 'draft' | 'approved' | 'active' | 'deprecated';
  approvedAt?: string;
  approvedBy?: string;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
}

interface PreviewResult {
  preview: Array<{
    row: number;
    original: Record<string, any>;
    mapped: Record<string, any>;
  }>;
  errors: string[];
}

export default function AdminVendorContracts() {
  const { toast } = useToast();
  const [selectedMapping, setSelectedMapping] = useState<VendorFieldMapping | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);

  // Fetch all vendor field mappings
  const { data: mappings = [], isLoading } = useQuery<VendorFieldMapping[]>({
    queryKey: ['/api/admin/vendor-field-mappings'],
    enabled: true
  });

  // Create mapping mutation
  const createMappingMutation = useMutation({
    mutationFn: async (data: {
      vendorSource: string;
      mappingName: string;
      columnMappings: Record<string, string>;
    }) => {
      return apiRequest('/api/admin/vendor-field-mappings', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/vendor-field-mappings'] });
      setIsCreateModalOpen(false);
      toast({
        title: "Success",
        description: "Vendor field mapping created successfully"
      });
    }
  });

  // Approve mapping mutation
  const approveMappingMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/admin/vendor-field-mappings/${id}/approve`, 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/vendor-field-mappings'] });
      toast({
        title: "Success",
        description: "Vendor field mapping approved"
      });
    }
  });

  // Preview mapping mutation
  const previewMappingMutation = useMutation({
    mutationFn: async (data: {
      vendorSource: string;
      mappingName: string;
      sampleData: Record<string, any>[];
    }): Promise<PreviewResult> => {
      const response = await apiRequest('/api/admin/vendor-field-mappings/preview', 'POST', data);
      return await response.json();
    },
    onSuccess: (result: PreviewResult) => {
      setPreviewData(result);
      setIsPreviewModalOpen(true);
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800" data-testid={`status-approved`}><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'active':
        return <Badge className="bg-blue-100 text-blue-800" data-testid={`status-active`}><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-800" data-testid={`status-draft`}><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
      case 'deprecated':
        return <Badge className="bg-red-100 text-red-800" data-testid={`status-deprecated`}><XCircle className="h-3 w-3 mr-1" />Deprecated</Badge>;
      default:
        return <Badge variant="outline" data-testid={`status-unknown`}>Unknown</Badge>;
    }
  };

  const handlePreview = async (mapping: VendorFieldMapping) => {
    // Sample data for preview - you could make this configurable
    const sampleData = [
      {
        'UPC': '757106324003',
        'Item Name': 'GLOCK GX2 9MM PISTOL BLACK POLYMER',
        'Manufacturer': 'GLOCK',
        'Manufacturer Item Number': 'GX2-9MM-BLK-001',
        'Web Item Description': 'Glock GX2 Semi-Automatic Pistol'
      },
      {
        'UPC': '082442971636',
        'Item Name': 'SIG SAUER PMX PISTOL 9MM BLACK',
        'Manufacturer': 'SIG SAUER', 
        'Manufacturer Item Number': 'PMX-9-BLK-TAC',
        'Web Item Description': 'Sig Sauer PMX Compact Semi-Automatic Pistol'
      }
    ];

    previewMappingMutation.mutate({
      vendorSource: mapping.vendorSource,
      mappingName: mapping.mappingName,
      sampleData
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vendor Field Mapping Contracts</h1>
          <p className="text-gray-600 mt-2">
            Manage vendor field mappings with approval workflow to prevent unauthorized changes
          </p>
        </div>
        <Button 
          onClick={() => setIsCreateModalOpen(true)}
          className="btn-orange-action"
          data-testid="button-create-mapping"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Mapping
        </Button>
      </div>

      {/* Security Notice */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center text-orange-800">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Contract-First Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-orange-700">
            All vendor imports now require approved field mapping contracts. 
            Direct CSV field access is blocked to prevent unauthorized changes and ensure data quality consistency.
          </p>
        </CardContent>
      </Card>

      {/* Mappings List */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">Loading vendor field mappings...</div>
            </CardContent>
          </Card>
        ) : (mappings as VendorFieldMapping[]).length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">No vendor field mappings</h3>
                <p className="text-gray-600 mb-4">Create your first vendor field mapping contract</p>
                <Button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="btn-orange-action"
                  data-testid="button-create-first-mapping"
                >
                  Create Mapping
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          mappings.map((mapping: VendorFieldMapping) => (
            <Card key={mapping.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2" data-testid={`mapping-title-${mapping.id}`}>
                      {mapping.vendorSource}
                      <span className="text-sm text-gray-500">({mapping.mappingName})</span>
                    </CardTitle>
                    <CardDescription>
                      Created: {new Date(mapping.createdAt).toLocaleDateString()}
                      {mapping.lastUsed && (
                        <> • Last used: {new Date(mapping.lastUsed).toLocaleDateString()}</>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(mapping.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Field Mappings Preview */}
                  <div>
                    <Label className="text-sm font-medium">Field Mappings</Label>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(mapping.columnMappings).slice(0, 4).map(([field, column]) => (
                        <div key={field} className="flex">
                          <span className="font-medium text-blue-600">{field}:</span>
                          <span className="ml-1 text-gray-600">{column}</span>
                        </div>
                      ))}
                      {Object.keys(mapping.columnMappings).length > 4 && (
                        <div className="text-gray-500">
                          +{Object.keys(mapping.columnMappings).length - 4} more...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Approval Info */}
                  {mapping.status === 'approved' && mapping.approvedBy && (
                    <div className="text-sm text-green-600">
                      ✅ Approved by {mapping.approvedBy} on {new Date(mapping.approvedAt!).toLocaleDateString()}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handlePreview(mapping)}
                      disabled={previewMappingMutation.isPending}
                      data-testid={`button-preview-${mapping.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    
                    {mapping.status === 'draft' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            size="sm"
                            className="btn-blue-action"
                            data-testid={`button-approve-${mapping.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Approve Vendor Field Mapping</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to approve this vendor field mapping contract? 
                              Once approved, it will be enforced in production imports.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => approveMappingMutation.mutate(mapping.id)}
                              className="btn-blue-action"
                            >
                              Approve Contract
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Mapping Modal */}
      <CreateMappingModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={createMappingMutation.mutate}
        isLoading={createMappingMutation.isPending}
      />

      {/* Preview Modal */}
      <PreviewModal 
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        previewData={previewData}
      />
    </div>
  );
}

// Create Mapping Modal Component
function CreateMappingModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading 
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [vendorSource, setVendorSource] = useState('');
  const [mappingName, setMappingName] = useState('Default');
  const [mappingsJson, setMappingsJson] = useState('{\n  "upc": "UPC",\n  "name": "Item Name",\n  "brand": "Manufacturer",\n  "model": "Item Name",\n  "manufacturerPartNumber": "Manufacturer Item Number"\n}');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const columnMappings = JSON.parse(mappingsJson);
      onSubmit({
        vendorSource,
        mappingName,
        columnMappings
      });
    } catch (error) {
      alert('Invalid JSON format for column mappings');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Vendor Field Mapping Contract</DialogTitle>
          <DialogDescription>
            Define how CSV columns map to product fields for this vendor
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="vendorSource">Vendor Source</Label>
              <Input
                id="vendorSource"
                value={vendorSource}
                onChange={(e) => setVendorSource(e.target.value)}
                placeholder="e.g., Chattanooga Shooting Supplies"
                required
                data-testid="input-vendor-source"
              />
            </div>
            <div>
              <Label htmlFor="mappingName">Mapping Name</Label>
              <Input
                id="mappingName"
                value={mappingName}
                onChange={(e) => setMappingName(e.target.value)}
                placeholder="Default"
                required
                data-testid="input-mapping-name"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="columnMappings">Column Mappings (JSON)</Label>
            <Textarea
              id="columnMappings"
              value={mappingsJson}
              onChange={(e) => setMappingsJson(e.target.value)}
              rows={10}
              className="font-mono text-sm"
              placeholder='{"field": "CSV Column Name"}'
              required
              data-testid="textarea-column-mappings"
            />
            <p className="text-sm text-gray-600 mt-1">
              Map product fields to CSV column names. Use "Item Name" for model extraction.
            </p>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="btn-orange-action"
              disabled={isLoading}
              data-testid="button-submit-mapping"
            >
              {isLoading ? 'Creating...' : 'Create Contract'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Preview Modal Component  
function PreviewModal({ 
  isOpen, 
  onClose, 
  previewData 
}: {
  isOpen: boolean;
  onClose: () => void;
  previewData: PreviewResult | null;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mapping Preview</DialogTitle>
          <DialogDescription>
            Preview of how the field mapping will transform sample data
          </DialogDescription>
        </DialogHeader>
        
        {previewData && (
          <div className="space-y-4">
            {previewData.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
                <ul className="text-sm text-red-700">
                  {previewData.errors.map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="space-y-4">
              {previewData.preview.map((item) => (
                <Card key={item.row}>
                  <CardHeader>
                    <CardTitle className="text-sm">Row {item.row}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="mapped">
                      <TabsList>
                        <TabsTrigger value="original">Original</TabsTrigger>
                        <TabsTrigger value="mapped">Mapped</TabsTrigger>
                      </TabsList>
                      <TabsContent value="original" className="mt-3">
                        <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                          {JSON.stringify(item.original, null, 2)}
                        </pre>
                      </TabsContent>
                      <TabsContent value="mapped" className="mt-3">
                        <pre className="text-xs bg-blue-50 p-3 rounded overflow-x-auto">
                          {JSON.stringify(item.mapped, null, 2)}
                        </pre>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}