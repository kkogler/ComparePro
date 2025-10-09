import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getVendorIdentifier } from "@/lib/vendor-utils";
// Using any for Order and Vendor since they're from shared schema
interface Order {
  id: number;
  companyId: number;
  orderNumber: string;
  status: string;
  orderType?: string;
  shipToName?: string;
  shipToLine1?: string;
  shipToLine2?: string;
  shipToCity?: string;
  shipToStateCode?: string;
  shipToZip?: string;
  dropShipFlag?: boolean;
  customer?: string;
  deliveryOption?: string;
  insuranceFlag?: boolean;
  adultSignatureFlag?: boolean;
  billingName?: string;
  billingLine1?: string;
  billingLine2?: string;
  billingCity?: string;
  billingStateCode?: string;
  billingZip?: string;
  warehouse?: string;
  customerPhone?: string;
  delayShipping?: boolean;
  overnight?: boolean;
  messageForSalesExec?: string;
  fflNumber?: string;
  externalOrderNumber?: string;
}

interface Vendor {
  id: number;
  name: string;
  vendorShortCode?: string;
  integrationType: string;
  status: string;
}
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, CheckCircle, Send, Settings, Truck, Package, MapPin } from "lucide-react";

interface ElectronicOrderingPanelProps {
  order: Order;
  vendor: Vendor;
  onOrderUpdated?: () => void;
}

interface OrderType {
  id: string;
  name: string;
  description: string;
}

interface ValidationResult {
  success: boolean;
  errors: string[];
}

export function ElectronicOrderingPanel({ order, vendor, onOrderUpdated }: ElectronicOrderingPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrderType, setSelectedOrderType] = useState(order.orderType || 'standard');
  const [shippingData, setShippingData] = useState({
    shipToName: order.shipToName || '',
    shipToLine1: order.shipToLine1 || '',
    shipToLine2: order.shipToLine2 || '',
    shipToCity: order.shipToCity || '',
    shipToStateCode: order.shipToStateCode || '',
    shipToZip: order.shipToZip || '',
  });
  const [dropShipData, setDropShipData] = useState({
    dropShipFlag: order.dropShipFlag || false,
    customer: order.customer || '',
    deliveryOption: order.deliveryOption || 'best',
    insuranceFlag: order.insuranceFlag || false,
    adultSignatureFlag: order.adultSignatureFlag || false,
  });
  const [billingData, setBillingData] = useState({
    billingName: order.billingName || '',
    billingLine1: order.billingLine1 || '',
    billingLine2: order.billingLine2 || '',
    billingCity: order.billingCity || '',
    billingStateCode: order.billingStateCode || '',
    billingZip: order.billingZip || '',
  });
  const [lipseysData, setLipseysData] = useState({
    warehouse: order.warehouse || '',
    customerPhone: order.customerPhone || '',
    delayShipping: order.delayShipping || false,
    overnight: order.overnight || false,
    messageForSalesExec: order.messageForSalesExec || '',
  });
  const [fflNumber, setFflNumber] = useState(order.fflNumber || '');

  // Get supported order types for this vendor
  // ✅ STANDARDIZED: Use vendor utility to get correct identifier
  const vendorIdentifier = vendor ? getVendorIdentifier(vendor) : null;
  const { data: orderTypesData } = useQuery({
    queryKey: [`/org/${order.companyId}/api/vendors/${vendorIdentifier}/order-types`],
    enabled: !!vendorIdentifier,
  });

  const orderTypes: OrderType[] = (orderTypesData as any)?.orderTypes || [
    { id: 'standard', name: 'Standard Order', description: 'Standard order processing' }
  ];

  // Validate order mutation
  const validateMutation = useMutation({
    mutationFn: async (): Promise<ValidationResult> => {
      const response = await apiRequest(`/org/${order.companyId}/api/orders/${order.id}/validate`, 'POST');
      return response as unknown as ValidationResult;
    },
    onSuccess: (data: ValidationResult) => {
      if (data.success) {
        toast({
          title: "Order Validated",
          description: "Order is ready for electronic submission",
        });
      } else {
        toast({
          title: "Validation Failed",
          description: data.errors.join(', '),
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Validation Error",
        description: "Failed to validate order",
        variant: "destructive",
      });
    },
  });

  // Submit order mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      // First update the order with current form data
      await apiRequest(`/org/${order.companyId}/api/orders/${order.id}`, 'PATCH', {
        orderType: selectedOrderType,
        ...shippingData,
        ...dropShipData,
        ...billingData,
        ...lipseysData,
        fflNumber,
      });

      // Then submit to vendor
      return apiRequest(`/org/${order.companyId}/api/orders/${order.id}/submit`, 'POST');
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "Order Submitted Successfully",
          description: data.externalOrderNumber 
            ? `Vendor Order #: ${data.externalOrderNumber}`
            : "Order submitted to vendor",
        });
        queryClient.invalidateQueries({ queryKey: [`/org/${order.companyId}/api/orders`] });
        onOrderUpdated?.();
      } else {
        toast({
          title: "Submission Failed",
          description: data.errors?.join(', ') || "Order submission failed",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Submission Error",
        description: "Failed to submit order electronically",
        variant: "destructive",
      });
    },
  });

  const canSubmitElectronically = vendor.integrationType === 'api' && 
                                 vendor.status === 'online' && 
                                 order.status === 'draft';

  const isChattanooga = vendor.vendorShortCode?.toLowerCase().includes('chattanooga');
  const isLipseys = vendor.vendorShortCode?.toLowerCase().includes('lipsey');
  const isDropShipOrder = selectedOrderType.includes('dropship') || dropShipData.dropShipFlag;
  const requiresFFL = selectedOrderType === 'dropship_firearm' || 
                      (isChattanooga && dropShipData.dropShipFlag && fflNumber);

  return (
    <Card className="mt-6" data-testid="electronic-ordering-panel">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          <CardTitle>Electronic Ordering</CardTitle>
          <Badge variant={canSubmitElectronically ? "default" : "secondary"}>
            {canSubmitElectronically ? "Available" : "Not Available"}
          </Badge>
        </div>
        <CardDescription>
          Submit this order electronically to {vendor.name}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {!canSubmitElectronically && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Electronic ordering is not available. Vendor must be online with API integration.
            </AlertDescription>
          </Alert>
        )}

        {canSubmitElectronically && (
          <>
            {/* Order Type Selection */}
            <div className="space-y-2">
              <Label>Order Type</Label>
              <Select value={selectedOrderType} onValueChange={setSelectedOrderType}>
                <SelectTrigger data-testid="select-order-type">
                  <SelectValue placeholder="Select order type" />
                </SelectTrigger>
                <SelectContent>
                  {orderTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div>
                        <div className="font-medium">{type.name}</div>
                        <div className="text-sm text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Shipping Address */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <Label className="text-base font-medium">Shipping Address</Label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={shippingData.shipToName}
                    onChange={(e) => setShippingData(prev => ({ ...prev, shipToName: e.target.value }))}
                    placeholder="Recipient name"
                    data-testid="input-ship-to-name"
                  />
                </div>
                <div>
                  <Label>Address Line 1</Label>
                  <Input
                    value={shippingData.shipToLine1}
                    onChange={(e) => setShippingData(prev => ({ ...prev, shipToLine1: e.target.value }))}
                    placeholder="Street address"
                    data-testid="input-ship-to-line1"
                  />
                </div>
                <div>
                  <Label>Address Line 2</Label>
                  <Input
                    value={shippingData.shipToLine2}
                    onChange={(e) => setShippingData(prev => ({ ...prev, shipToLine2: e.target.value }))}
                    placeholder="Apt, suite, etc. (optional)"
                    data-testid="input-ship-to-line2"
                  />
                </div>
                <div>
                  <Label>City</Label>
                  <Input
                    value={shippingData.shipToCity}
                    onChange={(e) => setShippingData(prev => ({ ...prev, shipToCity: e.target.value }))}
                    placeholder="City"
                    data-testid="input-ship-to-city"
                  />
                </div>
                <div>
                  <Label>State</Label>
                  <Input
                    value={shippingData.shipToStateCode}
                    onChange={(e) => setShippingData(prev => ({ ...prev, shipToStateCode: e.target.value }))}
                    placeholder="State code (e.g., CA)"
                    data-testid="input-ship-to-state"
                  />
                </div>
                <div>
                  <Label>ZIP Code</Label>
                  <Input
                    value={shippingData.shipToZip}
                    onChange={(e) => setShippingData(prev => ({ ...prev, shipToZip: e.target.value }))}
                    placeholder="ZIP code"
                    data-testid="input-ship-to-zip"
                  />
                </div>
              </div>
            </div>

            {/* Drop-Ship Options for Chattanooga */}
            {isChattanooga && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    <Label className="text-base font-medium">Drop-Ship Options</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dropShipFlag"
                      checked={dropShipData.dropShipFlag}
                      onCheckedChange={(checked) => 
                        setDropShipData(prev => ({ ...prev, dropShipFlag: checked as boolean }))
                      }
                      data-testid="checkbox-drop-ship"
                    />
                    <Label htmlFor="dropShipFlag">Enable Drop-Ship (ship directly to customer)</Label>
                  </div>

                  {dropShipData.dropShipFlag && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                      <div>
                        <Label>Customer Name</Label>
                        <Input
                          value={dropShipData.customer}
                          onChange={(e) => setDropShipData(prev => ({ ...prev, customer: e.target.value }))}
                          placeholder="Customer name"
                          data-testid="input-customer-name"
                        />
                      </div>
                      <div>
                        <Label>Delivery Option</Label>
                        <Select 
                          value={dropShipData.deliveryOption} 
                          onValueChange={(value) => setDropShipData(prev => ({ ...prev, deliveryOption: value }))}
                        >
                          <SelectTrigger data-testid="select-delivery-option">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="best">Best</SelectItem>
                            <SelectItem value="fastest">Fastest</SelectItem>
                            <SelectItem value="economy">Economy</SelectItem>
                            <SelectItem value="ground">Ground</SelectItem>
                            <SelectItem value="next_day_air">Next Day Air</SelectItem>
                            <SelectItem value="second_day_air">Second Day Air</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="insuranceFlag"
                          checked={dropShipData.insuranceFlag}
                          onCheckedChange={(checked) => 
                            setDropShipData(prev => ({ ...prev, insuranceFlag: checked as boolean }))
                          }
                          data-testid="checkbox-insurance"
                        />
                        <Label htmlFor="insuranceFlag">Add Insurance</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="adultSignatureFlag"
                          checked={dropShipData.adultSignatureFlag}
                          onCheckedChange={(checked) => 
                            setDropShipData(prev => ({ ...prev, adultSignatureFlag: checked as boolean }))
                          }
                          data-testid="checkbox-adult-signature"
                        />
                        <Label htmlFor="adultSignatureFlag">Require Adult Signature</Label>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Billing Address for Lipsey's Drop-Ship */}
            {isLipseys && selectedOrderType === 'dropship_accessory' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <Label className="text-base font-medium">Billing Address</Label>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Billing Name</Label>
                      <Input
                        value={billingData.billingName}
                        onChange={(e) => setBillingData(prev => ({ ...prev, billingName: e.target.value }))}
                        placeholder="Billing name"
                        data-testid="input-billing-name"
                      />
                    </div>
                    <div>
                      <Label>Billing Address Line 1</Label>
                      <Input
                        value={billingData.billingLine1}
                        onChange={(e) => setBillingData(prev => ({ ...prev, billingLine1: e.target.value }))}
                        placeholder="Billing street address"
                        data-testid="input-billing-line1"
                      />
                    </div>
                    <div>
                      <Label>Billing Address Line 2</Label>
                      <Input
                        value={billingData.billingLine2}
                        onChange={(e) => setBillingData(prev => ({ ...prev, billingLine2: e.target.value }))}
                        placeholder="Apt, suite, etc. (optional)"
                        data-testid="input-billing-line2"
                      />
                    </div>
                    <div>
                      <Label>Billing City</Label>
                      <Input
                        value={billingData.billingCity}
                        onChange={(e) => setBillingData(prev => ({ ...prev, billingCity: e.target.value }))}
                        placeholder="Billing city"
                        data-testid="input-billing-city"
                      />
                    </div>
                    <div>
                      <Label>Billing State</Label>
                      <Input
                        value={billingData.billingStateCode}
                        onChange={(e) => setBillingData(prev => ({ ...prev, billingStateCode: e.target.value }))}
                        placeholder="State code (e.g., CA)"
                        data-testid="input-billing-state"
                      />
                    </div>
                    <div>
                      <Label>Billing ZIP</Label>
                      <Input
                        value={billingData.billingZip}
                        onChange={(e) => setBillingData(prev => ({ ...prev, billingZip: e.target.value }))}
                        placeholder="ZIP code"
                        data-testid="input-billing-zip"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Lipsey's Additional Options */}
            {isLipseys && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <Label className="text-base font-medium">Lipsey's Options</Label>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedOrderType !== 'standard' && (
                      <div>
                        <Label>Warehouse</Label>
                        <Select 
                          value={lipseysData.warehouse} 
                          onValueChange={(value) => setLipseysData(prev => ({ ...prev, warehouse: value }))}
                        >
                          <SelectTrigger data-testid="select-warehouse">
                            <SelectValue placeholder="Select warehouse" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="louisiana">Louisiana</SelectItem>
                            <SelectItem value="north_carolina">North Carolina</SelectItem>
                            <SelectItem value="texas">Texas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {selectedOrderType === 'dropship_firearm' && (
                      <div>
                        <Label>Customer Phone</Label>
                        <Input
                          value={lipseysData.customerPhone}
                          onChange={(e) => setLipseysData(prev => ({ ...prev, customerPhone: e.target.value }))}
                          placeholder="Customer phone number"
                          data-testid="input-customer-phone"
                        />
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="delayShipping"
                        checked={lipseysData.delayShipping}
                        onCheckedChange={(checked) => 
                          setLipseysData(prev => ({ ...prev, delayShipping: checked as boolean }))
                        }
                        data-testid="checkbox-delay-shipping"
                      />
                      <Label htmlFor="delayShipping">Delay Shipping</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="overnight"
                        checked={lipseysData.overnight}
                        onCheckedChange={(checked) => 
                          setLipseysData(prev => ({ ...prev, overnight: checked as boolean }))
                        }
                        data-testid="checkbox-overnight"
                      />
                      <Label htmlFor="overnight">Overnight Shipping</Label>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Message for Sales Executive</Label>
                    <Textarea
                      value={lipseysData.messageForSalesExec}
                      onChange={(e) => setLipseysData(prev => ({ ...prev, messageForSalesExec: e.target.value }))}
                      placeholder="Optional message for Lipsey's sales team"
                      data-testid="textarea-sales-message"
                    />
                  </div>
                </div>
              </>
            )}

            {/* FFL Number for Firearms */}
            {requiresFFL && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>FFL Number</Label>
                  <Input
                    value={fflNumber}
                    onChange={(e) => setFflNumber(e.target.value)}
                    placeholder="Federal Firearms License number"
                    data-testid="input-ffl-number"
                  />
                  <p className="text-sm text-muted-foreground">
                    Required for firearm orders. Hyphens will be automatically removed.
                  </p>
                </div>
              </>
            )}

            <Separator />

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => validateMutation.mutate()}
                disabled={validateMutation.isPending}
                variant="outline"
                data-testid="button-validate-order"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {validateMutation.isPending ? "Validating..." : "Validate Order"}
              </Button>
              
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || order.status !== 'draft'}
                data-testid="button-submit-order"
              >
                <Send className="mr-2 h-4 w-4" />
                {submitMutation.isPending ? "Submitting..." : "Submit Order"}
              </Button>
            </div>

            {order.externalOrderNumber && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Order submitted successfully. Vendor Order Number: {order.externalOrderNumber}
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}