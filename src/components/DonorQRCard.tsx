import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Droplet, Download, Share2 } from "lucide-react";
import QRCode from "qrcode";

interface DonorQRCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  donor: {
    id: string;
    full_name: string;
    blood_group: string;
    avatar_url: string | null;
    phone: string;
    last_donation_date: string | null;
    availability_status: string;
  } | null;
}

export const DonorQRCard = ({ open, onOpenChange, donor }: DonorQRCardProps) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  useEffect(() => {
    if (donor && open) {
      generateQRCode();
    }
  }, [donor, open]);

  const generateQRCode = async () => {
    if (!donor) return;
    
    const verificationUrl = `${window.location.origin}/verify-donor/${donor.id}`;
    
    try {
      const url = await QRCode.toDataURL(verificationUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: "#dc2626",
          light: "#ffffff",
        },
      });
      setQrCodeUrl(url);
    } catch (err) {
      console.error("Failed to generate QR code:", err);
    }
  };

  const downloadCard = () => {
    const cardElement = document.getElementById("donor-id-card");
    if (!cardElement) return;

    // Use html2canvas or similar for better results, but for now we'll share the QR
    if (qrCodeUrl) {
      const link = document.createElement("a");
      link.download = `donor-card-${donor?.full_name?.replace(/\s+/g, "-")}.png`;
      link.href = qrCodeUrl;
      link.click();
    }
  };

  const shareCard = async () => {
    if (!donor) return;
    
    const verificationUrl = `${window.location.origin}/verify-donor/${donor.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "LeyHadhiya Donor Card",
          text: `${donor.full_name}'s Blood Donor Card`,
          url: verificationUrl,
        });
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
      navigator.clipboard.writeText(verificationUrl);
    }
  };

  const getDonorId = () => {
    if (!donor) return "XXXX-XXXX";
    return donor.id.slice(0, 8).toUpperCase();
  };

  const getEligibilityStatus = () => {
    if (!donor?.last_donation_date) return { eligible: true, text: "Eligible" };
    
    const daysSince = Math.floor(
      (new Date().getTime() - new Date(donor.last_donation_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSince >= 90) {
      return { eligible: true, text: "Eligible" };
    }
    return { eligible: false, text: `Wait ${90 - daysSince} days` };
  };

  if (!donor) return null;

  const eligibility = getEligibilityStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-transparent border-0">
        <div
          id="donor-id-card"
          className="relative bg-gradient-to-br from-red-600 via-red-700 to-red-900 rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Header Pattern */}
          <div className="absolute top-0 left-0 right-0 h-32 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>

          {/* Card Content */}
          <div className="relative p-6">
            {/* Logo & Title */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                  <Droplet className="h-6 w-6 text-white fill-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg tracking-wide">LeyHadhiya</h2>
                  <p className="text-red-200 text-xs">Blood Donor Network</p>
                </div>
              </div>
              <Badge 
                className={`${
                  eligibility.eligible 
                    ? "bg-green-500/90 hover:bg-green-500" 
                    : "bg-amber-500/90 hover:bg-amber-500"
                } text-white border-0 text-xs`}
              >
                {eligibility.text}
              </Badge>
            </div>

            {/* Donor Info */}
            <div className="flex gap-4 mb-6">
              <Avatar className="h-20 w-20 border-4 border-white/30 shadow-lg">
                <AvatarImage src={donor.avatar_url || undefined} />
                <AvatarFallback className="bg-white/20 text-white text-xl font-bold">
                  {donor.full_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-white font-bold text-xl mb-1">{donor.full_name}</h3>
                <p className="text-red-200 text-sm mb-2">Donor ID: {getDonorId()}</p>
                <div className="flex items-center gap-2">
                  <div className="bg-white rounded-lg px-3 py-1.5 shadow-md">
                    <span className="text-red-600 font-black text-2xl">{donor.blood_group}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="bg-white rounded-xl p-4 mb-4 shadow-inner">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="Donor QR Code" className="w-28 h-28" />
                  ) : (
                    <div className="w-28 h-28 bg-gray-100 rounded animate-pulse" />
                  )}
                </div>
                <div className="flex-1 text-center">
                  <p className="text-gray-600 text-sm mb-1">Scan to verify</p>
                  <p className="text-gray-400 text-xs">Hospital staff can scan this QR code to verify donor eligibility</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center">
              <p className="text-red-200 text-xs">Valid Blood Donor Card</p>
            </div>
          </div>

          {/* Bottom Gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 via-white to-red-400" />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4 px-2">
          <Button
            variant="outline"
            className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
            onClick={downloadCard}
          >
            <Download className="h-4 w-4 mr-2" />
            Save QR
          </Button>
          <Button
            variant="outline"
            className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
            onClick={shareCard}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
