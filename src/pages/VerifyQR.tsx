import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Percent } from "lucide-react";
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-8 max-w-md">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <Clock className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-lg">Verifying voucher...</p>
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
      <main className="container mx-auto px-4 py-8 max-w-md">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              {error ? (
                <XCircle className="h-16 w-16 text-destructive" />
              ) : (
                <CheckCircle className="h-16 w-16 text-green-500" />
              )}
            </div>
            <CardTitle className="text-center">
              {error ? "Verification Failed" : "Voucher Verified!"}
            </CardTitle>
            <CardDescription className="text-center">
              {error || "This voucher has been successfully verified and redeemed"}
            </CardDescription>
            {warning && (
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200 text-center">
                {warning}
              </div>
            )}
          </CardHeader>
          {result && (
            <CardContent className="space-y-4">
              {/* Tier Discount Banner - Important for merchant */}
              {tierInfo && tierInfo.discount > 0 && !error && (
                <div className="p-4 bg-primary/10 border-2 border-primary rounded-lg">
                  <div className="flex items-center gap-3">
                    <Percent className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-lg font-bold text-primary">Apply {tierInfo.discount}% Discount</p>
                      <p className="text-sm text-muted-foreground">
                        {tierInfo.name} tier member ({tierInfo.current_points} pts)
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="border-t pt-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Reward</p>
                    <p className="font-semibold">{result.reward_catalog?.title}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Partner</p>
                    <p className="font-semibold">{result.reward_catalog?.partner_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Donor</p>
                    <p className="font-semibold">{result.profiles?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{result.profiles?.phone}</p>
                  </div>
                  {tierInfo && (
                    <div>
                      <p className="text-sm text-muted-foreground">Donor Tier</p>
                      <Badge variant="outline" className="font-semibold">
                        {tierInfo.name} ({tierInfo.discount}% discount)
                      </Badge>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Reward Program Status</p>
                    {rewardProgramActive ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Voucher Code</p>
                    <p className="text-xs font-mono">{result.voucher_code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {result.status === "verified" ? (
                      <Badge className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified at {new Date(result.verified_at).toLocaleString()}
                      </Badge>
                    ) : result.status === "expired" ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  );
}