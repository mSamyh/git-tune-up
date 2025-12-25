import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Droplet, CheckCircle, Clock, TrendingUp, Activity, Heart, Sparkles } from "lucide-react";

interface DonorStats {
  totalDonors: number;
  registeredDonors: number;
  availableDonors: number;
  unavailableDonors: number;
  bloodGroupCounts: Record<string, number>;
  availabilityRate: number;
  totalDonations: number;
  monthlyDonations: { month: string; count: number }[];
}

export const DonorStatsDashboard = () => {
  const [stats, setStats] = useState<DonorStats | null>(null);
  const [loading, setLoading] = useState(true);

  const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  
  const bloodGroupColors: Record<string, string> = {
    "A+": "bg-red-500",
    "A-": "bg-red-400",
    "B+": "bg-blue-500",
    "B-": "bg-blue-400",
    "AB+": "bg-purple-500",
    "AB-": "bg-purple-400",
    "O+": "bg-green-500",
    "O-": "bg-green-400",
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("blood_group, availability_status, user_type")
        .in("user_type", ["donor", "both"]);

      const { data: directory } = await supabase
        .from("donor_directory")
        .select("blood_group, availability_status, linked_profile_id");

      const { data: donations } = await supabase
        .from("donation_history")
        .select("donation_date")
        .order("donation_date", { ascending: false });

      const { data: directoryDonations } = await supabase
        .from("donor_directory_history")
        .select("donation_date")
        .order("donation_date", { ascending: false });

      const registeredDonors = profiles || [];
      const unlinkedDirectory = (directory || []).filter(d => !d.linked_profile_id);
      const allDonors = [...registeredDonors, ...unlinkedDirectory];
      const allDonationsData = [...(donations || []), ...(directoryDonations || [])];

      const bloodGroupCounts: Record<string, number> = {};
      bloodGroups.forEach(bg => bloodGroupCounts[bg] = 0);
      allDonors.forEach(d => {
        if (d.blood_group && bloodGroupCounts[d.blood_group] !== undefined) {
          bloodGroupCounts[d.blood_group]++;
        }
      });

      const available = registeredDonors.filter(d => d.availability_status === 'available').length;
      const unavailable = registeredDonors.filter(d => d.availability_status !== 'available').length;

      const monthlyDonations: { month: string; count: number }[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = monthDate.toLocaleString('default', { month: 'short' });
        const year = monthDate.getFullYear();
        const monthStart = new Date(year, monthDate.getMonth(), 1);
        const monthEnd = new Date(year, monthDate.getMonth() + 1, 0);
        
        const count = allDonationsData.filter(d => {
          const donationDate = new Date(d.donation_date);
          return donationDate >= monthStart && donationDate <= monthEnd;
        }).length;

        monthlyDonations.push({ month: `${monthName}`, count });
      }

      setStats({
        totalDonors: allDonors.length,
        registeredDonors: registeredDonors.length,
        availableDonors: available,
        unavailableDonors: unavailable,
        bloodGroupCounts,
        availabilityRate: registeredDonors.length > 0 
          ? Math.round((available / registeredDonors.length) * 100) 
          : 0,
        totalDonations: allDonationsData.length,
        monthlyDonations,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const maxBloodGroupCount = useMemo(() => {
    if (!stats) return 0;
    return Math.max(...Object.values(stats.bloodGroupCounts), 1);
  }, [stats]);

  const maxMonthlyDonations = useMemo(() => {
    if (!stats) return 0;
    return Math.max(...stats.monthlyDonations.map(m => m.count), 1);
  }, [stats]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      {/* Hero Stats Card - Like Profile Page */}
      <div className="relative overflow-hidden">
        <div className="h-20 bg-gradient-to-br from-primary via-primary/80 to-primary/60 rounded-t-2xl" />
        <Card className="relative -mt-8 mx-2 rounded-2xl border-border/50 shadow-lg">
          <CardContent className="p-0">
            {/* Quick Stats Header */}
            <div className="p-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                  <Activity className="h-7 w-7 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Donor Statistics</h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Live community insights
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-4 border-t border-border bg-muted/30">
              <div className="py-3 text-center border-r border-border">
                <p className="text-xl font-bold text-primary">{stats.totalDonors}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
              </div>
              <div className="py-3 text-center border-r border-border">
                <p className="text-xl font-bold text-green-500">{stats.availableDonors}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Available</p>
              </div>
              <div className="py-3 text-center border-r border-border">
                <p className="text-xl font-bold text-amber-500">{stats.availabilityRate}%</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Rate</p>
              </div>
              <div className="py-3 text-center">
                <p className="text-xl font-bold text-red-500">{stats.totalDonations}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Donations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Achievement-Style Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center mb-2">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <p className="font-semibold text-sm">{stats.registeredDonors} Registered</p>
          <p className="text-xs text-muted-foreground">Active donor accounts</p>
        </div>
        
        <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-2xl p-4">
          <div className="h-10 w-10 rounded-xl bg-green-500/20 flex items-center justify-center mb-2">
            <Heart className="h-5 w-5 text-green-500" />
          </div>
          <p className="font-semibold text-sm">{stats.totalDonations} Lives</p>
          <p className="text-xs text-muted-foreground">Potentially saved</p>
        </div>
      </div>

      {/* Blood Group Distribution - Action List Style */}
      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-0">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Droplet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Blood Type Distribution</p>
              <p className="text-xs text-muted-foreground">Donors by blood group</p>
            </div>
          </div>
          
          {/* Blood Group Circles */}
          <div className="p-4 pt-3">
            <div className="grid grid-cols-4 gap-3 mb-4">
              {bloodGroups.map((bg) => (
                <div key={bg} className="text-center">
                  <div 
                    className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md ${bloodGroupColors[bg]}`}
                  >
                    {stats.bloodGroupCounts[bg]}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 font-medium">{bg}</p>
                </div>
              ))}
            </div>
            
            {/* Progress Bars */}
            <div className="space-y-2">
              {bloodGroups.map((bg) => (
                <div key={bg} className="flex items-center gap-3">
                  <span className="text-xs w-8 text-muted-foreground font-medium">{bg}</span>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ${bloodGroupColors[bg]}`}
                      style={{ width: `${(stats.bloodGroupCounts[bg] / maxBloodGroupCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs w-8 text-right font-semibold">{stats.bloodGroupCounts[bg]}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Donation Trends - Action List Style */}
      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-0">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Donation Trends</p>
              <p className="text-xs text-muted-foreground">Last 6 months activity</p>
            </div>
          </div>
          
          <div className="p-4">
            <div className="flex items-end justify-between gap-2 h-28">
              {stats.monthlyDonations.map((month, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center">
                    <span className="text-xs font-semibold mb-1 text-primary">{month.count}</span>
                    <div 
                      className="w-full bg-gradient-to-t from-primary to-primary/70 rounded-t-lg transition-all duration-700"
                      style={{ 
                        height: `${Math.max((month.count / maxMonthlyDonations) * 70, 8)}px`,
                        opacity: month.count > 0 ? 1 : 0.3
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{month.month}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};