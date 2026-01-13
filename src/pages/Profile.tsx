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
import { 
  Droplet, MapPin, Phone, Edit2, Settings, Gift, QrCode, LogOut, 
  Calendar, Award, Heart, Shield, ChevronRight, X, Check, Clock,
  User, Grid3X3, Bookmark, MoreHorizontal, Sparkles, MessageCircle, Link2,
  Share2, ExternalLink
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
  const [activeTab, setActiveTab] = useState("posts");
  
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
      case 'available': return 'from-green-400 to-emerald-500';
      case 'reserved': return 'from-amber-400 to-orange-500';
      default: return 'from-red-400 to-rose-500';
    }
  };

  const getStatusRingColor = () => {
    switch (availabilityStatus) {
      case 'available': return 'ring-green-500';
      case 'reserved': return 'ring-amber-500';
      default: return 'ring-red-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <AppHeader />
        <main className="container mx-auto px-4 py-4 max-w-lg">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto max-w-2xl px-4">
        {/* Profile Header */}
        <div className="py-5 animate-fade-in">
          {/* Top row: Avatar and Stats */}
          <div className="flex items-center gap-5 mb-5">
            {/* Avatar with status ring */}
            <div className="relative flex-shrink-0">
              <div className={`p-[2px] rounded-full bg-gradient-to-tr ${getStatusColor()}`}>
                <div className="p-[2px] rounded-full bg-background">
                  <AvatarUpload
                    currentAvatarUrl={profile.avatar_url}
                    userName={profile.full_name}
                    onUploadComplete={(url) => setProfile(prev => prev ? {...prev, avatar_url: url} : null)}
                    size="lg"
                  />
                </div>
              </div>
              {/* Status indicator */}
              <div className={`absolute bottom-0 right-0 h-5 w-5 rounded-full border-2 border-background flex items-center justify-center ${
                availabilityStatus === 'available' ? 'bg-green-500' : 
                availabilityStatus === 'reserved' ? 'bg-amber-500' : 'bg-red-500'
              }`}>
                {availabilityStatus === 'available' && <Check className="h-3 w-3 text-white" />}
                {availabilityStatus === 'reserved' && <Clock className="h-3 w-3 text-white" />}
                {availabilityStatus === 'unavailable' && <X className="h-3 w-3 text-white" />}
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1 flex justify-around">
              <button onClick={() => navigate('/history')} className="text-center hover:opacity-70 transition-opacity">
                <p className="text-xl font-bold">{donationCount}</p>
                <p className="text-xs text-muted-foreground">Donations</p>
              </button>
              <button onClick={() => setShowRewardsDialog(true)} className="text-center hover:opacity-70 transition-opacity">
                <p className="text-xl font-bold">{totalPoints}</p>
                <p className="text-xs text-muted-foreground">Points</p>
              </button>
              <div className="text-center">
                <p className="text-xl font-bold text-primary">{profile.blood_group}</p>
                <p className="text-xs text-muted-foreground">Blood</p>
              </div>
            </div>
          </div>

          {/* Name and Bio */}
          <div className="mb-4">
            <h1 className="text-base font-bold">{profile.full_name}</h1>
            {profile.title && (
              <Badge 
                className="text-[10px] border-0 font-medium px-2 py-0.5 mt-1"
                style={{ 
                  backgroundColor: profile.title_color ? `${profile.title_color}20` : 'hsl(var(--primary) / 0.1)',
                  color: profile.title_color || 'hsl(var(--primary))'
                }}
              >
                {profile.title}
              </Badge>
            )}
            
            {/* Category/Type badge */}
            <p className="text-sm text-muted-foreground">
              {userType === 'both' ? 'Donor & Receiver' : userType === 'donor' ? 'Blood Donor' : 'Blood Receiver'}
            </p>
            
            {profile.bio && (
              <p className="text-sm mt-1">{profile.bio}</p>
            )}
            
            {/* Location and contact - Interactive links */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
              {profile.island && (
                <a 
                  href={`https://maps.google.com/?q=${encodeURIComponent(profile.island + ', Maldives')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                >
                  <MapPin className="h-3 w-3" />
                  {profile.island}
                  <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                </a>
              )}
              <a 
                href={`tel:${profile.phone}`}
                className="flex items-center gap-1 text-muted-foreground hover:text-emerald-600 transition-colors"
              >
                <Phone className="h-3 w-3" />
                {profile.phone}
              </a>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-5">
            <Button 
              variant="secondary" 
              className="flex-1 rounded-xl h-10 text-sm font-medium"
              onClick={() => setShowEditDialog(true)}
            >
              Edit profile
            </Button>
            <Button 
              variant="secondary" 
              className="flex-1 rounded-xl h-10 text-sm font-medium"
              onClick={() => setShowRewardsDialog(true)}
            >
              <Gift className="h-4 w-4 mr-1.5" />
              Rewards
            </Button>
            <Button 
              variant="secondary" 
              size="icon"
              className="rounded-xl h-10 w-10"
              onClick={() => setShowQRCard(true)}
            >
              <QrCode className="h-4 w-4" />
            </Button>
            <Button 
              variant="secondary" 
              size="icon"
              className="rounded-xl h-10 w-10"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `${profile.full_name} - Blood Donor`,
                    text: `${profile.full_name} is a ${profile.blood_group} blood donor at LeyHadhiya`,
                    url: window.location.href,
                  });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  toast({ title: "Link copied", description: "Profile link copied to clipboard" });
                }
              }}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Quick Stats Highlights */}
          {isDonor && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="h-14 w-14 rounded-2xl border border-border/50 flex items-center justify-center bg-primary/5 mb-1.5">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <span className="text-[10px] text-muted-foreground">{donationCount} Lives</span>
              </div>
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="h-14 w-14 rounded-2xl border border-border/50 flex items-center justify-center bg-amber-500/5 mb-1.5">
                  <Award className="h-6 w-6 text-amber-500" />
                </div>
                <span className="text-[10px] text-muted-foreground">{totalPoints} Pts</span>
              </div>
              <button 
                onClick={() => navigate('/history')}
                className="flex flex-col items-center flex-shrink-0 group"
              >
                <div className="h-14 w-14 rounded-2xl border border-border/50 flex items-center justify-center bg-blue-500/5 mb-1.5 group-hover:border-blue-500/30 transition-colors">
                  <Calendar className="h-6 w-6 text-blue-500" />
                </div>
                <span className="text-[10px] text-muted-foreground">History</span>
              </button>
              <button 
                onClick={() => setShowQRCard(true)}
                className="flex flex-col items-center flex-shrink-0 group"
              >
                <div className="h-14 w-14 rounded-2xl border border-border/50 flex items-center justify-center bg-emerald-500/5 mb-1.5 group-hover:border-emerald-500/30 transition-colors">
                  <QrCode className="h-6 w-6 text-emerald-500" />
                </div>
                <span className="text-[10px] text-muted-foreground">ID Card</span>
              </button>
            </div>
          )}
        </div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-transparent border-y border-border/50 rounded-none h-12 p-0">
            <TabsTrigger 
              value="posts" 
              className="flex-1 rounded-none h-full text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              <Grid3X3 className="h-5 w-5" />
            </TabsTrigger>
            <TabsTrigger 
              value="saved" 
              className="flex-1 rounded-none h-full text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              <Bookmark className="h-5 w-5" />
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="flex-1 rounded-none h-full text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              <Settings className="h-5 w-5" />
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="posts" className="mt-5 space-y-4">
            {/* Quick Stats Grid */}
            {isDonor && (
              <div className="grid grid-cols-3 gap-2">
                <div className="aspect-square bg-primary/5 rounded-2xl flex flex-col items-center justify-center p-3 border border-border/50">
                  <Heart className="h-7 w-7 text-primary mb-1.5" />
                  <p className="text-base font-semibold">{donationCount}</p>
                  <p className="text-[10px] text-muted-foreground">Donations</p>
                </div>
                <div className="aspect-square bg-amber-500/5 rounded-2xl flex flex-col items-center justify-center p-3 border border-border/50">
                  <Award className="h-7 w-7 text-amber-500 mb-1.5" />
                  <p className="text-base font-semibold">{totalPoints}</p>
                  <p className="text-[10px] text-muted-foreground">Points</p>
                </div>
                <div className="aspect-square bg-emerald-500/5 rounded-2xl flex flex-col items-center justify-center p-3 border border-border/50">
                  <Sparkles className="h-7 w-7 text-emerald-500 mb-1.5" />
                  <p className="text-base font-semibold">{donationCount}</p>
                  <p className="text-[10px] text-muted-foreground">Lives</p>
                </div>
              </div>
            )}

            {/* Quick Actions as list */}
            <Card className="rounded-xl border-border/50 overflow-hidden">
              <button 
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                onClick={() => navigate('/history')}
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">View Donation History</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              
              {isDonor && (
                <>
                  <div className="border-t border-border/50" />
                  <button 
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    onClick={() => setShowRewardsDialog(true)}
                  >
                    <div className="flex items-center gap-3">
                      <Gift className="h-5 w-5 text-amber-500" />
                      <span className="text-sm font-medium">Rewards & Benefits</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </>
              )}
              
              <div className="border-t border-border/50" />
              <button 
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                onClick={() => setShowQRCard(true)}
              >
                <div className="flex items-center gap-3">
                  <QrCode className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium">Donor ID Card</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </Card>
          </TabsContent>

          {/* Saved Tab */}
          <TabsContent value="saved" className="mt-4">
            <Card className="rounded-xl border-border/50">
              <CardContent className="p-6 text-center">
                <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold mb-1">Saved Items</h3>
                <p className="text-sm text-muted-foreground">Your saved blood requests and donors will appear here</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4 space-y-3">
            {/* Availability Section */}
            {isDonor && (
              <Card className="rounded-xl border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Droplet className="h-5 w-5 text-primary" />
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
            <Card className="rounded-xl border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <User className="h-5 w-5 text-purple-500" />
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
            <Card className="rounded-xl border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <MapPin className="h-5 w-5 text-emerald-500" />
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
        <Card className="rounded-xl border-border/50">
          <button 
            onClick={() => navigate("/admin")} 
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium">Admin Panel</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </Card>
      )}
      
      <Card className="rounded-xl border-destructive/30 bg-destructive/5 overflow-hidden">
        <button 
          onClick={handleLogout} 
          className="w-full flex items-center gap-3 p-4"
        >
          <LogOut className="h-5 w-5 text-destructive" />
          <span className="text-sm font-medium text-destructive">Sign Out</span>
        </button>
      </Card>
    </div>
  );
};

export default Profile;
