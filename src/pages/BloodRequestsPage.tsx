import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Heart, CheckCircle, XCircle } from "lucide-react";
import BloodRequests from "@/components/BloodRequests";
import { BottomNav } from "@/components/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "@/components/AppHeader";

const BloodRequestsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [filter, setFilter] = useState("active");

  // Clear highlight from URL after mounting
  useEffect(() => {
    if (highlightId) {
      const timer = setTimeout(() => {
        navigate("/blood-requests", { replace: true });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [highlightId, navigate]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto px-4 py-6 max-w-lg space-y-4">
        {/* Header Card */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Blood Requests</h2>
            <Button 
              size="sm" 
              className="rounded-xl"
              onClick={() => navigate("/request-blood")}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Request
            </Button>
          </div>
          
          <Tabs value={filter} onValueChange={setFilter} className="w-full">
            <TabsList className="grid w-full grid-cols-3 rounded-xl h-10">
              <TabsTrigger value="active" className="rounded-lg gap-1 text-xs">
                <Heart className="h-3.5 w-3.5" />
                Open
              </TabsTrigger>
              <TabsTrigger value="fulfilled" className="rounded-lg gap-1 text-xs">
                <CheckCircle className="h-3.5 w-3.5" />
                Done
              </TabsTrigger>
              <TabsTrigger value="expired" className="rounded-lg gap-1 text-xs">
                <XCircle className="h-3.5 w-3.5" />
                Expired
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Requests List */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsContent value="active" className="mt-0">
              <BloodRequests status="active" highlightId={highlightId} />
            </TabsContent>
            <TabsContent value="fulfilled" className="mt-0">
              <BloodRequests status="fulfilled" highlightId={highlightId} />
            </TabsContent>
            <TabsContent value="expired" className="mt-0">
              <BloodRequests status="expired" highlightId={highlightId} />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Floating Add Button */}
      <Button
        size="lg"
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-xl z-50 bg-primary hover:bg-primary/90"
        onClick={() => navigate("/request-blood")}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <BottomNav />
    </div>
  );
};

export default BloodRequestsPage;
