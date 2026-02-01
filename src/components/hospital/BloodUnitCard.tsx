import { format, differenceInDays, parseISO } from "date-fns";
import { Droplets, Calendar, User, Package, MoreVertical, Bookmark, HeartPulse, Trash2, Pencil, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface BloodUnit {
  id: string;
  hospital_id: string;
  blood_group: string;
  collection_date: string;
  expiry_date: string;
  donor_id: string | null;
  donor_name: string | null;
  bag_number: string | null;
  volume_ml: number;
  status: "available" | "reserved" | "transfused" | "expired" | "discarded";
  reserved_for: string | null;
  reserved_at: string | null;
  used_at: string | null;
  batch_number: string | null;
  component_type: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

interface BloodUnitCardProps {
  unit: BloodUnit;
  onReserve: (unit: BloodUnit) => void;
  onTransfuse: (unit: BloodUnit) => void;
  onUnreserve: (unit: BloodUnit) => void;
  onDiscard: (unit: BloodUnit) => void;
  onEdit: (unit: BloodUnit) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "available":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
    case "reserved":
      return "bg-amber-500/10 text-amber-600 border-amber-500/30";
    case "transfused":
      return "bg-blue-500/10 text-blue-600 border-blue-500/30";
    case "expired":
      return "bg-red-500/10 text-red-600 border-red-500/30";
    case "discarded":
      return "bg-gray-500/10 text-gray-600 border-gray-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getBloodGroupBg = (bloodGroup: string) => {
  const colors: Record<string, string> = {
    "A+": "bg-red-500",
    "A-": "bg-red-600",
    "B+": "bg-blue-500",
    "B-": "bg-blue-600",
    "O+": "bg-emerald-500",
    "O-": "bg-emerald-600",
    "AB+": "bg-purple-500",
    "AB-": "bg-purple-600",
  };
  return colors[bloodGroup] || "bg-gray-500";
};

const getComponentLabel = (type: string) => {
  const labels: Record<string, string> = {
    whole_blood: "Whole Blood",
    packed_rbc: "Packed RBC",
    plasma: "FFP",
    platelets: "Platelets",
    cryoprecipitate: "Cryo",
  };
  return labels[type] || type;
};

export const BloodUnitCard = ({
  unit,
  onReserve,
  onTransfuse,
  onUnreserve,
  onDiscard,
  onEdit,
}: BloodUnitCardProps) => {
  const daysUntilExpiry = differenceInDays(parseISO(unit.expiry_date), new Date());
  const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
  const isExpired = daysUntilExpiry < 0;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm",
              getBloodGroupBg(unit.blood_group)
            )}
          >
            {unit.blood_group}
          </div>
          <div>
            <p className="font-semibold">{unit.bag_number || "No Bag #"}</p>
            <p className="text-xs text-muted-foreground">
              {getComponentLabel(unit.component_type)} • {unit.volume_ml}ml
            </p>
          </div>
        </div>
        <Badge className={cn("text-xs", getStatusColor(unit.status))}>
          {unit.status}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Collected</p>
            <p>{format(parseISO(unit.collection_date), "MMM d, yyyy")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Expires</p>
            <p
              className={cn(
                isExpired && "text-red-600 font-medium",
                isExpiringSoon && !isExpired && "text-amber-600 font-medium"
              )}
            >
              {format(parseISO(unit.expiry_date), "MMM d, yyyy")}
              {isExpiringSoon && !isExpired && (
                <span className="ml-1">({daysUntilExpiry}d)</span>
              )}
              {isExpired && <span className="ml-1">(Expired)</span>}
            </p>
          </div>
        </div>
        {unit.donor_name && (
          <div className="col-span-2 flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Donor</p>
              <p>
                {unit.donor_name}
                {unit.donor_id && (
                  <span className="text-muted-foreground ml-1">({unit.donor_id})</span>
                )}
              </p>
            </div>
          </div>
        )}
        {unit.reserved_for && unit.status === "reserved" && (
          <div className="col-span-2 flex items-center gap-2">
            <Bookmark className="h-3.5 w-3.5 text-amber-600" />
            <div>
              <p className="text-xs text-muted-foreground">Reserved for</p>
              <p className="text-amber-600">{unit.reserved_for}</p>
            </div>
          </div>
        )}
        {unit.batch_number && (
          <div className="col-span-2 flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Batch</p>
              <p>{unit.batch_number}</p>
            </div>
          </div>
        )}
      </div>

      {unit.remarks && (
        <p className="mt-3 text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
          {unit.remarks}
        </p>
      )}

      {/* Actions based on status */}
      {(unit.status === "available" || unit.status === "reserved") && (
        <div className="mt-4 flex gap-2 pt-3 border-t">
          {unit.status === "available" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-9 rounded-xl"
                onClick={() => onReserve(unit)}
              >
                <Bookmark className="h-4 w-4 mr-1.5" /> Reserve
              </Button>
              <Button
                size="sm"
                className="flex-1 h-9 rounded-xl"
                onClick={() => onTransfuse(unit)}
              >
                <HeartPulse className="h-4 w-4 mr-1.5" /> Use
              </Button>
            </>
          )}
          {unit.status === "reserved" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-9 rounded-xl"
                onClick={() => onUnreserve(unit)}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" /> Unreserve
              </Button>
              <Button
                size="sm"
                className="flex-1 h-9 rounded-xl"
                onClick={() => onTransfuse(unit)}
              >
                <HeartPulse className="h-4 w-4 mr-1.5" /> Use
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-xl">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(unit)}>
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDiscard(unit)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Discard
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </Card>
  );
};

export default BloodUnitCard;
