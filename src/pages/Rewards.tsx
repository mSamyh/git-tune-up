import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Gift, QrCode, Trophy, Clock, CheckCircle, Award, Star, Crown, 
  Sparkles, Store, Trash2, ChevronLeft, History, Ticket
} from "lucide-react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getUserTier, TierInfo } from "@/lib/tierSystem";
import { PointsHistoryPanel } from "@/components/PointsHistoryPanel";
import { DonorMilestones } from "@/components/DonorMilestones";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface DonorPoints {
  total_points: number;
  lifetime_points: number;
}

interface Reward {
  id: string;
  title: string;
  description: string;
  points_required: number;
  partner_name: string;
  partner_logo_url: string | null;
  category: string;
}

interface Redemption {
  id: string;
  voucher_code: string;
  qr_code_data: string;
  expires_at: string;
  status: string;
  verified_at: string | null;
  points_spent: number;
  reward_catalog: {
    title: string;
    partner_name: string;
    partner_logo_url: string | null;
  };
}

const Rewards = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [points, setPoints] = useState<DonorPoints | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedRedemption, setSelectedRedemption] = useState<Redemption | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [userTier, setUserTier] = useState<TierInfo | null>(null);
  const [nextTier, setNextTier] = useState<TierInfo | null>(null);
  const [totalDonations, setTotalDonations] = useState(0);
  const [activeTab, setActiveTab] = useState("rewards");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isRedeeming, setIsRedeeming] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);
    };
    loadUser();
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      fetchRewardsData();
    }
  }, [userId]);

  const fetchRewardsData = async () => {
    if (!userId) return;
    
    setLoading(true);
    
    // Fetch points
    const { data: pointsData } = await supabase
      .from("donor_points")
      .select("total_points, lifetime_points")
      .eq("donor_id", userId)
      .maybeSingle();
    
    setPoints(pointsData);

    // Get user tier
    if (pointsData) {
      const tier = await getUserTier(pointsData.total_points);
      setUserTier(tier);
      
      // Calculate next tier
      const { data: settings } = await supabase
        .from("reward_settings")
        .select("*")
        .in("setting_key", ["tier_silver_min", "tier_gold_min", "tier_platinum_min"]);
      
      if (settings) {
        const settingsMap: Record<string, number> = {};
        settings.forEach(s => settingsMap[s.setting_key] = parseInt(s.setting_value));
        
        const tiers = [
          { name: "Silver", minPoints: settingsMap.tier_silver_min || 500 },
          { name: "Gold", minPoints: settingsMap.tier_gold_min || 1000 },
          { name: "Platinum", minPoints: settingsMap.tier_platinum_min || 2000 },
        ];
        
        const next = tiers.find(t => pointsData.total_points < t.minPoints);
        if (next) {
          const nextTierFull = await getUserTier(next.minPoints);
          setNextTier(nextTierFull);
        }
      }
    } else {
      const tier = await getUserTier(0);
      setUserTier(tier);
    }

    // Fetch available rewards
    const { data: rewardsData } = await supabase
      .from("reward_catalog")
      .select("*")
      .eq("is_active", true)
      .order("points_required");
    
    setRewards(rewardsData || []);

    // Fetch redemption history
    const { data: redemptionsData } = await supabase
      .from("redemption_history")
      .select(`
        *,
        reward_catalog (
          title,
          partner_name,
          partner_logo_url
        )
      `)
      .eq("donor_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    
    setRedemptions(redemptionsData || []);
    
    // Fetch total donations count
    const { count } = await supabase
      .from("donation_history")
      .select("*", { count: "exact", head: true })
      .eq("donor_id", userId);
    
    setTotalDonations(count || 0);
    setLoading(false);
  };

  const handleRedeem = async (reward: Reward) => {
    if (isRedeeming || !userId) return;
    
    const pointsToDeduct = reward.points_required;

    if (!points || points.total_points < pointsToDeduct) {
      toast({
        variant: "destructive",
        title: "Insufficient points",
        description: `You need ${pointsToDeduct} points to redeem this reward.`,
      });
      return;
    }

    setIsRedeeming(true);
    let redemptionId: string | null = null;

    try {
      const voucherCode = `VCH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const { data: settings } = await supabase
        .from("reward_settings")
        .select("setting_value")
        .eq("setting_key", "qr_expiry_hours")
        .single();
      
      const expiryHours = parseInt(settings?.setting_value || "24");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiryHours);

      const verifyUrl = `${window.location.origin}/verify-qr/${voucherCode}`;
      
      const { data: redemption, error: redemptionError } = await supabase
        .from("redemption_history")
        .insert({
          donor_id: userId,
          reward_id: reward.id,
          points_spent: pointsToDeduct,
          voucher_code: voucherCode,
          qr_code_data: verifyUrl,
          expires_at: expiresAt.toISOString(),
          status: "pending",
        })
        .select(`*, reward_catalog (title, partner_name, partner_logo_url)`)
        .single();

      if (redemptionError) throw redemptionError;
      redemptionId = redemption.id;

      const { data: currentPoints, error: fetchError } = await supabase
        .from("donor_points")
        .select("total_points")
        .eq("donor_id", userId)
        .single();

      if (fetchError) throw fetchError;

      if (currentPoints.total_points < pointsToDeduct) {
        throw new Error("Insufficient points. Your balance may have changed.");
      }

      const { error: pointsError } = await supabase
        .from("donor_points")
        .update({ total_points: currentPoints.total_points - pointsToDeduct })
        .eq("donor_id", userId);

      if (pointsError) throw pointsError;

      const tierInfo = userTier ? ` | ${userTier.name} tier (${userTier.discount}% merchant discount)` : "";
      
      const { error: transactionError } = await supabase
        .from("points_transactions")
        .insert({
          donor_id: userId,
          points: -pointsToDeduct,
          transaction_type: "redeemed",
          description: `Redeemed reward: ${reward.title}${tierInfo}`,
          related_redemption_id: redemption.id,
        });

      if (transactionError) {
        await supabase
          .from("donor_points")
          .update({ total_points: currentPoints.total_points })
          .eq("donor_id", userId);
        throw new Error("Failed to record transaction. Points have been restored.");
      }

      const qrUrl = await QRCode.toDataURL(verifyUrl, { width: 300, margin: 2 });
      
      setQrCodeUrl(qrUrl);
      setSelectedRedemption(redemption);
      setQrDialogOpen(true);
      await fetchRewardsData();

      toast({
        title: "🎉 Reward redeemed!",
        description: `Show QR to merchant for ${userTier?.discount || 0}% discount.`,
      });
    } catch (error: any) {
      if (redemptionId) {
        await supabase.from("redemption_history").delete().eq("id", redemptionId);
      }
      toast({
        variant: "destructive",
        title: "Redemption failed",
        description: error.message || "Please try again.",
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  const showQRCode = async (redemption: Redemption) => {
    const qrUrl = await QRCode.toDataURL(redemption.qr_code_data, { width: 300, margin: 2 });
    setQrCodeUrl(qrUrl);
    setSelectedRedemption(redemption);
    setQrDialogOpen(true);
  };

  const handleDeleteVoucher = async (redemptionId: string, pointsSpent: number) => {
    try {
      const { data, error } = await supabase.functions.invoke("delete-voucher", {
        body: { redemption_id: redemptionId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setRedemptions((prev) => prev.filter((r) => r.id !== redemptionId));
      await fetchRewardsData();
      
      toast({
        title: "Voucher deleted",
        description: `${data?.points_refunded || pointsSpent} points have been refunded.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message ?? "Unable to delete voucher.",
      });
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    if (status === "verified") {
      return <Badge className="bg-green-500 text-white text-[10px]"><CheckCircle className="h-2.5 w-2.5 mr-0.5" />Used</Badge>;
    }
    if (new Date(expiresAt) < new Date() || status === "expired") {
      return <Badge variant="destructive" className="text-[10px]">Expired</Badge>;
    }
    if (status === "cancelled") {
      return <Badge variant="outline" className="text-[10px]">Cancelled</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px]"><Clock className="h-2.5 w-2.5 mr-0.5" />Active</Badge>;
  };

  const getTierIcon = () => {
    if (!userTier) return Trophy;
    switch (userTier.icon) {
      case "crown": return Crown;
      case "star": return Star;
      case "trophy": return Trophy;
      default: return Award;
    }
  };

  const currentPoints = points?.total_points || 0;
  const lifetimePoints = points?.lifetime_points || 0;
  const TierIcon = getTierIcon();
  const progressToNextTier = nextTier ? Math.min(100, (currentPoints / nextTier.minPoints) * 100) : 100;
  const pointsToNextTier = nextTier ? nextTier.minPoints - currentPoints : 0;
  
  const categories = ["all", ...new Set(rewards.map(r => r.category))];
  const filteredRewards = selectedCategory === "all" 
    ? rewards 
    : rewards.filter(r => r.category === selectedCategory);
  
  const pendingVouchers = redemptions.filter(r => r.status === "pending" && new Date(r.expires_at) > new Date());

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <AppHeader />
        <main className="container mx-auto px-4 py-4 max-w-lg">
          <Skeleton className="h-40 w-full rounded-2xl mb-4" />
          <Skeleton className="h-12 w-full rounded-xl mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />
      
      <main className="container mx-auto px-4 py-4 max-w-lg">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="mb-3 -ml-2 text-muted-foreground"
          onClick={() => navigate("/profile")}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Profile
        </Button>
        
        {/* Points Summary Card */}
        <Card className="rounded-2xl overflow-hidden border-0 shadow-lg bg-gradient-to-br from-primary/5 via-background to-primary/10 mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-primary to-primary/60 shadow-lg ring-4 ring-primary/20">
                <TierIcon className="h-8 w-8 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-3xl font-bold">{currentPoints.toLocaleString()}</CardTitle>
                  <span className="text-muted-foreground text-sm">points</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {userTier && (
                    <Badge 
                      className={cn(
                        userTier.name === "Platinum" ? "bg-purple-500/20 text-purple-600 border-purple-300" :
                        userTier.name === "Gold" ? "bg-yellow-500/20 text-yellow-600 border-yellow-300" :
                        userTier.name === "Silver" ? "bg-gray-400/20 text-gray-600 border-gray-300" :
                        "bg-orange-500/20 text-orange-600 border-orange-300"
                      )} 
                      variant="outline"
                    >
                      {userTier.name} Member
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Lifetime: {lifetimePoints.toLocaleString()} pts
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {userTier && (
              <div className="p-3 bg-muted/50 rounded-xl">
                <p className="text-sm">
                  <span className="font-semibold">🎁 {userTier.name} Benefits:</span>{" "}
                  <span className="text-muted-foreground">
                    {userTier.discount}% merchant discount on all rewards
                  </span>
                </p>
              </div>
            )}
            
            {nextTier && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Progress to {nextTier.name}</span>
                  <span className="font-medium">{pointsToNextTier} pts to go</span>
                </div>
                <Progress value={progressToNextTier} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-muted/50 rounded-xl h-12 p-1 mb-4">
            <TabsTrigger value="rewards" className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Gift className="h-4 w-4 mr-1.5" />
              Rewards
            </TabsTrigger>
            <TabsTrigger value="vouchers" className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm relative">
              <Ticket className="h-4 w-4 mr-1.5" />
              Vouchers
              {pendingVouchers.length > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                  {pendingVouchers.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="achievements" className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Trophy className="h-4 w-4 mr-1.5" />
              Badges
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <History className="h-4 w-4 mr-1.5" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Rewards Tab */}
          <TabsContent value="rewards" className="mt-0 space-y-4">
            {/* Category Filter */}
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2 pb-2">
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? "default" : "outline"}
                    size="sm"
                    className="rounded-full text-xs h-8 px-4"
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat === "all" ? "All" : cat}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* Reward Cards */}
            <div className="space-y-3">
              {filteredRewards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No rewards available in this category</p>
                </div>
              ) : (
                filteredRewards.map((reward) => {
                  const canAfford = currentPoints >= reward.points_required;
                  return (
                    <Card key={reward.id} className="rounded-2xl border-border/50 overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {reward.partner_logo_url ? (
                            <img 
                              src={reward.partner_logo_url} 
                              alt={reward.partner_name}
                              className="w-16 h-16 rounded-xl object-cover bg-muted"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                              <Store className="h-8 w-8 text-primary/60" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate">{reward.title}</h3>
                            <p className="text-xs text-muted-foreground truncate">{reward.partner_name}</p>
                            <div className="flex items-center justify-between mt-2">
                              <Badge variant="secondary" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                {reward.points_required} pts
                              </Badge>
                              <Button
                                size="sm"
                                className="h-8 rounded-lg text-xs"
                                disabled={!canAfford || isRedeeming}
                                onClick={() => handleRedeem(reward)}
                              >
                                {canAfford ? "Redeem" : "Need more pts"}
                              </Button>
                            </div>
                            {userTier && userTier.discount > 0 && (
                              <p className="text-[10px] text-green-600 mt-1.5 flex items-center gap-1">
                                <Gift className="h-3 w-3" />
                                {userTier.discount}% {userTier.name} discount applies
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Vouchers Tab */}
          <TabsContent value="vouchers" className="mt-0 space-y-3">
            {redemptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Ticket className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No vouchers yet</p>
                <p className="text-xs mt-1">Redeem rewards to get vouchers</p>
              </div>
            ) : (
              redemptions.map((redemption) => {
                const isActive = redemption.status === "pending" && new Date(redemption.expires_at) > new Date();
                return (
                  <Card key={redemption.id} className={cn("rounded-2xl border-border/50", !isActive && "opacity-60")}>
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        {redemption.reward_catalog?.partner_logo_url ? (
                          <img 
                            src={redemption.reward_catalog.partner_logo_url} 
                            alt={redemption.reward_catalog.partner_name}
                            className="w-12 h-12 rounded-xl object-cover bg-muted"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <Ticket className="h-6 w-6 text-primary/60" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm truncate">{redemption.reward_catalog?.title}</h3>
                              <p className="text-xs text-muted-foreground">{redemption.reward_catalog?.partner_name}</p>
                            </div>
                            {getStatusBadge(redemption.status, redemption.expires_at)}
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                              Expires: {new Date(redemption.expires_at).toLocaleDateString()}
                            </span>
                            <div className="flex gap-1">
                              {isActive && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 rounded-lg"
                                    onClick={() => showQRCode(redemption)}
                                  >
                                    <QrCode className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 rounded-lg text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteVoucher(redemption.id, redemption.points_spent)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="mt-0">
            {userId && (
              <DonorMilestones 
                donorId={userId}
                totalDonations={totalDonations}
                currentPoints={currentPoints}
                lifetimePoints={lifetimePoints}
              />
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-0">
            {userId && <PointsHistoryPanel userId={userId} />}
          </TabsContent>
        </Tabs>
      </main>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader className="text-center">
            <DialogTitle>Your Voucher QR Code</DialogTitle>
            <DialogDescription>
              Show this to the merchant to redeem your reward
            </DialogDescription>
          </DialogHeader>
          
          {selectedRedemption && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-xl">
                  <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                </div>
              </div>
              
              <div className="text-center space-y-1">
                <p className="font-semibold">{selectedRedemption.reward_catalog?.title}</p>
                <p className="text-sm text-muted-foreground">{selectedRedemption.reward_catalog?.partner_name}</p>
                <p className="text-xs font-mono bg-muted px-2 py-1 rounded inline-block">
                  {selectedRedemption.voucher_code}
                </p>
              </div>
              
              {userTier && userTier.discount > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                  <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                    🎁 {userTier.name} Member: {userTier.discount}% discount
                  </p>
                </div>
              )}
              
              <p className="text-xs text-center text-muted-foreground">
                Valid until: {new Date(selectedRedemption.expires_at).toLocaleString()}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Rewards;
