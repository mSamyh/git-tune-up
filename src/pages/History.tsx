import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { BottomNav } from "@/components/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/hooks/use-toast";
import { DonationHistoryByYear } from "@/components/DonationHistoryByYear";
import { PointsHistoryPanel } from "@/components/PointsHistoryPanel";
import { Plus, Calendar as CalendarIcon, Droplets, Award, TrendingUp, Timer, History as HistoryIcon, Coins, Sparkles, Heart, Flame } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { awardDonationPoints, getPointsPerDonation, syncLastDonationDate } from "@/lib/donationPoints";

interface Profile {
  id: string;
  full_name: string;
  last_donation_date: string | null;
  user_type: string;
}

interface DonationRecord {
  id: string;
  donation_date: string;
  hospital_name: string;
  notes: string | null;
  units_donated: number;
}

const History = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [tempDonationDate, setTempDonationDate] = useState<Date>();
  const [hospitalName, setHospitalName] = useState("");
  const [pointsPerDonation, setPointsPerDonation] = useState(100);
  const [donationCount, setDonationCount] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [activeTab, setActiveTab] = useState("donations");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      if (!isMounted) return;
      setUserId(user.id);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, last_donation_date, user_type")
        .eq("id", user.id)
        .single();

      if (!isMounted) return;
      if (profileData) {
        setProfile(profileData);
      }

      const { data: countData } = await supabase.rpc('get_donation_count', { donor_uuid: user.id });
      if (!isMounted) return;
      setDonationCount(countData || 0);

      const { data: pointsData } = await supabase
        .from("donor_points")
        .select("total_points")
        .eq("donor_id", user.id)
        .maybeSingle();
      
      if (!isMounted) return;
      setTotalPoints(pointsData?.total_points || 0);

      await fetchDonations(user.id);
      if (isMounted) setLoading(false);
    };

    loadData();
    fetchPointsSettings();
    
    return () => { isMounted = false; };
  }, [navigate]);

  const fetchDonations = async (donorId: string) => {
    const { data } = await supabase
      .from("donation_history")
      .select("*")
      .eq("donor_id", donorId)
      .order("donation_date", { ascending: false });

    if (data) {
      setDonations(data);
    }
  };

  const fetchPointsSettings = async () => {
    const points = await getPointsPerDonation();
    setPointsPerDonation(points);
  };

  const handleAddDonation = async () => {
    if (!hospitalName.trim()) {
      toast({
        variant: "destructive",
        title: "Hospital name required",
        description: "Please enter the hospital name",
      });
      return;
    }

    if (!tempDonationDate || !userId || !profile) return;

    const formattedDate = format(tempDonationDate, "yyyy-MM-dd");

    // Enforce 90-day gap between donations (medical safety rule)
    const { data: existingDonations } = await supabase
      .from("donation_history")
      .select("donation_date, hospital_name")
      .eq("donor_id", userId)
      .order("donation_date", { ascending: false });

    if (existingDonations && existingDonations.length > 0) {
      const newDate = tempDonationDate;
      const conflict = existingDonations.find((d) => {
        const existing = new Date(d.donation_date);
        const diffDays = Math.abs(differenceInDays(newDate, existing));
        return diffDays < 90;
      });

      if (conflict) {
        const conflictDate = new Date(conflict.donation_date);
        const diffDays = Math.abs(differenceInDays(tempDonationDate, conflictDate));
        const waitDays = 90 - diffDays;
        toast({
          variant: "destructive",
          title: "Too soon to donate",
          description: `You have a donation on ${format(conflictDate, "MMM d, yyyy")} at ${conflict.hospital_name}. Donations must be at least 90 days apart. ${waitDays > 0 ? `Wait ${waitDays} more day${waitDays === 1 ? "" : "s"}.` : ""}`,
        });
        return;
      }
    }

    const { data: newDonation, error: historyError } = await supabase
      .from("donation_history")
      .insert({
        donor_id: userId,
        donation_date: formattedDate,
        hospital_name: hospitalName.trim(),
        units_donated: 1,
      })
      .select()
      .single();

    if (historyError) {
      if (historyError.code === '23505') {
        toast({
          variant: "destructive",
          title: "Duplicate donation",
          description: "You already have a donation recorded for this date",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to add donation",
          description: historyError.message,
        });
      }
      return;
    }

    if (newDonation) {
      const awarded = await awardDonationPoints(userId, newDonation.id, hospitalName.trim(), pointsPerDonation);
      if (awarded) {
        setTotalPoints(prev => prev + pointsPerDonation);
      }
    }

    await syncLastDonationDate(userId);

    const { notifyNewDonation } = await import("@/lib/telegramNotifications");
    await notifyNewDonation({
      donor_name: profile.full_name,
      hospital_name: hospitalName.trim(),
      donation_date: formattedDate,
      units_donated: 1
    });

    setShowAddDialog(false);
    setHospitalName("");
    setTempDonationDate(undefined);
    setDonationCount(prev => prev + 1);
    await fetchDonations(userId);

    // Refetch profile to get updated last_donation_date
    const { data: updatedProfile } = await supabase
      .from("profiles")
      .select("id, full_name, last_donation_date, user_type")
      .eq("id", userId)
      .single();
    if (updatedProfile) setProfile(updatedProfile);

    toast({
      title: "Donation recorded",
      description: `You earned ${pointsPerDonation} points!`,
    });
  };

  const totalUnits = donations.reduce((sum, d) => sum + (d.units_donated || 1), 0);
  const isDonorType = profile?.user_type === 'donor' || profile?.user_type === 'both';

  // Calculate days until eligible (90-day rule)
  const getDaysUntilEligible = () => {
    if (!profile?.last_donation_date) return 0;
    const lastDonation = new Date(profile.last_donation_date);
    const eligibleDate = new Date(lastDonation);
    eligibleDate.setDate(eligibleDate.getDate() + 90);
    const today = new Date();
    const daysRemaining = differenceInDays(eligibleDate, today);
    return Math.max(0, daysRemaining);
  };

  const daysUntilEligible = getDaysUntilEligible();
  const daysSinceLastDonation = profile?.last_donation_date 
    ? differenceInDays(new Date(), new Date(profile.last_donation_date))
    : 0;
  const eligibilityProgress = profile?.last_donation_date 
    ? Math.min(100, (daysSinceLastDonation / 90) * 100)
    : 100;
  const isEligible = daysUntilEligible === 0;

  // Lives saved (each donation can save up to 3 lives)
  const livesSaved = donationCount * 3;
  const ringCircumference = 2 * Math.PI * 52;
  const ringOffset = ringCircumference - (eligibilityProgress / 100) * ringCircumference;

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <AppHeader />
        <main className="container mx-auto px-4 py-6 max-w-lg">
          <Skeleton className="h-[500px] w-full rounded-3xl" />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />

      <main className="container mx-auto px-4 py-4 max-w-2xl animate-fade-in">
        {/* ===== HERO: Eligibility Ring ===== */}
        <div className="relative overflow-hidden rounded-3xl mb-5 shadow-xl">
          {/* Mesh gradient backdrop */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 80% at 0% 0%, hsl(var(--primary) / 0.35) 0%, transparent 55%), radial-gradient(120% 80% at 100% 100%, hsl(265 70% 55% / 0.25) 0%, transparent 55%), linear-gradient(135deg, hsl(222 45% 10%) 0%, hsl(222 45% 14%) 100%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative px-5 pt-5 pb-6">
            {/* Top row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10">
                  <HistoryIcon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="text-white font-bold text-sm tracking-wide">My Journey</h1>
                  <p className="text-white/50 text-[10px] tracking-wider uppercase">
                    Donation History
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-semibold backdrop-blur-md border",
                  isEligible
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
                    : "bg-amber-500/15 text-amber-300 border-amber-400/30"
                )}
              >
                {isEligible ? "✓ Eligible" : `${daysUntilEligible}d to go`}
              </div>
            </div>

            {/* Ring + Lives saved */}
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="hsl(0 0% 100% / 0.1)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke={isEligible ? "hsl(142 71% 50%)" : "hsl(38 92% 55%)"}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    style={{ transition: "stroke-dashoffset 1s ease-out" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {profile?.last_donation_date ? (
                    <>
                      <span className="text-white text-2xl font-black leading-none">
                        {Math.min(90, daysSinceLastDonation)}
                      </span>
                      <span className="text-white/50 text-[9px] uppercase tracking-wider mt-0.5">
                        of 90 days
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-6 w-6 text-emerald-300 mb-0.5" />
                      <span className="text-white/60 text-[9px] uppercase tracking-wider">
                        Ready
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white/60 text-[10px] uppercase tracking-wider mb-1">
                  Lives impacted
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-white text-4xl font-black tabular-nums">{livesSaved}</span>
                  <Heart className="h-5 w-5 text-rose-400 fill-rose-400" />
                </div>
                <p className="text-white/70 text-xs mt-1.5 leading-snug">
                  {profile?.last_donation_date
                    ? isEligible
                      ? "Your body's ready — book your next donation."
                      : `Last donated ${format(new Date(profile.last_donation_date), "MMM d")}.`
                    : "Add your first donation to start tracking."}
                </p>
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-2 mt-5">
              <div className="bg-white/8 backdrop-blur-md rounded-2xl p-2.5 border border-white/10">
                <div className="flex items-center gap-1.5 mb-1">
                  <Droplets className="h-3 w-3 text-white/60" />
                  <span className="text-white/60 text-[9px] uppercase tracking-wider">Donations</span>
                </div>
                <p className="text-white font-black text-xl tabular-nums">{donationCount}</p>
              </div>
              <div className="bg-white/8 backdrop-blur-md rounded-2xl p-2.5 border border-white/10">
                <div className="flex items-center gap-1.5 mb-1">
                  <Award className="h-3 w-3 text-amber-300" />
                  <span className="text-white/60 text-[9px] uppercase tracking-wider">Points</span>
                </div>
                <p className="text-white font-black text-xl tabular-nums">{totalPoints}</p>
              </div>
              <div className="bg-white/8 backdrop-blur-md rounded-2xl p-2.5 border border-white/10">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3 w-3 text-emerald-300" />
                  <span className="text-white/60 text-[9px] uppercase tracking-wider">Units</span>
                </div>
                <p className="text-white font-black text-xl tabular-nums">{totalUnits}</p>
              </div>
            </div>
          </div>

          {/* Holographic accent */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />
        </div>

        {/* ===== Tabs ===== */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12 rounded-2xl bg-muted/50 p-1.5 mb-4">
            <TabsTrigger
              value="donations"
              className="rounded-xl text-sm font-semibold data-[state=active]:shadow-md data-[state=active]:bg-card"
            >
              <Droplets className="h-4 w-4 mr-1.5" />
              Donations
            </TabsTrigger>
            <TabsTrigger
              value="points"
              className="rounded-xl text-sm font-semibold data-[state=active]:shadow-md data-[state=active]:bg-card"
            >
              <Coins className="h-4 w-4 mr-1.5" />
              Points
            </TabsTrigger>
          </TabsList>

          <TabsContent value="donations" className="mt-0">
            <Card className="rounded-3xl border-border/50 shadow-soft overflow-hidden">
              <CardHeader className="pb-2 pt-4 px-5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Flame className="h-4 w-4 text-primary" />
                      Donation Timeline
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Grouped by year, latest first
                    </CardDescription>
                  </div>
                  {donationCount > 0 && (
                    <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-full">
                      {donationCount} total
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pb-4 px-5">
                {userId && <DonationHistoryByYear donorId={userId} variant="standalone" />}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="points" className="mt-0">
            {userId && <PointsHistoryPanel userId={userId} />}
          </TabsContent>
        </Tabs>
      </main>

      {/* Floating Add Button */}
      {isDonorType && (
        <Button
          size="lg"
          className="fixed bottom-24 right-4 h-14 w-14 rounded-2xl shadow-lg z-50 btn-press"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Add Donation Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader className="px-4 py-3 border-b border-border/50">
            <DialogTitle>Add Donation</DialogTitle>
            <DialogDescription>
              Record a new blood donation. You'll earn {pointsPerDonation} points! Donations must be at least 90 days apart for your safety.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <Label>Donation Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-11 rounded-xl",
                      !tempDonationDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {tempDonationDate ? format(tempDonationDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={tempDonationDate}
                    onSelect={setTempDonationDate}
                    disabled={(date) => {
                      if (date > new Date()) return true;
                      // Disable any date within 90 days of an existing donation
                      return donations.some((d) => {
                        const existing = new Date(d.donation_date);
                        return Math.abs(differenceInDays(date, existing)) < 90;
                      });
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hospital">Hospital Name</Label>
              <Input
                id="hospital"
                placeholder="Enter hospital name"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 px-4 py-3 border-t border-border/50">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setShowAddDialog(false);
                setHospitalName("");
                setTempDonationDate(undefined);
              }}
            >
              Cancel
            </Button>
            <Button 
              className="rounded-xl btn-press"
              onClick={handleAddDonation}
              disabled={!tempDonationDate || !hospitalName.trim()}
            >
              Add Donation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default History;
