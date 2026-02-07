import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { CalendarIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { BloodUnit } from "./BloodUnitCard";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const COMPONENT_TYPES = [
  { value: "whole_blood", label: "Whole Blood" },
  { value: "packed_rbc", label: "Packed RBC" },
  { value: "plasma", label: "Fresh Frozen Plasma" },
  { value: "platelets", label: "Platelets" },
  { value: "cryoprecipitate", label: "Cryoprecipitate" },
];

interface AddBloodUnitSheetProps {
  hospitalId: string;
  onAdd: () => void;
  editingUnit?: BloodUnit | null;
  onEditComplete?: () => void;
}

export const AddBloodUnitSheet = ({
  hospitalId,
  onAdd,
  editingUnit,
  onEditComplete,
}: AddBloodUnitSheetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [bloodGroup, setBloodGroup] = useState(editingUnit?.blood_group || "");
  const [collectionDate, setCollectionDate] = useState<Date | undefined>(
    editingUnit ? new Date(editingUnit.collection_date) : new Date()
  );
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(
    editingUnit ? new Date(editingUnit.expiry_date) : addDays(new Date(), 35)
  );
  const [donorId, setDonorId] = useState(editingUnit?.donor_id || "");
  const [donorName, setDonorName] = useState(editingUnit?.donor_name || "");
  const [bagNumber, setBagNumber] = useState(editingUnit?.bag_number || "");
  const [volumeMl, setVolumeMl] = useState(editingUnit?.volume_ml?.toString() || "450");
  const [batchNumber, setBatchNumber] = useState(editingUnit?.batch_number || "");
  const [componentType, setComponentType] = useState(editingUnit?.component_type || "whole_blood");
  const [remarks, setRemarks] = useState(editingUnit?.remarks || "");

  // Re-initialize form state when editingUnit changes
  useEffect(() => {
    if (editingUnit) {
      setBloodGroup(editingUnit.blood_group);
      setCollectionDate(new Date(editingUnit.collection_date));
      setExpiryDate(new Date(editingUnit.expiry_date));
      setDonorId(editingUnit.donor_id || "");
      setDonorName(editingUnit.donor_name || "");
      setBagNumber(editingUnit.bag_number || "");
      setVolumeMl(editingUnit.volume_ml?.toString() || "450");
      setBatchNumber(editingUnit.batch_number || "");
      setComponentType(editingUnit.component_type || "whole_blood");
      setRemarks(editingUnit.remarks || "");
    }
  }, [editingUnit]);

  const resetForm = () => {
    setBloodGroup("");
    setCollectionDate(new Date());
    setExpiryDate(addDays(new Date(), 35));
    setDonorId("");
    setDonorName("");
    setBagNumber("");
    setVolumeMl("450");
    setBatchNumber("");
    setComponentType("whole_blood");
    setRemarks("");
  };

  const handleCollectionDateChange = (date: Date | undefined) => {
    setCollectionDate(date);
    if (date) {
      // Default expiry to 35 days after collection for whole blood
      setExpiryDate(addDays(date, 35));
    }
  };

  const handleSubmit = async () => {
    if (!bloodGroup || !collectionDate || !expiryDate) {
      toast.error("Blood group, collection date, and expiry date are required");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("manage-blood-unit", {
        body: {
          action: editingUnit ? "update" : "add",
          hospital_id: hospitalId,
          unit_id: editingUnit?.id,
          blood_group: bloodGroup,
          collection_date: format(collectionDate, "yyyy-MM-dd"),
          expiry_date: format(expiryDate, "yyyy-MM-dd"),
          donor_id: donorId || null,
          donor_name: donorName || null,
          bag_number: bagNumber || null,
          volume_ml: parseInt(volumeMl) || 450,
          batch_number: batchNumber || null,
          component_type: componentType,
          remarks: remarks || null,
        },
      });

      if (error) throw error;

      toast.success(editingUnit ? "Blood unit updated" : "Blood unit added");
      setIsOpen(false);
      resetForm();
      onAdd();
      if (editingUnit && onEditComplete) {
        onEditComplete();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save blood unit");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen || !!editingUnit} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        resetForm();
        if (editingUnit && onEditComplete) {
          onEditComplete();
        }
      }
    }}>
      {!editingUnit && (
        <SheetTrigger asChild>
          <Button className="fixed bottom-24 right-4 h-14 px-6 rounded-full shadow-lg z-40">
            <Plus className="h-5 w-5 mr-2" />
            Add Unit
          </Button>
        </SheetTrigger>
      )}
      <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>{editingUnit ? "Edit" : "Add"} Blood Unit</SheetTitle>
          <SheetDescription>
            {editingUnit ? "Update the blood unit details" : "Enter details for the new blood unit"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-8">
          {/* Blood Group Selection */}
          <div className="space-y-2">
            <Label>Blood Group *</Label>
            <div className="grid grid-cols-4 gap-2">
              {BLOOD_GROUPS.map((bg) => (
                <Button
                  key={bg}
                  type="button"
                  variant={bloodGroup === bg ? "default" : "outline"}
                  className={cn("h-12 text-base font-bold rounded-xl", bloodGroup === bg && "ring-2 ring-primary")}
                  onClick={() => setBloodGroup(bg)}
                >
                  {bg}
                </Button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Collection Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-xl",
                      !collectionDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {collectionDate ? format(collectionDate, "MMM d, yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={collectionDate}
                    onSelect={handleCollectionDateChange}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Expiry Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-xl",
                      !expiryDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expiryDate ? format(expiryDate, "MMM d, yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expiryDate}
                    onSelect={setExpiryDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Donor Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Donor ID</Label>
              <Input
                value={donorId}
                onChange={(e) => setDonorId(e.target.value)}
                placeholder="External ID"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Donor Name</Label>
              <Input
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                placeholder="Name"
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Unit Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bag Number</Label>
              <Input
                value={bagNumber}
                onChange={(e) => setBagNumber(e.target.value)}
                placeholder="e.g. BG-2026-001"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Volume (ml)</Label>
              <Input
                type="number"
                value={volumeMl}
                onChange={(e) => setVolumeMl(e.target.value)}
                placeholder="450"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Component Type</Label>
              <Select value={componentType} onValueChange={setComponentType}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPONENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Batch Number</Label>
              <Input
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="Optional"
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any additional notes..."
              className="rounded-xl"
              rows={3}
            />
          </div>

          <Button
            onClick={handleSubmit}
            className="w-full h-12 rounded-xl"
            disabled={isSubmitting || !bloodGroup || !collectionDate || !expiryDate}
          >
            {isSubmitting ? "Saving..." : editingUnit ? "Update Unit" : "Add Blood Unit"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddBloodUnitSheet;
