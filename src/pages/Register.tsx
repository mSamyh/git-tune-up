import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Droplet } from "lucide-react";
import { LocationSelector } from "@/components/LocationSelector";

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

  const handleSendOTP = async () => {
    if (!formData.phone) {
      toast({
        variant: "destructive",
        title: "Phone required",
        description: "Please enter your phone number",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-otp", {
        body: { phone: formData.phone },
      });

      if (error) throw error;

      setOtpSent(true);
      toast({
        title: "OTP sent",
        description: "Please check your phone for the verification code",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to send OTP",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
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

      if (authError) throw authError;

      if (authData.user) {
        // Create profile after signup
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
            description: "Account created but profile setup failed. Please contact support.",
          });
          setLoading(false);
          return;
        }

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Droplet className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Donor Registration</CardTitle>
          <CardDescription>Complete your profile to start saving lives</CardDescription>
        </CardHeader>
        <CardContent>
          {!otpVerified ? (
            <form onSubmit={otpSent ? handleVerifyOtp : handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    disabled={otpSent}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="flex gap-2">
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      disabled={otpSent}
                    />
                    {!otpSent && (
                      <Button type="button" onClick={handleSendOTP} disabled={loading}>
                        Send OTP
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {otpSent && (
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification Code</Label>
                  <Input
                    id="otp"
                    value={formData.otp}
                    onChange={(e) => setFormData({ ...formData, otp: e.target.value })}
                    placeholder="Enter 6-digit code"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="bloodGroup">Blood Group</Label>
                <Select
                  value={formData.bloodGroup}
                  onValueChange={(value) => setFormData({ ...formData, bloodGroup: value })}
                  required
                  disabled={otpSent}
                >
                  <SelectTrigger>
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

              {otpSent && (
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Verifying..." : "Verify OTP"}
                </Button>
              )}
              
              <div className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <a href="/auth" className="text-primary hover:underline">
                  Login here
                </a>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Complete Registration"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;