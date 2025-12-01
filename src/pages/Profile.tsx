import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { AppHeader } from "@/components/AppHeader";
import { TopDonorBadge } from "@/components/TopDonorBadge";

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
  const [tempDonationDate, setTempDonationDate] = useState<Date>();
  const [hospitalName, setHospitalName] = useState("");
  const [showHospitalDialog, setShowHospitalDialog] = useState(false);
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
    
    const count = data || 0;
    setDonationCount(count);

    // If donation count is 0, automatically clear last_donation_date
    if (count === 0 && profile?.last_donation_date) {
      await supabase
        .from("profiles")
        .update({ 
          last_donation_date: null,
          availability_status: 'available'
        })
        .eq("id", user.id);
      
      await fetchProfile();
    } else if (count > 0) {
      // If donations exist, fetch the most recent donation date from history
      const { data: historyData } = await supabase
        .from("donation_history")
        .select("donation_date")
        .eq("donor_id", user.id)
        .order("donation_date", { ascending: false })
        .limit(1)
        .single();

      if (historyData && historyData.donation_date !== profile?.last_donation_date) {
        await supabase
          .from("profiles")
          .update({ last_donation_date: historyData.donation_date })
          .eq("id", user.id);
        
        await fetchProfile();
      }
    }
  };

  const canSetAvailable = () => {
    // If no last donation date (0 donations), allow setting available
    if (!profile?.last_donation_date) return true;
    
    const daysSinceLastDonation = Math.floor(
      (new Date().getTime() - new Date(profile.last_donation_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return daysSinceLastDonation >= 90;
  };

  const getDaysUntilAvailable = () => {
    if (!profile?.last_donation_date) return 0;
    
    const daysSinceLastDonation = Math.floor(
      (new Date().getTime() - new Date(profile.last_donation_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return Math.max(0, 90 - daysSinceLastDonation);
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <AvatarUpload
                    currentAvatarUrl={profile.avatar_url}
                    userName={profile.full_name}
                    onUploadComplete={(url) => setProfile(prev => prev ? {...prev, avatar_url: url} : null)}
                  />
                </div>
                <div>
                  <CardTitle className="text-2xl">{profile.full_name}</CardTitle>
                  <CardDescription>Your Profile</CardDescription>
                  {isFirstTimeDonor && (
                    <p className="text-sm text-primary mt-1">First Time Donor</p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? <Save className="h-4 w-4 mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
                {isEditing ? "Save" : "Edit"}
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
                {userType === 'donor' && "You will be visible in the donor list"}
                {userType === 'receiver' && "You will NOT be visible in the donor list"}
                {userType === 'both' && "You will be visible in the donor list"}
              </p>
            </div>

            {(userType === 'donor' || userType === 'both') && (
              <>
                <div className="space-y-4 p-4 border rounded-lg">
                  <div>
                    <Label className="text-base font-semibold">Availability Status</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      {!canSetAvailable() 
                        ? `You must wait ${getDaysUntilAvailable()} more days from your last donation to set available`
                        : "Update your availability status"
                      }
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

                <div className="space-y-4 p-4 border rounded-lg">
              <div>
                <Label className="text-base font-semibold">Last Donation Date</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  {donationCount === 0 
                    ? "Set your first blood donation date. No future dates allowed."
                    : "You can only update to a newer date. Cannot clear or backdate once you have donation history."
                  }
                </p>
              </div>
              
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
                    {lastDonationDate ? format(lastDonationDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={lastDonationDate}
                    onSelect={(date) => {
                      if (date) {
                        setTempDonationDate(date);
                        setShowHospitalDialog(true);
                      }
                    }}
                    disabled={(date) => {
                      // Can't select future dates
                      if (date > new Date()) return true;
                      // Can't select dates older than existing last_donation_date if history exists
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

              {lastDonationDate && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {format(lastDonationDate, "PPP")}
                </p>
              )}

              {(profile?.last_donation_date || lastDonationDate) && donationCount === 0 && (
                <Button 
                  variant="outline"
                  onClick={async () => {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;

                    // Only allow clearing if donation count is 0
                    if (donationCount > 0) {
                      toast({
                        variant: "destructive",
                        title: "Cannot clear",
                        description: "You can only clear last donation date when you have no donation history",
                      });
                      return;
                    }

                    // Clear last donation date
                    const { error } = await supabase
                      .from("profiles")
                      .update({ 
                        last_donation_date: null,
                        availability_status: 'available'
                      })
                      .eq("id", user.id);

                    if (error) {
                      toast({
                        variant: "destructive",
                        title: "Clear failed",
                        description: error.message,
                      });
                      return;
                    }

                    setLastDonationDate(undefined);
                    toast({
                      title: "Date cleared",
                      description: "Your last donation date has been cleared",
                    });
                    
                    // Refresh all data
                    await fetchProfile();
                    await fetchDonationCount();
                  }}
                >
                  Clear
                </Button>
              )}
              
              {donationCount > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  ℹ️ Clear button is only available when you have 0 donations. Contact an admin to delete donation history if needed.
                </p>
              )}
            </div>

            <Dialog open={showHospitalDialog} onOpenChange={setShowHospitalDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enter Hospital Name</DialogTitle>
                  <DialogDescription>
                    Please enter the name of the hospital where you donated blood on {tempDonationDate && format(tempDonationDate, "PPP")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
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
                      setShowHospitalDialog(false);
                      setHospitalName("");
                      setTempDonationDate(undefined);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!hospitalName.trim()) {
                        toast({
                          variant: "destructive",
                          title: "Hospital name required",
                          description: "Please enter the hospital name",
                        });
                        return;
                      }

                      if (!tempDonationDate) return;

                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) return;

                      const formattedDate = format(tempDonationDate, "yyyy-MM-dd");

                      // Update profile with last donation date (trigger will insert into donation_history)
                      const { error: profileError } = await supabase
                        .from("profiles")
                        .update({ last_donation_date: formattedDate })
                        .eq("id", user.id);

                      if (profileError) {
                        toast({
                          variant: "destructive",
                          title: "Update failed",
                          description: profileError.message,
                        });
                        return;
                      }

                      // Wait a moment for trigger to complete, then update the hospital name
                      setTimeout(async () => {
                        const { error: historyError } = await supabase
                          .from("donation_history")
                          .update({ hospital_name: hospitalName })
                          .eq("donor_id", user.id)
                          .eq("donation_date", formattedDate);

                        if (historyError) {
                          console.error("Error updating hospital name:", historyError);
                        }

                        await fetchProfile();
                        await fetchDonationCount();
                      }, 500);

                      setLastDonationDate(tempDonationDate);
                      setShowHospitalDialog(false);
                      setHospitalName("");
                      setTempDonationDate(undefined);

                      toast({
                        title: "Date updated",
                        description: "Your last donation date has been updated",
                      });
                    }}
                  >
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <DonationHistory donorId={profile.id} />
              </>
            )}

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

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears > 0) {
      return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
    } else if (diffMonths > 0) {
      return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    } else if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return 'Today';
    }
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
                <p className="text-xs text-muted-foreground italic">
                  {getTimeAgo(donation.donation_date)}
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