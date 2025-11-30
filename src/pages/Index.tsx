import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Droplet, Search, Heart, LogOut } from "lucide-react";
import DonorDirectory from "@/components/DonorDirectory";
import BloodRequests from "@/components/BloodRequests";

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary animate-pulse">
              <Droplet className="h-12 w-12 text-primary-foreground" />
            </div>
            <h1 className="text-5xl font-bold mb-4 text-foreground">Blood Donor Management</h1>
            <p className="text-xl text-muted-foreground mb-8">Save lives by donating blood</p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" onClick={() => navigate("/auth")}>
                <Heart className="mr-2 h-5 w-5" />
                Get Started
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-card p-6 rounded-lg shadow-md text-center">
              <Droplet className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold text-lg mb-2">Easy Registration</h3>
              <p className="text-muted-foreground">Register as a donor with OTP verification</p>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-md text-center">
              <Search className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold text-lg mb-2">Find Donors</h3>
              <p className="text-muted-foreground">Search donors by blood group and location</p>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-md text-center">
              <Heart className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold text-lg mb-2">Request Blood</h3>
              <p className="text-muted-foreground">Post urgent blood requests with SMS alerts</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
              <Droplet className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Blood Donor</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/profile")}>
              Profile
            </Button>
            <Button variant="ghost" onClick={() => navigate("/request-blood")}>
              Request Blood
            </Button>
            <Button variant="ghost" onClick={() => navigate("/admin")}>
              Admin
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Blood Requests</h2>
          <p className="text-muted-foreground">Active blood donation requests</p>
        </div>
        <BloodRequests />

        <div className="mt-12 mb-8">
          <h2 className="text-3xl font-bold mb-2">Donor Directory</h2>
          <p className="text-muted-foreground">Find donors by blood group and district</p>
        </div>
        <DonorDirectory />
      </main>
    </div>
  );
};

export default Index;