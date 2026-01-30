import { Edit, Calendar, AlertCircle, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { differenceInDays, parseISO, format } from "date-fns";

interface BloodStockCardProps {
  bloodGroup: string;
  units: number;
  status: string;
  expiryDate: string | null;
  notes: string | null;
  onEdit: () => void;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case "available":
      return {
        label: "Available",
        color: "text-emerald-600",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/20",
        icon: CheckCircle,
      };
    case "low":
      return {
        label: "Low",
        color: "text-amber-600",
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/20",
        icon: AlertTriangle,
      };
    case "critical":
      return {
        label: "Critical",
        color: "text-red-600",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/20",
        icon: AlertCircle,
      };
    case "out_of_stock":
    default:
      return {
        label: "Out",
        color: "text-muted-foreground",
        bgColor: "bg-muted/50",
        borderColor: "border-border",
        icon: XCircle,
      };
  }
};

const getBloodGroupColor = (bloodGroup: string) => {
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

const BloodStockCard = ({
  bloodGroup,
  units,
  status,
  expiryDate,
  notes,
  onEdit,
}: BloodStockCardProps) => {
  const statusConfig = getStatusConfig(status);
  const StatusIcon = statusConfig.icon;

  const daysUntilExpiry = expiryDate
    ? differenceInDays(parseISO(expiryDate), new Date())
    : null;

  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry >= 0;

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 rounded-xl border transition-colors",
        statusConfig.bgColor,
        statusConfig.borderColor
      )}
    >
      <div className="flex items-center gap-4">
        {/* Blood Group Badge */}
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg",
            getBloodGroupColor(bloodGroup)
          )}
        >
          {bloodGroup}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">{units}</span>
            <span className="text-sm text-muted-foreground">units</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="outline"
              className={cn("text-xs", statusConfig.color, statusConfig.borderColor)}
            >
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
            {isExpiringSoon && daysUntilExpiry !== null && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30 bg-amber-500/10">
                <Calendar className="h-3 w-3 mr-1" />
                {daysUntilExpiry === 0 ? "Today" : `${daysUntilExpiry}d`}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Edit Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onEdit}
        className="rounded-full"
      >
        <Edit className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default BloodStockCard;
