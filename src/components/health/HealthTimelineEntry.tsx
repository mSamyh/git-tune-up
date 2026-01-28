import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Droplet, 
  Activity, 
  Heart, 
  Scale, 
  AlertTriangle, 
  FileText,
  Trash2,
  MoreVertical,
  Building2,
  User
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { HealthRecord } from "./HealthTimeline";

interface HealthTimelineEntryProps {
  record: HealthRecord;
  isLast: boolean;
  onDelete: (id: string) => void;
}

export const HealthTimelineEntry = ({ record, isLast, onDelete }: HealthTimelineEntryProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const getHemoglobinStatus = (level: number | null) => {
    if (!level) return null;
    if (level < 12.0) return { status: "low", color: "bg-red-500", textColor: "text-red-500", label: "Low" };
    if (level < 12.5) return { status: "borderline", color: "bg-amber-500", textColor: "text-amber-500", label: "Borderline" };
    return { status: "normal", color: "bg-emerald-500", textColor: "text-emerald-500", label: "Normal" };
  };

  const hemoglobinStatus = getHemoglobinStatus(record.hemoglobin_level);
  const isDeferred = !!record.deferral_reason;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("donor_health_records")
        .delete()
        .eq("id", record.id);

      if (error) throw error;

      onDelete(record.id);
      toast({ title: "Record deleted" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to delete",
        description: error.message,
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <div className="relative flex gap-3 pb-4">
        {/* Timeline connector */}
        {!isLast && (
          <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-border/50" />
        )}

        {/* Status dot */}
        <div className={`relative z-10 h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${
          isDeferred 
            ? 'bg-amber-500' 
            : hemoglobinStatus 
              ? hemoglobinStatus.color 
              : 'bg-primary'
        }`}>
          {isDeferred ? (
            <AlertTriangle className="h-3 w-3 text-white" />
          ) : (
            <Droplet className="h-3 w-3 text-white" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">
                  {format(new Date(record.record_date), "MMM d, yyyy")}
                </span>
                {isDeferred && (
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                    DEFERRED
                  </Badge>
                )}
              </div>
              
              {/* Metrics */}
              <div className="mt-1.5 space-y-1">
                {record.hemoglobin_level && (
                  <div className="flex items-center gap-2 text-sm">
                    <Droplet className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Hb: {record.hemoglobin_level} g/dL</span>
                    {hemoglobinStatus && (
                      <span className={`text-xs ${hemoglobinStatus.textColor}`}>
                        ({hemoglobinStatus.label})
                      </span>
                    )}
                  </div>
                )}

                {(record.blood_pressure_systolic && record.blood_pressure_diastolic) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Activity className="h-3.5 w-3.5" />
                    <span>BP: {record.blood_pressure_systolic}/{record.blood_pressure_diastolic} mmHg</span>
                  </div>
                )}

                {record.pulse_rate && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Heart className="h-3.5 w-3.5" />
                    <span>Pulse: {record.pulse_rate} BPM</span>
                  </div>
                )}

                {record.weight_kg && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Scale className="h-3.5 w-3.5" />
                    <span>Weight: {record.weight_kg} kg</span>
                  </div>
                )}

                {record.deferral_reason && (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Reason: {record.deferral_reason}</span>
                  </div>
                )}

                {record.health_notes && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 mt-0.5" />
                    <span className="line-clamp-2">{record.health_notes}</span>
                  </div>
                )}

                {/* Recorded by indicator */}
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                  {record.recorded_by === 'hospital' ? (
                    <>
                      <Building2 className="h-3 w-3" />
                      Hospital record
                    </>
                  ) : (
                    <>
                      <User className="h-3 w-3" />
                      Self-recorded
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Health Record</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this health record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
