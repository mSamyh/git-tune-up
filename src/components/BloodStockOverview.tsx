import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Droplets, Building2, MapPin, Phone, Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Hospital {
  id: string;
  name: string;
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
  stocks: BloodStock[];
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'available': return 'bg-emerald-500 text-white';
    case 'low': return 'bg-amber-500 text-white';
    case 'critical': return 'bg-red-500 text-white';
    case 'out_of_stock': return 'bg-muted text-muted-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getStockBadgeVariant = (units: number, status: string) => {
  if (units === 0) return 'outline';
  if (status === 'critical') return 'destructive';
  if (status === 'low') return 'secondary';
  return 'default';
};

export const BloodStockOverview = () => {
  const [hospitalsWithStock, setHospitalsWithStock] = useState<HospitalWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAtoll, setSelectedAtoll] = useState("all");
  const [selectedBloodGroup, setSelectedBloodGroup] = useState("all");
  const [atolls, setAtolls] = useState<string[]>([]);

  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('blood-stock-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blood_stock' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const [hospitalsRes, stockRes] = await Promise.all([
      supabase.from("hospitals").select("id, name, atoll, island, phone").eq("is_active", true),
      supabase.from("blood_stock").select("*"),
    ]);

    if (hospitalsRes.data && stockRes.data) {
      const hospitalsMap: Record<string, HospitalWithStock> = {};
      const atollSet = new Set<string>();

      hospitalsRes.data.forEach(hospital => {
        hospitalsMap[hospital.id] = {
          ...hospital,
          stocks: [],
        };
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

  const getTotalCritical = (hospital: HospitalWithStock) => {
    return hospital.stocks.filter(s => s.status === 'critical' || s.status === 'out_of_stock').length;
  };

  const getLastUpdated = (hospital: HospitalWithStock) => {
    const latest = hospital.stocks.reduce((max, stock) => {
      const stockDate = new Date(stock.last_updated);
      return stockDate > max ? stockDate : max;
    }, new Date(0));
    return latest.getTime() > 0 ? formatDistanceToNow(latest, { addSuffix: true }) : 'Never';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <Select value={selectedAtoll} onValueChange={setSelectedAtoll}>
          <SelectTrigger className="w-[140px] rounded-xl">
            <SelectValue placeholder="All Atolls" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Atolls</SelectItem>
            {atolls.map(atoll => (
              <SelectItem key={atoll} value={atoll}>{atoll}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedBloodGroup} onValueChange={setSelectedBloodGroup}>
          <SelectTrigger className="w-[140px] rounded-xl">
            <SelectValue placeholder="All Types" />
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
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No hospitals found matching your criteria</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHospitals.map(hospital => (
            <Card key={hospital.id} className="rounded-2xl overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      {hospital.name}
                    </CardTitle>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      {(hospital.atoll || hospital.island) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[hospital.island, hospital.atoll].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {hospital.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {hospital.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getLastUpdated(hospital)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {/* Blood Stock Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {BLOOD_GROUPS.map(bg => {
                    const stock = hospital.stocks.find(s => s.blood_group === bg);
                    const units = stock?.units_available || 0;
                    const status = stock?.status || 'out_of_stock';

                    return (
                      <div
                        key={bg}
                        className={`text-center p-2 rounded-xl border ${
                          units === 0 ? 'bg-muted/30 border-border/50' : 
                          status === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                          status === 'low' ? 'bg-amber-500/10 border-amber-500/30' :
                          'bg-emerald-500/10 border-emerald-500/30'
                        }`}
                      >
                        <div className="font-bold text-sm">{bg}</div>
                        <div className={`text-lg font-semibold ${
                          units === 0 ? 'text-muted-foreground' :
                          status === 'critical' ? 'text-red-600' :
                          status === 'low' ? 'text-amber-600' :
                          'text-emerald-600'
                        }`}>
                          {units}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Status Summary */}
                {getTotalCritical(hospital) > 0 && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{getTotalCritical(hospital)} blood type(s) critically low or out of stock</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
