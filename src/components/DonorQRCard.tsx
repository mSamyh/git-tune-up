import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Droplet, Download, Share2, Shield, Sparkles, CheckCircle2 } from "lucide-react";
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
        width: 220,
        margin: 1,
        color: {
          dark: "#0b1220",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
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
    const status = donor?.availability_status || "available";

    // Honor manual unavailable / reserved status first — overrides 90-day calc
    if (status === "reserved") {
      return { eligible: false, text: "Reserved", daysLeft: 0 };
    }
    if (status === "unavailable") {
      // Show cooldown if applicable, else generic unavailable
      if (donor?.last_donation_date) {
        const daysSince = Math.floor(
          (new Date().getTime() - new Date(donor.last_donation_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSince < 90) {
          return { eligible: false, text: `${90 - daysSince}d wait`, daysLeft: 90 - daysSince };
        }
      }
      return { eligible: false, text: "Unavailable", daysLeft: 0 };
    }

    // status === 'available' (or unknown) — still respect 90-day medical rule
    if (donor?.last_donation_date) {
      const daysSince = Math.floor(
        (new Date().getTime() - new Date(donor.last_donation_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince < 90) {
        return { eligible: false, text: `${90 - daysSince}d wait`, daysLeft: 90 - daysSince };
      }
    }
    return { eligible: true, text: "Eligible", daysLeft: 0 };
  };

  if (!donor) return null;

  const eligibility = getEligibilityStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden bg-transparent border-0 shadow-none">
        <DialogTitle className="sr-only">Donor ID Card</DialogTitle>

        {/* Premium ID Card */}
        <div className="relative">
          <div
            id="donor-id-card"
            className="relative rounded-3xl overflow-hidden shadow-2xl bg-[hsl(222_45%_11%)]"
          >
            {/* Mesh gradient background */}
            <div
              className="absolute inset-0 opacity-90 pointer-events-none"
              style={{
                background:
                  "radial-gradient(120% 80% at 0% 0%, hsl(0 72% 50% / 0.35) 0%, transparent 55%), radial-gradient(120% 80% at 100% 100%, hsl(265 70% 55% / 0.28) 0%, transparent 55%), linear-gradient(135deg, hsl(222 45% 9%) 0%, hsl(222 45% 13%) 100%)",
              }}
            />

            {/* Subtle grid texture */}
            <div
              className="absolute inset-0 opacity-[0.06] pointer-events-none mix-blend-overlay"
              style={{
                backgroundImage:
                  "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />

            {/* Shimmer */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer-slow_4s_ease-in-out_infinite]" />
            </div>

            {/* Header */}
            <div className="relative px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-gradient-to-br from-primary to-[hsl(354_78%_42%)] p-2 rounded-xl shadow-lg shadow-primary/30">
                    <Droplet className="h-5 w-5 text-white fill-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-sm tracking-wide">LeyHadhiya</h2>
                    <p className="text-white/50 text-[10px] tracking-wider uppercase">Blood Donor Network</p>
                  </div>
                </div>

                <Badge
                  className={`${
                    eligibility.eligible
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
                      : "bg-amber-500/15 text-amber-300 border-amber-400/30"
                  } border text-[10px] px-2 py-0.5 backdrop-blur-md ${
                    eligibility.eligible ? "animate-pulse" : ""
                  }`}
                >
                  <Shield className="h-2.5 w-2.5 mr-1" />
                  {eligibility.text}
                </Badge>
              </div>
            </div>

            {/* Donor Info */}
            <div className="relative px-5 py-4">
              <div className="flex items-start gap-4">
                {/* Avatar with halo */}
                <div className="relative">
                  <div
                    className={`absolute -inset-1 rounded-full blur-md opacity-60 ${
                      eligibility.eligible ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  />
                  <div
                    className={`relative ${
                      eligibility.eligible ? "ring-2 ring-emerald-400/60" : "ring-2 ring-amber-400/60"
                    } ring-offset-2 ring-offset-[hsl(222_45%_11%)] rounded-full`}
                  >
                    <Avatar className="h-16 w-16 border-2 border-white/15">
                      <AvatarImage src={donor.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/40 to-primary/10 text-white text-lg font-bold">
                        {donor.full_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  {eligibility.eligible && (
                    <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 rounded-full p-1 shadow-md shadow-emerald-500/40">
                      <CheckCircle2 className="h-3 w-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>

                {/* Name & details */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-base truncate">{donor.full_name}</h3>
                  <p className="text-white/40 text-[11px] mt-0.5 font-mono tracking-wider">
                    ID · {getDonorId()}
                  </p>

                  {/* Blood Type Pill */}
                  <div className="mt-2.5 inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/15 shadow-inner">
                    <Droplet className="h-3.5 w-3.5 text-primary fill-primary" />
                    <span className="text-white font-black text-lg leading-none">{donor.blood_group}</span>
                    <Sparkles className="h-3 w-3 text-white/40" />
                  </div>
                </div>
              </div>
            </div>

            {/* QR Section */}
            <div className="relative mx-5 mb-4">
              <div className="bg-white rounded-2xl p-3 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 relative">
                    {/* Corner accents */}
                    <div className="absolute -top-0.5 -left-0.5 w-3 h-3 border-t-2 border-l-2 border-primary rounded-tl-md" />
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 border-t-2 border-r-2 border-primary rounded-tr-md" />
                    <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 border-b-2 border-l-2 border-primary rounded-bl-md" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-b-2 border-r-2 border-primary rounded-br-md" />
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="Donor QR Code" className="w-24 h-24 rounded-md" />
                    ) : (
                      <div className="w-24 h-24 bg-slate-100 rounded-md animate-pulse" />
                    )}
                  </div>

                  <div className="flex-1">
                    <p className="text-slate-900 text-xs font-semibold mb-0.5">Scan to Verify</p>
                    <p className="text-slate-500 text-[10px] leading-relaxed">
                      Hospitals can scan this code to verify donor eligibility instantly.
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1 text-[9px] text-emerald-600 font-medium">
                      <Shield className="h-2.5 w-2.5" />
                      Secured & Verified
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="relative px-5 pb-4">
              <div className="flex items-center justify-center gap-2 text-white/40 text-[10px]">
                <div className="h-px flex-1 bg-white/10" />
                <span className="tracking-widest uppercase">Valid Donor Card</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
            </div>

            {/* Holographic accent bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            className="flex-1 bg-card/60 backdrop-blur-md border-border/60 rounded-xl shadow-sm hover:shadow-md"
            onClick={downloadCard}
          >
            <Download className="h-4 w-4 mr-2" />
            Save QR
          </Button>
          <Button
            variant="gradient"
            className="flex-1 rounded-xl"
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
