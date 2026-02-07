import { useState, useEffect, useMemo } from "react";
import { Droplets, Package, AlertTriangle, Clock, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
import BloodUnitCard, { BloodUnit } from "./BloodUnitCard";
import AddBloodUnitSheet from "./AddBloodUnitSheet";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

interface BloodUnitManagerProps {
  hospitalId: string;
}

export const BloodUnitManager = ({ hospitalId }: BloodUnitManagerProps) => {
  const [units, setUnits] = useState<BloodUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBloodGroup, setFilterBloodGroup] = useState<string>("all");
  const [editingUnit, setEditingUnit] = useState<BloodUnit | null>(null);
  
  // Dialog states
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: "reserve" | "transfuse" | "discard" | "unreserve" | null;
    unit: BloodUnit | null;
    patientName: string;
  }>({
    open: false,
    type: null,
    unit: null,
    patientName: "",
  });

  const fetchUnits = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("blood_units")
      .select("*")
      .eq("hospital_id", hospitalId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load blood units");
      console.error(error);
    } else {
      setUnits((data || []) as BloodUnit[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUnits();

    // Subscribe to realtime changes for this hospital's blood units
    const channel = supabase
      .channel(`blood-units-${hospitalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "blood_units",
          filter: `hospital_id=eq.${hospitalId}`,
        },
        () => {
          fetchUnits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hospitalId]);

  // Calculate stats
  const stats = useMemo(() => {
    const available = units.filter((u) => u.status === "available");
    const reserved = units.filter((u) => u.status === "reserved");
    const expiringSoon = available.filter((u) => {
      const days = differenceInDays(parseISO(u.expiry_date), new Date());
      return days >= 0 && days <= 7;
    });
    
    return {
      totalAvailable: available.length,
      reserved: reserved.length,
      expiringSoon: expiringSoon.length,
      byBloodGroup: BLOOD_GROUPS.map((bg) => ({
        bloodGroup: bg,
        count: available.filter((u) => u.blood_group === bg).length,
      })),
    };
  }, [units]);

  // Filter units
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (filterBloodGroup !== "all" && u.blood_group !== filterBloodGroup) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          u.bag_number?.toLowerCase().includes(query) ||
          u.donor_name?.toLowerCase().includes(query) ||
          u.donor_id?.toLowerCase().includes(query) ||
          u.blood_group.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [units, filterBloodGroup, searchQuery]);

  const availableUnits = filteredUnits.filter((u) => u.status === "available");
  const reservedUnits = filteredUnits.filter((u) => u.status === "reserved");
  const usedUnits = filteredUnits.filter((u) => ["transfused", "discarded", "expired"].includes(u.status));

  const handleAction = async () => {
    const { type, unit, patientName } = actionDialog;
    if (!type || !unit) return;

    try {
      const { error } = await supabase.functions.invoke("manage-blood-unit", {
        body: {
          action: type,
          hospital_id: hospitalId,
          unit_id: unit.id,
          patient_name: patientName || undefined,
        },
      });

      if (error) throw error;

      toast.success(
        type === "reserve"
          ? "Unit reserved"
          : type === "transfuse"
          ? "Unit marked as used"
          : type === "unreserve"
          ? "Reservation cancelled"
          : "Unit discarded"
      );
      fetchUnits();
    } catch (error: any) {
      toast.error(error.message || "Action failed");
    } finally {
      setActionDialog({ open: false, type: null, unit: null, patientName: "" });
    }
  };

  const openActionDialog = (type: "reserve" | "transfuse" | "discard" | "unreserve", unit: BloodUnit) => {
    setActionDialog({ open: true, type, unit, patientName: unit.reserved_for || "" });
  };

  return (
    <div className="space-y-6 pb-32">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Package className="h-4 w-4 text-emerald-500" />
              <span className="text-2xl font-bold text-emerald-600">{stats.totalAvailable}</span>
            </div>
            <p className="text-xs text-muted-foreground">Available</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-2xl font-bold text-amber-600">{stats.reserved}</span>
            </div>
            <p className="text-xs text-muted-foreground">Reserved</p>
          </CardContent>
        </Card>
        <Card className={`${stats.expiringSoon > 0 ? "bg-red-500/10 border-red-500/20" : "bg-muted/50"}`}>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <AlertTriangle className={`h-4 w-4 ${stats.expiringSoon > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              <span className={`text-2xl font-bold ${stats.expiringSoon > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                {stats.expiringSoon}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Expiring</p>
          </CardContent>
        </Card>
      </div>

      {/* Blood Group Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Droplets className="h-4 w-4 text-primary" />
            Stock by Blood Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {stats.byBloodGroup.map(({ bloodGroup, count }) => (
              <div
                key={bloodGroup}
                className={`rounded-xl p-3 text-center border ${
                  count > 0 ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border/50"
                }`}
              >
                <p className="text-sm font-bold">{bloodGroup}</p>
                <p className={`text-xl font-bold ${count > 0 ? "text-primary" : "text-muted-foreground"}`}>
                  {count}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bag, donor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={filterBloodGroup} onValueChange={setFilterBloodGroup}>
          <SelectTrigger className="w-24 rounded-xl">
            <Filter className="h-4 w-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {BLOOD_GROUPS.map((bg) => (
              <SelectItem key={bg} value={bg}>{bg}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Units Tabs */}
      <Tabs defaultValue="available" className="w-full">
        <TabsList className="w-full grid grid-cols-3 rounded-xl h-11">
          <TabsTrigger value="available" className="rounded-lg">
            Available ({availableUnits.length})
          </TabsTrigger>
          <TabsTrigger value="reserved" className="rounded-lg">
            Reserved ({reservedUnits.length})
          </TabsTrigger>
          <TabsTrigger value="used" className="rounded-lg">
            Used ({usedUnits.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="mt-4 space-y-3">
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : availableUnits.length === 0 ? (
            <Card className="bg-muted/30">
              <CardContent className="py-8 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No available units</p>
              </CardContent>
            </Card>
          ) : (
            availableUnits.map((unit) => (
              <BloodUnitCard
                key={unit.id}
                unit={unit}
                onReserve={(u) => openActionDialog("reserve", u)}
                onTransfuse={(u) => openActionDialog("transfuse", u)}
                onUnreserve={(u) => openActionDialog("unreserve", u)}
                onDiscard={(u) => openActionDialog("discard", u)}
                onEdit={(u) => setEditingUnit(u)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="reserved" className="mt-4 space-y-3">
          {reservedUnits.length === 0 ? (
            <Card className="bg-muted/30">
              <CardContent className="py-8 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No reserved units</p>
              </CardContent>
            </Card>
          ) : (
            reservedUnits.map((unit) => (
              <BloodUnitCard
                key={unit.id}
                unit={unit}
                onReserve={(u) => openActionDialog("reserve", u)}
                onTransfuse={(u) => openActionDialog("transfuse", u)}
                onUnreserve={(u) => openActionDialog("unreserve", u)}
                onDiscard={(u) => openActionDialog("discard", u)}
                onEdit={(u) => setEditingUnit(u)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="used" className="mt-4 space-y-3">
          {usedUnits.length === 0 ? (
            <Card className="bg-muted/30">
              <CardContent className="py-8 text-center">
                <Droplets className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No used units yet</p>
              </CardContent>
            </Card>
          ) : (
            usedUnits.map((unit) => (
              <BloodUnitCard
                key={unit.id}
                unit={unit}
                onReserve={() => {}}
                onTransfuse={() => {}}
                onUnreserve={() => {}}
                onDiscard={() => {}}
                onEdit={() => {}}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Add Unit Sheet */}
      <AddBloodUnitSheet
        hospitalId={hospitalId}
        onAdd={fetchUnits}
        editingUnit={editingUnit}
        onEditComplete={() => setEditingUnit(null)}
      />

      {/* Action Dialog */}
      <AlertDialog
        open={actionDialog.open}
        onOpenChange={(open) => {
          if (!open) setActionDialog({ open: false, type: null, unit: null, patientName: "" });
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.type === "reserve" && "Reserve Blood Unit"}
              {actionDialog.type === "transfuse" && "Mark as Transfused"}
              {actionDialog.type === "unreserve" && "Cancel Reservation"}
              {actionDialog.type === "discard" && "Discard Blood Unit"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.type === "reserve" && "Enter patient name to reserve this unit."}
              {actionDialog.type === "transfuse" && "This will mark the blood unit as used/transfused."}
              {actionDialog.type === "unreserve" && "This will make the unit available again."}
              {actionDialog.type === "discard" && "This will mark the unit as discarded. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {(actionDialog.type === "reserve" || actionDialog.type === "transfuse") && (
            <div className="py-4">
              <Input
                placeholder="Patient name"
                value={actionDialog.patientName}
                onChange={(e) => setActionDialog({ ...actionDialog, patientName: e.target.value })}
                className="rounded-xl"
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={`rounded-xl ${actionDialog.type === "discard" ? "bg-destructive hover:bg-destructive/90" : ""}`}
            >
              {actionDialog.type === "reserve" && "Reserve"}
              {actionDialog.type === "transfuse" && "Confirm"}
              {actionDialog.type === "unreserve" && "Unreserve"}
              {actionDialog.type === "discard" && "Discard"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BloodUnitManager;
