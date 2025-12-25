import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Heart, CheckCircle, XCircle, Droplet, Activity, Sparkles, ChevronRight } from "lucide-react";
import BloodRequests from "@/components/BloodRequests";
import { BottomNav } from "@/components/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";

const BloodRequestsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [filter, setFilter] = useState("active");
  const [stats, setStats] = useState({ active: 0, fulfilled: 0, expired: 0 });

  useEffect(() => {
    if (highlightId) {
      const timer = setTimeout(() => {
        navigate("/blood-requests", { replace: true });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [highlightId, navigate]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { data } = await supabase
      .from("blood_requests")
      .select("status");
    
    if (data) {
      setStats({
        active: data.filter(r => r.status === "active").length,
        fulfilled: data.filter(r => r.status === "fulfilled").length,
        expired: data.filter(r => r.status === "expired").length,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto max-w-lg">
        {/* Hero Section - Like Profile Page */}
        <div className="relative">
          <div className="h-20 bg-gradient-to-br from-destructive via-destructive/80 to-destructive/60 rounded-b-3xl" />
          
          <div className="px-4 -mt-8 relative z-10">
            <Card className="rounded-2xl border-border/50 shadow-lg overflow-hidden">
              <CardContent className="p-0">
                {/* Header */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-destructive to-destructive/70 flex items-center justify-center shadow-lg">
                        <Droplet className="h-7 w-7 text-destructive-foreground" />
                      </div>
                      <div>
                        <h1 className="text-lg font-bold">Blood Requests</h1>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Help save lives today
                        </p>
                      </div>
                    </div>
                    
                    <Button 
                      size="sm" 
                      className="rounded-xl"
                      onClick={() => navigate("/request-blood")}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      New
                    </Button>
                  </div>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-3 border-t border-border bg-muted/30">
                  <button 
                    className={`py-3 text-center transition-colors ${filter === 'active' ? 'bg-muted/50' : 'hover:bg-muted/30'}`}
                    onClick={() => setFilter('active')}
                  >
                    <p className="text-xl font-bold text-destructive">{stats.active}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Open</p>
                  </button>
                  <button 
                    className={`py-3 text-center border-x border-border transition-colors ${filter === 'fulfilled' ? 'bg-muted/50' : 'hover:bg-muted/30'}`}
                    onClick={() => setFilter('fulfilled')}
                  >
                    <p className="text-xl font-bold text-green-500">{stats.fulfilled}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Done</p>
                  </button>
                  <button 
                    className={`py-3 text-center transition-colors ${filter === 'expired' ? 'bg-muted/50' : 'hover:bg-muted/30'}`}
                    onClick={() => setFilter('expired')}
                  >
                    <p className="text-xl font-bold text-muted-foreground">{stats.expired}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Expired</p>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 mt-4">
          <Tabs value={filter} onValueChange={setFilter} className="w-full">
            <TabsList className="w-full bg-muted/50 p-1 rounded-xl mb-4">
              <TabsTrigger value="active" className="flex-1 rounded-lg text-xs gap-1">
                <Heart className="h-3.5 w-3.5" />
                Open
              </TabsTrigger>
              <TabsTrigger value="fulfilled" className="flex-1 rounded-lg text-xs gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                Done
              </TabsTrigger>
              <TabsTrigger value="expired" className="flex-1 rounded-lg text-xs gap-1">
                <XCircle className="h-3.5 w-3.5" />
                Expired
              </TabsTrigger>
            </TabsList>

            {/* Requests List */}
            <Card className="rounded-2xl border-border/50">
              <CardContent className="p-4">
                <TabsContent value="active" className="mt-0">
                  <BloodRequests status="active" highlightId={highlightId} />
                </TabsContent>
                <TabsContent value="fulfilled" className="mt-0">
                  <BloodRequests status="fulfilled" highlightId={highlightId} />
                </TabsContent>
                <TabsContent value="expired" className="mt-0">
                  <BloodRequests status="expired" highlightId={highlightId} />
                </TabsContent>
              </CardContent>
            </Card>
          </Tabs>
        </div>
      </main>

      {/* Floating Add Button */}
      <Button
        size="lg"
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-xl z-50 bg-destructive hover:bg-destructive/90"
        onClick={() => navigate("/request-blood")}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <BottomNav />
    </div>
  );
};

export default BloodRequestsPage;