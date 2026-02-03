import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

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
  stocks: BloodStock[];
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const getUnitColor = (units: number, status: string) => {
  if (units === 0) return "text-muted-foreground";
  if (status === "critical") return "text-red-600 font-semibold";
  if (status === "low") return "text-amber-600 font-medium";
  return "text-emerald-600";
};

export const BloodStockOverview = () => {
  const [hospitalsWithStock, setHospitalsWithStock] = useState<HospitalWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAtoll, setSelectedAtoll] = useState("all");
  const [selectedBloodGroup, setSelectedBloodGroup] = useState("all");
  const [atolls, setAtolls] = useState<string[]>([]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('blood-stock-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blood_stock' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const [hospitalsRes, stockRes] = await Promise.all([
      supabase.from("hospitals").select("id, name, atoll, island").eq("is_active", true),
      supabase.from("blood_stock").select("*"),
    ]);

    if (hospitalsRes.data && stockRes.data) {
      const hospitalsMap: Record<string, HospitalWithStock> = {};
      const atollSet = new Set<string>();

      hospitalsRes.data.forEach(hospital => {
        hospitalsMap[hospital.id] = { ...hospital, stocks: [] };
        if (hospital.atoll) atollSet.add(hospital.atoll);
      });

      stockRes.data.forEach(stock => {
        if (hospitalsMap[stock.hospital_id]) {
          hospitalsMap[stock.hospital_id].stocks.push(stock);
        }
      });

      setHospitalsWithStock(Object.values(hospitalsMap));
      setAtolls(Array.from(atollSet).sort());
    }

    setLoading(false);
  };

  const filteredHospitals = hospitalsWithStock.filter(hospital => {
    if (selectedAtoll !== "all" && hospital.atoll !== selectedAtoll) return false;
    if (selectedBloodGroup !== "all") {
      const hasBloodGroup = hospital.stocks.some(
        s => s.blood_group === selectedBloodGroup && s.units_available > 0
      );
      if (!hasBloodGroup) return false;
    }
    return true;
  });

  const getLastUpdated = (hospital: HospitalWithStock) => {
    const latest = hospital.stocks.reduce((max, stock) => {
      const stockDate = new Date(stock.last_updated);
      return stockDate > max ? stockDate : max;
    }, new Date(0));
    return latest.getTime() > 0 ? formatDistanceToNow(latest, { addSuffix: false }) : null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-2">
        <Select value={selectedAtoll} onValueChange={setSelectedAtoll}>
          <SelectTrigger className="w-28 h-8 text-xs">
            <SelectValue placeholder="Atoll" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Atolls</SelectItem>
            {atolls.map(atoll => (
              <SelectItem key={atoll} value={atoll}>{atoll}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedBloodGroup} onValueChange={setSelectedBloodGroup}>
          <SelectTrigger className="w-24 h-8 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {BLOOD_GROUPS.map(bg => (
              <SelectItem key={bg} value={bg}>{bg}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Hospital Cards */}
      {filteredHospitals.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hospitals found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredHospitals.map(hospital => {
            const lastUpdated = getLastUpdated(hospital);
            
            return (
              <Card key={hospital.id}>
                <CardContent className="p-3">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm truncate">{hospital.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                      {hospital.atoll && <span>{hospital.atoll}</span>}
                      {lastUpdated && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {lastUpdated}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Compact Blood Group Grid */}
                  <div className="grid grid-cols-8 gap-1 text-center">
                    {BLOOD_GROUPS.map(bg => {
                      const stock = hospital.stocks.find(s => s.blood_group === bg);
                      const units = stock?.units_available || 0;
                      const status = stock?.status || 'out_of_stock';

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
            );
          })}
        </div>
      )}
    </div>
  );
};
