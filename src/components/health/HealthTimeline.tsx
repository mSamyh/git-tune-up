import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Plus, Activity, AlertCircle, Calendar, TrendingUp } from "lucide-react";
import { HemoglobinChart } from "./HemoglobinChart";
import { HealthTimelineEntry } from "./HealthTimelineEntry";
import { DonationIntervalStats } from "./DonationIntervalStats";
import { AddHealthRecordSheet } from "./AddHealthRecordSheet";
import { logger } from "@/lib/logger";

export interface HealthRecord {
  id: string;
  donor_id: string;
  donation_id: string | null;
  record_date: string;
  hemoglobin_level: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  pulse_rate: number | null;
  weight_kg: number | null;
  deferral_reason: string | null;
  deferral_duration_days: number | null;
  health_notes: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

interface HealthTimelineProps {
  userId: string;
}

export const HealthTimeline = ({ userId }: HealthTimelineProps) => {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [donations, setDonations] = useState<{ donation_date: string }[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        // Fetch health records
        const { data: healthData, error: healthError } = await supabase
          .from("donor_health_records")
          .select("*")
          .eq("donor_id", userId)
          .order("record_date", { ascending: false });

        if (healthError) {
          logger.error("Failed to fetch health records:", healthError);
        }

        // Fetch donation history for interval stats
        const { data: donationData, error: donationError } = await supabase
          .from("donation_history")
          .select("donation_date")
          .eq("donor_id", userId)
          .order("donation_date", { ascending: false });

        if (donationError) {
          logger.error("Failed to fetch donations:", donationError);
        }

        if (isMounted) {
          setRecords((healthData as HealthRecord[]) || []);
          setDonations(donationData || []);
          setLoading(false);
        }
      } catch (error) {
        logger.error("Error fetching health data:", error);
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleRecordAdded = (newRecord: HealthRecord) => {
    setRecords(prev => [newRecord, ...prev]);
    setShowAddSheet(false);
  };

  const handleRecordDeleted = (recordId: string) => {
    setRecords(prev => prev.filter(r => r.id !== recordId));
  };

  // Calculate stats
  const hemoglobinRecords = records.filter(r => r.hemoglobin_level !== null);
  const deferralCount = records.filter(r => r.deferral_reason !== null).length;
  const latestHemoglobin = hemoglobinRecords[0]?.hemoglobin_level;

  const getHemoglobinStatus = (level: number | null | undefined) => {
    if (!level) return { status: "unknown", color: "text-muted-foreground", label: "No data" };
    if (level < 12.0) return { status: "low", color: "text-red-500", label: "Low" };
    if (level < 12.5) return { status: "borderline", color: "text-amber-500", label: "Borderline" };
    return { status: "normal", color: "text-emerald-500", label: "Normal" };
  };

  const hemoglobinStatus = getHemoglobinStatus(latestHemoglobin);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Health Timeline</h2>
          </div>
          <p className="text-sm text-muted-foreground">Private health dashboard</p>
        </div>
        <Button
          onClick={() => setShowAddSheet(true)}
          size="sm"
          className="rounded-xl h-9 gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add Record
        </Button>
      </div>

      {/* Hemoglobin Trend Chart */}
      {hemoglobinRecords.length > 0 ? (
        <Card className="rounded-2xl border-border/50 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium text-sm">Hemoglobin Trend</span>
              </div>
              {latestHemoglobin && (
                <div className="text-right">
                  <p className="text-lg font-bold">{latestHemoglobin} g/dL</p>
                  <p className={`text-xs ${hemoglobinStatus.color}`}>{hemoglobinStatus.label}</p>
                </div>
              )}
            </div>
            <HemoglobinChart records={hemoglobinRecords} />
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6 text-center">
            <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium mb-1">No Hemoglobin Data Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start tracking your hemoglobin levels to see trends over time
            </p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setShowAddSheet(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add First Record
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <DonationIntervalStats donations={donations} />
        
        <Card className="rounded-xl border-border/50">
          <CardContent className="p-3 text-center">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 mx-auto mb-1 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold">{records.length}</p>
            <p className="text-[10px] text-muted-foreground">Records</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50">
          <CardContent className="p-3 text-center">
            <div className={`h-8 w-8 rounded-lg mx-auto mb-1 flex items-center justify-center ${
              deferralCount > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'
            }`}>
              <AlertCircle className={`h-4 w-4 ${deferralCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
            </div>
            <p className="text-xl font-bold">{deferralCount}</p>
            <p className="text-[10px] text-muted-foreground">Deferrals</p>
          </CardContent>
        </Card>
      </div>

      {/* Health Records Timeline */}
      {records.length > 0 ? (
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-4">
            <h3 className="font-medium text-sm mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Health Records
            </h3>
            <div className="space-y-0">
              {records.map((record, index) => (
                <HealthTimelineEntry
                  key={record.id}
                  record={record}
                  isLast={index === records.length - 1}
                  onDelete={handleRecordDeleted}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6 text-center">
            <Heart className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium mb-1">No Health Records Yet</h3>
            <p className="text-sm text-muted-foreground">
              Track your donation health metrics to monitor your wellbeing
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add Health Record Sheet */}
      <AddHealthRecordSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        userId={userId}
        onRecordAdded={handleRecordAdded}
      />
    </div>
  );
};
