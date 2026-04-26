import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BottomNav } from "@/components/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/hooks/use-toast";
import { DonationHistoryByYear } from "@/components/DonationHistoryByYear";
import { PointsHistoryPanel } from "@/components/PointsHistoryPanel";
import {
  Plus,
  Calendar as CalendarIcon,
  Droplets,
  Award,
  Heart,
  ShieldCheck,
  Clock,
  Info,
  CheckCircle2,
  Hourglass,
  Activity,
  Coins,
} from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";
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
      if (profileData) setProfile(profileData);

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
    if (data) setDonations(data);
  };

  const fetchPointsSettings = async () => {
    const points = await getPointsPerDonation();
    setPointsPerDonation(points);
  };

  const handleAddDonation = async () => {
    if (!hospitalName.trim()) {
      toast({ variant: "destructive", title: "Hospital name required", description: "Please enter the hospital name" });
      return;
    }
    if (!tempDonationDate || !userId || !profile) return;

    const formattedDate = format(tempDonationDate, "yyyy-MM-dd");

    const { data: existingDonations } = await supabase
      .from("donation_history")
      .select("donation_date, hospital_name")
      .eq("donor_id", userId)
      .order("donation_date", { ascending: false });

    if (existingDonations && existingDonations.length > 0) {
      const newDate = tempDonationDate;
      const conflict = existingDonations.find((d) => {
        const existing = new Date(d.donation_date);
        return Math.abs(differenceInDays(newDate, existing)) < 90;
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
        toast({ variant: "destructive", title: "Duplicate donation", description: "You already have a donation recorded for this date" });
      } else {
        toast({ variant: "destructive", title: "Failed to add donation", description: historyError.message });
      }
      return;
    }

    if (newDonation) {
      const awarded = await awardDonationPoints(userId, newDonation.id, hospitalName.trim(), pointsPerDonation);
      if (awarded) setTotalPoints(prev => prev + pointsPerDonation);
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

    const { data: updatedProfile } = await supabase
      .from("profiles")
      .select("id, full_name, last_donation_date, user_type")
      .eq("id", userId)
      .single();
    if (updatedProfile) setProfile(updatedProfile);

    toast({ title: "Donation recorded", description: `You earned ${pointsPerDonation} points!` });
  };

  const totalUnits = donations.reduce((sum, d) => sum + (d.units_donated || 1), 0);
  const isDonorType = profile?.user_type === 'donor' || profile?.user_type === 'both';

  // Use the most recent donation from history (more reliable than profile.last_donation_date)
  const lastDonationDateStr = donations[0]?.donation_date || profile?.last_donation_date || null;

  const getDaysUntilEligible = () => {
    if (!lastDonationDateStr) return 0;
    const lastDonation = new Date(lastDonationDateStr);
    const eligibleDate = addDays(lastDonation, 90);
    return Math.max(0, differenceInDays(eligibleDate, new Date()));
  };

  const daysUntilEligible = getDaysUntilEligible();
  const daysSinceLastDonation = lastDonationDateStr
    ? Math.max(0, differenceInDays(new Date(), new Date(lastDonationDateStr)))
    : 0;
  const progress = lastDonationDateStr ? Math.min(100, (daysSinceLastDonation / 90) * 100) : 100;
  const isEligible = daysUntilEligible === 0;
  const livesSaved = donationCount * 3;
  const nextEligibleDate = lastDonationDateStr ? addDays(new Date(lastDonationDateStr), 90) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <AppHeader />
        <main className="container mx-auto px-4 py-6 max-w-lg space-y-4">
          <Skeleton className="h-72 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader />

      <main className="container mx-auto px-4 pt-3 pb-4 max-w-2xl animate-fade-in space-y-4">
        {/* ========== HERO CARD ========== */}
        <section
          className="relative overflow-hidden rounded-[28px] shadow-2xl"
          style={{
            background:
              "linear-gradient(135deg, hsl(0 75% 18%) 0%, hsl(348 70% 22%) 45%, hsl(15 65% 20%) 100%)",
          }}
        >
          {/* Decorative blobs */}
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-rose-500/30 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 w-56 h-56 rounded-full bg-amber-500/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.07] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(hsl(0 0% 100%) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          />

          <div className="relative p-5">
            {/* Header row */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-white/60 text-[10px] uppercase tracking-[0.2em] font-semibold mb-1">
                  Your Journey
                </p>
                <h1 className="text-white text-2xl font-black leading-tight">
                  Donation History
                </h1>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-lg">
                <Heart className="h-6 w-6 text-white fill-rose-300/40" />
              </div>
            </div>

            {/* Lives saved hero number */}
            <div className="flex items-end gap-3 mb-5">
              <div>
                <p className="text-white/60 text-[10px] uppercase tracking-wider mb-0.5">
                  Lives impacted
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-white text-6xl font-black tabular-nums leading-none drop-shadow-lg">
                    {livesSaved}
                  </span>
                  <span className="text-white/70 text-sm font-medium">lives</span>
                </div>
              </div>
              <div className="ml-auto flex flex-col items-end gap-1">
                <div
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-md border flex items-center gap-1.5",
                    isEligible
                      ? "bg-emerald-500/25 text-emerald-100 border-emerald-300/40"
                      : "bg-amber-500/25 text-amber-100 border-amber-300/40"
                  )}
                >
                  {isEligible ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Eligible
                    </>
                  ) : (
                    <>
                      <Hourglass className="h-3.5 w-3.5" />
                      {daysUntilEligible}d to go
                    </>
                  )}
                </div>
                <p className="text-white/50 text-[10px]">
                  {donationCount} donation{donationCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* 90-Day eligibility bar */}
            <div className="bg-black/25 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="text-white text-[11px] font-semibold uppercase tracking-wider">
                    90-Day Recovery
                  </span>
                </div>
                <span className="text-white/80 text-[11px] font-bold tabular-nums">
                  Day {Math.min(90, daysSinceLastDonation)}/90
                </span>
              </div>
              {/* Custom progress bar */}
              <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all duration-1000",
                    isEligible
                      ? "bg-gradient-to-r from-emerald-400 to-green-300"
                      : "bg-gradient-to-r from-amber-400 to-rose-300"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-white/60 text-[10px]">
                  {lastDonationDateStr
                    ? `Last: ${format(new Date(lastDonationDateStr), "MMM d, yyyy")}`
                    : "No donations recorded"}
                </p>
                {nextEligibleDate && !isEligible && (
                  <p className="text-white/80 text-[10px] font-medium">
                    Next: {format(nextEligibleDate, "MMM d")}
                  </p>
                )}
              </div>
            </div>

            {/* Stats trio */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10">
                <Droplets className="h-4 w-4 text-rose-200 mb-1.5" />
                <p className="text-white text-xl font-black tabular-nums leading-none">{donationCount}</p>
                <p className="text-white/60 text-[10px] mt-1">Donations</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10">
                <Award className="h-4 w-4 text-amber-200 mb-1.5" />
                <p className="text-white text-xl font-black tabular-nums leading-none">{totalPoints}</p>
                <p className="text-white/60 text-[10px] mt-1">Points</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10">
                <Activity className="h-4 w-4 text-emerald-200 mb-1.5" />
                <p className="text-white text-xl font-black tabular-nums leading-none">{totalUnits}</p>
                <p className="text-white/60 text-[10px] mt-1">Units</p>
              </div>
            </div>
          </div>
        </section>

        {/* ========== 90-DAY RULE INFO BANNER ========== */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug">
              90 days between donations
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              For your safety, the app blocks adding donations less than 90 days apart. Dates within the gap are disabled in the picker.
            </p>
          </div>
        </div>

        {/* ========== TABS ========== */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12 rounded-2xl bg-muted/60 p-1.5">
            <TabsTrigger
              value="donations"
              className="rounded-xl text-sm font-semibold data-[state=active]:shadow-md data-[state=active]:bg-card transition-all"
            >
              <Droplets className="h-4 w-4 mr-1.5" />
              Donations
            </TabsTrigger>
            <TabsTrigger
              value="points"
              className="rounded-xl text-sm font-semibold data-[state=active]:shadow-md data-[state=active]:bg-card transition-all"
            >
              <Coins className="h-4 w-4 mr-1.5" />
              Points
            </TabsTrigger>
          </TabsList>

          <TabsContent value="donations" className="mt-3">
            <div className="rounded-3xl bg-card border border-border/60 shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Timeline
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Grouped by year, latest first
                  </p>
                </div>
                {donationCount > 0 && (
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                    {donationCount} total
                  </span>
                )}
              </div>
              <div className="px-4 pb-4">
                {userId && <DonationHistoryByYear donorId={userId} variant="standalone" />}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="points" className="mt-3">
            {userId && <PointsHistoryPanel userId={userId} />}
          </TabsContent>
        </Tabs>
      </main>

      {/* Floating Add Button */}
      {isDonorType && (
        <Button
          size="lg"
          className="fixed bottom-24 right-4 h-14 w-14 rounded-2xl shadow-xl z-50 btn-press bg-gradient-to-br from-primary to-rose-600 hover:opacity-95"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Add Donation Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader className="px-1 pt-1">
            <DialogTitle className="text-lg flex items-center gap-2">
              <Droplets className="h-5 w-5 text-primary" />
              Add Donation
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Earn <span className="font-bold text-primary">{pointsPerDonation} points</span>. For your safety, donations must be at least <span className="font-semibold">90 days apart</span> — blocked dates are disabled below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Donation Date</Label>
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
              <Label htmlFor="hospital" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hospital Name</Label>
              <Input
                id="hospital"
                placeholder="e.g. IGMH, ADK Hospital, KRH"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
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
