import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import BloodRequests from "@/components/BloodRequests";
import { BottomNav } from "@/components/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BloodRequestsPage = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("active");

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={() => navigate("/request-blood")}>
            <Plus className="h-4 w-4 mr-2" />
            Request Blood
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Blood Requests</h1>
          <p className="text-muted-foreground">View and manage blood donation requests</p>
        </div>

        <Tabs value={filter} onValueChange={setFilter} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">Open Requests</TabsTrigger>
            <TabsTrigger value="fulfilled">Fulfilled Requests</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-6">
            <BloodRequests status="active" />
          </TabsContent>
          <TabsContent value="fulfilled" className="mt-6">
            <BloodRequests status="fulfilled" />
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
    </div>
  );
};

export default BloodRequestsPage;
