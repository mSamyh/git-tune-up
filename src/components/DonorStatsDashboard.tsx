import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Droplet, CheckCircle, Clock, TrendingUp } from "lucide-react";

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
      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("blood_group, availability_status, user_type")
        .in("user_type", ["donor", "both"]);

      // Fetch donor directory
      const { data: directory } = await supabase
        .from("donor_directory")
        .select("blood_group, availability_status, linked_profile_id");

      // Fetch donation history
      const { data: donations } = await supabase
        .from("donation_history")
        .select("donation_date")
        .order("donation_date", { ascending: false });

      // Fetch directory donations
      const { data: directoryDonations } = await supabase
        .from("donor_directory_history")
        .select("donation_date")
        .order("donation_date", { ascending: false });

      const registeredDonors = profiles || [];
      const unlinkedDirectory = (directory || []).filter(d => !d.linked_profile_id);
      const allDonors = [...registeredDonors, ...unlinkedDirectory];
      const allDonationsData = [...(donations || []), ...(directoryDonations || [])];

      // Calculate blood group counts
      const bloodGroupCounts: Record<string, number> = {};
      bloodGroups.forEach(bg => bloodGroupCounts[bg] = 0);
      allDonors.forEach(d => {
        if (d.blood_group && bloodGroupCounts[d.blood_group] !== undefined) {
          bloodGroupCounts[d.blood_group]++;
        }
      });

      // Calculate availability
      const available = registeredDonors.filter(d => d.availability_status === 'available').length;
      const unavailable = registeredDonors.filter(d => d.availability_status !== 'available').length;

      // Calculate monthly donations for the last 6 months
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
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-xl border-border/50 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalDonors}</p>
                <p className="text-xs text-muted-foreground">Total Donors</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50 bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.availableDonors}</p>
                <p className="text-xs text-muted-foreground">Available Now</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50 bg-gradient-to-br from-orange-500/10 to-orange-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.availabilityRate}%</p>
                <p className="text-xs text-muted-foreground">Availability Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50 bg-gradient-to-br from-red-500/10 to-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <Droplet className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalDonations}</p>
                <p className="text-xs text-muted-foreground">Total Donations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blood Group Distribution */}
      <Card className="rounded-xl border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Droplet className="h-4 w-4 text-primary" />
            Donors by Blood Type
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-4 gap-2">
            {bloodGroups.map((bg) => (
              <div key={bg} className="text-center">
                <div 
                  className={`mx-auto w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${bloodGroupColors[bg]}`}
                >
                  {stats.bloodGroupCounts[bg]}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{bg}</p>
              </div>
            ))}
          </div>
          
          {/* Bar Chart */}
          <div className="mt-4 space-y-2">
            {bloodGroups.map((bg) => (
              <div key={bg} className="flex items-center gap-2">
                <span className="text-xs w-8 text-muted-foreground">{bg}</span>
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${bloodGroupColors[bg]}`}
                    style={{ width: `${(stats.bloodGroupCounts[bg] / maxBloodGroupCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs w-6 text-right font-medium">{stats.bloodGroupCounts[bg]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Donation Trends */}
      <Card className="rounded-xl border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Donation Trends (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-end justify-between gap-2 h-24">
            {stats.monthlyDonations.map((month, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center">
                  <span className="text-xs font-medium mb-1">{month.count}</span>
                  <div 
                    className="w-full bg-primary rounded-t-md transition-all duration-500"
                    style={{ 
                      height: `${Math.max((month.count / maxMonthlyDonations) * 60, 4)}px`,
                      opacity: month.count > 0 ? 1 : 0.3
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{month.month}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
