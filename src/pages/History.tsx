import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BottomNav } from "@/components/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { AppHeader } from "@/components/AppHeader";
import { DonationHistoryByYear } from "@/components/DonationHistoryByYear";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  full_name: string;
  last_donation_date: string | null;
  user_type: string;
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
  const [refreshKey, setRefreshKey] = useState(0);
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

    setLoading(false);
  };

  const fetchPointsSettings = async () => {
    const { data } = await supabase
      .from("reward_settings")
      .select("setting_value")
      .eq("setting_key", "points_per_donation")
      .maybeSingle();

    if (data) setPointsPerDonation(parseInt(data.setting_value));
  };

  const awardPoints = async (donorId: string, donationId: string, hospitalName: string) => {
    const { data: existingTransaction } = await supabase
      .from("points_transactions")
      .select("id")
      .eq("related_donation_id", donationId)
      .maybeSingle();

    if (existingTransaction) {
      console.log(`Points already awarded for donation ${donationId}, skipping`);
      return;
    }

    const { error: txError } = await supabase
      .from("points_transactions")
      .insert({
        donor_id: donorId,
        points: pointsPerDonation,
        transaction_type: "earned",
        description: `Points earned from blood donation at ${hospitalName}`,
        related_donation_id: donationId,
      });

    if (txError) {
      console.error("Failed to create points transaction:", txError);
      toast({
        variant: "destructive",
        title: "Points Error",
        description: "Failed to award points for this donation.",
      });
      return;
    }

    const { data: existingPoints } = await supabase
      .from("donor_points")
      .select("*")
      .eq("donor_id", donorId)
      .maybeSingle();

    if (existingPoints) {
      await supabase
        .from("donor_points")
        .update({
          total_points: existingPoints.total_points + pointsPerDonation,
          lifetime_points: existingPoints.lifetime_points + pointsPerDonation,
          updated_at: new Date().toISOString(),
        })
        .eq("donor_id", donorId);
    } else {
      await supabase
        .from("donor_points")
        .insert({
          donor_id: donorId,
          total_points: pointsPerDonation,
          lifetime_points: pointsPerDonation,
        });
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

    // Fetch most recent donation date to update profile
    const { data: historyData } = await supabase
      .from("donation_history")
      .select("donation_date")
      .eq("donor_id", userId)
      .order("donation_date", { ascending: false })
      .limit(1)
      .single();

    if (historyData) {
      await supabase
        .from("profiles")
        .update({ last_donation_date: historyData.donation_date })
        .eq("id", userId);
    }

    // Send Telegram notification
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
    setRefreshKey(prev => prev + 1);

    toast({
      title: "Donation recorded",
      description: `You earned ${pointsPerDonation} points!`,
    });
  };

  const isDonorType = profile?.user_type === 'donor' || profile?.user_type === 'both';

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <AppHeader />
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Skeleton className="h-64 w-full" />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>My Donation History</CardTitle>
            <CardDescription>Your personal donation records grouped by year</CardDescription>
          </CardHeader>
          <CardContent>
            {userId && <DonationHistoryByYear key={refreshKey} donorId={userId} variant="standalone" />}
          </CardContent>
        </Card>
      </main>

      {/* Floating Add Button */}
      {isDonorType && (
        <Button
          size="lg"
          className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg z-50"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Add Donation Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
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
                      "w-full justify-start text-left font-normal",
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
                  You can only add dates newer than your last donation date.
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setHospitalName("");
                setTempDonationDate(undefined);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddDonation} disabled={!tempDonationDate || !hospitalName.trim()}>
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
