import { useState, useEffect } from "react";
import { Minus, Plus, Droplets, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface BloodStock {
  id: string;
  blood_group: string;
  units_available: number;
  units_reserved: number;
  expiry_date: string | null;
  status: string;
  notes: string | null;
  last_updated: string;
}

interface StockUpdateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  hospitalId: string;
  hospitalPin: string;
  selectedBloodGroup: string | null;
  currentStock: BloodStock | null;
  onUpdate: (stock: BloodStock[]) => void;
  allBloodGroups: string[];
}

const CHANGE_REASONS = [
  { value: "donation", label: "Donation Received" },
  { value: "transfusion", label: "Transfusion/Used" },
  { value: "expired", label: "Expired" },
  { value: "transfer_in", label: "Transfer In" },
  { value: "transfer_out", label: "Transfer Out" },
  { value: "correction", label: "Correction" },
];

const StockUpdateSheet = ({
  isOpen,
  onClose,
  hospitalId,
  hospitalPin,
  selectedBloodGroup,
  currentStock,
  onUpdate,
  allBloodGroups,
}: StockUpdateSheetProps) => {
  const [bloodGroup, setBloodGroup] = useState(selectedBloodGroup || "");
  const [action, setAction] = useState<"add" | "remove" | "set">("add");
  const [units, setUnits] = useState(1);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();
  const [reason, setReason] = useState("donation");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (selectedBloodGroup) {
      setBloodGroup(selectedBloodGroup);
    }
    if (currentStock) {
      setExpiryDate(currentStock.expiry_date ? new Date(currentStock.expiry_date) : undefined);
      setNotes(currentStock.notes || "");
    } else {
      setExpiryDate(undefined);
      setNotes("");
    }
    setUnits(1);
    setAction("add");
    setReason("donation");
  }, [selectedBloodGroup, currentStock, isOpen]);

  const handleSubmit = async () => {
    if (!bloodGroup) {
      toast.error("Please select a blood group");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-blood-stock", {
        body: {
          hospital_id: hospitalId,
          pin: hospitalPin,
          blood_group: bloodGroup,
          action,
          units,
          expiry_date: expiryDate ? format(expiryDate, "yyyy-MM-dd") : null,
          reason: CHANGE_REASONS.find((r) => r.value === reason)?.label || reason,
          notes,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message || "Stock updated successfully");
        onUpdate(data.allStock);
        onClose();
      } else {
        toast.error(data.error || "Failed to update stock");
      }
    } catch (error: any) {
      console.error("Error updating stock:", error);
      toast.error(error.message || "Failed to update stock");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!bloodGroup || !currentStock) return;

    if (!confirm(`Are you sure you want to delete the ${bloodGroup} stock entry?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-blood-stock", {
        body: {
          hospital_id: hospitalId,
          pin: hospitalPin,
          blood_group: bloodGroup,
          delete: true,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Stock entry deleted");
        // Remove the deleted item from the list
        onUpdate([]);
        onClose();
        // Trigger a refresh
        window.location.reload();
      } else {
        toast.error(data.error || "Failed to delete stock");
      }
    } catch (error: any) {
      console.error("Error deleting stock:", error);
      toast.error(error.message || "Failed to delete stock");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl">
        <SheetHeader className="text-center pb-4">
          <SheetTitle className="flex items-center justify-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            {selectedBloodGroup ? `Update ${selectedBloodGroup} Stock` : "Add Blood Stock"}
          </SheetTitle>
          {currentStock && (
            <p className="text-sm text-muted-foreground">
              Current: {currentStock.units_available} units
            </p>
          )}
        </SheetHeader>

        <div className="space-y-6 overflow-y-auto max-h-[calc(90vh-200px)] pb-6">
          {/* Blood Group Selection (only if not pre-selected) */}
          {!selectedBloodGroup && (
            <div className="space-y-2">
              <Label>Blood Group</Label>
              <Select value={bloodGroup} onValueChange={setBloodGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  {allBloodGroups.map((bg) => (
                    <SelectItem key={bg} value={bg}>
                      {bg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Action Type */}
          <div className="space-y-2">
            <Label>Update Type</Label>
            <ToggleGroup
              type="single"
              value={action}
              onValueChange={(val) => val && setAction(val as "add" | "remove" | "set")}
              className="grid grid-cols-3 gap-2"
            >
              <ToggleGroupItem
                value="add"
                className="data-[state=on]:bg-emerald-500/20 data-[state=on]:text-emerald-600 data-[state=on]:border-emerald-500"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </ToggleGroupItem>
              <ToggleGroupItem
                value="remove"
                className="data-[state=on]:bg-red-500/20 data-[state=on]:text-red-600 data-[state=on]:border-red-500"
              >
                <Minus className="h-4 w-4 mr-1" />
                Remove
              </ToggleGroupItem>
              <ToggleGroupItem
                value="set"
                className="data-[state=on]:bg-blue-500/20 data-[state=on]:text-blue-600 data-[state=on]:border-blue-500"
              >
                Set Total
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Units */}
          <div className="space-y-2">
            <Label>Units</Label>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setUnits(Math.max(0, units - 1))}
                disabled={units <= 0}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={units}
                onChange={(e) => setUnits(Math.max(0, parseInt(e.target.value) || 0))}
                className="text-center text-2xl font-bold h-14"
                min={0}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setUnits(units + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Expiry Date */}
          <div className="space-y-2">
            <Label>Earliest Expiry Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expiryDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {expiryDate ? format(expiryDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={expiryDate}
                  onSelect={setExpiryDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {CHANGE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-background pt-4 border-t space-y-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !bloodGroup}
            className="w-full h-12"
          >
            {isSubmitting ? "Updating..." : "Update Stock"}
          </Button>
          {currentStock && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="w-full"
            >
              Delete Entry
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default StockUpdateSheet;
