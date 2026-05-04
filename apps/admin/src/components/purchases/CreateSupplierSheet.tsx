import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { adminApi } from "@/lib/config";

interface Supplier {
  _id?: string;
  name: string;
  email: string;
  contact?: string;
  address?: string;
  paymentSystem: string;
  paymentDetails?: string;
  taxId?: string;
  website?: string;
  notes?: string;
  isActive: boolean;
}

interface CreateSupplierSheetProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supplier?: Supplier | null;
}

export default function CreateSupplierSheet({
  open,
  onClose,
  onSuccess,
  supplier,
}: CreateSupplierSheetProps) {
  const [formData, setFormData] = useState<Supplier>({
    name: "",
    email: "",
    contact: "",
    address: "",
    paymentSystem: "cash",
    paymentDetails: "",
    taxId: "",
    website: "",
    notes: "",
    isActive: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name,
        email: supplier.email,
        contact: supplier.contact || "",
        address: supplier.address || "",
        paymentSystem: supplier.paymentSystem || "cash",
        paymentDetails: supplier.paymentDetails || "",
        taxId: supplier.taxId || "",
        website: supplier.website || "",
        notes: supplier.notes || "",
        isActive: supplier.isActive !== undefined ? supplier.isActive : true,
      });
    } else {
      resetForm();
    }
  }, [supplier, open]);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      contact: "",
      address: "",
      paymentSystem: "cash",
      paymentDetails: "",
      taxId: "",
      website: "",
      notes: "",
      isActive: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        name: formData.name.trim(),
        email: formData.email.trim(),
        contact: formData.contact?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        paymentDetails: formData.paymentDetails?.trim() || undefined,
        taxId: formData.taxId?.trim() || undefined,
        website: formData.website?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
      };

      if (supplier?._id) {
        // Update existing supplier
        const response = await adminApi.put(
          `/suppliers/${supplier._id}`,
          payload
        );
        if (response.data.success) {
          toast.success("Supplier updated successfully");
          resetForm();
          onSuccess();
          onClose();
        }
      } else {
        // Create new supplier
        const response = await adminApi.post("/suppliers", payload);
        if (response.data.success) {
          toast.success("Supplier created successfully");
          resetForm();
          onSuccess();
          onClose();
        }
      }
    } catch (error) {
      console.error("Error saving supplier:", error);
      const message =
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data &&
        typeof error.response.data === "object" &&
        "message" in error.response.data
          ? String(error.response.data.message)
          : "Failed to save supplier";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {supplier ? "Edit Supplier" : "Create New Supplier"}
          </SheetTitle>
          <SheetDescription>
            {supplier
              ? "Update supplier information"
              : "Add a new supplier to your database"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-6">
          {/* Required Fields */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Required Information</h3>

            <div className="space-y-2">
              <Label htmlFor="name">
                Supplier Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter supplier name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="supplier@example.com"
                required
              />
            </div>
          </div>

          {/* Optional Contact Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">
              Contact Information (Optional)
            </h3>

            <div className="space-y-2">
              <Label htmlFor="contact">Phone Number</Label>
              <Input
                id="contact"
                value={formData.contact}
                onChange={(e) =>
                  setFormData({ ...formData, contact: e.target.value })
                }
                placeholder="+1 234 567 8900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Enter full address"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
                placeholder="https://example.com"
              />
            </div>
          </div>

          {/* Payment Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">
              Payment Information (Optional)
            </h3>

            <div className="space-y-2">
              <Label htmlFor="paymentSystem">Payment System</Label>
              <Select
                value={formData.paymentSystem}
                onValueChange={(value) =>
                  setFormData({ ...formData, paymentSystem: value })
                }
              >
                <SelectTrigger id="paymentSystem">
                  <SelectValue placeholder="Select payment system" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="online">Online Payment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDetails">Payment Details</Label>
              <Textarea
                id="paymentDetails"
                value={formData.paymentDetails}
                onChange={(e) =>
                  setFormData({ ...formData, paymentDetails: e.target.value })
                }
                placeholder="Bank account, payment terms, etc."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxId">Tax ID / Business Number</Label>
              <Input
                id="taxId"
                value={formData.taxId}
                onChange={(e) =>
                  setFormData({ ...formData, taxId: e.target.value })
                }
                placeholder="Enter tax ID or business registration number"
              />
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">
              Additional Information (Optional)
            </h3>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Any additional notes about the supplier"
                rows={4}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Active Status</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading
                ? "Saving..."
                : supplier
                  ? "Update Supplier"
                  : "Create Supplier"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
