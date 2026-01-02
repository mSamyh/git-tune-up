import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Droplet, Search, Heart, UserCheck, X, Users, BarChart3, GitCompare } from "lucide-react";
import { DonorTable } from "@/components/DonorTable";
import { DonorStatsDashboard } from "@/components/DonorStatsDashboard";
import { BloodCompatibilityChecker } from "@/components/BloodCompatibilityChecker";
import { BottomNav } from "@/components/BottomNav";
import { BloodGroupFilter } from "@/components/BloodGroupFilter";
import { AppHeader } from "@/components/AppHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [selectedBloodGroup, setSelectedBloodGroup] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const toggleSearch = () => {
    setIsSearchExpanded(!isSearchExpanded);
    if (!isSearchExpanded) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchTerm("");
    }
  };
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
        {/* Tabs for Directory, Stats, and Compatibility */}
        <Tabs defaultValue="directory" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 rounded-xl h-11">
            <TabsTrigger value="directory" className="rounded-lg flex items-center gap-1.5 text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Directory</span>
              <span className="sm:hidden">Donors</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="rounded-lg flex items-center gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Statistics</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="compatibility" className="rounded-lg flex items-center gap-1.5 text-xs sm:text-sm">
              <GitCompare className="h-4 w-4" />
              <span className="hidden sm:inline">Compatibility</span>
              <span className="sm:hidden">Match</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="directory" className="mt-0">
            {/* Search and Filter Header */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md -mx-4 px-4 pb-4 pt-2">
              <div className="flex items-center gap-3 mb-4">
                {/* Expandable Search */}
                <div className={`transition-all duration-300 ${isSearchExpanded ? 'flex-1' : 'flex-none'}`}>
                  {isSearchExpanded ? (
                    <div className="relative flex items-center">
                      <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={searchInputRef}
                        placeholder="Search donors..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-10 rounded-xl border-border/30 bg-card/80 pl-9 pr-9 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 h-10 w-10"
                        onClick={toggleSearch}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl border-border/30 bg-card/80 hover:bg-primary/10"
                      onClick={toggleSearch}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Title */}
                {!isSearchExpanded && (
                  <div className="flex-1">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Donor Directory
                    </h1>
                  </div>
                )}
              </div>

              {/* Blood Group Filter */}
              <BloodGroupFilter selectedGroup={selectedBloodGroup} onSelectGroup={setSelectedBloodGroup} />
            </div>

            {/* Donor Table */}
            <div className="bg-card rounded-2xl border overflow-hidden mt-4">
              <DonorTable bloodGroupFilter={selectedBloodGroup} searchTerm={searchTerm} />
            </div>
          </TabsContent>

          <TabsContent value="stats" className="mt-0">
            <DonorStatsDashboard />
          </TabsContent>

          <TabsContent value="compatibility" className="mt-0">
            <BloodCompatibilityChecker />
          </TabsContent>
        </Tabs>

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