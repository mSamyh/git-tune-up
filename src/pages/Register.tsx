import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Droplet, ArrowLeft, CheckCircle2, Phone, Mail, Lock } from "lucide-react";
import { LocationSelector } from "@/components/LocationSelector";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const Register = () => {
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    bloodGroup: "",
    otp: "",
    email: "",
    password: "",
  });
  const [selectedAtoll, setSelectedAtoll] = useState("");
  const [selectedIsland, setSelectedIsland] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if all required fields are filled for sending OTP
  const canSendOtp = formData.fullName.trim() && 
                     formData.phone.trim() && 
                     formData.bloodGroup && 
                     selectedAtoll && 
                     selectedIsland;

  const handleSendOTP = async () => {
    if (!canSendOtp) {
      toast({
        variant: "destructive",
        title: "All fields required",
        description: "Please fill in all fields before sending OTP",
      });
      return;
    }

    setLoading(true);
    try {
      // Check if phone number already exists in profiles
      const { data: existingProfile, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", formData.phone)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking phone:", checkError);
      }

      if (existingProfile) {
        toast({
          variant: "destructive",
          title: "Mobile already exists",
          description: "This phone number is already registered. Please login instead.",
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone: formData.phone },
      });

      if (error) {
        // Try to parse the error message from the response
        const errorMessage = data?.error || error.message || "Failed to send OTP";
        throw new Error(errorMessage);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setOtpSent(true);
      toast({
        title: "OTP sent",
        description: "Please check your phone for the verification code",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const displayMessage = errorMessage.includes("Invalid phone number") 
        ? "Invalid mobile number. Must be 7 digits starting with 7 or 9"
        : errorMessage;
      toast({
        variant: "destructive",
        title: "Failed to send OTP",
        description: displayMessage,
      });
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.otp.length !== 6) {
      toast({
        variant: "destructive",
        title: "Invalid OTP",
        description: "Please enter the complete 6-digit code",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-otp", {
        body: { 
          phone: formData.phone, 
          otp: formData.otp,
        },
      });

      if (verifyError || !verifyData?.success) {
        const message =
          (verifyData as any)?.error ||
          (verifyError instanceof Error ? verifyError.message : "Failed to verify OTP");
        throw new Error(message);
      }

      setOtpVerified(true);
      toast({
        title: "OTP verified!",
        description: "Please create your login credentials",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!otpVerified) {
        throw new Error("Please verify your phone number with OTP before registering");
      }

      if (!formData.email || !formData.password) {
        throw new Error("Please enter email and password");
      }

      if (formData.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      // Sign up with email and password
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone: formData.phone,
            blood_group: formData.bloodGroup,
            atoll: selectedAtoll,
            island: selectedIsland,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) {
        const message = authError.message?.toLowerCase() ?? "";
        if (message.includes("user already registered") || message.includes("user already exists") || message.includes("email rate limit")) {
          toast({
            title: "Account already exists",
            description: "Please log in with your email and password instead.",
          });
          navigate("/auth");
          setLoading(false);
          return;
        }
        throw authError;
      }

      if (authData.user) {
        const { error: profileError } = await supabase.from("profiles").insert({
          id: authData.user.id,
          full_name: formData.fullName,
          phone: formData.phone,
          blood_group: formData.bloodGroup,
          atoll: selectedAtoll,
          island: selectedIsland,
          district: selectedAtoll && selectedIsland ? `${selectedAtoll} - ${selectedIsland}` : null,
        });

        if (profileError) {
          console.error("Profile creation error:", profileError);
          toast({
            variant: "destructive",
            title: "Registration partially complete",
            description: profileError.message ?? "Account created but profile setup failed. Please contact support.",
          });
          navigate("/auth");
          setLoading(false);
          return;
        }

        const { notifyNewUserRegistration } = await import("@/lib/telegramNotifications");
        await notifyNewUserRegistration({
          full_name: formData.fullName,
          phone: formData.phone,
          blood_group: formData.bloodGroup,
          district: selectedAtoll && selectedIsland ? `${selectedAtoll} - ${selectedIsland}` : undefined
        });

        toast({
          title: "Registration complete!",
          description: "You can now log in with your credentials",
        });

        navigate("/auth");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }

    setLoading(false);
  };

  // Step indicator
  const getStep = () => {
    if (otpVerified) return 3;
    if (otpSent) return 2;
    return 1;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-lg mx-auto pt-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/auth")}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Donor Registration</h1>
            <p className="text-sm text-muted-foreground">Step {getStep()} of 3</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-8">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${getStep() >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            <span className="w-5 h-5 rounded-full bg-background/20 flex items-center justify-center">1</span>
            Details
          </div>
          <div className={`h-0.5 flex-1 rounded ${getStep() >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${getStep() >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            <span className="w-5 h-5 rounded-full bg-background/20 flex items-center justify-center">2</span>
            Verify
          </div>
          <div className={`h-0.5 flex-1 rounded ${getStep() >= 3 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${getStep() >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            <span className="w-5 h-5 rounded-full bg-background/20 flex items-center justify-center">3</span>
            Account
          </div>
        </div>

        {/* Step 1: Profile Details */}
        {!otpSent && !otpVerified && (
          <div className="bg-card rounded-2xl border p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Droplet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Personal Details</h2>
                <p className="text-sm text-muted-foreground">Fill in your information to register</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Enter your full name"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter phone number"
                    className="pl-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bloodGroup">Blood Group</Label>
                <Select
                  value={formData.bloodGroup}
                  onValueChange={(value) => setFormData({ ...formData, bloodGroup: value })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_GROUPS.map((group) => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <LocationSelector
                  selectedAtoll={selectedAtoll}
                  selectedIsland={selectedIsland}
                  onAtollChange={setSelectedAtoll}
                  onIslandChange={setSelectedIsland}
                />
              </div>

              <Button 
                onClick={handleSendOTP} 
                disabled={loading || !canSendOtp}
                className="w-full rounded-xl h-12"
              >
                {loading ? "Sending OTP..." : "Send OTP to Verify"}
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground pt-2">
              Already have an account?{" "}
              <a href="/auth" className="text-primary hover:underline font-medium">
                Login here
              </a>
            </div>
          </div>
        )}

        {/* Step 2: OTP Verification */}
        {otpSent && !otpVerified && (
          <div className="bg-card rounded-2xl border p-6 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Verify Phone Number</h2>
                <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to {formData.phone}</p>
              </div>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="flex justify-center">
                <InputOTP 
                  value={formData.otp} 
                  onChange={(value) => setFormData({ ...formData, otp: value })}
                  maxLength={6}
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
                type="submit" 
                className="w-full rounded-xl h-12" 
                disabled={loading || formData.otp.length !== 6}
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Didn't receive the code?{" "}
                <button 
                  type="button" 
                  onClick={handleSendOTP} 
                  disabled={loading}
                  className="text-primary hover:underline font-medium"
                >
                  Resend
                </button>
              </p>
            </form>
          </div>
        )}

        {/* Step 3: Email & Password */}
        {otpVerified && (
          <div className="bg-card rounded-2xl border p-6 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <h2 className="font-semibold">Phone Verified!</h2>
                <p className="text-sm text-muted-foreground">Create your login credentials</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    className="pl-10 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="At least 6 characters"
                    className="pl-10 rounded-xl"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full rounded-xl h-12" 
                disabled={loading}
              >
                {loading ? "Creating account..." : "Complete Registration"}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;
