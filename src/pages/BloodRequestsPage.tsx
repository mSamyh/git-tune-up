import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import BloodRequests from "@/components/BloodRequests";
import { BottomNav } from "@/components/BottomNav";

const BloodRequestsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <BloodRequests />
      </main>

      <BottomNav />
    </div>
  );
};

export default BloodRequestsPage;
