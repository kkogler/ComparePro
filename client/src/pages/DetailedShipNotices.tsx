import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Eye, Package, Truck } from "lucide-react";
import ShipNoticeDetailForm from "@/components/ShipNoticeDetailForm";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DetailedASN {
  id: number;
  asnNumber: string;
  orderId: number;
  vendorId: number;
  status: string;
  shipDate: string;
  shipmentId?: string;
  purchaseOrderId?: string;
  totalUnitsShipped: number;
  totalUnitsBackordered: number;
  poShippingCost: number;
  poOtherCost: number;
  totalPoAmount: number;
  poNote?: string;
  trackingNumber?: string;
  carrier?: string;
  vendor?: string;
  orderNumber?: string;
  createdAt: string;
}

interface DetailedASNItem {
  id: number;
  asnId: number;
  productName: string;
  sku: string;
  manufacturerPartNumber?: string;
  vendorProductId?: string;
  upc?: string;
  modelStyle?: string;
  costToDealer: number;
  msrp?: number;
  map?: number;
  caliber?: string;
  weight?: number;
  manufacturerBrand?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  quantityShipped: number;
  quantityBackordered: number;
}

export default function DetailedShipNotices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedASN, setSelectedASN] = useState<DetailedASN | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Get current organization from URL
  const orgSlug = window.location.pathname.split('/')[2];

  // Query for ASNs with detailed information
  const { data: asns = [], isLoading } = useQuery<DetailedASN[]>({
    queryKey: [`/org/${orgSlug}/api/detailed-asns`, statusFilter],
    queryFn: async () => {
      const url = statusFilter === 'all' 
        ? `/org/${orgSlug}/api/detailed-asns`
        : `/org/${orgSlug}/api/detailed-asns?status=${statusFilter}`;
      return await apiRequest(url, 'GET');
    },
    enabled: !!orgSlug
  });

  // Query for ASN items when viewing details
  const { data: asnItems = [] } = useQuery<DetailedASNItem[]>({
    queryKey: [`/org/${orgSlug}/api/detailed-asns`, selectedASN?.id, 'items'],
    queryFn: async () => {
      if (!selectedASN?.id) return [];
      return await apiRequest(`/org/${orgSlug}/api/detailed-asns/${selectedASN.id}/items`, 'GET');
    },
    enabled: !!selectedASN?.id && showDetailsDialog
  });

  // Mutation for creating ship notices
  const createShipNoticeMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/org/${orgSlug}/api/detailed-ship-notices`, 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${orgSlug}/api/detailed-asns`] });
      setShowCreateDialog(false);
      toast({
        title: "Ship Notice Created",
        description: "Detailed ship notice has been successfully created",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create ship notice",
        variant: "destructive",
      });
    }
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      open: "default",
      complete: "secondary",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const handleCreateShipNotice = async (data: any) => {
    await createShipNoticeMutation.mutateAsync(data);
  };

  const handleViewDetails = (asn: DetailedASN) => {
    setSelectedASN(asn);
    setShowDetailsDialog(true);
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Detailed Ship Notices</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive shipment tracking with complete product details
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Ship Notice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Detailed Ship Notice</DialogTitle>
            </DialogHeader>
            <ShipNoticeDetailForm
              onSubmit={handleCreateShipNotice}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="text-sm font-medium">Status:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ASN List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Ship Notices ({asns.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading ship notices...</div>
          ) : asns.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ASN Number</TableHead>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Ship Date</TableHead>
                    <TableHead>Shipment ID</TableHead>
                    <TableHead>Units Shipped</TableHead>
                    <TableHead>Units Backordered</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {asns.map((asn) => (
                    <TableRow key={asn.id}>
                      <TableCell className="font-medium">{asn.asnNumber}</TableCell>
                      <TableCell>{asn.orderNumber || asn.orderId}</TableCell>
                      <TableCell>{asn.vendor || 'Unknown'}</TableCell>
                      <TableCell>{formatDate(asn.shipDate)}</TableCell>
                      <TableCell>{asn.shipmentId || '-'}</TableCell>
                      <TableCell className="text-center">{asn.totalUnitsShipped}</TableCell>
                      <TableCell className="text-center">{asn.totalUnitsBackordered}</TableCell>
                      <TableCell>{formatCurrency(asn.totalPoAmount)}</TableCell>
                      <TableCell className="font-mono text-sm">{asn.trackingNumber || '-'}</TableCell>
                      <TableCell>{asn.carrier || '-'}</TableCell>
                      <TableCell>{getStatusBadge(asn.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(asn)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No detailed ship notices found
            </div>
          )}
        </CardContent>
      </Card>

      {/* ASN Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ship Notice Details - {selectedASN?.asnNumber}</DialogTitle>
          </DialogHeader>
          
          {selectedASN && (
            <div className="space-y-6">
              {/* ASN Header Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Shipment Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">Order Details</h4>
                      <p className="text-sm text-gray-600">ASN Number: {selectedASN.asnNumber}</p>
                      <p className="text-sm text-gray-600">Order Number: {selectedASN.orderNumber || selectedASN.orderId}</p>
                      <p className="text-sm text-gray-600">Vendor: {selectedASN.vendor || 'Unknown'}</p>
                      <p className="text-sm text-gray-600">PO ID: {selectedASN.purchaseOrderId || '-'}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Shipping Details</h4>
                      <p className="text-sm text-gray-600">Ship Date: {formatDate(selectedASN.shipDate)}</p>
                      <p className="text-sm text-gray-600">Shipment ID: {selectedASN.shipmentId || '-'}</p>
                      <p className="text-sm text-gray-600">Tracking: {selectedASN.trackingNumber || '-'}</p>
                      <p className="text-sm text-gray-600">Carrier: {selectedASN.carrier || '-'}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Totals</h4>
                      <p className="text-sm text-gray-600">Units Shipped: {selectedASN.totalUnitsShipped}</p>
                      <p className="text-sm text-gray-600">Units Backordered: {selectedASN.totalUnitsBackordered}</p>
                      <p className="text-sm text-gray-600">Shipping Cost: {formatCurrency(selectedASN.poShippingCost)}</p>
                      <p className="text-sm text-gray-600">Total Amount: {formatCurrency(selectedASN.totalPoAmount)}</p>
                    </div>
                  </div>
                  {selectedASN.poNote && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-gray-900">Notes</h4>
                      <p className="text-sm text-gray-600">{selectedASN.poNote}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Shipped Items */}
              <Card>
                <CardHeader>
                  <CardTitle>Shipped Items ({asnItems.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {asnItems.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>UPC</TableHead>
                            <TableHead>Part #</TableHead>
                            <TableHead>Model/Style</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead>Caliber</TableHead>
                            <TableHead>Weight</TableHead>
                            <TableHead>Cost</TableHead>
                            <TableHead>MSRP</TableHead>
                            <TableHead>MAP</TableHead>
                            <TableHead>Qty Shipped</TableHead>
                            <TableHead>Qty Backorder</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Image</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {asnItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.productName}</TableCell>
                              <TableCell>{item.sku}</TableCell>
                              <TableCell>{item.upc || '-'}</TableCell>
                              <TableCell>{item.manufacturerPartNumber || '-'}</TableCell>
                              <TableCell>{item.modelStyle || '-'}</TableCell>
                              <TableCell>{item.manufacturerBrand || '-'}</TableCell>
                              <TableCell>{item.caliber || '-'}</TableCell>
                              <TableCell>{item.weight ? `${item.weight} lbs` : '-'}</TableCell>
                              <TableCell>{formatCurrency(item.costToDealer)}</TableCell>
                              <TableCell>{item.msrp ? formatCurrency(item.msrp) : '-'}</TableCell>
                              <TableCell>{item.map ? formatCurrency(item.map) : '-'}</TableCell>
                              <TableCell className="text-center">{item.quantityShipped}</TableCell>
                              <TableCell className="text-center">{item.quantityBackordered}</TableCell>
                              <TableCell>{item.description || '-'}</TableCell>
                              <TableCell>
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt="Product" className="w-12 h-12 object-cover rounded" />
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No items found for this ship notice
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}