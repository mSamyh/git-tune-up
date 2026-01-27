import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Droplet, Search, Heart, UserCheck, X, Users, BarChart3, GitCompare, ArrowRight, Sparkles, Shield, SlidersHorizontal } from "lucide-react";
import { DonorTable } from "@/components/DonorTable";
import { DonorStatsDashboard } from "@/components/DonorStatsDashboard";
import BloodCompatibilityChecker from "@/components/BloodCompatibilityChecker";
import { BottomNav } from "@/components/BottomNav";
import { BloodGroupFilter } from "@/components/BloodGroupFilter";
import { AppHeader } from "@/components/AppHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DonorFilterSheet } from "@/components/DonorFilterSheet";

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [selectedBloodGroup, setSelectedBloodGroup] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Filter states
  const [selectedAtoll, setSelectedAtoll] = useState("all");
  const [selectedIsland, setSelectedIsland] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [atolls, setAtolls] = useState<{ id: string; name: string }[]>([]);
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

  // Fetch atolls for filter with isMounted cleanup
  useEffect(() => {
    let isMounted = true;
    
    const fetchAtolls = async () => {
      try {
        const { data, error } = await supabase
          .from("atolls")
          .select("id, name")
          .order("name");
        
        if (error) throw error;
        if (isMounted && data) setAtolls(data);
      } catch (error) {
        console.error("Error fetching atolls:", error);
      }
    };
    
    fetchAtolls();
    return () => { isMounted = false; };
  }, []);

  // Count active filters
  const activeFilterCount = 
    (selectedAtoll !== "all" ? 1 : 0) + 
    (selectedIsland !== "all" ? 1 : 0) +
    (selectedStatus !== "all" ? 1 : 0);
  
  // Reset island when atoll changes
  const handleAtollChange = (atoll: string) => {
    setSelectedAtoll(atoll);
    setSelectedIsland("all");
  };

  // Unauthenticated landing page
  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        
        <main className="container mx-auto px-4 py-6 max-w-2xl">
          {/* Hero Section - Modern & Dynamic */}
          <section className="relative text-center py-10 animate-fade-in overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute top-10 left-1/4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
              <div className="absolute bottom-10 right-1/4 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
            </div>
            
            {/* Icon with glow effect */}
            <div className="relative inline-flex items-center justify-center mb-6">
              <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-xl scale-150" />
              <div className="relative h-20 w-20 rounded-3xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30">
                <Droplet className="h-10 w-10 text-white fill-white/30" />
              </div>
            </div>
            
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight mb-3 bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text">
              LeyHadhiya
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
              Connect with blood donors in your community. <span className="text-primary font-medium">Every donation saves lives.</span>
            </p>
            
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")} 
              className="rounded-2xl h-14 px-10 font-semibold text-base shadow-lg shadow-primary/25 btn-press group"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
            
            {/* Trust badges */}
            <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-primary" />
                Verified Donors
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                Free Forever
              </span>
            </div>
          </section>

          {/* Features - Modern Cards */}
          <section className="grid gap-4 py-8">
            {[
              { icon: UserCheck, title: "Easy Registration", desc: "Quick signup with phone verification", gradient: "from-emerald-500/10 to-emerald-500/5" },
              { icon: Search, title: "Find Donors", desc: "Search by blood type and location", gradient: "from-blue-500/10 to-blue-500/5" },
              { icon: Heart, title: "Request Blood", desc: "Post requests with SMS alerts", gradient: "from-primary/10 to-primary/5" },
            ].map(({ icon: Icon, title, desc, gradient }, i) => (
              <div 
                key={i}
                className={`group relative flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r ${gradient} border border-border/50 hover:border-primary/20 transition-all hover:shadow-md cursor-pointer`}
              >
                <div className="h-14 w-14 rounded-2xl bg-card border border-border/50 flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-lg">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            ))}
          </section>

          {/* Footer */}
          <footer className="py-8 text-center border-t border-border/50 mt-6">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mb-4">
              Built with <Heart className="h-3.5 w-3.5 text-primary fill-primary animate-pulse" /> for the community
            </p>
            <div className="flex items-center justify-center gap-6">
              <Button variant="link" onClick={() => navigate("/about")} className="text-muted-foreground hover:text-primary text-sm p-0 h-auto font-medium">
                About
              </Button>
              <Button variant="link" onClick={() => navigate("/faq")} className="text-muted-foreground hover:text-primary text-sm p-0 h-auto font-medium">
                FAQ
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/60 mt-5">© 2025 LeyHadhiya. All rights reserved.</p>
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
        {/* Tabs Navigation - Modern Pill Style */}
        <Tabs defaultValue="directory" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-12 rounded-2xl bg-muted/60 p-1.5 mb-5 shadow-inner">
            <TabsTrigger 
              value="directory" 
              className="rounded-xl flex items-center gap-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary transition-all"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Directory</span>
              <span className="sm:hidden">Donors</span>
            </TabsTrigger>
            <TabsTrigger 
              value="stats" 
              className="rounded-xl flex items-center gap-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary transition-all"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Statistics</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger 
              value="compatibility" 
              className="rounded-xl flex items-center gap-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary transition-all"
            >
              <GitCompare className="h-4 w-4" />
              <span className="hidden sm:inline">Compatibility</span>
              <span className="sm:hidden">Match</span>
            </TabsTrigger>
          </TabsList>

          {/* Directory Tab */}
          <TabsContent value="directory" className="mt-0 animate-fade-in">
            {/* Search Header - Clean & Floating */}
            <div className="sticky top-14 z-10 bg-background/90 backdrop-blur-xl -mx-4 px-4 py-3 border-b border-border/30">
              <div className="flex items-center gap-3 mb-3">
                <div className={`transition-all duration-300 ease-out ${isSearchExpanded ? 'flex-1' : 'flex-none'}`}>
                  {isSearchExpanded ? (
                    <div className="relative flex items-center animate-fade-in">
                      <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={searchInputRef}
                        placeholder="Search donors..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-11 rounded-xl bg-muted/50 border-border/50 pl-10 pr-10 text-sm placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 h-9 w-9 text-muted-foreground hover:text-foreground rounded-lg"
                        onClick={toggleSearch}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 rounded-xl border-border/50 bg-muted/30 hover:bg-muted/50"
                      onClick={toggleSearch}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {!isSearchExpanded && (
                  <>
                    <div className="flex-1">
                      <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                        <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Users className="h-4 w-4 text-primary" />
                        </span>
                        Donor Directory
                      </h2>
                    </div>
                    
                    {/* Filter Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilterSheetOpen(true)}
                      className="h-10 rounded-xl gap-1.5 border-border/50 bg-muted/30 hover:bg-muted/50"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      <span className="hidden sm:inline">Filters</span>
                      {activeFilterCount > 0 && (
                        <Badge className="h-5 min-w-5 p-0 text-xs flex items-center justify-center rounded-full">
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>
                  </>
                )}
              </div>

              <BloodGroupFilter selectedGroup={selectedBloodGroup} onSelectGroup={setSelectedBloodGroup} />
              
              {/* Active filter chips */}
              {(selectedAtoll !== "all" || selectedIsland !== "all" || selectedStatus !== "all") && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {selectedAtoll !== "all" && (
                    <Badge 
                      variant="secondary" 
                      className="gap-1.5 cursor-pointer hover:bg-secondary/80 pr-1.5"
                      onClick={() => handleAtollChange("all")}
                    >
                      {selectedAtoll}
                      <X className="h-3 w-3" />
                    </Badge>
                  )}
                  {selectedIsland !== "all" && (
                    <Badge 
                      variant="secondary" 
                      className="gap-1.5 cursor-pointer hover:bg-secondary/80 pr-1.5"
                      onClick={() => setSelectedIsland("all")}
                    >
                      {selectedIsland}
                      <X className="h-3 w-3" />
                    </Badge>
                  )}
                  {selectedStatus !== "all" && (
                    <Badge 
                      variant="secondary" 
                      className="gap-1.5 cursor-pointer hover:bg-secondary/80 pr-1.5 capitalize"
                      onClick={() => setSelectedStatus("all")}
                    >
                      {selectedStatus}
                      <X className="h-3 w-3" />
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Donor Table - Card container */}
            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden mt-4 shadow-sm">
              <DonorTable 
                bloodGroupFilter={selectedBloodGroup} 
                searchTerm={searchTerm}
                atollFilter={selectedAtoll}
                islandFilter={selectedIsland}
                statusFilter={selectedStatus}
              />
            </div>
          </TabsContent>
          
          {/* Filter Sheet */}
          <DonorFilterSheet
            open={filterSheetOpen}
            onOpenChange={setFilterSheetOpen}
            selectedAtoll={selectedAtoll}
            onAtollChange={handleAtollChange}
            selectedIsland={selectedIsland}
            onIslandChange={setSelectedIsland}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            atolls={atolls}
          />

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
          <div className="flex items-center justify-center gap-6">
            <Button variant="link" onClick={() => navigate("/about")} className="text-muted-foreground hover:text-primary text-sm p-0 h-auto font-medium">
              About
            </Button>
            <Button variant="link" onClick={() => navigate("/faq")} className="text-muted-foreground hover:text-primary text-sm p-0 h-auto font-medium">
              FAQ
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-4">© 2025 LeyHadhiya. All rights reserved.</p>
        </footer>
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;