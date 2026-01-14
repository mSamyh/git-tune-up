import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Droplet, Download, Share2, Shield, Sparkles } from "lucide-react";
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
        width: 180,
        margin: 1,
        color: {
          dark: "#1a1a2e",
          light: "#ffffff",
        },
        errorCorrectionLevel: 'M',
      });
      setQrCodeUrl(url);
    } catch (err) {
      console.error("Failed to generate QR code:", err);
    }
  };

  const downloadCard = () => {
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
    if (!donor?.last_donation_date) return { eligible: true, text: "Eligible", daysLeft: 0 };
    
    const daysSince = Math.floor(
      (new Date().getTime() - new Date(donor.last_donation_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSince >= 90) {
      return { eligible: true, text: "Eligible", daysLeft: 0 };
    }
    return { eligible: false, text: `${90 - daysSince}d wait`, daysLeft: 90 - daysSince };
  };

  if (!donor) return null;

  const eligibility = getEligibilityStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px] p-0 overflow-hidden bg-transparent border-0 shadow-none">
        {/* Modern ID Card */}
        <div className="relative">
          {/* Card Container with Glass Effect */}
          <div
            id="donor-id-card"
            className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl overflow-hidden shadow-2xl"
          >
            {/* Holographic Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-purple-500/10 pointer-events-none" />
            
            {/* Animated Shimmer Effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div 
                className="absolute inset-0 translate-x-[-100%] animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent"
                style={{ 
                  animation: 'shimmer 3s ease-in-out infinite',
                }}
              />
            </div>

            {/* Top Pattern with Logo */}
            <div className="relative px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-gradient-to-br from-primary to-red-700 p-2 rounded-xl shadow-lg">
                    <Droplet className="h-5 w-5 text-white fill-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-sm tracking-wide">LeyHadhiya</h2>
                    <p className="text-slate-400 text-[10px]">Blood Donor Network</p>
                  </div>
                </div>
                
                {/* Status Badge */}
                <Badge 
                  className={`${
                    eligibility.eligible 
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                      : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  } border text-[10px] px-2 py-0.5 backdrop-blur-sm ${eligibility.eligible ? 'animate-pulse' : ''}`}
                >
                  <Shield className="h-2.5 w-2.5 mr-1" />
                  {eligibility.text}
                </Badge>
              </div>
            </div>

            {/* Donor Info Section */}
            <div className="relative px-5 py-4">
              <div className="flex items-start gap-4">
                {/* Avatar with Ring */}
                <div className={`relative ${eligibility.eligible ? 'ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-slate-900' : ''} rounded-full`}>
                  <Avatar className="h-16 w-16 border-2 border-white/20">
                    <AvatarImage src={donor.avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-white text-lg font-bold">
                      {donor.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {eligibility.eligible && (
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1">
                      <Sparkles className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </div>
                
                {/* Name and Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-base truncate">{donor.full_name}</h3>
                  <p className="text-slate-400 text-xs mt-0.5">ID: {getDonorId()}</p>
                  
                  {/* Blood Type Badge */}
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10">
                    <Droplet className="h-3.5 w-3.5 text-primary fill-primary" />
                    <span className="text-white font-black text-lg">{donor.blood_group}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="relative mx-5 mb-4">
              <div className="bg-white rounded-2xl p-3 shadow-lg">
                <div className="flex items-center gap-3">
                  {/* QR Code */}
                  <div className="flex-shrink-0 bg-white rounded-xl p-1">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="Donor QR Code" className="w-24 h-24" />
                    ) : (
                      <div className="w-24 h-24 bg-slate-100 rounded-lg animate-pulse" />
                    )}
                  </div>
                  
                  {/* Scan Instructions */}
                  <div className="flex-1 text-center">
                    <p className="text-slate-800 text-xs font-medium mb-1">Scan to Verify</p>
                    <p className="text-slate-500 text-[10px] leading-relaxed">
                      Hospital staff can scan this QR code to verify donor eligibility
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="relative px-5 pb-4">
              <div className="flex items-center justify-center gap-2 text-slate-500 text-[10px]">
                <div className="h-px flex-1 bg-slate-700" />
                <span>Valid Blood Donor Card</span>
                <div className="h-px flex-1 bg-slate-700" />
              </div>
            </div>

            {/* Holographic Bottom Accent */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            className="flex-1 bg-slate-800/50 border-slate-700 text-white hover:bg-slate-800 hover:text-white rounded-xl"
            onClick={downloadCard}
          >
            <Download className="h-4 w-4 mr-2" />
            Save QR
          </Button>
          <Button
            variant="outline"
            className="flex-1 bg-slate-800/50 border-slate-700 text-white hover:bg-slate-800 hover:text-white rounded-xl"
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
