import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Droplet, MapPin, Phone, Edit, Save, Settings, Gift, QrCode } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { AvatarUpload } from "@/components/AvatarUpload";
import { LocationSelector } from "@/components/LocationSelector";
import { AppHeader } from "@/components/AppHeader";
import { TopDonorBadge } from "@/components/TopDonorBadge";
import { RewardsSection } from "@/components/RewardsSection";
import { DonorQRCard } from "@/components/DonorQRCard";


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
  title: string | null;
  title_color: string | null;
  bio: string | null;
}


const Profile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [donationCount, setDonationCount] = useState(0);
  const [availabilityStatus, setAvailabilityStatus] = useState("available");
  const [userType, setUserType] = useState("donor");
  const [selectedAtoll, setSelectedAtoll] = useState("");
  const [selectedIsland, setSelectedIsland] = useState("");
  const [showRewardsDialog, setShowRewardsDialog] = useState(false);
  const [showQRCard, setShowQRCard] = useState(false);
  
  const [bio, setBio] = useState("");
  const [isEditingBio, setIsEditingBio] = useState(false);
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
      setBio(data.bio || '');
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

  const saveBio = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ bio })
      .eq("id", user.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    } else {
      setProfile(prev => prev ? { ...prev, bio } : null);
      setIsEditingBio(false);
      toast({
        title: "Bio updated",
        description: "Your bio has been saved",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
        {/* Profile Card */}
        <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 pb-4">
            {/* Action buttons at top right */}
            <div className="flex justify-end gap-2 -mt-2 -mr-2">
              {(userType === 'donor' || userType === 'both') && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowQRCard(true)}
                  title="Donor ID Card"
                  className="h-9 w-9 rounded-full bg-background/80 backdrop-blur"
                >
                  <QrCode className="h-4 w-4 text-primary" />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsEditing(!isEditing)}
                className="rounded-full bg-background/80 backdrop-blur px-3"
              >
                {isEditing ? <Save className="h-4 w-4 mr-1" /> : <Edit className="h-4 w-4 mr-1" />}
                {isEditing ? "Save" : "Edit"}
              </Button>
            </div>

            {/* Centered Profile Section */}
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <AvatarUpload
                  currentAvatarUrl={profile.avatar_url}
                  userName={profile.full_name}
                  onUploadComplete={(url) => setProfile(prev => prev ? {...prev, avatar_url: url} : null)}
                  size="lg"
                />
                {(userType === 'donor' || userType === 'both') && (
                  <Button
                    size="icon"
                    className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md bg-primary hover:bg-primary/90"
                    onClick={() => setShowRewardsDialog(true)}
                  >
                    <Gift className="h-4 w-4 text-primary-foreground" />
                  </Button>
                )}
              </div>
              
              <h1 className="text-2xl font-bold mt-4">{profile.full_name}</h1>
              
              {profile.title && (
                <Badge className={`mt-2 ${profile.title_color || "bg-secondary text-secondary-foreground"}`}>
                  {profile.title}
                </Badge>
              )}
              
              {isFirstTimeDonor && (
                <p className="text-sm text-primary mt-1 font-medium">First Time Donor</p>
              )}

              {/* Bio Section */}
              <div className="w-full mt-3 max-w-xs">
                {isEditingBio ? (
                  <div className="space-y-2">
                    <Input
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Write something about yourself..."
                      className="text-center text-sm"
                      maxLength={150}
                    />
                    <div className="flex justify-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setIsEditingBio(false)}>Cancel</Button>
                      <Button size="sm" onClick={saveBio}>Save</Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingBio(true)}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    {bio || "+ Add bio"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center justify-around py-4 border-t bg-muted/30">
            <div className="text-center px-4">
              <p className="text-2xl font-bold text-primary">{profile.blood_group}</p>
              <p className="text-xs text-muted-foreground">Blood Type</p>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center px-4">
              <p className="text-2xl font-bold">{donationCount}</p>
              <p className="text-xs text-muted-foreground">Donations</p>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center px-4">
              <Badge 
                variant="outline" 
                className={`text-xs ${
                  availabilityStatus === 'available' 
                    ? 'text-green-600 border-green-600 bg-green-50 dark:bg-green-950' 
                    : availabilityStatus === 'reserved' 
                      ? 'text-orange-600 border-orange-600 bg-orange-50 dark:bg-orange-950' 
                      : 'text-red-600 border-red-600 bg-red-50 dark:bg-red-950'
                }`}
              >
                {availabilityStatus === 'available' ? 'Available' : 
                 availabilityStatus === 'reserved' ? 'Reserved' : 'Unavailable'}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">Status</p>
            </div>
          </div>
        </Card>

        {/* Contact Info Card */}
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{profile.phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="font-medium">
                  {profile.atoll && profile.island
                    ? `${profile.atoll} - ${profile.island}`
                    : profile.district || "Not set"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings Cards */}
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Update Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <LocationSelector
              selectedAtoll={selectedAtoll}
              selectedIsland={selectedIsland}
              onAtollChange={setSelectedAtoll}
              onIslandChange={setSelectedIsland}
            />
            <Button onClick={updateLocation} className="w-full rounded-xl">
              Save Location
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Profile Type
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Choose whether you want to be a donor, receiver, or both
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={userType} onValueChange={updateUserType}>
              <SelectTrigger className="rounded-xl">
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
          </CardContent>
        </Card>

        {(userType === 'donor' || userType === 'both') && (
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Droplet className="h-4 w-4 text-primary" />
                Availability Status
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {!canSetAvailable() 
                  ? `You must wait ${getDaysUntilAvailable()} more days from your last donation to set available`
                  : "Update your availability status"
                }
              </p>
            </CardHeader>
            <CardContent>
              <Select value={availabilityStatus} onValueChange={updateAvailability}>
                <SelectTrigger className="rounded-xl">
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
            </CardContent>
          </Card>
        )}

        <CheckAdminButton />
      </main>

      <Dialog open={showRewardsDialog} onOpenChange={setShowRewardsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rewards & Benefits</DialogTitle>
            <DialogDescription>
              Earn points with every donation and redeem rewards
            </DialogDescription>
          </DialogHeader>
          <RewardsSection userId={profile.id} />
        </DialogContent>
      </Dialog>

      <DonorQRCard
        open={showQRCard}
        onOpenChange={setShowQRCard}
        donor={profile}
      />

      <BottomNav />
    </div>
  );
};

// DonationHistory component has been moved to src/components/DonationHistoryByYear.tsx

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