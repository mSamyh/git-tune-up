import { AlertTriangle, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO, format } from "date-fns";

interface BloodStock {
  id: string;
  blood_group: string;
  units_available: number;
  expiry_date: string | null;
}

interface ExpiryAlertsProps {
  expiringStock: BloodStock[];
}

const ExpiryAlerts = ({ expiringStock }: ExpiryAlertsProps) => {
  if (expiringStock.length === 0) return null;

  return (
    <Card className="bg-amber-500/10 border-amber-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          Expiring Soon
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {expiringStock.map((stock) => {
          const daysUntilExpiry = stock.expiry_date
            ? differenceInDays(parseISO(stock.expiry_date), new Date())
            : 0;

          return (
            <div
              key={stock.id}
              className="flex items-center justify-between p-2 rounded-lg bg-background/50"
            >
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className="font-bold bg-amber-500/20 text-amber-700 border-amber-500/30"
                >
                  {stock.blood_group}
                </Badge>
                <span className="text-sm">
                  {stock.units_available} units
                </span>
              </div>
              <div className="flex items-center gap-1 text-amber-600 text-sm">
                <Calendar className="h-3 w-3" />
                {daysUntilExpiry === 0
                  ? "Today"
                  : daysUntilExpiry === 1
                  ? "Tomorrow"
                  : `${daysUntilExpiry} days`}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ExpiryAlerts;
