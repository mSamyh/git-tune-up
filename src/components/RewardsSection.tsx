import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Gift, QrCode, Trophy, Clock, CheckCircle, Award, Star, Crown, ChevronDown, ChevronUp } from "lucide-react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getUserTier, TierInfo } from "@/lib/tierSystem";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [vouchersOpen, setVouchersOpen] = useState(false);
  const { toast } = useToast();

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

    // Get user tier based on CURRENT points (total_points)
    if (pointsData) {
      const tier = await getUserTier(pointsData.total_points);
      setUserTier(tier);
    } else {
      // No points record = 0 points = Bronze tier
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
          partner_name
        )
      `)
      .eq("donor_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    
    setRedemptions(redemptionsData || []);
    setLoading(false);
  };

  const [isRedeeming, setIsRedeeming] = useState(false);

  const handleRedeem = async (reward: Reward) => {
    // Prevent duplicate redemptions
    if (isRedeeming) {
      toast({
        variant: "destructive",
        title: "Please wait",
        description: "A redemption is already in progress.",
      });
      return;
    }

    // Deduct FULL points required (no discount on points - merchant applies discount)
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
      // Generate unique voucher code
      const voucherCode = `VCH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // Get QR expiry hours from settings
      const { data: settings } = await supabase
        .from("reward_settings")
        .select("setting_value")
        .eq("setting_key", "qr_expiry_hours")
        .single();
      
      const expiryHours = parseInt(settings?.setting_value || "24");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiryHours);

      // Generate QR code data (verification URL)
      const verifyUrl = `${window.location.origin}/verify-qr/${voucherCode}`;
      
      // Create redemption record with full points
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
            partner_name
          )
        `)
        .single();

      if (redemptionError) throw redemptionError;
      redemptionId = redemption.id;

      // Deduct full points with optimistic locking check
      const { data: currentPoints, error: fetchError } = await supabase
        .from("donor_points")
        .select("total_points")
        .eq("donor_id", userId)
        .single();

      if (fetchError) throw fetchError;

      // Double-check user still has enough points (prevent race conditions)
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

      // Record transaction - merchant applies tier discount at POS
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
        // Rollback: Restore points
        await supabase
          .from("donor_points")
          .update({ 
            total_points: currentPoints.total_points 
          })
          .eq("donor_id", userId);
        
        throw new Error("Failed to record transaction. Points have been restored.");
      }

      // Generate QR code image
      const qrUrl = await QRCode.toDataURL(verifyUrl, {
        width: 300,
        margin: 2,
      });
      
      setQrCodeUrl(qrUrl);
      setSelectedRedemption(redemption);
      setQrDialogOpen(true);

      await fetchRewardsData();

      toast({
        title: "Reward redeemed!",
        description: `Your QR code is ready. Merchant will apply ${userTier?.discount || 0}% discount.`,
      });
    } catch (error: any) {
      console.error("Error redeeming reward:", error);
      
      // Rollback: Delete redemption record if it was created
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
      // Call secure edge function to delete voucher
      const { data, error } = await supabase.functions.invoke("delete-voucher", {
        body: { redemption_id: redemptionId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Optimistically remove from local list so it disappears immediately
      setRedemptions((prev) => prev.filter((r) => r.id === redemptionId ? false : true));

      await fetchRewardsData();
      
      toast({
        title: "Voucher deleted",
        description: `${data?.points_refunded || pointsSpent} points have been refunded to your account.`,
      });
    } catch (error: any) {
      console.error("Error deleting voucher:", error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message ?? "Unable to delete voucher. Please try again.",
      });
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    if (status === "verified") {
      return <Badge className="bg-green-500 text-white"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>;
    }
    if (new Date(expiresAt) < new Date() || status === "expired") {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (status === "cancelled") {
      return <Badge variant="outline">Cancelled</Badge>;
    }
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  if (loading) {
    return <div className="text-center p-4 text-muted-foreground">Loading rewards...</div>;
  }

  // Show empty state only if user has never earned points AND has no redemptions
  if ((!points || points.lifetime_points === 0) && redemptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Gift className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">No Rewards Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Start donating blood to earn points and unlock exclusive rewards from our partners. 
            You'll earn 100 points for every donation!
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

  return (
    <div className="space-y-4">
      {/* Points Summary with Tier - Leyhadhiya themed */}
      <Card className="rounded-2xl overflow-hidden border-0 shadow-lg bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-primary to-primary/60 shadow-lg`}>
              <TierIcon className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-2xl font-bold">{currentPoints}</CardTitle>
                <span className="text-muted-foreground">points</span>
                {userTier && (
                  <Badge className={`${userTier.color} bg-opacity-20 border`} variant="outline">
                    {userTier.name}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-sm">Lifetime: {lifetimePoints} pts</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {userTier && (
            <div className="p-3 bg-muted/50 rounded-xl mt-2">
              <p className="text-sm">
                <span className="font-medium">🎉 {userTier.name} Benefits:</span>{" "}
                <span className="text-muted-foreground">
                  {userTier.discount}% merchant discount on rewards
                </span>
              </p>
              {userTier.maxPoints && (
                <p className="text-xs text-muted-foreground mt-1">
                  Tier range: {userTier.minPoints} - {userTier.maxPoints} pts
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Rewards - Collapsible */}
      <Collapsible open={rewardsOpen} onOpenChange={setRewardsOpen}>
        <Card className="rounded-2xl border-0 shadow-md">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Gift className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <CardTitle className="text-base">Available Rewards</CardTitle>
                    <CardDescription className="text-xs">{rewards.length} rewards available</CardDescription>
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
                  {rewards.map((reward) => (
                    <div key={reward.id} className="p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-sm">{reward.title}</h3>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{reward.category}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1 line-clamp-2">{reward.description}</p>
                          <p className="text-[10px] text-muted-foreground">Partner: {reward.partner_name}</p>
                          {userTier && userTier.discount > 0 && (
                            <Badge variant="secondary" className="text-[10px] mt-2 bg-green-500/10 text-green-600 border-0">
                              🎁 {userTier.discount}% discount
                            </Badge>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-primary">{reward.points_required}</p>
                          <p className="text-[10px] text-muted-foreground">points</p>
                          <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleRedeem(reward); }}
                            disabled={currentPoints < reward.points_required || isRedeeming}
                            className="mt-2 h-7 text-xs rounded-lg"
                          >
                            {isRedeeming ? "..." : "Redeem"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* My Vouchers - Collapsible */}
      {redemptions.length > 0 && (
        <Collapsible open={vouchersOpen} onOpenChange={setVouchersOpen}>
          <Card className="rounded-2xl border-0 shadow-md">
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-secondary/50 flex items-center justify-center">
                      <QrCode className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="text-left">
                      <CardTitle className="text-base">My Vouchers</CardTitle>
                      <CardDescription className="text-xs">{redemptions.length} voucher(s)</CardDescription>
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
                    
                    return (
                      <div key={redemption.id} className="p-3 bg-muted/30 rounded-xl">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{redemption.reward_catalog.title}</h4>
                            <p className="text-[10px] text-muted-foreground">{redemption.reward_catalog.partner_name}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Expires: {new Date(redemption.expires_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {getStatusBadge(redemption.status, redemption.expires_at)}
                            {redemption.status === "pending" && !isExpired && (
                              <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => showQRCode(redemption)}>
                                <QrCode className="h-3 w-3" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 text-xs text-destructive hover:text-destructive rounded-lg"
                                onClick={() => handleDeleteVoucher(redemption.id, redemption.points_spent)}
                              >
                                Delete
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

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Your Reward QR Code</DialogTitle>
            <DialogDescription>
              Show this QR code to the merchant to redeem your reward
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCodeUrl && (
              <div className="p-4 bg-white rounded-xl shadow-inner">
                <img src={qrCodeUrl} alt="QR Code" className="w-56 h-56" />
              </div>
            )}
            {selectedRedemption && (
              <div className="text-center space-y-2 w-full">
                <p className="font-semibold">{selectedRedemption.reward_catalog.title}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedRedemption.reward_catalog.partner_name}
                </p>
                <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                  {selectedRedemption.voucher_code}
                </p>
                <p className="text-xs text-destructive">
                  Expires: {new Date(selectedRedemption.expires_at).toLocaleString()}
                </p>
                {selectedRedemption.status === "verified" && (
                  <Badge className="bg-green-500 mt-2 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Already Used
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
