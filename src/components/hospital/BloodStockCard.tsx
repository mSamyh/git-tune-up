import { Edit, Calendar, AlertCircle, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { differenceInDays, parseISO } from "date-fns";

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
      return { label: "Available", color: "text-emerald-700", accent: "bg-emerald-500", icon: CheckCircle };
    case "low":
      return { label: "Low", color: "text-amber-700", accent: "bg-amber-500", icon: AlertTriangle };
    case "critical":
      return { label: "Critical", color: "text-red-700", accent: "bg-red-500", icon: AlertCircle };
    case "out_of_stock":
    default:
      return { label: "Out of stock", color: "text-muted-foreground", accent: "bg-muted-foreground/40", icon: XCircle };
  }
};

const BloodStockCard = ({
  bloodGroup,
  units,
  status,
  expiryDate,
  onEdit,
}: BloodStockCardProps) => {
  const cfg = getStatusConfig(status);
  const StatusIcon = cfg.icon;

  const daysUntilExpiry = expiryDate ? differenceInDays(parseISO(expiryDate), new Date()) : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry >= 0;

  return (
    <div className="relative flex items-center justify-between p-4 rounded-xl border border-border bg-card transition-colors hover:border-primary/30">
      <span className={cn("absolute left-0 top-3 bottom-3 w-0.5 rounded-r", cfg.accent)} />
      <div className="flex items-center gap-4 pl-2">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-muted text-foreground font-semibold text-sm border border-border">
          {bloodGroup}
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-xl tabular-nums">{units}</span>
            <span className="text-xs text-muted-foreground">units</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="outline" className={cn("text-[10px] font-medium border-border bg-transparent px-1.5", cfg.color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {cfg.label}
            </Badge>
            {isExpiringSoon && daysUntilExpiry !== null && (
              <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-transparent px-1.5">
                <Calendar className="h-3 w-3 mr-1" />
                {daysUntilExpiry === 0 ? "Today" : `${daysUntilExpiry}d`}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Button variant="ghost" size="icon" onClick={onEdit} className="rounded-full h-8 w-8">
        <Edit className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default BloodStockCard;
