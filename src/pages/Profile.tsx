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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Droplet, MapPin, Phone, Calendar as CalendarIcon, Edit, Save, Medal, Settings } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/BottomNav";
import { AvatarUpload } from "@/components/AvatarUpload";
import { LocationSelector } from "@/components/LocationSelector";

interface Profile {
  id: string;
  full_name: string;
  phone: string;
  blood_group: string;
  district: string | null;
  atoll: string | null;
  island: string | null;
  address: string | null;
  is_available: boolean;
  avatar_url: string | null;
  availability_status: string;
  available_date: string | null;
  last_donation_date: string | null;
  user_type: string;
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
  const [userType, setUserType] = useState("donor");
  const [selectedAtoll, setSelectedAtoll] = useState("");
  const [selectedIsland, setSelectedIsland] = useState("");
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
      setUserType(data.user_type || 'donor');
      setSelectedAtoll(data.atoll || '');
      setSelectedIsland(data.island || '');
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
    // This function is now removed - only admins can add donation history
    toast({
      variant: "destructive",
      title: "Not allowed",
      description: "Only admins can manage donation history",
    });
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

  const updateUserType = async (type: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ user_type: type })
      .eq("id", user.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    } else {
      setProfile((prev) => prev ? { ...prev, user_type: type } : null);
      setUserType(type);
      toast({
        title: "User type updated",
        description: `You are now a ${type}`,
      });
    }
  };

  const updateLocation = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !selectedAtoll || !selectedIsland) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select both atoll and island",
      });
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ 
        atoll: selectedAtoll,
        island: selectedIsland,
        district: `${selectedAtoll} - ${selectedIsland}`
      })
      .eq("id", user.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    } else {
      toast({
        title: "Location updated",
        description: "Your location has been updated successfully",
      });
      fetchProfile();
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
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <AvatarUpload
                    currentAvatarUrl={profile.avatar_url}
                    userName={profile.full_name}
                    onUploadComplete={(url) => setProfile(prev => prev ? {...prev, avatar_url: url} : null)}
                  />
                  {isTopDonor && (
                    <div className="absolute -top-1 -right-1">
                      <Medal className="h-6 w-6 text-yellow-500" />
                    </div>
                  )}
                </div>
                <div>
                  <CardTitle className="text-2xl">{profile.full_name}</CardTitle>
                  <CardDescription>Your Profile</CardDescription>
                  {isFirstTimeDonor && (
                    <p className="text-sm text-primary mt-1">First Time Donor</p>
                  )}
                </div>
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
                    <p className="font-semibold">
                      {profile.atoll && profile.island
                        ? `${profile.atoll} - ${profile.island}`
                        : profile.district || "Not set"}
                    </p>
                    {profile.address && (
                      <p className="text-sm text-muted-foreground">{profile.address}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg">
              <div>
                <Label className="text-base font-semibold">Update Location</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Select your atoll and island
                </p>
              </div>
              
              <LocationSelector
                selectedAtoll={selectedAtoll}
                selectedIsland={selectedIsland}
                onAtollChange={setSelectedAtoll}
                onIslandChange={setSelectedIsland}
              />
              
              <Button onClick={updateLocation} className="w-full">
                Save Location
              </Button>
            </div>

            <div className="space-y-4 p-4 border rounded-lg">
              <div>
                <Label className="text-base font-semibold">Profile Type</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Choose whether you want to be a donor, receiver, or both
                </p>
              </div>
              
              <Select value={userType} onValueChange={updateUserType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="donor">Donor Only</SelectItem>
                  <SelectItem value="receiver">Receiver Only</SelectItem>
                  <SelectItem value="both">Both Donor & Receiver</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {userType === 'donor' && "You will be visible in the donor directory"}
                {userType === 'receiver' && "You will NOT be visible in the donor directory"}
                {userType === 'both' && "You will be visible in the donor directory"}
              </p>
            </div>

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
                </div>
              </div>
            )}

            <DonationHistory donorId={profile.id} />
          </CardContent>
        </Card>

        <CheckAdminButton />
      </main>

      <BottomNav />
    </div>
  );
};

const DonationHistory = ({ donorId }: { donorId: string }) => {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
  }, [donorId]);

  const fetchHistory = async () => {
    const { data } = await supabase
      .from("donation_history")
      .select("*")
      .eq("donor_id", donorId)
      .order("donation_date", { ascending: false });

    if (data) setHistory(data);
  };

  if (history.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">Donation History</CardTitle>
        <CardDescription>Your past donations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {history.map((donation) => (
            <div key={donation.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">{donation.hospital_name}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(donation.donation_date).toLocaleDateString()}
                </p>
                {donation.notes && (
                  <p className="text-xs text-muted-foreground">{donation.notes}</p>
                )}
              </div>
              <Badge variant="outline">{donation.units_donated} unit(s)</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const CheckAdminButton = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    setIsAdmin(!!data);
  };

  if (!isAdmin) return null;

  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <Button onClick={() => navigate("/admin")} className="w-full">
          <Settings className="h-4 w-4 mr-2" />
          Admin Panel
        </Button>
      </CardContent>
    </Card>
  );
};

export default Profile;