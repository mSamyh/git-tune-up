import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Droplets,
  MapPin,
  Phone,
  Clock,
  Filter,
  RefreshCw,
  Building2,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/BottomNav";

interface Hospital {
  id: string;
  name: string;
  address: string | null;
  atoll: string | null;
  island: string | null;
  phone: string | null;
}

interface BloodStock {
  id: string;
  hospital_id: string;
  blood_group: string;
  units_available: number;
  status: string;
  last_updated: string;
}

interface HospitalWithStock extends Hospital {
  stock: BloodStock[];
  lastUpdated: Date | null;
  criticalCount: number;
  totalUnits: number;
}

interface Atoll {
  id: string;
  name: string;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const getStatusColor = (status: string) => {
  switch (status) {
    case "available":
      return "text-emerald-600 bg-emerald-500/10 border-emerald-500/30";
    case "low":
      return "text-amber-600 bg-amber-500/10 border-amber-500/30";
    case "critical":
      return "text-red-600 bg-red-500/10 border-red-500/30";
    default:
      return "text-muted-foreground bg-muted/50 border-border";
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

const BloodStock = () => {
  const navigate = useNavigate();
  const [hospitals, setHospitals] = useState<HospitalWithStock[]>([]);
  const [atolls, setAtolls] = useState<Atoll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAtoll, setSelectedAtoll] = useState<string>("all");
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAtolls = async () => {
    const { data } = await supabase.from("atolls").select("id, name").order("name");
    setAtolls(data || []);
  };

  const fetchData = async () => {
    try {
      // Fetch hospitals
      const { data: hospitalsData, error: hospitalsError } = await supabase
        .from("hospitals")
        .select("*")
        .eq("is_active", true);

      if (hospitalsError) throw hospitalsError;

      // Fetch blood stock
      const { data: stockData, error: stockError } = await supabase
        .from("blood_stock")
        .select("*");

      if (stockError) throw stockError;

      // Group stock by hospital
      const stockByHospital = new Map<string, BloodStock[]>();
      (stockData || []).forEach((stock) => {
        const existing = stockByHospital.get(stock.hospital_id) || [];
        existing.push(stock);
        stockByHospital.set(stock.hospital_id, existing);
      });

      // Combine data
      const combined: HospitalWithStock[] = (hospitalsData || []).map((hospital) => {
        const stock = stockByHospital.get(hospital.id) || [];
        const lastUpdated = stock.length > 0
          ? new Date(Math.max(...stock.map((s) => new Date(s.last_updated).getTime())))
          : null;
        const criticalCount = stock.filter(
          (s) => s.status === "critical" || s.status === "out_of_stock"
        ).length;
        const totalUnits = stock.reduce((sum, s) => sum + s.units_available, 0);

        return {
          ...hospital,
          stock,
          lastUpdated,
          criticalCount,
          totalUnits,
        };
      });

      setHospitals(combined);
    } catch (error) {
      console.error("Error fetching blood stock:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchAtolls();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("blood_stock_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blood_stock" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
  };

  // Filter hospitals
  const filteredHospitals = hospitals.filter((hospital) => {
    if (selectedAtoll !== "all" && hospital.atoll !== selectedAtoll) {
      return false;
    }
    if (selectedBloodGroup !== "all") {
      const hasBloodGroup = hospital.stock.some(
        (s) => s.blood_group === selectedBloodGroup && s.units_available > 0
      );
      if (!hasBloodGroup) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            Blood Availability
          </h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-full"
          >
            <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-4 pb-3">
          <Select value={selectedAtoll} onValueChange={setSelectedAtoll}>
            <SelectTrigger className="flex-1 h-9">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Atolls" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Atolls</SelectItem>
              {atolls.map((atoll) => (
                <SelectItem key={atoll.id} value={atoll.name}>
                  {atoll.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedBloodGroup} onValueChange={setSelectedBloodGroup}>
            <SelectTrigger className="flex-1 h-9">
              <Droplets className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {BLOOD_GROUPS.map((bg) => (
                <SelectItem key={bg} value={bg}>
                  {bg}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32 mt-1" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <Skeleton key={j} className="h-12 rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredHospitals.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Hospitals Found</h3>
              <p className="text-sm text-muted-foreground">
                {selectedAtoll !== "all" || selectedBloodGroup !== "all"
                  ? "Try adjusting your filters"
                  : "No hospitals have registered yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredHospitals.map((hospital) => (
            <Card key={hospital.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{hospital.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {hospital.island}, {hospital.atoll}
                    </div>
                    {hospital.phone && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {hospital.phone}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {hospital.criticalCount > 0 ? (
                      <Badge variant="destructive" className="text-xs">
                        {hospital.criticalCount} critical
                      </Badge>
                    ) : (
                      <Badge className="text-xs bg-emerald-500">All OK</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Blood Stock Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {BLOOD_GROUPS.map((bg) => {
                    const stock = hospital.stock.find((s) => s.blood_group === bg);
                    const units = stock?.units_available || 0;
                    const status = stock?.status || "out_of_stock";

                    return (
                      <div
                        key={bg}
                        className={cn(
                          "rounded-lg p-2 text-center border",
                          getStatusColor(status)
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-md mx-auto flex items-center justify-center text-white text-xs font-bold mb-1",
                            getBloodGroupBg(bg)
                          )}
                        >
                          {bg}
                        </div>
                        <div className="text-lg font-bold">{units}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                  <span>{hospital.totalUnits} total units</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {hospital.lastUpdated
                      ? formatDistanceToNow(hospital.lastUpdated, { addSuffix: true })
                      : "No data"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default BloodStock;
