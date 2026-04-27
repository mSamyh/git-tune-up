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
  Sparkles,
  TrendingUp,
  Coins,
  Flame,
  ChevronRight,
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
      // The DB trigger may also raise check_violation if somehow bypassed
      if (historyError.code === '23505') {
        toast({ variant: "destructive", title: "Duplicate donation", description: "You already have a donation recorded for this date" });
      } else if (historyError.message?.toLowerCase().includes('90 days')) {
        toast({ variant: "destructive", title: "Too soon to donate", description: historyError.message });
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
    : 90;
  const progress = lastDonationDateStr ? Math.min(100, (daysSinceLastDonation / 90) * 100) : 100;
  const isEligible = daysUntilEligible === 0;
  const livesSaved = donationCount * 3;
  const nextEligibleDate = lastDonationDateStr ? addDays(new Date(lastDonationDateStr), 90) : null;

  // SVG ring math
  const RING_SIZE = 168;
  const STROKE = 12;
  const RADIUS = (RING_SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * RADIUS;
  const dashOffset = CIRC - (progress / 100) * CIRC;

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <AppHeader />
        <main className="container mx-auto px-4 py-6 max-w-lg space-y-4">
          <Skeleton className="h-80 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 pb-28">
      <AppHeader />

      <main className="container mx-auto px-4 pt-3 pb-4 max-w-2xl animate-fade-in space-y-4">
        {/* ============== HERO: Eligibility Ring ============== */}
        <section className="relative overflow-hidden rounded-[32px] border border-border/40 bg-card shadow-xl">
          {/* Top half: dark gradient with ring */}
          <div
            className="relative px-5 pt-6 pb-5"
            style={{
              background:
                "radial-gradient(circle at 30% 20%, hsl(0 70% 22%) 0%, hsl(0 80% 14%) 45%, hsl(348 60% 10%) 100%)",
            }}
          >
            {/* Soft noise / dots overlay */}
            <div
              className="absolute inset-0 opacity-[0.08] pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(hsl(0 0% 100%) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />
            {/* Glow blobs */}
            <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-rose-500/30 blur-3xl" />
            <div className="absolute -bottom-10 -left-12 w-40 h-40 rounded-full bg-amber-500/20 blur-3xl" />

            <div className="relative flex items-center justify-between mb-4">
              <div>
                <p className="text-white/60 text-[10px] uppercase tracking-[0.25em] font-bold mb-1">
                  Donation Journey
                </p>
                <h1 className="text-white text-2xl font-black leading-tight">
                  {profile?.full_name?.split(" ")[0] || "Hero"}'s Story
                </h1>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-md border flex items-center gap-1.5",
                    isEligible
                      ? "bg-emerald-400/20 text-emerald-100 border-emerald-300/40"
                      : "bg-amber-400/20 text-amber-100 border-amber-300/40"
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  {isEligible ? "Ready to donate" : "Recovery phase"}
                </div>
              </div>
            </div>

            {/* Ring + Lives saved */}
            <div className="relative flex items-center justify-between gap-4">
              {/* Circular Ring */}
              <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
                <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
                  <defs>
                    <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      {isEligible ? (
                        <>
                          <stop offset="0%" stopColor="hsl(142 76% 56%)" />
                          <stop offset="100%" stopColor="hsl(160 84% 60%)" />
                        </>
                      ) : (
                        <>
                          <stop offset="0%" stopColor="hsl(45 95% 60%)" />
                          <stop offset="100%" stopColor="hsl(15 90% 60%)" />
                        </>
                      )}
                    </linearGradient>
                  </defs>
                  {/* Track */}
                  <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RADIUS}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={STROKE}
                    fill="none"
                  />
                  {/* Progress */}
                  <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RADIUS}
                    stroke="url(#ringGradient)"
                    strokeWidth={STROKE}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={dashOffset}
                    className="transition-all duration-1000"
                  />
                </svg>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {isEligible ? (
                    <>
                      <Heart className="h-6 w-6 text-emerald-300 fill-emerald-400/40 mb-1" />
                      <p className="text-white text-xl font-black leading-none">Eligible</p>
                      <p className="text-white/50 text-[10px] mt-1 font-medium">Donate now</p>
                    </>
                  ) : (
                    <>
                      <p className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5 font-bold">
                        Wait
                      </p>
                      <p className="text-white text-3xl font-black tabular-nums leading-none">
                        {daysUntilEligible}
                      </p>
                      <p className="text-white/60 text-[10px] mt-0.5">
                        day{daysUntilEligible !== 1 ? "s" : ""}
                      </p>
                      <div className="mt-1.5 px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-[9px] font-semibold">
                        {Math.min(90, daysSinceLastDonation)}/90
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Lives impacted */}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <p className="text-white/50 text-[10px] uppercase tracking-wider font-bold mb-1">
                    Lives Impacted
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-white text-5xl font-black tabular-nums leading-none drop-shadow-2xl">
                      {livesSaved}
                    </span>
                    <Flame className="h-5 w-5 text-rose-300 fill-rose-400/30" />
                  </div>
                  <p className="text-white/60 text-xs mt-1">
                    From {donationCount} donation{donationCount !== 1 ? "s" : ""}
                  </p>
                </div>

                {nextEligibleDate && !isEligible && (
                  <div className="bg-white/5 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10">
                    <p className="text-white/50 text-[9px] uppercase tracking-wider font-bold">
                      Next eligible
                    </p>
                    <p className="text-white text-sm font-bold mt-0.5">
                      {format(nextEligibleDate, "MMM d, yyyy")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom: stat cards on light surface */}
          <div className="grid grid-cols-3 divide-x divide-border bg-card">
            <button
              onClick={() => setActiveTab("donations")}
              className="px-3 py-3.5 text-center hover:bg-muted/50 transition-colors"
            >
              <Droplets className="h-4 w-4 text-rose-500 mx-auto mb-1" />
              <p className="text-xl font-black tabular-nums leading-none">{donationCount}</p>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                Donations
              </p>
            </button>
            <button
              onClick={() => setActiveTab("points")}
              className="px-3 py-3.5 text-center hover:bg-muted/50 transition-colors"
            >
              <Award className="h-4 w-4 text-amber-500 mx-auto mb-1" />
              <p className="text-xl font-black tabular-nums leading-none">{totalPoints}</p>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                Points
              </p>
            </button>
            <div className="px-3 py-3.5 text-center">
              <TrendingUp className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
              <p className="text-xl font-black tabular-nums leading-none">{totalUnits}</p>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                Units
              </p>
            </div>
          </div>
        </section>

        {/* ============== 90-Day Safety Banner ============== */}
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.06] to-transparent p-3.5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground leading-snug">
              90-day medical safety rule
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Enforced by the system — dates within 90 days of any donation cannot be added.
            </p>
          </div>
        </div>

        {/* ============== Tabs ============== */}
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
                    <ChevronRight className="h-4 w-4 text-primary" />
                    Timeline
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Grouped by year, latest first
                  </p>
                </div>
                {donationCount > 0 && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
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
          className="fixed bottom-24 right-4 h-14 w-14 rounded-2xl shadow-2xl z-50 btn-press bg-gradient-to-br from-primary to-rose-600 hover:opacity-95 ring-4 ring-primary/20"
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
