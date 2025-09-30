import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Comprehensive Ship Notice Schema
const shipNoticeItemSchema = z.object({
  productName: z.string().min(1, "Product name required"),
  sku: z.string().min(1, "SKU required"),
  manufacturerPartNumber: z.string().optional(),
  vendorProductId: z.string().optional(),
  upc: z.string().optional(),
  modelStyle: z.string().optional(),
  costToDealer: z.number().min(0, "Cost must be positive"),
  msrp: z.number().min(0, "MSRP must be positive").optional(),
  map: z.number().min(0, "MAP must be positive").optional(),
  caliber: z.string().optional(),
  weight: z.number().min(0, "Weight must be positive").optional(),
  manufacturerBrand: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  quantityShipped: z.number().min(1, "Quantity shipped must be at least 1"),
  quantityBackordered: z.number().min(0, "Quantity backordered cannot be negative").optional(),
});

const shipNoticeSchema = z.object({
  // Order Level Fields
  shipDate: z.string().min(1, "Ship date required"),
  shipmentId: z.string().optional(),
  purchaseOrderId: z.string().optional(),
  vendorId: z.number().min(1, "Vendor required"),
  totalUnitsShipped: z.number().min(0, "Total units shipped cannot be negative"),
  totalUnitsBackordered: z.number().min(0, "Total units backordered cannot be negative").optional(),
  poShippingCost: z.number().min(0, "Shipping cost cannot be negative").optional(),
  poOtherCost: z.number().min(0, "Other cost cannot be negative").optional(),
  totalPoAmount: z.number().min(0, "Total PO amount cannot be negative").optional(),
  poNote: z.string().optional(),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  
  // Items array
  items: z.array(shipNoticeItemSchema).min(1, "At least one item required"),
});

type ShipNoticeFormData = z.infer<typeof shipNoticeSchema>;
type ShipNoticeItemData = z.infer<typeof shipNoticeItemSchema>;

interface ShipNoticeDetailFormProps {
  orderId?: number;
  vendorId?: number;
  onSubmit: (data: ShipNoticeFormData) => Promise<void>;
  onCancel: () => void;
}

const carrierOptions = [
  { value: "UPS", label: "UPS" },
  { value: "FedEx", label: "FedEx" },
  { value: "USPS", label: "USPS" },
  { value: "DHL", label: "DHL" },
  { value: "Other", label: "Other" },
];

export default function ShipNoticeDetailForm({ 
  orderId, 
  vendorId, 
  onSubmit, 
  onCancel 
}: ShipNoticeDetailFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ShipNoticeFormData>({
    resolver: zodResolver(shipNoticeSchema),
    defaultValues: {
      shipDate: new Date().toISOString().split('T')[0],
      vendorId: vendorId || undefined,
      totalUnitsShipped: 0,
      totalUnitsBackordered: 0,
      poShippingCost: 0,
      poOtherCost: 0,
      totalPoAmount: 0,
      items: [{
        productName: "",
        sku: "",
        costToDealer: 0,
        quantityShipped: 1,
        quantityBackordered: 0,
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const addItem = () => {
    append({
      productName: "",
      sku: "",
      costToDealer: 0,
      quantityShipped: 1,
      quantityBackordered: 0,
    });
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
      updateTotals();
    }
  };

  const updateTotals = () => {
    const items = form.getValues("items");
    const totalShipped = items.reduce((sum, item) => sum + (item.quantityShipped || 0), 0);
    const totalBackordered = items.reduce((sum, item) => sum + (item.quantityBackordered || 0), 0);
    const totalAmount = items.reduce((sum, item) => sum + ((item.costToDealer || 0) * (item.quantityShipped || 0)), 0);
    
    form.setValue("totalUnitsShipped", totalShipped);
    form.setValue("totalUnitsBackordered", totalBackordered);
    form.setValue("totalPoAmount", totalAmount);
  };

  const handleSubmit = async (data: ShipNoticeFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      toast({
        title: "Ship Notice Created",
        description: "Ship notice has been successfully created and processed.",
      });
    } catch (error: any) {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create ship notice",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        
        {/* Order Level Information */}
        <Card>
          <CardHeader>
            <CardTitle>Ship Notice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="shipDate">Ship Date *</Label>
                <Input
                  id="shipDate"
                  type="date"
                  {...form.register("shipDate")}
                />
                {form.formState.errors.shipDate && (
                  <p className="text-sm text-red-600">{form.formState.errors.shipDate.message}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="shipmentId">Shipment ID</Label>
                <Input
                  id="shipmentId"
                  placeholder="Vendor shipment identifier"
                  {...form.register("shipmentId")}
                />
              </div>
              
              <div>
                <Label htmlFor="purchaseOrderId">Purchase Order ID</Label>
                <Input
                  id="purchaseOrderId"
                  placeholder="Original PO reference"
                  {...form.register("purchaseOrderId")}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="trackingNumber">Tracking Number</Label>
                <Input
                  id="trackingNumber"
                  placeholder="Package tracking number"
                  {...form.register("trackingNumber")}
                />
              </div>
              
              <div>
                <Label htmlFor="carrier">Carrier</Label>
                <Select onValueChange={(value) => form.setValue("carrier", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    {carrierOptions.map((carrier) => (
                      <SelectItem key={carrier.value} value={carrier.value}>
                        {carrier.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="vendorId">Vendor ID</Label>
                <Input
                  id="vendorId"
                  type="number"
                  {...form.register("vendorId", { valueAsNumber: true })}
                />
                {form.formState.errors.vendorId && (
                  <p className="text-sm text-red-600">{form.formState.errors.vendorId.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="poShippingCost">PO Shipping Cost</Label>
                <Input
                  id="poShippingCost"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...form.register("poShippingCost", { valueAsNumber: true })}
                />
              </div>
              
              <div>
                <Label htmlFor="poOtherCost">PO Other Cost</Label>
                <Input
                  id="poOtherCost"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...form.register("poOtherCost", { valueAsNumber: true })}
                />
              </div>
              
              <div>
                <Label htmlFor="totalUnitsShipped">Total Units Shipped</Label>
                <Input
                  id="totalUnitsShipped"
                  type="number"
                  readOnly
                  className="bg-gray-50"
                  {...form.register("totalUnitsShipped", { valueAsNumber: true })}
                />
              </div>
              
              <div>
                <Label htmlFor="totalPoAmount">Total PO Amount</Label>
                <Input
                  id="totalPoAmount"
                  type="number"
                  step="0.01"
                  readOnly
                  className="bg-gray-50"
                  {...form.register("totalPoAmount", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="poNote">PO Note</Label>
              <Textarea
                id="poNote"
                placeholder="Additional notes about the shipment"
                rows={3}
                {...form.register("poNote")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Shipped Items */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Shipped Items</CardTitle>
              <Button type="button" onClick={addItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name *</TableHead>
                    <TableHead>SKU *</TableHead>
                    <TableHead>Mfg Part #</TableHead>
                    <TableHead>UPC</TableHead>
                    <TableHead>Model/Style</TableHead>
                    <TableHead>Cost *</TableHead>
                    <TableHead>MSRP</TableHead>
                    <TableHead>MAP</TableHead>
                    <TableHead>Caliber</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Qty Shipped *</TableHead>
                    <TableHead>Qty Backorder</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Image URL</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Input
                          placeholder="Product name"
                          {...form.register(`items.${index}.productName`)}
                          onChange={(e) => {
                            form.setValue(`items.${index}.productName`, e.target.value);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="SKU"
                          {...form.register(`items.${index}.sku`)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Part number"
                          {...form.register(`items.${index}.manufacturerPartNumber`)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="UPC"
                          {...form.register(`items.${index}.upc`)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Model/Style"
                          {...form.register(`items.${index}.modelStyle`)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...form.register(`items.${index}.costToDealer`, { 
                            valueAsNumber: true,
                            onChange: updateTotals
                          })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...form.register(`items.${index}.msrp`, { valueAsNumber: true })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...form.register(`items.${index}.map`, { valueAsNumber: true })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Caliber"
                          {...form.register(`items.${index}.caliber`)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="lbs"
                          {...form.register(`items.${index}.weight`, { valueAsNumber: true })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Brand"
                          {...form.register(`items.${index}.manufacturerBrand`)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Category"
                          {...form.register(`items.${index}.category`)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          {...form.register(`items.${index}.quantityShipped`, { 
                            valueAsNumber: true,
                            onChange: updateTotals
                          })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          {...form.register(`items.${index}.quantityBackordered`, { 
                            valueAsNumber: true,
                            onChange: updateTotals
                          })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Description"
                          {...form.register(`items.${index}.description`)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="https://..."
                          {...form.register(`items.${index}.imageUrl`)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="btn-orange-action">
            {isSubmitting ? "Creating..." : "Create Ship Notice"}
          </Button>
        </div>
      </form>
    </div>
  );
}