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
import { Plus, Calendar as CalendarIcon, Droplets, Award, TrendingUp, Timer, History as HistoryIcon, Coins } from "lucide-react";
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <AppHeader />
        <main className="container mx-auto px-4 py-6 max-w-lg">
          <Skeleton className="h-[500px] w-full rounded-2xl" />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto px-4 py-4 max-w-2xl animate-fade-in">
        {/* Header Section */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-sm">
              <HistoryIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold">Donation History</h1>
              <p className="text-xs text-muted-foreground">Your blood donation journey</p>
            </div>
          </div>
        </div>

        {/* Interactive Stats Row */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <button
            onClick={() => setActiveTab("donations")}
            className={cn(
              "p-3 rounded-2xl text-center transition-all btn-press",
              activeTab === "donations"
                ? "bg-primary/10 ring-2 ring-primary/30"
                : "bg-muted/50 hover:bg-muted/70"
            )}
          >
            <Droplets className={cn(
              "h-5 w-5 mx-auto mb-1.5 transition-colors",
              activeTab === "donations" ? "text-primary" : "text-muted-foreground"
            )} />
            <p className={cn(
              "text-lg font-bold transition-colors",
              activeTab === "donations" ? "text-primary" : "text-foreground"
            )}>{donationCount}</p>
            <p className="text-[10px] text-muted-foreground">Donations</p>
          </button>
          
          <button
            onClick={() => setActiveTab("points")}
            className={cn(
              "p-3 rounded-2xl text-center transition-all btn-press",
              activeTab === "points"
                ? "bg-amber-500/10 ring-2 ring-amber-500/30"
                : "bg-muted/50 hover:bg-muted/70"
            )}
          >
            <Award className={cn(
              "h-5 w-5 mx-auto mb-1.5 transition-colors",
              activeTab === "points" ? "text-amber-600" : "text-muted-foreground"
            )} />
            <p className={cn(
              "text-lg font-bold transition-colors",
              activeTab === "points" ? "text-amber-600" : "text-foreground"
            )}>{totalPoints}</p>
            <p className="text-[10px] text-muted-foreground">Points</p>
          </button>
          
          <div className="p-3 rounded-2xl bg-muted/50 text-center">
            <TrendingUp className="h-5 w-5 text-muted-foreground mx-auto mb-1.5" />
            <p className="text-lg font-bold">{totalUnits}</p>
            <p className="text-[10px] text-muted-foreground">Units</p>
          </div>
        </div>

        {/* Eligibility Progress Card */}
        {profile?.last_donation_date && donationCount > 0 && (
          <Card className="rounded-2xl border-border/50 shadow-soft mb-4 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isEligible 
                    ? "bg-green-500/10" 
                    : "bg-amber-500/10"
                )}>
                  <Timer className={cn(
                    "h-5 w-5",
                    isEligible ? "text-green-600" : "text-amber-600"
                  )} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {isEligible 
                      ? "You're eligible to donate!" 
                      : `${daysUntilEligible} days until eligible`
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last donation: {format(new Date(profile.last_donation_date), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              <Progress 
                value={eligibilityProgress} 
                className={cn(
                  "h-2",
                  isEligible && "[&>div]:bg-green-500"
                )}
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground">Day {Math.min(90, daysSinceLastDonation)}</span>
                <span className="text-[10px] text-muted-foreground">90 days</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11 rounded-xl bg-muted/50 p-1">
            <TabsTrigger value="donations" className="rounded-lg text-sm data-[state=active]:shadow-sm">
              <Droplets className="h-4 w-4 mr-1.5" />
              Donations
            </TabsTrigger>
            <TabsTrigger value="points" className="rounded-lg text-sm data-[state=active]:shadow-sm">
              <Coins className="h-4 w-4 mr-1.5" />
              Points
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="donations" className="mt-4">
            <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Blood Donations</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Your past donations grouped by year
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                {userId && (
                  <DonationHistoryByYear donorId={userId} variant="standalone" />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="points" className="mt-4">
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
              Record a new blood donation. You'll earn {pointsPerDonation} points!
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
                    disabled={(date) => date > new Date()}
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
