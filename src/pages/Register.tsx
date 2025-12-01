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
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    bloodGroup: "",
    otp: "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Verify OTP and create user profile in one backend call
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-otp", {
        body: { 
          phone: formData.phone, 
          otp: formData.otp,
          userData: {
            fullName: formData.fullName,
            bloodGroup: formData.bloodGroup,
            atoll: selectedAtoll,
            island: selectedIsland,
          }
        },
      });

      if (verifyError || !verifyData?.success) {
        const message =
          (verifyData as any)?.error ||
          (verifyError instanceof Error ? verifyError.message : "Failed to verify OTP");
        throw new Error(message);
      }

      // Set the session from the backend response
      if (verifyData.session) {
        await supabase.auth.setSession(verifyData.session);
      }

      toast({
        title: "Registration complete!",
        description: "Your profile has been created successfully",
      });

      navigate("/");
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
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

            <Button type="submit" className="w-full" disabled={loading || !otpSent || !selectedAtoll || !selectedIsland}>
              {loading ? "Registering..." : "Complete Registration"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;