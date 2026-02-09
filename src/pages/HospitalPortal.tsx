import { useState, useEffect } from "react";
import { Building2, LogOut, ArrowLeft, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import BloodUnitManager from "@/components/hospital/BloodUnitManager";

interface Hospital {
  id: string;
  name: string;
  address: string | null;
  atoll: string | null;
  island: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
}

const HospitalPortal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hospital, setHospital] = useState<Hospital | null>(null);

  useEffect(() => {
    checkExistingSession();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setHospital(null);
      } else if (event === 'SIGNED_IN' && session?.user?.user_metadata?.hospital_id) {
        fetchHospitalData(session.user.user_metadata.hospital_id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkExistingSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.user_metadata?.hospital_id) {
        await fetchHospitalData(session.user.user_metadata.hospital_id);
      }
    } catch (error) {
      console.error("Error checking session:", error);
    } finally {
      setIsCheckingSession(false);
    }
  };

  const fetchHospitalData = async (hospitalId: string) => {
    try {
      const { data, error } = await supabase
        .from("hospitals")
        .select("*")
        .eq("id", hospitalId)
        .single();

      if (error) throw error;
      
      if (data) {
        setHospital(data);
      }
    } catch (error: any) {
      console.error("Error fetching hospital:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load hospital data" });
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      toast({ variant: "destructive", title: "Missing credentials", description: "Please enter email and password" });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Verify this is a hospital account
      if (!data.user?.user_metadata?.hospital_id) {
        await supabase.auth.signOut();
        toast({ variant: "destructive", title: "Access denied", description: "This account is not authorized for hospital portal" });
        return;
      }

      await fetchHospitalData(data.user.user_metadata.hospital_id);
      toast({ title: "Welcome!" });
    } catch (error: any) {
      console.error("Login error:", error);
      toast({ variant: "destructive", title: "Login failed", description: error.message || "Login failed" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setHospital(null);
    setEmail("");
    setPassword("");
    toast({ title: "Logged out successfully" });
  };

  // Loading state
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <div className="text-center">
          <Building2 className="h-12 w-12 mx-auto text-primary animate-pulse" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Login Screen
  if (!hospital) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
          <div className="flex items-center justify-between px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Hospital Portal</h1>
            <div className="w-10" />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-md rounded-2xl">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="text-2xl">Hospital Portal</CardTitle>
              <CardDescription>
                Login with your hospital credentials to manage blood stock
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="hospital@example.com"
                      className="pl-10 rounded-xl"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="pl-10 pr-10 rounded-xl"
                      disabled={isLoading}
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleLogin}
                disabled={!email || !password || isLoading}
                className="w-full h-12 rounded-xl"
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Contact admin for portal access
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Hospital Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{hospital.name}</h1>
              <p className="text-xs text-muted-foreground">
                {hospital.island}, {hospital.atoll}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="rounded-full text-destructive hover:text-destructive"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Blood Unit Manager */}
      <div className="p-4">
        <BloodUnitManager hospitalId={hospital.id} />
      </div>
    </div>
  );
};

export default HospitalPortal;
