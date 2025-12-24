import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Droplet, MapPin, Phone, Edit2, Settings, Gift, QrCode, LogOut, 
  Calendar, Award, Heart, Shield, ChevronRight, X, Check, Clock,
  User, Activity, Sparkles
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { AvatarUpload } from "@/components/AvatarUpload";
import { LocationSelector } from "@/components/LocationSelector";
import { AppHeader } from "@/components/AppHeader";
import { RewardsSection } from "@/components/RewardsSection";
import { AvailabilityToggle } from "@/components/AvailabilityToggle";
import { DonorQRCard } from "@/components/DonorQRCard";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [donationCount, setDonationCount] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [availabilityStatus, setAvailabilityStatus] = useState("available");
  const [userType, setUserType] = useState("donor");
  const [selectedAtoll, setSelectedAtoll] = useState("");
  const [selectedIsland, setSelectedIsland] = useState("");
  const [showRewardsDialog, setShowRewardsDialog] = useState(false);
  const [showQRCard, setShowQRCard] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
    fetchDonationCount();
    fetchPoints();
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
      setEditBio(data.bio || '');
    }

    setLoading(false);
  };

  const fetchDonationCount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.rpc('get_donation_count', { donor_uuid: user.id });
    setDonationCount(data || 0);
  };

  const fetchPoints = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("donor_points")
      .select("total_points, lifetime_points")
      .eq("donor_id", user.id)
      .maybeSingle();
    
    setTotalPoints(data?.total_points || 0);
  };

  const canSetAvailable = () => {
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
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    } else {
      setProfile((prev) => prev ? { ...prev, availability_status: status } : null);
      setAvailabilityStatus(status);
      toast({ title: "Status updated" });
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
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    } else {
      setProfile((prev) => prev ? { ...prev, user_type: type } : null);
      setUserType(type);
      toast({ title: "Profile type updated" });
    }
  };

  const updateLocation = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selectedAtoll || !selectedIsland) {
      toast({ variant: "destructive", title: "Please select location" });
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
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    } else {
      toast({ title: "Location updated" });
      fetchProfile();
    }
  };

  const saveBio = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ bio: editBio })
      .eq("id", user.id);

    if (error) {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    } else {
      setProfile(prev => prev ? { ...prev, bio: editBio } : null);
      setShowEditDialog(false);
      toast({ title: "Bio updated" });
    }
  };

  const getStatusColor = () => {
    switch (availabilityStatus) {
      case 'available': return 'bg-green-500';
      case 'reserved': return 'bg-amber-500';
      default: return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    switch (availabilityStatus) {
      case 'available': return 'Available to donate';
      case 'reserved': return 'Reserved for donation';
      default: return 'Currently unavailable';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <AppHeader />
        <main className="container mx-auto px-4 py-4 max-w-lg">
          <Skeleton className="h-48 w-full rounded-2xl mb-4" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="p-6 text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Profile Not Found</h2>
            <p className="text-muted-foreground mb-4">Please complete your registration</p>
            <Button onClick={() => navigate("/register")} className="rounded-xl">
              Complete Registration
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDonor = userType === 'donor' || userType === 'both';
  const isFirstTimeDonor = !profile?.last_donation_date && donationCount === 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto max-w-lg">
        {/* Hero Profile Section */}
        <div className="relative">
          {/* Cover gradient */}
          <div className="h-28 bg-gradient-to-br from-primary via-primary/80 to-primary/60 rounded-b-3xl" />
          
          {/* Profile card overlapping cover */}
          <div className="px-4 -mt-16 relative z-10">
            <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
              {/* Avatar and actions */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between">
                  {/* Avatar with status ring */}
                  <div className="relative">
                    <div className={`absolute inset-0 rounded-full ${getStatusColor()} animate-pulse opacity-30 scale-110`} />
                    <div className={`p-1 rounded-full ${getStatusColor()}`}>
                      <AvatarUpload
                        currentAvatarUrl={profile.avatar_url}
                        userName={profile.full_name}
                        onUploadComplete={(url) => setProfile(prev => prev ? {...prev, avatar_url: url} : null)}
                        size="lg"
                      />
                    </div>
                    {/* Status dot */}
                    <div className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-3 border-card ${getStatusColor()} flex items-center justify-center`}>
                      {availabilityStatus === 'available' && <Check className="h-3 w-3 text-white" />}
                      {availabilityStatus === 'reserved' && <Clock className="h-3 w-3 text-white" />}
                      {availabilityStatus === 'unavailable' && <X className="h-3 w-3 text-white" />}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    {isDonor && (
                      <>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-9 w-9 rounded-full"
                          onClick={() => setShowQRCard(true)}
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-9 w-9 rounded-full"
                          onClick={() => setShowRewardsDialog(true)}
                        >
                          <Gift className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button 
                      variant="outline" 
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() => setShowEditDialog(true)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Name and info */}
                <div className="mt-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold">{profile.full_name}</h1>
                    {profile.title && (
                      <Badge variant="secondary" className="text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        {profile.title}
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <span className={`inline-block h-2 w-2 rounded-full ${getStatusColor()}`} />
                    {getStatusText()}
                  </p>
                  
                  {profile.bio && (
                    <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{profile.bio}</p>
                  )}

                  {/* Quick info pills */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                      <Droplet className="h-3 w-3" />
                      {profile.blood_group}
                    </div>
                    {profile.atoll && profile.island && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted text-muted-foreground rounded-full text-xs">
                        <MapPin className="h-3 w-3" />
                        {profile.island}
                      </div>
                    )}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted text-muted-foreground rounded-full text-xs">
                      <Phone className="h-3 w-3" />
                      {profile.phone}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats bar */}
              <div className="grid grid-cols-3 border-t border-border bg-muted/30">
                <button 
                  className="py-3 text-center hover:bg-muted/50 transition-colors"
                  onClick={() => navigate('/history')}
                >
                  <p className="text-xl font-bold text-primary">{donationCount}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Donations</p>
                </button>
                <button 
                  className="py-3 text-center border-x border-border hover:bg-muted/50 transition-colors"
                  onClick={() => setShowRewardsDialog(true)}
                >
                  <p className="text-xl font-bold text-amber-500">{totalPoints}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Points</p>
                </button>
                <div className="py-3 text-center">
                  <p className="text-xl font-bold text-emerald-500">{donationCount}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lives Saved</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="px-4 mt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="overview" className="flex-1 rounded-lg text-xs">
                <Activity className="h-3.5 w-3.5 mr-1.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex-1 rounded-lg text-xs">
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Settings
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-4 space-y-3">
              {/* Achievement Cards */}
              {isDonor && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center mb-2">
                      <Heart className="h-5 w-5 text-primary" />
                    </div>
                    <p className="font-semibold text-sm">
                      {isFirstTimeDonor ? 'Ready to Start' : `${donationCount} Donations`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isFirstTimeDonor ? 'Make your first donation' : 'Thank you for saving lives'}
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center mb-2">
                      <Award className="h-5 w-5 text-amber-500" />
                    </div>
                    <p className="font-semibold text-sm">{totalPoints} Points</p>
                    <p className="text-xs text-muted-foreground">Redeem for rewards</p>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <Card className="rounded-2xl border-border/50">
                <CardContent className="p-0">
                  <button 
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    onClick={() => navigate('/history')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-sm">Donation History</p>
                        <p className="text-xs text-muted-foreground">View all your past donations</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                  
                  <Separator />
                  
                  {isDonor && (
                    <>
                      <button 
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                        onClick={() => setShowRewardsDialog(true)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <Gift className="h-5 w-5 text-amber-500" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-sm">Rewards & Benefits</p>
                            <p className="text-xs text-muted-foreground">Redeem your points</p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </button>
                      
                      <Separator />
                    </>
                  )}
                  
                  <button 
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    onClick={() => setShowQRCard(true)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <QrCode className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-sm">Donor ID Card</p>
                        <p className="text-xs text-muted-foreground">Your digital donor card</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="mt-4 space-y-3">
              {/* Availability Section */}
              {isDonor && (
                <Card className="rounded-2xl border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Droplet className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Availability Status</p>
                        <p className="text-xs text-muted-foreground">Set when you can donate</p>
                      </div>
                    </div>
                    <AvailabilityToggle
                      value={availabilityStatus}
                      onChange={updateAvailability}
                      canSetAvailable={canSetAvailable()}
                      daysUntilAvailable={getDaysUntilAvailable()}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Profile Type */}
              <Card className="rounded-2xl border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Profile Type</p>
                      <p className="text-xs text-muted-foreground">Choose your role</p>
                    </div>
                  </div>
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
                </CardContent>
              </Card>

              {/* Location */}
              <Card className="rounded-2xl border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Location</p>
                      <p className="text-xs text-muted-foreground">Update your location</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <LocationSelector
                      selectedAtoll={selectedAtoll}
                      selectedIsland={selectedIsland}
                      onAtollChange={setSelectedAtoll}
                      onIslandChange={setSelectedIsland}
                    />
                    <Button onClick={updateLocation} className="w-full rounded-xl" size="sm">
                      Save Location
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Admin & Logout */}
              <CheckAdminButton />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your bio and personal info</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bio</label>
              <Textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Tell us about yourself..."
                className="rounded-xl resize-none"
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground text-right">{editBio.length}/200</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button className="flex-1 rounded-xl" onClick={saveBio}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rewards Dialog */}
      <Dialog open={showRewardsDialog} onOpenChange={setShowRewardsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rewards & Benefits</DialogTitle>
            <DialogDescription>Earn points with every donation and redeem rewards</DialogDescription>
          </DialogHeader>
          <RewardsSection userId={profile.id} />
        </DialogContent>
      </Dialog>

      {/* QR Card */}
      <DonorQRCard
        open={showQRCard}
        onOpenChange={setShowQRCard}
        donor={profile}
      />

      <BottomNav />
    </div>
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="space-y-3">
      {isAdmin && (
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-4">
            <button 
              onClick={() => navigate("/admin")} 
              className="w-full flex items-center justify-between hover:bg-muted/50 -m-4 p-4 rounded-2xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Admin Panel</p>
                  <p className="text-xs text-muted-foreground">Manage the platform</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>
      )}
      
      <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
        <CardContent className="p-4">
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center gap-3"
          >
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <LogOut className="h-5 w-5 text-destructive" />
            </div>
            <div className="text-left">
              <p className="font-medium text-sm text-destructive">Sign Out</p>
              <p className="text-xs text-muted-foreground">Log out of your account</p>
            </div>
          </button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;