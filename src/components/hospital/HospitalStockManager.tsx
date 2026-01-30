import { useState } from "react";
import { Plus, Droplets, AlertTriangle, Clock, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BloodStockCard from "./BloodStockCard";
import StockUpdateSheet from "./StockUpdateSheet";
import ExpiryAlerts from "./ExpiryAlerts";
import { differenceInDays, parseISO, format } from "date-fns";

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

interface HospitalStockManagerProps {
  hospitalId: string;
  hospitalPin: string;
  bloodStock: BloodStock[];
  onStockUpdate: (stock: BloodStock[]) => void;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const HospitalStockManager = ({
  hospitalId,
  hospitalPin,
  bloodStock,
  onStockUpdate,
}: HospitalStockManagerProps) => {
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Calculate stats
  const totalUnits = bloodStock.reduce((sum, s) => sum + s.units_available, 0);
  const criticalCount = bloodStock.filter((s) => s.status === "critical" || s.status === "out_of_stock").length;
  const typesWithStock = bloodStock.filter((s) => s.units_available > 0).length;

  // Get expiring soon items (within 7 days)
  const expiringSoon = bloodStock.filter((s) => {
    if (!s.expiry_date) return false;
    const daysUntilExpiry = differenceInDays(parseISO(s.expiry_date), new Date());
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
  });

  // Create a map for quick lookup
  const stockMap = new Map(bloodStock.map((s) => [s.blood_group, s]));

  const handleOpenUpdate = (bloodGroup: string) => {
    setSelectedBloodGroup(bloodGroup);
    setIsSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setSelectedBloodGroup(null);
  };

  const getSelectedStock = () => {
    if (!selectedBloodGroup) return null;
    return stockMap.get(selectedBloodGroup) || null;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Package className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold text-primary">{typesWithStock}</span>
            </div>
            <p className="text-xs text-muted-foreground">Types</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Droplets className="h-4 w-4 text-emerald-500" />
              <span className="text-2xl font-bold text-emerald-600">{totalUnits}</span>
            </div>
            <p className="text-xs text-muted-foreground">Units</p>
          </CardContent>
        </Card>
        <Card className={`${criticalCount > 0 ? "bg-red-500/10 border-red-500/20" : "bg-muted/50"}`}>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <AlertTriangle className={`h-4 w-4 ${criticalCount > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              <span className={`text-2xl font-bold ${criticalCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                {criticalCount}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
      </div>

      {/* Expiry Alerts */}
      {expiringSoon.length > 0 && (
        <ExpiryAlerts expiringStock={expiringSoon} />
      )}

      {/* Blood Stock Grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Droplets className="h-5 w-5 text-primary" />
              Blood Stock
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {bloodStock.length > 0 
                ? format(parseISO(bloodStock[0].last_updated), "h:mm a")
                : "No data"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {BLOOD_GROUPS.map((bloodGroup) => {
            const stock = stockMap.get(bloodGroup);
            return (
              <BloodStockCard
                key={bloodGroup}
                bloodGroup={bloodGroup}
                units={stock?.units_available || 0}
                status={stock?.status || "out_of_stock"}
                expiryDate={stock?.expiry_date || null}
                notes={stock?.notes || null}
                onEdit={() => handleOpenUpdate(bloodGroup)}
              />
            );
          })}
        </CardContent>
      </Card>

      {/* Add/Update Button */}
      <Button
        onClick={() => {
          setSelectedBloodGroup(null);
          setIsSheetOpen(true);
        }}
        className="fixed bottom-6 right-6 h-14 px-6 rounded-full shadow-lg"
      >
        <Plus className="h-5 w-5 mr-2" />
        Add/Update Stock
      </Button>

      {/* Update Sheet */}
      <StockUpdateSheet
        isOpen={isSheetOpen}
        onClose={handleCloseSheet}
        hospitalId={hospitalId}
        hospitalPin={hospitalPin}
        selectedBloodGroup={selectedBloodGroup}
        currentStock={getSelectedStock()}
        onUpdate={onStockUpdate}
        allBloodGroups={BLOOD_GROUPS}
      />
    </div>
  );
};

export default HospitalStockManager;
