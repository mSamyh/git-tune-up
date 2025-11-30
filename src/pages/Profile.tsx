import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Droplet, MapPin, Phone, Calendar as CalendarIcon, Edit, Save, Medal } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/BottomNav";

interface Profile {
  full_name: string;
  phone: string;
  blood_group: string;
  district: string;
  address: string | null;
  is_available: boolean;
  avatar_url: string | null;
  availability_status: string;
  available_date: string | null;
  last_donation_date: string | null;
}

interface DonationHistory {
  id: string;
  donation_date: string;
  hospital_name: string;
  notes: string | null;
  units_donated: number;
}

const Profile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [donationCount, setDonationCount] = useState(0);
  const [lastDonationDate, setLastDonationDate] = useState<Date>();
  const [hospitalName, setHospitalName] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState("available");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
    fetchDonationCount();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      toast({
        variant: "destructive",
        title: "Error loading profile",
        description: error.message,
      });
    } else if (data) {
      setProfile(data);
      setAvailabilityStatus(data.availability_status || 'available');
      if (data.last_donation_date) {
        setLastDonationDate(new Date(data.last_donation_date));
      }
    }

    setLoading(false);
  };

  const fetchDonationCount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data } = await supabase.rpc('get_donation_count', { donor_uuid: user.id });
    
    setDonationCount(data || 0);
  };

  const canSetAvailable = () => {
    if (!profile?.last_donation_date) return true;
    
    const daysSinceLastDonation = Math.floor(
      (new Date().getTime() - new Date(profile.last_donation_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return daysSinceLastDonation >= 90;
  };

  const saveDonation = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !lastDonationDate || !hospitalName) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please provide both date and hospital name",
      });
      return;
    }

    // Check 90-day rule
    if (!canSetAvailable() && availabilityStatus === 'available') {
      toast({
        variant: "destructive",
        title: "Cannot set available",
        description: "You must wait 90 days from your last donation",
      });
      return;
    }

    // Add to donation history
    const { error: historyError } = await supabase
      .from("donation_history")
      .insert({
        donor_id: user.id,
        donation_date: lastDonationDate.toISOString().split('T')[0],
        hospital_name: hospitalName,
        units_donated: 1,
      });

    if (historyError) {
      toast({
        variant: "destructive",
        title: "Failed to save donation",
        description: historyError.message,
      });
      return;
    }

    // Update profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        last_donation_date: lastDonationDate.toISOString().split('T')[0],
        availability_status: availabilityStatus,
      })
      .eq("id", user.id);

    if (profileError) {
      toast({
        variant: "destructive",
        title: "Failed to update profile",
        description: profileError.message,
      });
      return;
    }

    toast({
      title: "Donation recorded",
      description: "Your donation history has been updated",
    });

    setIsEditing(false);
    setHospitalName("");
    fetchProfile();
    fetchDonationCount();
  };

  const updateAvailability = async (status: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    if (status === 'available' && !canSetAvailable()) {
      toast({
        variant: "destructive",
        title: "Cannot set available",
        description: "You must wait 90 days from your last donation",
      });
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ availability_status: status })
      .eq("id", user.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    } else {
      setProfile((prev) => prev ? { ...prev, availability_status: status } : null);
      setAvailabilityStatus(status);
      toast({
        title: "Status updated",
        description: `Your status is now ${status.replace('_', ' ')}`,
      });
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Profile Not Found</CardTitle>
            <CardDescription>Please complete your registration</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/register")}>Complete Registration</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isFirstTimeDonor = !profile?.last_donation_date && donationCount === 0;
  const isTopDonor = donationCount >= 3;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                  <Droplet className="h-8 w-8 text-primary-foreground" />
                  {isTopDonor && (
                    <div className="absolute -top-1 -right-1">
                      <Medal className="h-6 w-6 text-yellow-500" />
                    </div>
                  )}
                </div>
                <div>
                  <CardTitle className="text-2xl">{profile.full_name}</CardTitle>
                  <CardDescription>Donor Profile</CardDescription>
                  {isFirstTimeDonor && (
                    <p className="text-sm text-primary mt-1">First Time Donor</p>
                  )}
                </div>
              </div>
              <Button
                variant={isEditing ? "default" : "outline"}
                size="sm"
                onClick={() => isEditing ? saveDonation() : setIsEditing(true)}
              >
                {isEditing ? <><Save className="h-4 w-4 mr-2" /> Save</> : <><Edit className="h-4 w-4 mr-2" /> Edit</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Droplet className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Blood Group</p>
                    <p className="font-semibold text-lg">{profile.blood_group}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Donations</p>
                  <p className="text-2xl font-bold text-primary">{donationCount}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-semibold">{profile.phone}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-semibold">{profile.district}</p>
                    {profile.address && (
                      <p className="text-sm text-muted-foreground">{profile.address}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="font-semibold">Add Donation Record</h3>
                
                <div className="space-y-2">
                  <Label>Last Donation Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !lastDonationDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {lastDonationDate ? format(lastDonationDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={lastDonationDate}
                        onSelect={setLastDonationDate}
                        disabled={(date) => date > new Date()}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Hospital Name</Label>
                  <Input
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    placeholder="Enter hospital name"
                  />
                </div>
              </div>
            )}

            <div className="space-y-4 p-4 border rounded-lg">
              <div>
                <Label className="text-base font-semibold">Availability Status</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  {!canSetAvailable() && "You must wait 90 days from your last donation to set available"}
                </p>
              </div>
              
              <Select value={availabilityStatus} onValueChange={updateAvailability}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available" disabled={!canSetAvailable()}>
                    Available
                  </SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="available_soon">
                    Available Soon (90 day rule)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {profile.last_donation_date && (
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <CalendarIcon className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Last Donation</p>
                  <p className="font-semibold">
                    {new Date(profile.last_donation_date).toLocaleDateString()}
                  </p>
                  {profile.available_date && availabilityStatus === 'available_soon' && (
                    <p className="text-xs text-muted-foreground">
                      Available after: {new Date(profile.available_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default Profile;