import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Droplets, Clock, RefreshCw, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  atoll: string | null;
  island: string | null;
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
  totalUnits: number;
}

interface Atoll {
  id: string;
  name: string;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const getUnitColor = (units: number, status: string) => {
  if (units === 0) return "text-muted-foreground";
  if (status === "critical") return "text-red-600 font-semibold";
  if (status === "low") return "text-amber-600 font-medium";
  return "text-emerald-600";
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
      const { data: hospitalsData, error: hospitalsError } = await supabase
        .from("hospitals")
        .select("id, name, atoll, island")
        .eq("is_active", true);

      if (hospitalsError) throw hospitalsError;

      const { data: stockData, error: stockError } = await supabase
        .from("blood_stock")
        .select("*");

      if (stockError) throw stockError;

      const stockByHospital = new Map<string, BloodStock[]>();
      (stockData || []).forEach((stock) => {
        const existing = stockByHospital.get(stock.hospital_id) || [];
        existing.push(stock);
        stockByHospital.set(stock.hospital_id, existing);
      });

      const combined: HospitalWithStock[] = (hospitalsData || []).map((hospital) => {
        const stock = stockByHospital.get(hospital.id) || [];
        const lastUpdated = stock.length > 0
          ? new Date(Math.max(...stock.map((s) => new Date(s.last_updated).getTime())))
          : null;
        const totalUnits = stock.reduce((sum, s) => sum + s.units_available, 0);

        return { ...hospital, stock, lastUpdated, totalUnits };
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

    const channel = supabase
      .channel("blood_stock_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "blood_stock" }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
  };

  const filteredHospitals = hospitals.filter((hospital) => {
    if (selectedAtoll !== "all" && hospital.atoll !== selectedAtoll) return false;
    if (selectedBloodGroup !== "all") {
      const hasBloodGroup = hospital.stock.some(
        (s) => s.blood_group === selectedBloodGroup && s.units_available > 0
      );
      if (!hasBloodGroup) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Compact Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2 px-3 py-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 flex items-center gap-2">
            <Droplets className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Blood Stock</span>
          </div>
          <Select value={selectedAtoll} onValueChange={setSelectedAtoll}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue placeholder="Atoll" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {atolls.map((atoll) => (
                <SelectItem key={atoll.id} value={atoll.name}>{atoll.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedBloodGroup} onValueChange={setSelectedBloodGroup}>
            <SelectTrigger className="w-20 h-8 text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {BLOOD_GROUPS.map((bg) => (
                <SelectItem key={bg} value={bg}>{bg}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing} className="h-8 w-8">
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <Skeleton className="h-4 w-32 mb-3" />
                <div className="grid grid-cols-8 gap-1">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <Skeleton key={j} className="h-8" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredHospitals.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {selectedAtoll !== "all" || selectedBloodGroup !== "all"
                  ? "No results for filters"
                  : "No hospitals registered"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredHospitals.map((hospital) => (
            <Card key={hospital.id}>
              <CardContent className="p-3">
                {/* Hospital Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{hospital.name}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    {hospital.atoll && <span>{hospital.atoll}</span>}
                    {hospital.lastUpdated && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(hospital.lastUpdated, { addSuffix: false })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Compact Blood Group Grid */}
                <div className="grid grid-cols-8 gap-1 text-center">
                  {BLOOD_GROUPS.map((bg) => {
                    const stock = hospital.stock.find((s) => s.blood_group === bg);
                    const units = stock?.units_available || 0;
                    const status = stock?.status || "out_of_stock";

                    return (
                      <div key={bg} className="space-y-0.5">
                        <div className="text-[10px] text-muted-foreground font-medium">{bg}</div>
                        <div className={cn("text-sm", getUnitColor(units, status))}>{units}</div>
                      </div>
                    );
                  })}
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
