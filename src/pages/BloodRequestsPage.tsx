import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Heart, CheckCircle, XCircle, Droplet, Clock, AlertTriangle } from "lucide-react";
import BloodRequests from "@/components/BloodRequests";
import { BottomNav } from "@/components/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const BloodRequestsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [filter, setFilter] = useState("active");
  const [stats, setStats] = useState({ active: 0, fulfilled: 0, expired: 0 });
  const [urgentCount, setUrgentCount] = useState(0);

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
    
    // Subscribe to blood_requests changes to refresh stats
    const channel = supabase
      .channel('blood_requests_stats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blood_requests' },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStats = async () => {
    const { data } = await supabase
      .from("blood_requests")
      .select("status, urgency");
    
    if (data) {
      setStats({
        active: data.filter(r => r.status === "active").length,
        fulfilled: data.filter(r => r.status === "fulfilled").length,
        expired: data.filter(r => r.status === "expired").length,
      });
      setUrgentCount(data.filter(r => r.status === "active" && r.urgency === "Emergency").length);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto max-w-2xl px-4 py-4">
        {/* Header Section */}
        <section className="mb-6 animate-fade-in">
          <Card className="rounded-2xl border-border/50 overflow-hidden shadow-soft">
            <CardContent className="p-0">
              {/* Hero */}
              <div className="p-5 flex items-start gap-4">
                <div className="relative flex-shrink-0">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Droplet className="h-7 w-7 text-primary" />
                  </div>
                  {urgentCount > 0 && (
                    <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive flex items-center justify-center animate-pulse-soft">
                      <span className="text-[10px] font-bold text-destructive-foreground">{urgentCount}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="font-display text-xl font-bold mb-0.5">Blood Requests</h1>
                  <p className="text-sm text-muted-foreground">Help save lives in your community</p>
                  {urgentCount > 0 && (
                    <Badge variant="destructive" className="mt-2 text-[10px] gap-1 font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      {urgentCount} urgent
                    </Badge>
                  )}
                </div>
                <Button 
                  size="sm" 
                  className="rounded-xl shadow-sm flex-shrink-0"
                  onClick={() => navigate("/request-blood")}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 border-t border-border/50 bg-secondary/30">
                <button 
                  className={`py-4 text-center transition-all relative ${
                    filter === 'active' ? 'bg-primary/5' : 'hover:bg-secondary/50'
                  }`}
                  onClick={() => setFilter('active')}
                >
                  {filter === 'active' && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-10 bg-primary rounded-full" />
                  )}
                  <div className="flex items-center justify-center gap-1.5 mb-0.5">
                    <Heart className={`h-4 w-4 ${filter === 'active' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-lg font-semibold ${filter === 'active' ? 'text-primary' : ''}`}>
                      {stats.active}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Active</p>
                </button>
                <button 
                  className={`py-4 text-center border-x border-border/50 transition-all relative ${
                    filter === 'fulfilled' ? 'bg-green-500/5' : 'hover:bg-secondary/50'
                  }`}
                  onClick={() => setFilter('fulfilled')}
                >
                  {filter === 'fulfilled' && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-10 bg-green-500 rounded-full" />
                  )}
                  <div className="flex items-center justify-center gap-1.5 mb-0.5">
                    <CheckCircle className={`h-4 w-4 ${filter === 'fulfilled' ? 'text-green-500' : 'text-muted-foreground'}`} />
                    <span className={`text-lg font-semibold ${filter === 'fulfilled' ? 'text-green-600' : ''}`}>
                      {stats.fulfilled}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Fulfilled</p>
                </button>
                <button 
                  className={`py-4 text-center transition-all relative ${
                    filter === 'expired' ? 'bg-muted' : 'hover:bg-secondary/50'
                  }`}
                  onClick={() => setFilter('expired')}
                >
                  {filter === 'expired' && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-10 bg-muted-foreground rounded-full" />
                  )}
                  <div className="flex items-center justify-center gap-1.5 mb-0.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-lg font-semibold text-muted-foreground">{stats.expired}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Expired</p>
                </button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Content Tabs */}
        <Tabs value={filter} onValueChange={setFilter} className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-11 rounded-xl bg-secondary p-1 mb-4">
            <TabsTrigger 
              value="active" 
              className="rounded-lg text-xs gap-1.5 font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Heart className="h-3.5 w-3.5" />
              Active
            </TabsTrigger>
            <TabsTrigger 
              value="fulfilled" 
              className="rounded-lg text-xs gap-1.5 font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Fulfilled
            </TabsTrigger>
            <TabsTrigger 
              value="expired" 
              className="rounded-lg text-xs gap-1.5 font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <XCircle className="h-3.5 w-3.5" />
              Expired
            </TabsTrigger>
          </TabsList>

          {/* Requests List */}
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardContent className="p-4">
              <TabsContent value="active" className="mt-0">
                <BloodRequests status="active" highlightId={highlightId} onStatusChange={setFilter} />
              </TabsContent>
              <TabsContent value="fulfilled" className="mt-0">
                <BloodRequests status="fulfilled" highlightId={highlightId} onStatusChange={setFilter} />
              </TabsContent>
              <TabsContent value="expired" className="mt-0">
                <BloodRequests status="expired" highlightId={highlightId} onStatusChange={setFilter} />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </main>

      {/* Floating Add Button */}
      <Button
        size="lg"
        className="fixed bottom-24 right-4 h-14 w-14 rounded-2xl shadow-primary-glow z-50 btn-press"
        onClick={() => navigate("/request-blood")}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <BottomNav />
    </div>
  );
};

export default BloodRequestsPage;