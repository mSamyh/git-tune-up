import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { CheckCircle, XCircle, Clock, Percent, Store, User, Phone, Sparkles, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/hooks/use-toast";

interface PreviewData {
  is_valid: boolean;
  status: 'pending' | 'verified' | 'expired';
  voucher_code: string;
  expires_at: string;
  verified_at: string | null;
  verified_by_merchant: string | null;
  reward: {
    id: string;
    title: string;
    description: string;
    partner_name: string;
    points_required: number;
  };
  customer: {
    full_name: string;
    phone: string;
  };
  tier: {
    name: string;
    discount: number;
    current_points: number;
  };
  reward_program_active: boolean;
}

interface VerificationResult {
  success: boolean;
  warning?: string;
  redemption: any;
  profiles: any;
  tier: {
    name: string;
    discount: number;
    current_points: number;
  };
  verified_by_merchant: string;
  reward_program_active: boolean;
}

type Step = 'loading' | 'preview' | 'verifying' | 'verified' | 'error';

export default function VerifyQR() {
  const { voucherCode } = useParams();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('loading');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [merchantPin, setMerchantPin] = useState("");
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState<string | null>(null);

  useEffect(() => {
    fetchPreview();
  }, [voucherCode]);

  const fetchPreview = async () => {
    if (!voucherCode) {
      setError("Invalid voucher code");
      setStep('error');
      return;
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("preview-voucher", {
        body: { voucher_code: voucherCode },
      });

      if (invokeError) throw invokeError;

      if (data.error) {
        setError(data.error);
        setStep('error');
        return;
      }

      setPreviewData(data);
      
      // If already verified or expired, show error state
      if (data.status === 'verified') {
        setError(`This voucher has already been redeemed${data.verified_by_merchant ? ` by ${data.verified_by_merchant}` : ''}`);
        setStep('error');
      } else if (data.status === 'expired') {
        setError("This voucher has expired");
        setStep('error');
      } else {
        setStep('preview');
      }
    } catch (err: any) {
      console.error("Preview error:", err);
      const errorMessage = err?.context?.body?.error || err.message || "Failed to load voucher details";
      setError(errorMessage);
      setStep('error');
    }
  };

  const handlePinVerify = async () => {
    if (merchantPin.length !== 6) {
      toast({ variant: "destructive", title: "Invalid PIN", description: "Please enter a 6-digit PIN" });
      return;
    }

    setStep('verifying');

    try {
      // Step 1: Verify merchant PIN
      const { data: pinData, error: pinError } = await supabase.functions.invoke("verify-merchant-pin", {
        body: { pin: merchantPin },
      });

      if (pinError) {
        console.error("PIN verification error:", pinError);
        const errorMsg = pinError?.context?.body?.error || pinError.message || "Failed to verify PIN";
        setError(errorMsg);
        setStep('preview');
        toast({ variant: "destructive", title: "Verification failed", description: errorMsg });
        setMerchantPin("");
        return;
      }

      if (!pinData.success) {
        setError(pinData.error || "Invalid PIN");
        setStep('preview');
        toast({ variant: "destructive", title: "Invalid PIN", description: pinData.error || "PIN not recognized" });
        setMerchantPin("");
        return;
      }

      setMerchantId(pinData.merchant_id);
      setMerchantName(pinData.merchant_name);

      // Step 2: Verify the voucher with merchant_id
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-qr-code", {
        body: { 
          voucher_code: voucherCode,
          merchant_id: pinData.merchant_id
        },
      });

      if (verifyError) {
        console.error("QR verification error:", verifyError);
        const errorMsg = verifyError?.context?.body?.error || verifyError.message || "Failed to verify voucher";
        setError(errorMsg);
        setStep('preview');
        toast({ variant: "destructive", title: "Verification failed", description: errorMsg });
        setMerchantPin("");
        return;
      }

      if (verifyData.error) {
        setError(verifyData.error);
        setStep('preview');
        toast({ variant: "destructive", title: "Verification failed", description: verifyData.error });
        setMerchantPin("");
        return;
      }

      // Success!
      setVerificationResult(verifyData);
      setStep('verified');
      toast({ title: "Voucher verified!", description: "Voucher verified successfully" });

    } catch (err: any) {
      console.error("Verification error:", err);
      setError(err.message || "Failed to verify voucher");
      setStep('preview');
      toast({ variant: "destructive", title: "Verification failed", description: "Please try again." });
      setMerchantPin("");
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

  // Loading state
  if (step === 'loading') {
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
                <p className="text-lg font-medium">Loading voucher...</p>
                <p className="text-sm text-muted-foreground">Please wait a moment</p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Error state (invalid/expired/already verified)
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-6 max-w-md">
          <Card className="rounded-2xl shadow-lg border-0 overflow-hidden ring-2 ring-destructive/20">
            <div className="h-2 w-full bg-destructive" />
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-12 w-12 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-2xl">Verification Failed</CardTitle>
              <CardDescription className="text-base">{error}</CardDescription>
            </CardHeader>
          </Card>

          {/* Show preview data if available */}
          {previewData && (
            <Card className="rounded-2xl shadow-md border-0 mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Voucher Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="text-sm text-muted-foreground mb-1">Reward</p>
                  <p className="font-semibold">{previewData.reward.title}</p>
                  <p className="text-sm text-muted-foreground">{previewData.reward.partner_name}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="text-sm text-muted-foreground mb-1">Customer</p>
                  <p className="font-semibold">{previewData.customer.full_name}</p>
                </div>
                {previewData.verified_at && (
                  <div className="p-3 bg-muted/50 rounded-xl text-center">
                    <p className="text-xs text-muted-foreground">Verified at</p>
                    <p className="text-sm font-medium">
                      {new Date(previewData.verified_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    );
  }

  // Verifying state (spinner while checking PIN and verifying)
  if (step === 'verifying') {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-8 max-w-md">
          <Card className="rounded-2xl shadow-lg border-0">
            <CardContent className="pt-8 pb-8">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <p className="text-lg font-medium">Verifying...</p>
                <p className="text-sm text-muted-foreground">Authenticating merchant and verifying voucher</p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Verified state (success)
  if (step === 'verified' && verificationResult) {
    const tierInfo = verificationResult.tier;
    const result = verificationResult.redemption;

    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-6 max-w-md">
          {/* Success Card */}
          <Card className="rounded-2xl shadow-lg border-0 overflow-hidden ring-2 ring-green-500/20 mb-4">
            <div className="h-2 w-full bg-green-500" />
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center animate-scale-in">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
              </div>
              <CardTitle className="text-2xl">Voucher Verified!</CardTitle>
              <CardDescription className="text-base">
                Successfully verified by {verificationResult.verified_by_merchant || merchantName}
              </CardDescription>
              {verificationResult.warning && (
                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {verificationResult.warning}
                </div>
              )}
            </CardHeader>
          </Card>

          {/* Tier Discount Card */}
          {tierInfo && tierInfo.discount > 0 && (
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
          <Card className="rounded-2xl shadow-md border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4" />
                Reward Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">Reward</p>
                <p className="font-semibold text-lg">{result.reward_catalog?.title}</p>
                <p className="text-sm text-muted-foreground">{result.reward_catalog?.partner_name}</p>
              </div>

              <div className="p-4 bg-muted/50 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <p className="font-semibold">{verificationResult.profiles?.full_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="h-3 w-3" />
                      {verificationResult.profiles?.phone}
                    </p>
                  </div>
                  {tierInfo && (
                    <Badge variant="outline" className={getTierBgColor(tierInfo.name)}>
                      {tierInfo.name}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Verification Time */}
              <div className="p-3 bg-green-500/10 rounded-xl text-center">
                <p className="text-xs text-muted-foreground">Verified at</p>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  {new Date(result.verified_at).toLocaleString()}
                </p>
              </div>

              {/* Voucher Code */}
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground text-center">Voucher Code</p>
                <p className="text-xs font-mono text-center text-muted-foreground mt-1 bg-muted px-3 py-2 rounded-lg">
                  {result.voucher_code}
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Preview state - show voucher details and PIN input
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-md">
        {/* Voucher Preview Card */}
        <Card className="rounded-2xl shadow-lg border-0 overflow-hidden mb-4">
          <div className="h-2 w-full bg-primary" />
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Store className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl">Voucher Ready</CardTitle>
            <CardDescription className="text-base">
              Enter merchant PIN to verify and redeem
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Reward Details */}
        {previewData && (
          <>
            {/* Tier Preview */}
            {previewData.tier && previewData.tier.discount > 0 && (
              <Card className="rounded-2xl shadow-lg border-0 overflow-hidden mb-4">
                <div className={`p-4 bg-gradient-to-br ${getTierColor(previewData.tier.name)} text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <Percent className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-white/80 text-xs font-medium">Eligible Discount</p>
                        <p className="text-2xl font-bold">{previewData.tier.discount}%</p>
                      </div>
                    </div>
                    <Badge className="bg-white/20 text-white border-0">
                      {previewData.tier.name}
                    </Badge>
                  </div>
                </div>
              </Card>
            )}

            <Card className="rounded-2xl shadow-md border-0 mb-4">
              <CardContent className="pt-4 space-y-3">
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="text-sm text-muted-foreground mb-1">Reward</p>
                  <p className="font-semibold">{previewData.reward.title}</p>
                  <p className="text-sm text-muted-foreground">{previewData.reward.partner_name}</p>
                </div>

                <div className="p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Customer</p>
                      <p className="font-semibold">{previewData.customer.full_name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3" />
                        {previewData.customer.phone}
                      </p>
                    </div>
                    {previewData.tier && (
                      <Badge variant="outline" className={getTierBgColor(previewData.tier.name)}>
                        {previewData.tier.name}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/50 rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Expires</p>
                    <p className="text-sm font-medium">
                      {new Date(previewData.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Merchant PIN Input Card */}
        <Card className="rounded-2xl shadow-lg border-0 overflow-hidden">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-lg">Merchant Verification</CardTitle>
            <CardDescription>
              Enter your 6-digit merchant PIN to verify this voucher
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={merchantPin}
                onChange={(value) => setMerchantPin(value)}
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
              onClick={handlePinVerify}
              disabled={merchantPin.length !== 6}
              className="w-full h-12 rounded-xl text-lg font-semibold"
              size="lg"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Verify & Redeem
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Only authorized merchants can verify vouchers
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
