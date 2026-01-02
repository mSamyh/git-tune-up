import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Heart, CheckCircle, XCircle, Droplet, Sparkles, Clock, Activity, AlertTriangle } from "lucide-react";
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

      <main className="container mx-auto max-w-lg px-4">
        {/* Hero Section with gradient */}
        <div className="relative mb-6">
          <div className="absolute inset-0 h-32 bg-gradient-to-br from-destructive/20 via-destructive/10 to-transparent rounded-3xl" />
          
          <div className="relative pt-4 px-1">
            {/* Main Header Card */}
            <Card className="rounded-2xl border-border/50 shadow-lg overflow-hidden">
              <CardContent className="p-0">
                {/* Hero Row */}
                <div className="p-5 pb-4 flex items-start gap-4">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-destructive to-destructive/70 flex items-center justify-center shadow-lg">
                      <Droplet className="h-8 w-8 text-destructive-foreground" />
                    </div>
                    {urgentCount > 0 && (
                      <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center shadow-md animate-pulse">
                        <span className="text-[10px] font-bold text-white">{urgentCount}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h1 className="text-xl font-bold mb-1">Blood Requests</h1>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Help save lives in your community
                    </p>
                    {urgentCount > 0 && (
                      <Badge variant="destructive" className="mt-2 text-[10px] gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {urgentCount} urgent request{urgentCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    className="rounded-xl shadow-md"
                    onClick={() => navigate("/request-blood")}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    New
                  </Button>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 border-t border-border bg-muted/30">
                  <button 
                    className={`py-4 text-center transition-all relative ${
                      filter === 'active' 
                        ? 'bg-destructive/10' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setFilter('active')}
                  >
                    {filter === 'active' && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-12 bg-destructive rounded-full" />
                    )}
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Heart className={`h-4 w-4 ${filter === 'active' ? 'text-destructive' : 'text-muted-foreground'}`} />
                      <p className={`text-xl font-bold ${filter === 'active' ? 'text-destructive' : ''}`}>
                        {stats.active}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Active</p>
                  </button>
                  <button 
                    className={`py-4 text-center border-x border-border transition-all relative ${
                      filter === 'fulfilled' 
                        ? 'bg-green-500/10' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setFilter('fulfilled')}
                  >
                    {filter === 'fulfilled' && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-12 bg-green-500 rounded-full" />
                    )}
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <CheckCircle className={`h-4 w-4 ${filter === 'fulfilled' ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <p className={`text-xl font-bold ${filter === 'fulfilled' ? 'text-green-500' : ''}`}>
                        {stats.fulfilled}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Fulfilled</p>
                  </button>
                  <button 
                    className={`py-4 text-center transition-all relative ${
                      filter === 'expired' 
                        ? 'bg-muted' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setFilter('expired')}
                  >
                    {filter === 'expired' && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-12 bg-muted-foreground rounded-full" />
                    )}
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Clock className={`h-4 w-4 text-muted-foreground`} />
                      <p className="text-xl font-bold text-muted-foreground">{stats.expired}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Expired</p>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <Tabs value={filter} onValueChange={setFilter} className="w-full">
            <TabsList className="w-full bg-muted/50 p-1 rounded-xl mb-4 h-11">
              <TabsTrigger value="active" className="flex-1 rounded-lg text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Heart className="h-3.5 w-3.5" />
                Active
              </TabsTrigger>
              <TabsTrigger value="fulfilled" className="flex-1 rounded-lg text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <CheckCircle className="h-3.5 w-3.5" />
                Fulfilled
              </TabsTrigger>
              <TabsTrigger value="expired" className="flex-1 rounded-lg text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <XCircle className="h-3.5 w-3.5" />
                Expired
              </TabsTrigger>
            </TabsList>

            {/* Requests List */}
            <Card className="rounded-2xl border-border/50 shadow-sm">
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