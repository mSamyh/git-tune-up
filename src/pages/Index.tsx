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
    return <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary animate-pulse">
              <Droplet className="h-12 w-12 text-primary-foreground" />
            </div>
            <h1 className="text-5xl font-bold mb-4 text-foreground">LeyHadhiya</h1>
            <p className="text-xl text-muted-foreground mb-8">Blood donors network - Save lives by donating blood</p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" onClick={() => navigate("/auth")}>
                <Heart className="mr-2 h-5 w-5" />
                Get Started
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-card p-6 rounded-lg shadow-md text-center">
              <UserCheck className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold text-lg mb-2">Easy Registration</h3>
              <p className="text-muted-foreground">Register with OTP verification</p>
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

          <footer className="mt-16 text-center pb-8">
            <p className="text-muted-foreground mb-2 flex items-center justify-center gap-1">
              Built with <Heart className="h-4 w-4 text-red-500 fill-red-500 inline animate-pulse border rounded-none shadow-none opacity-85" /> to connect with donors
            </p>
            <Button variant="link" onClick={() => navigate("/faq")} className="text-primary hover:underline p-0 h-auto">
              FAQ
            </Button>
          </footer>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <BloodGroupFilter selectedGroup={selectedBloodGroup} onSelectGroup={setSelectedBloodGroup} />
        </div>
        
        <DonorTable bloodGroupFilter={selectedBloodGroup} />

        <footer className="mt-16 text-center pb-8">
          <p className="text-muted-foreground mb-2 flex items-center justify-center gap-1">
            Built with <Heart className="h-4 w-4 text-red-500 fill-red-500 inline animate-pulse" /> to connect with donors
          </p>
          <Button variant="link" onClick={() => navigate("/faq")} className="text-primary hover:underline p-0 h-auto">
            FAQ
          </Button>
        </footer>
      </main>

      <BottomNav />
    </div>;
};
export default Index;