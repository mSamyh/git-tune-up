import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Droplet, Search, Heart, UserCheck, X, Users, BarChart3, GitCompare, ArrowRight } from "lucide-react";
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
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({
      data: { session }
    }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Unauthenticated landing page
  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          {/* Hero Section - Clean & Minimal */}
          <section className="text-center py-12 animate-fade-in">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-primary/10 mb-6">
              <Droplet className="h-10 w-10 text-primary" />
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight mb-3">
              LeyHadhiya
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
              Connect with blood donors in your community. Every donation saves lives.
            </p>
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")} 
              className="rounded-2xl h-12 px-8 font-semibold text-base shadow-primary-glow btn-press"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </section>

          {/* Features - Minimal Cards */}
          <section className="grid gap-4 md:grid-cols-3 py-8">
            <div className="group p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/20 transition-colors">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <UserCheck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold mb-1.5">Easy Registration</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Quick signup with phone verification
              </p>
            </div>
            <div className="group p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/20 transition-colors">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold mb-1.5">Find Donors</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Search by blood type and location
              </p>
            </div>
            <div className="group p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/20 transition-colors">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Heart className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold mb-1.5">Request Blood</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Post requests with SMS alerts
              </p>
            </div>
          </section>

          {/* Footer */}
          <footer className="py-8 text-center border-t border-border/50 mt-8">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mb-3">
              Built with <Heart className="h-3.5 w-3.5 text-primary fill-primary" /> for the community
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button variant="link" onClick={() => navigate("/about")} className="text-muted-foreground hover:text-primary text-sm p-0 h-auto font-medium">
                About
              </Button>
              <span className="text-border">•</span>
              <Button variant="link" onClick={() => navigate("/faq")} className="text-muted-foreground hover:text-primary text-sm p-0 h-auto font-medium">
                FAQ
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/70 mt-4">© 2025 LeyHadhiya. All rights reserved.</p>
          </footer>
        </main>
      </div>
    );
  }

  // Authenticated dashboard
  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto px-4 py-4 max-w-2xl">
        {/* Tabs Navigation */}
        <Tabs defaultValue="directory" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-12 rounded-2xl bg-secondary p-1 mb-5">
            <TabsTrigger 
              value="directory" 
              className="rounded-xl flex items-center gap-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Directory</span>
              <span className="sm:hidden">Donors</span>
            </TabsTrigger>
            <TabsTrigger 
              value="stats" 
              className="rounded-xl flex items-center gap-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Statistics</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger 
              value="compatibility" 
              className="rounded-xl flex items-center gap-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <GitCompare className="h-4 w-4" />
              <span className="hidden sm:inline">Compatibility</span>
              <span className="sm:hidden">Match</span>
            </TabsTrigger>
          </TabsList>

          {/* Directory Tab */}
          <TabsContent value="directory" className="mt-0 animate-fade-in">
            {/* Search Header */}
            <div className="sticky top-14 z-10 bg-background/80 backdrop-blur-xl -mx-4 px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-3 mb-3">
                <div className={`transition-all duration-300 ${isSearchExpanded ? 'flex-1' : 'flex-none'}`}>
                  {isSearchExpanded ? (
                    <div className="relative flex items-center">
                      <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={searchInputRef}
                        placeholder="Search donors by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-10 rounded-xl bg-secondary/50 border-0 pl-10 pr-10 text-sm placeholder:text-muted-foreground/60"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 h-10 w-10 text-muted-foreground hover:text-foreground"
                        onClick={toggleSearch}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-10 w-10 rounded-xl"
                      onClick={toggleSearch}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {!isSearchExpanded && (
                  <div className="flex-1">
                    <h2 className="font-display font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Donor Directory
                    </h2>
                  </div>
                )}
              </div>

              <BloodGroupFilter selectedGroup={selectedBloodGroup} onSelectGroup={setSelectedBloodGroup} />
            </div>

            {/* Donor Table */}
            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden mt-4 shadow-soft">
              <DonorTable bloodGroupFilter={selectedBloodGroup} searchTerm={searchTerm} />
            </div>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="mt-0 animate-fade-in">
            <DonorStatsDashboard />
          </TabsContent>

          {/* Compatibility Tab */}
          <TabsContent value="compatibility" className="mt-0 animate-fade-in">
            <BloodCompatibilityChecker />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <footer className="mt-10 pt-6 text-center border-t border-border/50">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mb-3">
            Built with <Heart className="h-3.5 w-3.5 text-primary fill-primary" /> for the community
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button variant="link" onClick={() => navigate("/about")} className="text-muted-foreground hover:text-primary text-sm p-0 h-auto font-medium">
              About
            </Button>
            <span className="text-border">•</span>
            <Button variant="link" onClick={() => navigate("/faq")} className="text-muted-foreground hover:text-primary text-sm p-0 h-auto font-medium">
              FAQ
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/70 mt-4">© 2025 LeyHadhiya. All rights reserved.</p>
        </footer>
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;