import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

export default function VerifyQR() {
  const { voucherCode } = useParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
      } else {
        setResult(data.redemption);
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
          </CardHeader>
          {result && (
            <CardContent className="space-y-4">
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