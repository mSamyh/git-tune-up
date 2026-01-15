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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BottomNav } from "@/components/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar as CalendarIcon, Droplets, Award, TrendingUp, Building2, ChevronDown, History as HistoryIcon } from "lucide-react";
import { format } from "date-fns";
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
  const [openYears, setOpenYears] = useState<string[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchPointsSettings();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    setUserId(user.id);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, full_name, last_donation_date, user_type")
      .eq("id", user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    const { data: countData } = await supabase.rpc('get_donation_count', { donor_uuid: user.id });
    setDonationCount(countData || 0);

    const { data: pointsData } = await supabase
      .from("donor_points")
      .select("total_points")
      .eq("donor_id", user.id)
      .maybeSingle();
    
    setTotalPoints(pointsData?.total_points || 0);

    // Fetch donation history
    await fetchDonations(user.id);

    setLoading(false);
  };

  const fetchDonations = async (donorId: string) => {
    const { data } = await supabase
      .from("donation_history")
      .select("*")
      .eq("donor_id", donorId)
      .order("donation_date", { ascending: false });

    if (data) {
      setDonations(data);
      // Open the most recent year by default
      if (data.length > 0) {
        const mostRecentYear = new Date(data[0].donation_date).getFullYear().toString();
        setOpenYears([mostRecentYear]);
      }
    }
  };

  const fetchPointsSettings = async () => {
    const points = await getPointsPerDonation();
    setPointsPerDonation(points);
  };

  const awardPoints = async (donorId: string, donationId: string, hospitalName: string) => {
    const awarded = await awardDonationPoints(donorId, donationId, hospitalName, pointsPerDonation);
    if (awarded) {
      setTotalPoints(prev => prev + pointsPerDonation);
    }
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
      await awardPoints(userId, newDonation.id, hospitalName.trim());
    }

    // Sync last donation date using shared utility
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

    toast({
      title: "Donation recorded",
      description: `You earned ${pointsPerDonation} points!`,
    });
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears > 0) return `${diffYears}y ago`;
    if (diffMonths > 0) return `${diffMonths}mo ago`;
    if (diffDays > 0) return `${diffDays}d ago`;
    return 'Today';
  };

  // Group donations by year
  const donationsByYear = donations.reduce((acc, donation) => {
    const year = new Date(donation.donation_date).getFullYear().toString();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(donation);
    return acc;
  }, {} as Record<string, DonationRecord[]>);

  // Sort donations within each year
  Object.keys(donationsByYear).forEach(year => {
    donationsByYear[year].sort((a, b) => 
      new Date(b.donation_date).getTime() - new Date(a.donation_date).getTime()
    );
  });

  const sortedYears = Object.keys(donationsByYear).sort((a, b) => Number(b) - Number(a));

  const toggleYear = (year: string) => {
    setOpenYears(prev => 
      prev.includes(year) 
        ? prev.filter(y => y !== year)
        : [...prev, year]
    );
  };

  const totalUnits = donations.reduce((sum, d) => sum + (d.units_donated || 1), 0);
  const isDonorType = profile?.user_type === 'donor' || profile?.user_type === 'both';

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <AppHeader />
        <main className="container mx-auto px-4 py-6 max-w-lg">
          <Skeleton className="h-[450px] w-full rounded-2xl" />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto px-4 py-4 max-w-2xl animate-fade-in">
        <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <HistoryIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-display">Donation History</CardTitle>
                <CardDescription className="text-xs">Your blood donation records</CardDescription>
              </div>
            </div>
          </CardHeader>

          {/* Quick Stats */}
          <div className="px-6 pb-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-green-500/5 border border-green-500/10 text-center">
                <Droplets className="h-5 w-5 text-green-600 mx-auto mb-1.5" />
                <p className="text-base font-semibold text-green-600">{donationCount}</p>
                <p className="text-[10px] text-muted-foreground">Donations</p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-center">
                <Award className="h-5 w-5 text-amber-600 mx-auto mb-1.5" />
                <p className="text-base font-semibold text-amber-600">{totalPoints}</p>
                <p className="text-[10px] text-muted-foreground">Points</p>
              </div>
              <div className="p-3 rounded-2xl bg-blue-500/5 border border-blue-500/10 text-center">
                <TrendingUp className="h-5 w-5 text-blue-600 mx-auto mb-1.5" />
                <p className="text-base font-semibold text-blue-600">{totalUnits}</p>
                <p className="text-[10px] text-muted-foreground">Units</p>
              </div>
            </div>
          </div>

          <CardContent className="pt-0">
            {donations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Droplets className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No donations yet</p>
                <p className="text-xs">Tap + to record your first donation</p>
              </div>
            ) : (
              <ScrollArea className="h-[320px]">
                <div className="space-y-2 pr-3">
                  {sortedYears.map((year) => {
                    const yearDonations = donationsByYear[year];
                    const yearUnits = yearDonations.reduce((sum, d) => sum + (d.units_donated || 1), 0);
                    const isOpen = openYears.includes(year);

                    return (
                      <Collapsible key={year} open={isOpen} onOpenChange={() => toggleYear(year)}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/40 hover:bg-muted/60 rounded-xl transition-colors">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <CalendarIcon className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-semibold text-sm">{year}</span>
                            <Badge variant="secondary" className="rounded-full text-[10px] px-2 h-5">
                              {yearDonations.length} donation{yearDonations.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-medium">{yearUnits}u</span>
                            <ChevronDown className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform duration-200",
                              isOpen && "rotate-180"
                            )} />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2">
                          <div className="space-y-1.5 ml-3 pl-3 border-l-2 border-primary/20">
                            {yearDonations.map((donation) => (
                              <div 
                                key={donation.id} 
                                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                              >
                                <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center flex-shrink-0 shadow-sm">
                                  <Droplets className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <Badge className="bg-green-500/10 text-green-600 border-0 text-xs">Donated</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-1 flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {donation.hospital_name}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                    {format(new Date(donation.donation_date), "MMM d, yyyy")} • {getTimeAgo(donation.donation_date)}
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0 font-bold text-sm text-primary">
                                  {donation.units_donated || 1}
                                  <span className="text-[10px] font-normal text-muted-foreground block">unit{(donation.units_donated || 1) !== 1 ? 's' : ''}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Floating Add Button */}
      {isDonorType && (
        <Button
          size="lg"
          className="fixed bottom-24 right-4 h-14 w-14 rounded-2xl shadow-primary-glow z-50 btn-press"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Add Donation Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Donation</DialogTitle>
            <DialogDescription>
              Record a new blood donation. You'll earn {pointsPerDonation} points!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Donation Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-xl",
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
                      if (profile?.last_donation_date && donationCount > 0) {
                        const existingDate = new Date(profile.last_donation_date);
                        if (date < existingDate) return true;
                      }
                      return false;
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {donationCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  You can only add dates newer than your last donation.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="hospital">Hospital Name</Label>
              <Input
                id="hospital"
                placeholder="Enter hospital name"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                className="rounded-xl"
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
              onClick={handleAddDonation} 
              disabled={!tempDonationDate || !hospitalName.trim()}
              className="rounded-xl"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default History;