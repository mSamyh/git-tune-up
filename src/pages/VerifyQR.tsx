import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Percent, Store, User, Phone, Sparkles, AlertTriangle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

export default function VerifyQR() {
  const { voucherCode } = useParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [rewardProgramActive, setRewardProgramActive] = useState<boolean>(true);
  const [tierInfo, setTierInfo] = useState<{ name: string; discount: number; current_points: number } | null>(null);

  useEffect(() => {
    verifyVoucher();
  }, [voucherCode]);

  const verifyVoucher = async () => {
    if (!voucherCode) {
      setError("Invalid voucher code");
      setLoading(false);
      return;
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("verify-qr-code", {
        body: { voucher_code: voucherCode },
      });

      if (invokeError) throw invokeError;

      if (data.error) {
        setError(data.error);
        setResult(data.redemption);
        setRewardProgramActive(data.reward_program_active ?? true);
        setTierInfo(data.tier || null);
      } else {
        setResult(data.redemption);
        setWarning(data.warning);
        setRewardProgramActive(data.reward_program_active ?? true);
        setTierInfo(data.tier || null);
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setError(err.message || "Failed to verify voucher");
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tierName: string) => {
    switch (tierName) {
      case "Platinum": return "from-purple-500 to-purple-600";
      case "Gold": return "from-yellow-500 to-yellow-600";
      case "Silver": return "from-gray-400 to-gray-500";
      default: return "from-orange-500 to-orange-600";
    }
  };

  const getTierBgColor = (tierName: string) => {
    switch (tierName) {
      case "Platinum": return "bg-purple-500/10 border-purple-200 text-purple-700";
      case "Gold": return "bg-yellow-500/10 border-yellow-200 text-yellow-700";
      case "Silver": return "bg-gray-400/10 border-gray-200 text-gray-700";
      default: return "bg-orange-500/10 border-orange-200 text-orange-700";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-8 max-w-md">
          <Card className="rounded-2xl shadow-lg border-0">
            <CardContent className="pt-8 pb-8">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-8 w-8 animate-spin text-primary" />
                </div>
                <p className="text-lg font-medium">Verifying voucher...</p>
                <p className="text-sm text-muted-foreground">Please wait a moment</p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-md">
        {/* Status Card */}
        <Card className={`rounded-2xl shadow-lg border-0 overflow-hidden mb-4 ${
          error ? "ring-2 ring-destructive/20" : "ring-2 ring-green-500/20"
        }`}>
          <div className={`h-2 w-full ${error ? "bg-destructive" : "bg-green-500"}`} />
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              {error ? (
                <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-12 w-12 text-destructive" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center animate-scale-in">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
              )}
            </div>
            <CardTitle className="text-2xl">
              {error ? "Verification Failed" : "Voucher Verified!"}
            </CardTitle>
            <CardDescription className="text-base">
              {error || "Successfully verified and marked as redeemed"}
            </CardDescription>
            {warning && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {warning}
              </div>
            )}
          </CardHeader>
        </Card>

        {/* Tier Discount Card - MOST IMPORTANT FOR MERCHANT */}
        {tierInfo && tierInfo.discount > 0 && !error && (
          <Card className="rounded-2xl shadow-lg border-0 overflow-hidden mb-4">
            <div className={`p-6 bg-gradient-to-br ${getTierColor(tierInfo.name)} text-white`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                    <Percent className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm font-medium">Apply Discount</p>
                    <p className="text-4xl font-bold">{tierInfo.discount}%</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className="bg-white/20 text-white border-0 text-sm mb-1">
                    {tierInfo.name} Tier
                  </Badge>
                  <p className="text-white/80 text-xs">{tierInfo.current_points} pts</p>
                </div>
              </div>
            </div>
            <CardContent className="py-3 bg-muted/50">
              <p className="text-sm text-center text-muted-foreground">
                <Sparkles className="h-4 w-4 inline mr-1" />
                Customer is a <strong>{tierInfo.name}</strong> member — apply {tierInfo.discount}% off at checkout
              </p>
            </CardContent>
          </Card>
        )}

        {/* Reward Details */}
        {result && (
          <Card className="rounded-2xl shadow-md border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4" />
                Reward Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Reward Info */}
              <div className="p-4 bg-muted/50 rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">Reward</p>
                <p className="font-semibold text-lg">{result.reward_catalog?.title}</p>
                <p className="text-sm text-muted-foreground">{result.reward_catalog?.partner_name}</p>
              </div>

              {/* Donor Info */}
              <div className="p-4 bg-muted/50 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <p className="font-semibold">{result.profiles?.full_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="h-3 w-3" />
                      {result.profiles?.phone}
                    </p>
                  </div>
                  {tierInfo && (
                    <Badge variant="outline" className={getTierBgColor(tierInfo.name)}>
                      {tierInfo.name}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Status Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/50 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  {result.status === "verified" ? (
                    <Badge className="bg-green-500 text-white">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : result.status === "expired" ? (
                    <Badge variant="destructive">Expired</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
                <div className="p-3 bg-muted/50 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">Program</p>
                  {rewardProgramActive ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Active
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                      Inactive
                    </Badge>
                  )}
                </div>
              </div>

              {/* Verification Time */}
              {result.verified_at && (
                <div className="p-3 bg-green-500/10 rounded-xl text-center">
                  <p className="text-xs text-muted-foreground">Verified at</p>
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    {new Date(result.verified_at).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Voucher Code */}
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground text-center">Voucher Code</p>
                <p className="text-xs font-mono text-center text-muted-foreground mt-1 bg-muted px-3 py-2 rounded-lg">
                  {result.voucher_code}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
