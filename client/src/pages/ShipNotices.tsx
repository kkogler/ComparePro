import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, Package, Eye, Plus, AlertTriangle, DollarSign, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Component to display ASN items with full product details
function ASNItemsTable({ asnId }: { asnId: number }) {
  const orgSlug = window.location.pathname.split('/')[2];
  
  const { data: asnItems = [], isLoading } = useQuery({
    queryKey: [`/org/${orgSlug}/api/asns/${asnId}/items`],
    enabled: !!asnId
  });

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Loading item details...</p>
      </div>
    );
  }

  if (!Array.isArray(asnItems) || asnItems.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
        <p>No items found for this shipment</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>Vendor SKU</TableHead>
          <TableHead>UPC</TableHead>
          <TableHead>Qty Shipped</TableHead>
          <TableHead>Qty Backordered</TableHead>
          <TableHead>Unit Cost</TableHead>
          <TableHead>Total Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {asnItems.map((item: any) => (
          <TableRow key={item.id}>
            <TableCell>
              <div>
                <div className="font-medium">{item.productName || 'Unknown Product'}</div>
                <div className="text-sm text-gray-500">
                  {item.brand && item.model ? `${item.brand} ${item.model}` : (item.brand || item.model || '')}
                </div>
              </div>
            </TableCell>
            <TableCell>{item.vendorSku || 'N/A'}</TableCell>
            <TableCell>{item.upc || 'N/A'}</TableCell>
            <TableCell>{item.quantityShipped || 0}</TableCell>
            <TableCell>{item.quantityBackordered || 0}</TableCell>
            <TableCell>${item.unitCost || '0.00'}</TableCell>
            <TableCell>${((item.quantityShipped || 0) * parseFloat(item.unitCost || '0')).toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface ASN {
  id: number;
  asnNumber: string;
  orderId: number;
  vendorId: number;
  status: string;
  shipDate: string;
  trackingNumber: string;
  itemsShipped: number;
  itemsTotal: number;
  shippingCost: string;
  notes: string;
  rawData: any;
  createdAt: string;
  // Additional fields from enhanced schema
  shipmentId?: string;
  purchaseOrderId?: string;
  totalUnitsShipped?: number;
  totalUnitsBackordered?: number;
  poShippingCost?: string;
  poOtherCost?: string;
  totalPoAmount?: string;
  poNote?: string;
  carrier?: string;
  // Related data
  orderNumber?: string;
  vendorName?: string;
}

interface ASNItem {
  id: number;
  asnId: number;
  orderItemId: number;
  quantityShipped: number;
  quantityBackordered: number;
  createdAt: string;
}

interface Order {
  id: number;
  orderNumber: string;
  vendorId: number;
  vendorName: string;
  status: string;
  total: string;
  itemCount: number;
  createdAt: string;
}

interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: string;
  totalCost: string;
}

function ShipNotices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedASN, setSelectedASN] = useState<ASN | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [shipNoticeForm, setShipNoticeForm] = useState({
    trackingNumber: "",
    carrier: "UPS",
    shipDate: new Date().toISOString().split('T')[0],
    notes: ""
  });

  // Get current organization from URL
  const orgSlug = window.location.pathname.split('/')[2];

  const { data: asns = [], isLoading } = useQuery<ASN[]>({
    queryKey: [`/org/${orgSlug}/api/asns`],
    enabled: !!orgSlug
  });

  const { data: openOrders = [], isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: [`/org/${orgSlug}/api/orders-open`],
    queryFn: async () => {
      console.log('Fetching orders for ship notice creation...');
      const response = await apiRequest(`/org/${orgSlug}/api/orders`, "GET");
      const orders = await response.json();
      console.log('All orders received:', orders);
      const filteredOrders = Array.isArray(orders) ? orders.filter(order => order.status === 'open') : [];
      console.log('Filtered orders (open only):', filteredOrders);
      return filteredOrders;
    },
    enabled: !!orgSlug && showCreateDialog
  });

  const { data: orderItems = [] } = useQuery<OrderItem[]>({
    queryKey: [`/org/${orgSlug}/api/orders/${selectedOrder?.id}/items`],
    enabled: !!selectedOrder
  });

  const createShipNotice = useMutation({
    mutationFn: async (data: { orderId: number; shipNoticeData: any }) => {
      const response = await apiRequest(`/org/${orgSlug}/api/ship-notices/from-order`, "POST", data);
      return response.json();
    },
    onSuccess: (createdASN) => {
      queryClient.invalidateQueries({ queryKey: [`/org/${orgSlug}/api/asns`] });
      setShowCreateDialog(false);
      setSelectedOrder(null);
      setShipNoticeForm({
        trackingNumber: "",
        carrier: "UPS",
        shipDate: new Date().toISOString().split('T')[0],
        notes: ""
      });
      
      // Automatically open the detailed view of the newly created ship notice
      setSelectedASN(createdASN);
      
      toast({
        title: "Success",
        description: "Ship notice created successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create ship notice",
        variant: "destructive"
      });
    }
  });

  const handleCreateShipNotice = () => {
    if (!selectedOrder) return;

    const shipNoticeData = {
      asnNumber: `ASN-${selectedOrder.orderNumber}-${Date.now()}`,
      trackingNumber: shipNoticeForm.trackingNumber,
      carrier: shipNoticeForm.carrier,
      shipDate: shipNoticeForm.shipDate,
      notes: shipNoticeForm.notes,
      itemsFromOrder: true
    };

    createShipNotice.mutate({ 
      orderId: selectedOrder.id, 
      shipNoticeData 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'complete': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <Truck className="h-8 w-8 animate-pulse text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Loading ship notices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ship Notices</h1>
          <p className="text-gray-600 mt-1">
            Track vendor shipments and deliveries
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="btn-orange-action">
              <Plus className="h-4 w-4 mr-2" />
              Create Ship Notice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Ship Notice from Order</DialogTitle>
              <DialogDescription>
                Select an open order to create a ship notice for delivered items
              </DialogDescription>
            </DialogHeader>
            
            {!selectedOrder ? (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Select an Open Order to Ship</h3>
                {isLoadingOrders ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Loading orders...</p>
                  </div>
                ) : !Array.isArray(openOrders) || openOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No open orders available for shipping</p>
                    <p className="text-sm">Orders must be in "open" status to create ship notices</p>
                    <p className="text-xs text-gray-400 mt-2">Debug: {JSON.stringify({ordersLength: openOrders?.length, enabled: showCreateDialog, orgSlug})}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order Number</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.isArray(openOrders) && openOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.orderNumber}</TableCell>
                          <TableCell>{order.vendorName}</TableCell>
                          <TableCell>{order.itemCount} items</TableCell>
                          <TableCell>${order.total}</TableCell>
                          <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => setSelectedOrder(order)}
                            >
                              Select
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium">Selected Order: {selectedOrder.orderNumber}</h3>
                  <p className="text-sm text-gray-600">Vendor: {selectedOrder.vendorName}</p>
                  <p className="text-sm text-gray-600">{selectedOrder.itemCount} items, Total: ${selectedOrder.total}</p>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Order Items</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Cost</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell>{item.sku}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>${item.unitCost}</TableCell>
                          <TableCell>${item.totalCost}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Ship Notice Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="trackingNumber">Tracking Number</Label>
                      <Input
                        id="trackingNumber"
                        value={shipNoticeForm.trackingNumber}
                        onChange={(e) => setShipNoticeForm(prev => ({ ...prev, trackingNumber: e.target.value }))}
                        placeholder="Enter tracking number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="carrier">Carrier</Label>
                      <Input
                        id="carrier"
                        value={shipNoticeForm.carrier}
                        onChange={(e) => setShipNoticeForm(prev => ({ ...prev, carrier: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="shipDate">Ship Date</Label>
                      <Input
                        id="shipDate"
                        type="date"
                        value={shipNoticeForm.shipDate}
                        onChange={(e) => setShipNoticeForm(prev => ({ ...prev, shipDate: e.target.value }))}
                      />
                    </div>
                    <div></div>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={shipNoticeForm.notes}
                      onChange={(e) => setShipNoticeForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Additional notes about this shipment"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setSelectedOrder(null)}
                  >
                    Back to Orders
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateShipNotice}
                    disabled={createShipNotice.isPending}
                    className="btn-orange-action"
                  >
                    {createShipNotice.isPending ? "Creating..." : "Create Ship Notice"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {asns.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Ship Notices</h3>
          <p className="text-gray-600 mb-4">
            Ship notices will appear here when vendors send shipment confirmations
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create from Order
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ship Notice</TableHead>
                <TableHead>Ship Date</TableHead>
                <TableHead>Referenced PO</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {asns.map((asn: ASN) => (
                <TableRow key={asn.id} className="hover:bg-gray-50">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-gray-500" />
                      <div>
                        <div className="font-medium">{asn.asnNumber}</div>
                        <div className="text-sm text-gray-500">
                          {asn.trackingNumber || 'No tracking'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {asn.shipDate ? new Date(asn.shipDate).toLocaleDateString() : 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {asn.purchaseOrderId || asn.orderNumber || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <div className="font-medium">{asn.itemsShipped || 0}</div>
                      <div className="text-sm text-gray-500">
                        of {asn.itemsTotal || 0} items
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      ${asn.totalPoAmount || asn.shippingCost || '0.00'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(asn.status)}>
                      {asn.status.charAt(0).toUpperCase() + asn.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedASN(asn)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Ship Notice Detail Modal */}
      <Dialog open={!!selectedASN} onOpenChange={() => setSelectedASN(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Ship Notice Details: {selectedASN?.asnNumber}
            </DialogTitle>
            <DialogDescription>
              Complete shipment information and item details
            </DialogDescription>
          </DialogHeader>
          
          {selectedASN && (
            <div className="space-y-6">
              {/* Shipment Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Shipment Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Ship Notice Number</Label>
                    <p className="text-sm">{selectedASN.asnNumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <Badge className={getStatusColor(selectedASN.status)}>
                      {selectedASN.status.charAt(0).toUpperCase() + selectedASN.status.slice(1)}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Ship Date</Label>
                    <p className="text-sm">
                      {selectedASN.shipDate ? new Date(selectedASN.shipDate).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Tracking Number</Label>
                    <p className="text-sm">{selectedASN.trackingNumber || 'No tracking available'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Carrier</Label>
                    <p className="text-sm">{selectedASN.carrier || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Purchase Order</Label>
                    <p className="text-sm">{selectedASN.purchaseOrderId || selectedASN.orderNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Items Shipped</Label>
                    <p className="text-sm">{selectedASN.itemsShipped || 0} of {selectedASN.itemsTotal || 0}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Shipping Cost</Label>
                    <p className="text-sm">${selectedASN.poShippingCost || selectedASN.shippingCost || '0.00'}</p>
                  </div>
                  {selectedASN.notes && (
                    <div className="col-span-2">
                      <Label className="text-sm font-medium text-gray-500">Notes</Label>
                      <p className="text-sm">{selectedASN.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Item Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Item Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <ASNItemsTable asnId={selectedASN.id} />
                </CardContent>
              </Card>

              {/* Webhook Raw Data */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Webhook Raw Data
                  </CardTitle>
                  <CardDescription>
                    This data can be retrieved by 3rd party applications using the webhook endpoint
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WebhookDataDisplay asnId={selectedASN.id} />
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component to display webhook raw data for 3rd party integrations
function WebhookDataDisplay({ asnId }: { asnId: number }) {
  const orgSlug = window.location.pathname.split('/')[2];
  
  const { data: webhookData, isLoading } = useQuery({
    queryKey: [`/org/${orgSlug}/api/webhook/ship-notice/${asnId}`],
    enabled: !!asnId
  });

  if (isLoading) {
    return (
      <div className="text-center py-4 text-gray-500">
        <p>Loading webhook data...</p>
      </div>
    );
  }

  if (!webhookData) {
    return (
      <div className="text-center py-4 text-red-500">
        <p>Failed to load webhook data</p>
      </div>
    );
  }

  const webhookUrl = `${window.location.origin}/org/${orgSlug}/api/webhook/ship-notice/${asnId}`;

  return (
    <div className="space-y-4">
      {/* Webhook URL */}
      <div>
        <Label className="text-sm font-medium">Webhook Endpoint URL:</Label>
        <div className="mt-1 p-2 bg-gray-100 rounded border font-mono text-sm break-all">
          {webhookUrl}
        </div>
      </div>
      
      {/* Raw JSON Data */}
      <div>
        <Label className="text-sm font-medium">Raw JSON Response:</Label>
        <pre className="mt-1 p-4 bg-gray-900 text-green-400 rounded border text-xs overflow-auto max-h-96 font-mono">
          {JSON.stringify(webhookData, null, 2)}
        </pre>
      </div>
      
      {/* Copy Button */}
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => {
          navigator.clipboard.writeText(JSON.stringify(webhookData, null, 2));
        }}
      >
        Copy JSON Data
      </Button>
    </div>
  );
}

export default ShipNotices;

