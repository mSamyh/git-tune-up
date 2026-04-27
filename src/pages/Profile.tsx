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
  Share2, ExternalLink, Activity
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { AvatarUpload } from "@/components/AvatarUpload";
import { LocationSelector } from "@/components/LocationSelector";
import { AppHeader } from "@/components/AppHeader";
import { RewardsSection } from "@/components/RewardsSection";
import { AvailabilityToggle } from "@/components/AvailabilityToggle";
import { DonorQRCard } from "@/components/DonorQRCard";
import { AchievementsPreview } from "@/components/AchievementsPreview";
import { HealthTimeline } from "@/components/health/HealthTimeline";
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
  reserved_until: string | null;
  status_note: string | null;
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
    let isMounted = true;
    
    const loadData = async () => {
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

      if (!isMounted) return;

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
    
    loadData();
    fetchDonationCount();
    fetchPoints();
    
    return () => { isMounted = false; };
  }, [navigate, toast]);

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

  const updateAvailability = async (status: string, metadata?: { reservedUntil?: string; statusNote?: string; unavailableUntil?: string }) => {
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

    const updateData: Record<string, any> = { availability_status: status };
    
    // Add metadata for reserved status
    if (status === 'reserved' && metadata?.reservedUntil) {
      updateData.reserved_until = metadata.reservedUntil;
    }
    
    // Add metadata for unavailable status
    if (status === 'unavailable') {
      updateData.status_note = metadata?.statusNote || null;
      updateData.unavailable_until = metadata?.unavailableUntil || null;
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    if (error) {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    } else {
      setProfile((prev) => prev ? { 
        ...prev, 
        availability_status: status,
        reserved_until: status === 'reserved' ? (metadata?.reservedUntil || null) : null,
        status_note: status === 'unavailable' ? (metadata?.statusNote || null) : null,
      } : null);
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
      // Refetch profile data
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data);
        setSelectedAtoll(data.atoll || '');
        setSelectedIsland(data.island || '');
      }
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

  const statusMeta = (() => {
    switch (availabilityStatus) {
      case 'available':
        return { label: 'Available to donate', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', cover: 'from-emerald-600 via-emerald-700 to-teal-900' };
      case 'reserved':
        return { label: 'Reserved', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/20', cover: 'from-amber-600 via-orange-700 to-rose-900' };
      default:
        return { label: 'Unavailable', dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/20', cover: 'from-slate-700 via-slate-800 to-slate-950' };
    }
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 pb-24">
      <AppHeader />

      <main className="container mx-auto max-w-2xl px-0 sm:px-4 animate-fade-in">
        {/* ============ COVER + AVATAR ============ */}
        <section className="relative">
          {/* Gradient cover banner */}
          <div className={`relative h-32 bg-gradient-to-br ${statusMeta.cover} overflow-hidden sm:rounded-b-[28px]`}>
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-black/20 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.08] mix-blend-overlay pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(hsl(0 0% 100%) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />

            {/* Status pill */}
            <div className="absolute top-3 right-4">
              <div className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center gap-1.5 shadow-lg">
                <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot} animate-pulse`} />
                <span className="text-white text-[11px] font-bold">{statusMeta.label}</span>
              </div>
            </div>

            {/* Blood group floating badge */}
            <div className="absolute top-3 left-4">
              <div className="px-3 py-1 rounded-full bg-white/95 backdrop-blur-md flex items-center gap-1.5 shadow-xl">
                <Droplet className="h-3 w-3 text-rose-600 fill-rose-500" />
                <span className="text-rose-600 text-xs font-black tabular-nums">{profile.blood_group}</span>
              </div>
            </div>
          </div>

          {/* Avatar overlapping cover */}
          <div className="px-5 -mt-12 relative">
            <div className="flex items-end justify-between">
              <div className="relative">
                <div className={`p-[3px] rounded-full bg-gradient-to-br ${statusMeta.cover} shadow-2xl`}>
                  <div className="p-[2px] rounded-full bg-background">
                    <AvatarUpload
                      currentAvatarUrl={profile.avatar_url}
                      userName={profile.full_name}
                      onUploadComplete={(url) => setProfile(prev => prev ? {...prev, avatar_url: url} : null)}
                      size="lg"
                    />
                  </div>
                </div>
                {availabilityStatus === 'available' && (
                  <div className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-emerald-500 border-[3px] border-background flex items-center justify-center shadow">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
              </div>

              {/* Quick action buttons (right of avatar, below cover) */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setShowQRCard(true)}
                  className="h-9 w-9 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <QrCode className="h-4 w-4 text-foreground" />
                </button>
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: `${profile.full_name} - Blood Donor`,
                        text: `${profile.full_name} is a ${profile.blood_group} blood donor at LeyHadhiya`,
                        url: window.location.href,
                      });
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      toast({ title: "Link copied" });
                    }
                  }}
                  className="h-9 w-9 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Share2 className="h-4 w-4 text-foreground" />
                </button>
                <button
                  onClick={() => setShowEditDialog(true)}
                  className="h-9 px-3 rounded-xl bg-foreground text-background shadow-sm flex items-center gap-1.5 font-semibold text-xs hover:opacity-90 transition-opacity"
                >
                  <Edit2 className="h-3 w-3" />
                  Edit
                </button>
              </div>
            </div>

            {/* Name + Title */}
            <div className="mt-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black leading-tight">{profile.full_name}</h1>
                {profile.title && (
                  <Badge
                    className="text-[10px] border-0 font-bold px-2 py-0.5"
                    style={{
                      backgroundColor: profile.title_color ? `${profile.title_color}20` : 'hsl(var(--primary) / 0.1)',
                      color: profile.title_color || 'hsl(var(--primary))'
                    }}
                  >
                    <Sparkles className="h-2.5 w-2.5 mr-1" />
                    {profile.title}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wider">
                {userType === 'both' ? 'Donor · Receiver' : userType === 'donor' ? 'Blood Donor' : 'Blood Receiver'}
              </p>

              {profile.bio && (
                <p className="text-sm mt-2 text-foreground/80 leading-relaxed">{profile.bio}</p>
              )}

              {/* Location + Phone chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {profile.island && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(profile.island + ', Maldives')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted text-xs text-foreground/80 transition-colors"
                  >
                    <MapPin className="h-3 w-3 text-emerald-600" />
                    {profile.island}
                  </a>
                )}
                <a
                  href={`tel:${profile.phone}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted text-xs text-foreground/80 transition-colors"
                >
                  <Phone className="h-3 w-3 text-blue-600" />
                  {profile.phone}
                </a>
              </div>
            </div>

            {/* ============ STATS STRIP ============ */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                onClick={() => navigate('/history')}
                className="rounded-2xl bg-card border border-border/60 px-3 py-3 hover:border-primary/40 hover:shadow-md transition-all active:scale-95 text-left"
              >
                <Heart className="h-4 w-4 text-rose-500 mb-1.5" />
                <p className="text-2xl font-black tabular-nums leading-none">{donationCount}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                  Donations
                </p>
              </button>
              <button
                onClick={() => navigate('/rewards')}
                className="rounded-2xl bg-card border border-border/60 px-3 py-3 hover:border-amber-500/40 hover:shadow-md transition-all active:scale-95 text-left"
              >
                <Award className="h-4 w-4 text-amber-500 mb-1.5" />
                <p className="text-2xl font-black tabular-nums leading-none">{totalPoints}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                  Points
                </p>
              </button>
              <div className="rounded-2xl bg-gradient-to-br from-rose-500 to-primary px-3 py-3 shadow-md text-left">
                <Droplet className="h-4 w-4 text-white/80 fill-white/30 mb-1.5" />
                <p className="text-2xl font-black tabular-nums leading-none text-white">
                  {donationCount * 3}
                </p>
                <p className="text-[10px] text-white/70 mt-1 uppercase tracking-wider font-semibold">
                  Lives Saved
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="px-5 mt-5">

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-transparent border-y border-border/50 rounded-none h-12 p-0">
            <TabsTrigger 
              value="posts" 
              className="flex-1 rounded-none h-full text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              <Grid3X3 className="h-5 w-5" />
            </TabsTrigger>
            {isDonor && (
              <TabsTrigger 
                value="health" 
                className="flex-1 rounded-none h-full text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <Activity className="h-5 w-5" />
              </TabsTrigger>
            )}
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
            {/* Achievements section - replaces redundant stats */}
            {isDonor && (
              <AchievementsPreview donationCount={donationCount} totalPoints={totalPoints} userName={profile.full_name} />
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
                      <Gift className="h-5 w-5 text-warning" />
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
                  <QrCode className="h-5 w-5 text-info" />
                  <span className="text-sm font-medium">Donor ID Card</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </Card>
          </TabsContent>

          {/* Health Tab */}
          {isDonor && (
            <TabsContent value="health" className="mt-4">
              <HealthTimeline userId={profile.id} />
            </TabsContent>
          )}

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
                    reservedUntil={profile?.reserved_until}
                    statusNote={profile?.status_note}
                  />
                </CardContent>
              </Card>
            )}

            {/* Profile Type */}
            <Card className="rounded-xl border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <User className="h-5 w-5 text-info" />
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
                  <MapPin className="h-5 w-5 text-success" />
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
        <Card className="rounded-xl border-border/50">
          <button 
            onClick={() => navigate("/admin")} 
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-info" />
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
