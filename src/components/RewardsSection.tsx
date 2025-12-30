import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Gift, QrCode, Trophy, Clock, CheckCircle, Award, Star, Crown, 
  ChevronDown, ChevronUp, Sparkles, Store, Trash2
} from "lucide-react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getUserTier, TierInfo } from "@/lib/tierSystem";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PointsHistoryPanel } from "./PointsHistoryPanel";
import { Progress } from "@/components/ui/progress";
import { DonorMilestones } from "./DonorMilestones";

interface RewardsSectionProps {
  userId: string;
}

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

export function RewardsSection({ userId }: RewardsSectionProps) {
  const [points, setPoints] = useState<DonorPoints | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedRedemption, setSelectedRedemption] = useState<Redemption | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [userTier, setUserTier] = useState<TierInfo | null>(null);
  const [nextTier, setNextTier] = useState<TierInfo | null>(null);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [vouchersOpen, setVouchersOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [milestonesOpen, setMilestonesOpen] = useState(false);
  const [totalDonations, setTotalDonations] = useState(0);
  const { toast } = useToast();
  const [isRedeeming, setIsRedeeming] = useState(false);

  useEffect(() => {
    fetchRewardsData();
  }, [userId]);

  const fetchRewardsData = async () => {
    setLoading(true);
    
    // Fetch points
    const { data: pointsData } = await supabase
      .from("donor_points")
      .select("total_points, lifetime_points")
      .eq("donor_id", userId)
      .maybeSingle();
    
    setPoints(pointsData);

    // Get user tier and next tier based on CURRENT points
    if (pointsData) {
      const tier = await getUserTier(pointsData.total_points);
      setUserTier(tier);
      
      // Calculate next tier
      const { data: settings } = await supabase
        .from("reward_settings")
        .select("*")
        .in("setting_key", [
          "tier_silver_min", "tier_gold_min", "tier_platinum_min"
        ]);
      
      if (settings) {
        const settingsMap: Record<string, number> = {};
        settings.forEach(s => settingsMap[s.setting_key] = parseInt(s.setting_value));
        
        const tiers = [
          { name: "Silver", minPoints: settingsMap.tier_silver_min || 100 },
          { name: "Gold", minPoints: settingsMap.tier_gold_min || 500 },
          { name: "Platinum", minPoints: settingsMap.tier_platinum_min || 1000 },
        ];
        
        const next = tiers.find(t => pointsData.total_points < t.minPoints);
        if (next) {
          const nextTierFull = await getUserTier(next.minPoints);
          setNextTier(nextTierFull);
        } else {
          setNextTier(null);
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

    // Fetch redemption history with partner logo
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
      .limit(10);
    
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
    if (isRedeeming) {
      toast({
        variant: "destructive",
        title: "Please wait",
        description: "A redemption is already in progress.",
      });
      return;
    }

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
        .select(`
          *,
          reward_catalog (
            title,
            partner_name,
            partner_logo_url
          )
        `)
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
        .update({ 
          total_points: currentPoints.total_points - pointsToDeduct 
        })
        .eq("donor_id", userId);

      if (pointsError) throw pointsError;

      const tierInfo = userTier 
        ? ` | ${userTier.name} tier (${userTier.discount}% merchant discount)`
        : "";
      
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
        console.error("CRITICAL: Transaction insert failed, rolling back points", transactionError);
        await supabase
          .from("donor_points")
          .update({ total_points: currentPoints.total_points })
          .eq("donor_id", userId);
        throw new Error("Failed to record transaction. Points have been restored.");
      }

      const qrUrl = await QRCode.toDataURL(verifyUrl, {
        width: 300,
        margin: 2,
      });
      
      setQrCodeUrl(qrUrl);
      setSelectedRedemption(redemption);
      setQrDialogOpen(true);

      await fetchRewardsData();

      toast({
        title: "🎉 Reward redeemed!",
        description: `Show QR to merchant for ${userTier?.discount || 0}% discount.`,
      });
    } catch (error: any) {
      console.error("Error redeeming reward:", error);
      
      if (redemptionId) {
        await supabase
          .from("redemption_history")
          .delete()
          .eq("id", redemptionId);
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
    const qrUrl = await QRCode.toDataURL(redemption.qr_code_data, {
      width: 300,
      margin: 2,
    });
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
      console.error("Error deleting voucher:", error);
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

  if (loading) {
    return <div className="text-center p-4 text-muted-foreground">Loading rewards...</div>;
  }

  if ((!points || points.lifetime_points === 0) && redemptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center animate-fade-in">
          <Sparkles className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold">Start Earning Rewards!</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Donate blood to earn points and unlock exclusive rewards from our partners. 
            Each donation earns you 100 points!
          </p>
        </div>
      </div>
    );
  }

  const currentPoints = points?.total_points || 0;
  const lifetimePoints = points?.lifetime_points || 0;

  const getTierIcon = () => {
    if (!userTier) return Trophy;
    switch (userTier.icon) {
      case "crown": return Crown;
      case "star": return Star;
      case "trophy": return Trophy;
      default: return Award;
    }
  };

  const TierIcon = getTierIcon();
  
  // Calculate progress to next tier
  const progressToNextTier = nextTier 
    ? Math.min(100, (currentPoints / nextTier.minPoints) * 100)
    : 100;
  const pointsToNextTier = nextTier ? nextTier.minPoints - currentPoints : 0;

  // Group rewards by category
  const categories = [...new Set(rewards.map(r => r.category))];

  return (
    <div className="space-y-4">
      {/* Points Summary with Tier Progress */}
      <Card className="rounded-2xl overflow-hidden border-0 shadow-lg bg-gradient-to-br from-primary/5 via-background to-primary/10">
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
                    className={`${
                      userTier.name === "Platinum" ? "bg-purple-500/20 text-purple-600 border-purple-300" :
                      userTier.name === "Gold" ? "bg-yellow-500/20 text-yellow-600 border-yellow-300" :
                      userTier.name === "Silver" ? "bg-gray-400/20 text-gray-600 border-gray-300" :
                      "bg-orange-500/20 text-orange-600 border-orange-300"
                    }`} 
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
          {/* Tier Benefits */}
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
          
          {/* Progress to Next Tier */}
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

      {/* Achievements & Milestones */}
      <Collapsible open={milestonesOpen} onOpenChange={setMilestonesOpen}>
        <Card className="rounded-2xl border-0 shadow-md">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="text-left">
                    <CardTitle className="text-base">Achievements</CardTitle>
                    <CardDescription className="text-xs">Track your milestones & badges</CardDescription>
                  </div>
                </div>
                {milestonesOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              <DonorMilestones 
                donorId={userId}
                totalDonations={totalDonations}
                currentPoints={currentPoints}
                lifetimePoints={lifetimePoints}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Available Rewards */}
      <Collapsible open={rewardsOpen} onOpenChange={setRewardsOpen}>
        <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Gift className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <CardTitle className="text-base">Available Rewards</CardTitle>
                    <CardDescription className="text-xs">{rewards.length} rewards • {categories.length} categories</CardDescription>
                  </div>
                </div>
                {rewardsOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {rewards.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 text-sm">No rewards available at the moment</p>
              ) : (
                <div className="space-y-3">
                  {rewards.map((reward) => {
                    const canAfford = currentPoints >= reward.points_required;
                    return (
                      <div 
                        key={reward.id} 
                        className={`p-4 rounded-xl transition-all ${
                          canAfford 
                            ? "bg-muted/30 hover:bg-muted/50 hover:shadow-md" 
                            : "bg-muted/20 opacity-60"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Partner Logo/Icon */}
                          <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden">
                            {reward.partner_logo_url ? (
                              <img 
                                src={reward.partner_logo_url} 
                                alt={reward.partner_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Store className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-sm">{reward.title}</h3>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{reward.category}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1.5 line-clamp-2">{reward.description}</p>
                            <p className="text-[10px] text-muted-foreground">
                              <Store className="h-3 w-3 inline mr-1" />{reward.partner_name}
                            </p>
                            {userTier && userTier.discount > 0 && canAfford && (
                              <Badge className="mt-2 text-[10px] bg-green-500/10 text-green-600 border-0">
                                🎁 {userTier.discount}% discount applies
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <p className={`text-xl font-bold ${canAfford ? "text-primary" : "text-muted-foreground"}`}>
                              {reward.points_required}
                            </p>
                            <p className="text-[10px] text-muted-foreground">points</p>
                            <Button
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleRedeem(reward); }}
                              disabled={!canAfford || isRedeeming}
                              className="mt-2 h-8 text-xs rounded-lg px-4"
                            >
                              {isRedeeming ? "..." : canAfford ? "Redeem" : "Need more pts"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* My Vouchers */}
      {redemptions.length > 0 && (
        <Collapsible open={vouchersOpen} onOpenChange={setVouchersOpen}>
          <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center">
                      <QrCode className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="text-left">
                      <CardTitle className="text-base">My Vouchers</CardTitle>
                      <CardDescription className="text-xs">
                        {redemptions.filter(r => r.status === "pending").length} active • {redemptions.length} total
                      </CardDescription>
                    </div>
                  </div>
                  {vouchersOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {redemptions.map((redemption) => {
                    const isExpired = new Date(redemption.expires_at) < new Date() || redemption.status === "expired";
                    const canDelete = redemption.status !== "verified";
                    const isActive = redemption.status === "pending" && !isExpired;
                    
                    return (
                      <div 
                        key={redemption.id} 
                        className={`p-3 rounded-xl ${isActive ? "bg-primary/5 border border-primary/20" : "bg-muted/30"}`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Partner Logo */}
                          <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden">
                            {redemption.reward_catalog.partner_logo_url ? (
                              <img 
                                src={redemption.reward_catalog.partner_logo_url} 
                                alt={redemption.reward_catalog.partner_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Store className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{redemption.reward_catalog.title}</h4>
                            <p className="text-[10px] text-muted-foreground">{redemption.reward_catalog.partner_name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Expires: {new Date(redemption.expires_at).toLocaleDateString()}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {getStatusBadge(redemption.status, redemption.expires_at)}
                            {isActive && (
                              <Button 
                                size="sm" 
                                variant="default" 
                                className="h-7 text-xs rounded-lg px-3" 
                                onClick={() => showQRCode(redemption)}
                              >
                                <QrCode className="h-3.5 w-3.5 mr-1" />
                                QR
                              </Button>
                            )}
                            {canDelete && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive rounded-lg"
                                onClick={() => handleDeleteVoucher(redemption.id, redemption.points_spent)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Points History */}
      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger className="w-full">
          <Card className="rounded-2xl border-0 shadow-md cursor-pointer hover:bg-muted/30 transition-colors">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <CardTitle className="text-base">Points History</CardTitle>
                    <CardDescription className="text-xs">View all transactions</CardDescription>
                  </div>
                </div>
                {historyOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </div>
            </CardHeader>
          </Card>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <PointsHistoryPanel userId={userId} />
        </CollapsibleContent>
      </Collapsible>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">Your Reward QR Code</DialogTitle>
            <DialogDescription className="text-center">
              Show this QR code to the merchant to redeem
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCodeUrl && (
              <div className="p-4 bg-white rounded-2xl shadow-lg ring-4 ring-primary/10">
                <img src={qrCodeUrl} alt="QR Code" className="w-56 h-56" />
              </div>
            )}
            {selectedRedemption && (
              <div className="text-center space-y-3 w-full">
                <div className="flex items-center justify-center gap-2">
                  {selectedRedemption.reward_catalog.partner_logo_url && (
                    <img 
                      src={selectedRedemption.reward_catalog.partner_logo_url} 
                      alt={selectedRedemption.reward_catalog.partner_name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <p className="font-semibold">{selectedRedemption.reward_catalog.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedRedemption.reward_catalog.partner_name}
                    </p>
                  </div>
                </div>
                
                {userTier && userTier.discount > 0 && (
                  <div className="p-3 bg-green-500/10 rounded-xl">
                    <p className="text-lg font-bold text-green-600">
                      {userTier.discount}% Discount
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Merchant applies {userTier.name} tier discount
                    </p>
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-2 rounded-lg">
                  {selectedRedemption.voucher_code}
                </p>
                <p className="text-xs text-destructive">
                  ⏰ Expires: {new Date(selectedRedemption.expires_at).toLocaleString()}
                </p>
                {selectedRedemption.status === "verified" && (
                  <Badge className="bg-green-500 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Already Redeemed
                  </Badge>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
