import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Droplet, Search, Heart, UserCheck } from "lucide-react";
import { DonorTable } from "@/components/DonorTable";
import { BottomNav } from "@/components/BottomNav";
import { BloodGroupFilter } from "@/components/BloodGroupFilter";
import { AppHeader } from "@/components/AppHeader";
const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [selectedBloodGroup, setSelectedBloodGroup] = useState("all");
  const navigate = useNavigate();
  useEffect(() => {
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        
        <main className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-8 text-center mb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <Droplet className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold mb-2 text-foreground">LeyHadhiya</h1>
            <p className="text-muted-foreground mb-6">Blood donors network - Save lives by donating blood</p>
            <Button size="lg" onClick={() => navigate("/auth")} className="rounded-xl">
              <Heart className="mr-2 h-5 w-5" />
              Get Started
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <div className="bg-card rounded-2xl border p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <UserCheck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Easy Registration</h3>
              <p className="text-sm text-muted-foreground">Register with OTP verification</p>
            </div>
            <div className="bg-card rounded-2xl border p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Find Donors</h3>
              <p className="text-sm text-muted-foreground">Search donors by blood group</p>
            </div>
            <div className="bg-card rounded-2xl border p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Heart className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Request Blood</h3>
              <p className="text-sm text-muted-foreground">Post urgent blood requests with SMS alerts</p>
            </div>
          </div>

          {/* Footer */}
          <footer className="text-center py-6">
            <p className="text-muted-foreground text-sm mb-2 flex items-center justify-center gap-1">
              Built with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> to connect with donors
            </p>
            <div className="flex items-center justify-center gap-3 mb-2">
              <Button variant="link" onClick={() => navigate("/about")} className="text-primary text-sm p-0 h-auto">
                About
              </Button>
              <span className="text-muted-foreground text-xs">•</span>
              <Button variant="link" onClick={() => navigate("/faq")} className="text-primary text-sm p-0 h-auto">
                FAQ
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">2025 - LeyHadhiya. All rights reserved</p>
          </footer>
        </main>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto px-4 py-6">
        {/* Blood Group Filter */}
        <div className="mb-6">
          <BloodGroupFilter selectedGroup={selectedBloodGroup} onSelectGroup={setSelectedBloodGroup} />
        </div>

        {/* Donor Table */}
        <div className="bg-card rounded-2xl border overflow-hidden">
          <DonorTable bloodGroupFilter={selectedBloodGroup} />
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center py-6">
          <p className="text-muted-foreground text-sm mb-2 flex items-center justify-center gap-1">
            Built with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> to connect with donors
          </p>
          <div className="flex items-center justify-center gap-3 mb-2">
            <Button variant="link" onClick={() => navigate("/about")} className="text-primary text-sm p-0 h-auto">
              About
            </Button>
            <span className="text-muted-foreground text-xs">•</span>
            <Button variant="link" onClick={() => navigate("/faq")} className="text-primary text-sm p-0 h-auto">
              FAQ
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">2025 - LeyHadhiya. All rights reserved</p>
        </footer>
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;