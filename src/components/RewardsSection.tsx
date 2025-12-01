import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Gift, QrCode, Trophy, Clock, CheckCircle, Award, Star, Crown } from "lucide-react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getUserTier, calculateDiscountedPoints } from "@/lib/tierSystem";

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
  const [userTier, setUserTier] = useState<any>(null);
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

    // Get user tier
    if (pointsData) {
      const tier = await getUserTier(pointsData.lifetime_points);
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

  const handleRedeem = async (reward: Reward) => {
    // Calculate discounted points based on user tier
    const discountedPoints = userTier 
      ? calculateDiscountedPoints(reward.points_required, userTier.discount)
      : reward.points_required;

    if (!points || points.total_points < discountedPoints) {
      toast({
        variant: "destructive",
        title: "Insufficient points",
        description: `You need ${discountedPoints} points to redeem this reward.`,
      });
      return;
    }

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
      
      // Create redemption record with discounted points
      const { data: redemption, error: redemptionError } = await supabase
        .from("redemption_history")
        .insert({
          donor_id: userId,
          reward_id: reward.id,
          points_spent: discountedPoints,
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

      // Deduct discounted points
      const { error: pointsError } = await supabase
        .from("donor_points")
        .update({ 
          total_points: points.total_points - discountedPoints 
        })
        .eq("donor_id", userId);

      if (pointsError) throw pointsError;

      // Record transaction with tier discount info
      const discountInfo = userTier 
        ? ` (${userTier.name} ${userTier.discount}% discount: ${reward.points_required} → ${discountedPoints} pts)`
        : "";
      
      await supabase
        .from("points_transactions")
        .insert({
          donor_id: userId,
          points: -discountedPoints,
          transaction_type: "redeemed",
          description: `Redeemed reward: ${reward.title}${discountInfo}`,
          related_redemption_id: redemption.id,
        });

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
        description: "Your QR code is ready to use.",
      });
    } catch (error: any) {
      console.error("Error redeeming reward:", error);
      toast({
        variant: "destructive",
        title: "Redemption failed",
        description: error.message,
      });
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
      // Delete the redemption
      const { error: deleteError } = await supabase
        .from("redemption_history")
        .delete()
        .eq("id", redemptionId);

      if (deleteError) throw deleteError;

      // Refund the points
      if (points) {
        await supabase
          .from("donor_points")
          .update({ 
            total_points: points.total_points + pointsSpent 
          })
          .eq("donor_id", userId);

        // Record refund transaction
        await supabase
          .from("points_transactions")
          .insert({
            donor_id: userId,
            points: pointsSpent,
            transaction_type: "refunded",
            description: "Voucher deleted - points refunded",
            related_redemption_id: redemptionId,
          });
      }

      await fetchRewardsData();
      
      toast({
        title: "Voucher deleted",
        description: `${pointsSpent} points have been refunded to your account.`,
      });
    } catch (error: any) {
      console.error("Error deleting voucher:", error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message,
      });
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    if (status === "verified") {
      return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>;
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
    return <div className="text-center p-4">Loading rewards...</div>;
  }

  // Show empty state only if user has never earned points AND has no redemptions
  if ((!points || points.lifetime_points === 0) && redemptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
        <Gift className="h-16 w-16 text-muted-foreground/50" />
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
    <div className="space-y-6">
      {/* Points Summary with Tier */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TierIcon className={`h-8 w-8 ${userTier?.color || "text-primary"}`} />
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl">{currentPoints} Points</CardTitle>
                  {userTier && (
                    <Badge className={userTier.color} variant="outline">
                      {userTier.name}
                    </Badge>
                  )}
                </div>
                <CardDescription>Lifetime earned: {lifetimePoints} points</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Earn 100 points for every blood donation. Use your points to redeem rewards from our partners.
          </p>
          {userTier && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-semibold mb-1">
                🎉 {userTier.name} Member Benefits:
              </p>
              <p className="text-sm text-muted-foreground">
                You save {userTier.discount}% on all reward redemptions!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Rewards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Available Rewards
          </CardTitle>
          <CardDescription>Redeem your points for exclusive rewards</CardDescription>
        </CardHeader>
        <CardContent>
          {rewards.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No rewards available at the moment</p>
          ) : (
            <div className="space-y-4">
              {rewards.map((reward) => {
                const discountedPoints = userTier 
                  ? calculateDiscountedPoints(reward.points_required, userTier.discount)
                  : reward.points_required;
                const hasSavings = discountedPoints < reward.points_required;
                
                return (
                  <div key={reward.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{reward.title}</h3>
                          <Badge variant="outline">{reward.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{reward.description}</p>
                        <p className="text-xs text-muted-foreground">Partner: {reward.partner_name}</p>
                      </div>
                      <div className="text-right ml-4">
                        {hasSavings ? (
                          <div>
                            <p className="text-sm text-muted-foreground line-through">{reward.points_required} pts</p>
                            <p className="text-lg font-bold text-primary">{discountedPoints} pts</p>
                            <Badge variant="secondary" className="text-xs mb-2">
                              Save {reward.points_required - discountedPoints} pts
                            </Badge>
                          </div>
                        ) : (
                          <p className="text-lg font-bold text-primary">{reward.points_required} pts</p>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleRedeem(reward)}
                          disabled={currentPoints < discountedPoints}
                          className="mt-2"
                        >
                          Redeem
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Redemption History */}
      {redemptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              My Vouchers
            </CardTitle>
            <CardDescription>Your redeemed rewards and QR codes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {redemptions.map((redemption) => {
                const isExpired = new Date(redemption.expires_at) < new Date() || redemption.status === "expired";
                const isUsed = redemption.status === "verified";
                const canDelete = redemption.status !== "verified";
                
                return (
                  <div key={redemption.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{redemption.reward_catalog.title}</h4>
                        <p className="text-xs text-muted-foreground">{redemption.reward_catalog.partner_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Expires: {new Date(redemption.expires_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(redemption.status, redemption.expires_at)}
                        {redemption.status === "pending" && !isExpired && (
                          <Button size="sm" variant="outline" onClick={() => showQRCode(redemption)}>
                            <QrCode className="h-4 w-4 mr-1" />
                            Show QR
                          </Button>
                        )}
                        {canDelete && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleDeleteVoucher(redemption.id, redemption.points_spent)}
                            className="text-destructive hover:text-destructive"
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
        </Card>
      )}

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your Reward QR Code</DialogTitle>
            <DialogDescription>
              Show this QR code to the merchant to redeem your reward
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCodeUrl && (
              <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
            )}
            {selectedRedemption && (
              <div className="text-center space-y-2 w-full">
                <p className="font-semibold">{selectedRedemption.reward_catalog.title}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedRedemption.reward_catalog.partner_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Voucher: {selectedRedemption.voucher_code}
                </p>
                <p className="text-xs text-destructive">
                  Expires: {new Date(selectedRedemption.expires_at).toLocaleString()}
                </p>
                {selectedRedemption.status === "verified" && (
                  <Badge className="bg-green-500 mt-2">
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