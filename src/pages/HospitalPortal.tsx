import { useState } from "react";
import { Building2, LogOut, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import HospitalStockManager from "@/components/hospital/HospitalStockManager";

interface Hospital {
  id: string;
  name: string;
  address: string | null;
  atoll: string | null;
  island: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
}

interface BloodStock {
  id: string;
  blood_group: string;
  units_available: number;
  units_reserved: number;
  expiry_date: string | null;
  status: string;
  notes: string | null;
  last_updated: string;
}

const HospitalPortal = () => {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [bloodStock, setBloodStock] = useState<BloodStock[]>([]);
  const [storedPin, setStoredPin] = useState("");

  const handleVerifyPin = async () => {
    if (pin.length !== 6) {
      toast.error("Please enter a 6-digit PIN");
      return;
    }

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-hospital-pin", {
        body: { pin },
      });

      if (error) throw error;

      if (data.success) {
        setHospital(data.hospital);
        setBloodStock(data.bloodStock || []);
        setStoredPin(pin);
        toast.success(`Welcome, ${data.hospital.name}!`);
      } else {
        toast.error(data.error || "Invalid PIN");
      }
    } catch (error: any) {
      console.error("Error verifying PIN:", error);
      toast.error(error.message || "Failed to verify PIN");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    setHospital(null);
    setBloodStock([]);
    setStoredPin("");
    setPin("");
    toast.info("Logged out successfully");
  };

  const handleStockUpdate = (newStock: BloodStock[]) => {
    setBloodStock(newStock);
  };

  // PIN Entry Screen
  if (!hospital) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
          <div className="flex items-center justify-between px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Hospital Portal</h1>
            <div className="w-10" />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="text-2xl">Hospital Portal</CardTitle>
              <p className="text-muted-foreground text-sm">
                Enter your 6-digit hospital PIN to manage blood stock
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  value={pin}
                  onChange={setPin}
                  maxLength={6}
                  disabled={isVerifying}
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="w-12 h-14 text-xl"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                onClick={handleVerifyPin}
                disabled={pin.length !== 6 || isVerifying}
                className="w-full h-12"
              >
                {isVerifying ? "Verifying..." : "Verify PIN"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Contact admin for portal access
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Hospital Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{hospital.name}</h1>
              <p className="text-xs text-muted-foreground">
                {hospital.island}, {hospital.atoll}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="rounded-full text-destructive hover:text-destructive"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Stock Manager */}
      <div className="p-4">
        <HospitalStockManager
          hospitalId={hospital.id}
          hospitalPin={storedPin}
          bloodStock={bloodStock}
          onStockUpdate={handleStockUpdate}
        />
      </div>
    </div>
  );
};

export default HospitalPortal;
