import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Droplet, Activity, Heart, Scale, AlertTriangle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { HealthRecord } from "./HealthTimeline";

interface AddHealthRecordSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onRecordAdded: (record: HealthRecord) => void;
}

const DEFERRAL_REASONS = [
  "Low hemoglobin",
  "Recent illness",
  "Medication",
  "Recent travel",
  "Low weight",
  "High/low blood pressure",
  "Recent tattoo/piercing",
  "Pregnancy/breastfeeding",
  "Other",
];

export const AddHealthRecordSheet = ({
  open,
  onOpenChange,
  userId,
  onRecordAdded,
}: AddHealthRecordSheetProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordDate, setRecordDate] = useState<Date>(new Date());
  const [hemoglobin, setHemoglobin] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [weight, setWeight] = useState("");
  const [isDeferred, setIsDeferred] = useState(false);
  const [deferralReason, setDeferralReason] = useState("");
  const [deferralDays, setDeferralDays] = useState("");
  const [notes, setNotes] = useState("");
  const [recordedBy, setRecordedBy] = useState("self");

  const { toast } = useToast();

  const resetForm = () => {
    setRecordDate(new Date());
    setHemoglobin("");
    setSystolic("");
    setDiastolic("");
    setPulse("");
    setWeight("");
    setIsDeferred(false);
    setDeferralReason("");
    setDeferralDays("");
    setNotes("");
    setRecordedBy("self");
  };

  const handleSubmit = async () => {
    if (!hemoglobin && !isDeferred) {
      toast({
        variant: "destructive",
        title: "Missing data",
        description: "Please enter hemoglobin level or mark as deferral",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const recordData = {
        donor_id: userId,
        record_date: format(recordDate, "yyyy-MM-dd"),
        hemoglobin_level: hemoglobin ? parseFloat(hemoglobin) : null,
        blood_pressure_systolic: systolic ? parseInt(systolic) : null,
        blood_pressure_diastolic: diastolic ? parseInt(diastolic) : null,
        pulse_rate: pulse ? parseInt(pulse) : null,
        weight_kg: weight ? parseFloat(weight) : null,
        deferral_reason: isDeferred ? deferralReason : null,
        deferral_duration_days: isDeferred && deferralDays ? parseInt(deferralDays) : null,
        health_notes: notes || null,
        recorded_by: recordedBy,
      };

      const { data, error } = await supabase
        .from("donor_health_records")
        .insert(recordData)
        .select()
        .single();

      if (error) throw error;

      toast({ title: "Health record added" });
      onRecordAdded(data as HealthRecord);
      resetForm();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to add record",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Add Health Record
          </SheetTitle>
          <SheetDescription>
            Track your donation health metrics privately
          </SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-5">
          {/* Record Date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Record Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal rounded-xl h-11",
                    !recordDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {recordDate ? format(recordDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-background" align="start">
                <Calendar
                  mode="single"
                  selected={recordDate}
                  onSelect={(date) => date && setRecordDate(date)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Recorded By */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Recorded By</Label>
            <Select value={recordedBy} onValueChange={setRecordedBy}>
              <SelectTrigger className="rounded-xl h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="self">Self-recorded</SelectItem>
                <SelectItem value="hospital">Hospital/Clinic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Hemoglobin */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Droplet className="h-4 w-4 text-primary" />
              Hemoglobin Level
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.1"
                placeholder="14.2"
                value={hemoglobin}
                onChange={(e) => setHemoglobin(e.target.value)}
                className="rounded-xl h-11"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">g/dL</span>
            </div>
            <p className="text-xs text-muted-foreground">Normal range: 12.0–17.5 g/dL</p>
          </div>

          {/* Blood Pressure */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Blood Pressure (optional)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="120"
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                className="rounded-xl h-11 flex-1"
              />
              <span className="text-muted-foreground">/</span>
              <Input
                type="number"
                placeholder="80"
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                className="rounded-xl h-11 flex-1"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">mmHg</span>
            </div>
          </div>

          {/* Other Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                Pulse (optional)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="72"
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                  className="rounded-xl h-11"
                />
                <span className="text-xs text-muted-foreground">BPM</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Scale className="h-4 w-4 text-purple-500" />
                Weight (optional)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="65.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="rounded-xl h-11"
                />
                <span className="text-xs text-muted-foreground">kg</span>
              </div>
            </div>
          </div>

          {/* Deferral */}
          <div className="space-y-3 p-4 rounded-xl bg-muted/30">
            <div className="flex items-center gap-3">
              <Checkbox
                id="deferred"
                checked={isDeferred}
                onCheckedChange={(checked) => setIsDeferred(checked === true)}
              />
              <Label
                htmlFor="deferred"
                className="text-sm font-medium flex items-center gap-2 cursor-pointer"
              >
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                I was deferred from donating
              </Label>
            </div>

            {isDeferred && (
              <div className="space-y-3 pt-2">
                <Select value={deferralReason} onValueChange={setDeferralReason}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {DEFERRAL_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Days"
                    value={deferralDays}
                    onChange={(e) => setDeferralDays(e.target.value)}
                    className="rounded-xl h-11"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">days deferral</span>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Health Notes (private)
            </Label>
            <Textarea
              placeholder="Any additional notes about your health..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl min-h-[80px] resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-border/50">
          <Button
            variant="outline"
            className="flex-1 rounded-xl h-11"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl h-11"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Record"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
