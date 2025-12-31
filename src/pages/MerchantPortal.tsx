import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Store, QrCode, CheckCircle, XCircle, Percent, User, Phone, AlertTriangle, Loader2, KeyRound } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface VerificationResult {
  success: boolean;
  error?: string;
  warning?: string;
  redemption?: any;
  profiles?: any;
  tier?: {
    name: string;
    discount: number;
    current_points: number;
  };
  reward_program_active?: boolean;
}

export default function MerchantPortal() {
  const [merchantPin, setMerchantPin] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [merchantName, setMerchantName] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyingVoucher, setVerifyingVoucher] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const { toast } = useToast();

  const verifyMerchantPin = async () => {
    if (merchantPin.length !== 6) {
      toast({ variant: "destructive", title: "Invalid PIN", description: "Please enter a 6-digit PIN" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-merchant-pin", {
        body: { pin: merchantPin },
      });

      if (error) throw error;

      if (data.success) {
        setIsVerified(true);
        setMerchantName(data.merchant_name);
        toast({ title: "Welcome!", description: `Logged in as ${data.merchant_name}` });
      } else {
        toast({ variant: "destructive", title: "Invalid PIN", description: data.error || "PIN not recognized" });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const verifyVoucher = async () => {
    if (!voucherCode.trim()) {
      toast({ variant: "destructive", title: "Enter voucher code" });
      return;
    }

    setVerifyingVoucher(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("verify-qr-code", {
        body: { voucher_code: voucherCode.trim(), merchant_pin: merchantPin },
      });

      if (error) throw error;

      setResult(data);
      
      if (data.success) {
        toast({ title: "Voucher Verified!", description: "Discount applied successfully" });
        setVoucherCode("");
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setVerifyingVoucher(false);
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

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-8 max-w-md">
          <Card className="rounded-2xl shadow-lg border-0">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Store className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Merchant Portal</CardTitle>
              <CardDescription>Enter your 6-digit merchant PIN to verify vouchers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <Label className="text-sm text-muted-foreground">Enter Merchant PIN</Label>
                <InputOTP 
                  maxLength={6} 
                  value={merchantPin} 
                  onChange={setMerchantPin}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              
              <Button 
                className="w-full rounded-xl h-12" 
                onClick={verifyMerchantPin}
                disabled={loading || merchantPin.length !== 6}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Verify PIN
                  </>
                )}
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                Contact admin if you don't have a merchant PIN
              </p>
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
        {/* Merchant Info */}
        <Card className="rounded-2xl shadow-lg border-0 mb-4 bg-gradient-to-r from-primary to-primary/80">
          <CardContent className="p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-white/80">Logged in as</p>
                <p className="text-lg font-bold">{merchantName}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Voucher Verification */}
        <Card className="rounded-2xl shadow-lg border-0 mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Verify Voucher
            </CardTitle>
            <CardDescription>Enter or scan the voucher code</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Voucher Code</Label>
              <Input
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                placeholder="Enter voucher code..."
                className="rounded-xl h-12 text-center font-mono text-lg uppercase"
              />
            </div>
            <Button 
              className="w-full rounded-xl h-12" 
              onClick={verifyVoucher}
              disabled={verifyingVoucher || !voucherCode.trim()}
            >
              {verifyingVoucher ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Verify & Redeem
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Verification Result */}
        {result && (
          <>
            {/* Status Card */}
            <Card className={`rounded-2xl shadow-lg border-0 overflow-hidden mb-4 ${
              result.success ? "ring-2 ring-green-500/20" : "ring-2 ring-destructive/20"
            }`}>
              <div className={`h-2 w-full ${result.success ? "bg-green-500" : "bg-destructive"}`} />
              <CardContent className="pt-6 pb-4 text-center">
                {result.success ? (
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3 animate-scale-in">
                    <CheckCircle className="h-10 w-10 text-green-500" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
                    <XCircle className="h-10 w-10 text-destructive" />
                  </div>
                )}
                <h3 className="text-xl font-bold mb-1">
                  {result.success ? "Voucher Verified!" : "Verification Failed"}
                </h3>
                <p className="text-muted-foreground">
                  {result.error || "Successfully verified and marked as redeemed"}
                </p>
                {result.warning && (
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    {result.warning}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tier Discount Card */}
            {result.tier && result.tier.discount > 0 && result.success && (
              <Card className="rounded-2xl shadow-lg border-0 overflow-hidden mb-4">
                <div className={`p-6 bg-gradient-to-br ${getTierColor(result.tier.name)} text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                        <Percent className="h-8 w-8" />
                      </div>
                      <div>
                        <p className="text-white/80 text-sm font-medium">Apply Discount</p>
                        <p className="text-4xl font-bold">{result.tier.discount}%</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-white/20 text-white border-0 text-sm mb-1">
                        {result.tier.name} Tier
                      </Badge>
                      <p className="text-white/80 text-xs">{result.tier.current_points} pts</p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Customer Details */}
            {result.redemption && result.success && (
              <Card className="rounded-2xl shadow-md border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Customer Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-muted/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{result.profiles?.full_name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {result.profiles?.phone}
                        </p>
                      </div>
                      {result.tier && (
                        <Badge variant="outline" className={getTierBgColor(result.tier.name)}>
                          {result.tier.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Reward Redeemed</p>
                    <p className="font-semibold">{result.redemption?.reward_catalog?.title}</p>
                    <p className="text-sm text-muted-foreground">{result.redemption?.reward_catalog?.partner_name}</p>
                  </div>
                  
                  <div className="p-3 bg-green-500/10 rounded-xl text-center">
                    <p className="text-xs text-muted-foreground">Verified at</p>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">
                      {new Date().toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Logout button */}
        <Button 
          variant="outline" 
          className="w-full mt-4 rounded-xl"
          onClick={() => {
            setIsVerified(false);
            setMerchantPin("");
            setResult(null);
          }}
        >
          Logout
        </Button>
      </main>
    </div>
  );
}
