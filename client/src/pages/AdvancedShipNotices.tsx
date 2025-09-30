import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit } from "lucide-react";
import type { ASNWithDetails, VendorInfo } from "@/lib/types";

export default function AdvancedShipNotices() {
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAsn, setSelectedAsn] = useState<ASNWithDetails | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: asns, isLoading } = useQuery<ASNWithDetails[]>({
    queryKey: ['/api/asns', statusFilter, vendorFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (vendorFilter !== 'all') {
        params.append('vendor', vendorFilter);
      }
      
      const url = `/api/asns${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 30000 // 30 seconds
  });

  // Fetch vendors for dropdown
  const { data: vendors } = useQuery<VendorInfo[]>({
    queryKey: ['/api/vendors'],
    staleTime: 60000 // 1 minute
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Open</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Partial</Badge>;
      case 'complete':
        return <Badge variant="default" className="bg-green-100 text-green-800">Complete</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get vendors with connected or paused status for filter
  const availableVendors = vendors?.filter(vendor => 
    vendor.status === 'connected' || vendor.status === 'paused'
  ) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Ship Notices</h1>
          <p className="text-muted-foreground">
            Track and manage advanced ship notices from vendors
          </p>
        </div>
      </div>
      
      {/* Filter Controls */}
      <div className="flex space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Vendors</label>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {availableVendors.map(vendor => (
                  <SelectItem key={vendor.id} value={vendor.name}>{vendor.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

      {/* ASN Table */}
      <Card>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse">
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : asns && asns.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ASN Number</TableHead>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Ship Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items Shipped</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {asns.map((asn) => (
                    <TableRow 
                      key={asn.id} 
                      className="table-hover cursor-pointer hover:bg-gray-50"
                      onDoubleClick={() => {
                        setSelectedAsn(asn);
                        setIsDialogOpen(true);
                      }}
                    >
                      <TableCell className="text-sm font-medium text-gray-900">
                        {asn.asnNumber}
                      </TableCell>
                      <TableCell className="text-sm text-gray-900">
                        {asn.orderNumber}
                      </TableCell>
                      <TableCell className="text-sm text-gray-900">
                        {asn.vendor}
                      </TableCell>
                      <TableCell className="text-sm text-gray-900">
                        {formatDate(asn.shipDate)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(asn.status)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-900">
                        {asn.itemsShipped} of {asn.itemsTotal}
                      </TableCell>
                      <TableCell className="text-sm text-primary font-mono">
                        {asn.trackingNumber ? (
                          <a
                            href={`https://www.fedex.com/fedextrack/?trknbr=${asn.trackingNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {asn.trackingNumber}
                          </a>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedAsn(asn)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-6xl">
                            <DialogHeader>
                              <DialogTitle>Ship Notice Details - {asn.asnNumber}</DialogTitle>
                            </DialogHeader>
                            <ASNDetailsModal asnId={asn.id} />
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No ship notices found
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Controlled Dialog for double-click */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Ship Notice Details - {selectedAsn?.asnNumber}</DialogTitle>
          </DialogHeader>
          {selectedAsn && <ASNDetailsModal asnId={selectedAsn.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ASN Details Modal Component
function ASNDetailsModal({ asnId }: { asnId: number }) {
  const { data: asnItems, isLoading } = useQuery({
    queryKey: ['/api/asns', asnId, 'items'],
    queryFn: async () => {
      const response = await fetch(`/api/asns/${asnId}/items`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const { data: orderItems } = useQuery({
    queryKey: ['/api/asns', asnId, 'order-items'],
    queryFn: async () => {
      const response = await fetch(`/api/asns/${asnId}/order-items`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">
        Shipment items showing quantities shipped vs ordered
      </div>
      
      {asnItems && asnItems.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part Number</TableHead>
                <TableHead>Vendor SKU</TableHead>
                <TableHead>UPC</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Qty Ordered</TableHead>
                <TableHead>Qty Shipped</TableHead>
                <TableHead>Qty Backordered</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Total Price</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {asnItems.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm font-medium text-gray-900">
                    {item.partNumber || 'N/A'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {item.vendorSku || 'N/A'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">
                    {item.upc || 'N/A'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">
                    {item.productName || 'N/A'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">
                    {item.quantityOrdered || 0}
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">
                    {item.quantityShipped || 0}
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">
                    {item.quantityBackordered || 0}
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">
                    {item.cost || 'N/A'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">
                    {item.totalPrice || 'N/A'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    <div className="max-w-xs">
                      {item.lipseyNote || 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {item.quantityShipped === item.quantityOrdered ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">Complete</Badge>
                      ) : item.quantityShipped > 0 ? (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Partial</Badge>
                      ) : (
                        <Badge variant="destructive" className="bg-red-100 text-red-800">Backordered</Badge>
                      )}
                      {item.blocked && (
                        <Badge variant="outline" className="bg-red-50 text-red-700">Blocked</Badge>
                      )}
                      {item.allocated && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700">Allocated</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    <div className="max-w-xs">
                      {item.errors && item.errors.length > 0 && (
                        <div className="text-xs text-red-600">
                          {item.errors.join(', ')}
                        </div>
                      )}
                      {item.lipseyOrderNumber && (
                        <div className="text-xs text-gray-500">
                          Lipsey Order: {item.lipseyOrderNumber}
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              
              {/* Total Row */}
              <TableRow className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                <TableCell colSpan={7} className="text-right text-sm font-semibold">
                  Total Cost of Items Shipped:
                </TableCell>
                <TableCell className="text-sm font-semibold">
                  {asnItems.length > 0 ? (
                    (() => {
                      const totalCost = asnItems.reduce((sum: number, item: any) => {
                        // Calculate cost per item shipped (unit cost × quantity shipped)
                        const unitCost = parseFloat(item.cost?.replace('$', '') || '0');
                        const quantityShipped = item.quantityShipped || 0;
                        return sum + (unitCost * quantityShipped);
                      }, 0);
                      return `$${totalCost.toFixed(2)}`;
                    })()
                  ) : '$0.00'}
                </TableCell>
                <TableCell colSpan={4}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No shipment items found
        </div>
      )}
    </div>
  );
}
