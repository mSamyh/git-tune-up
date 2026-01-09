import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Share2, Download, Clock, MapPin, Droplet, Heart, AlertTriangle, Copy, Check, Sparkles } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "@/hooks/use-toast";

interface BloodRequestShareCardProps {
  request: {
    id: string;
    patient_name: string;
    blood_group: string;
    units_needed: number;
    hospital_name: string;
    urgency: string;
    needed_before?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BloodRequestShareCard = ({ request, open, onOpenChange }: BloodRequestShareCardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const platformUrl = `${window.location.origin}/requests?highlight=${request.id}`;

  useEffect(() => {
    if (open) {
      generateQR();
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
  }, [open, request.id]);

  const generateQR = async () => {
    try {
      const url = await QRCode.toDataURL(platformUrl, {
        width: 120,
        margin: 1,
        color: { dark: "#dc2626", light: "#ffffff" },
        errorCorrectionLevel: 'M'
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error("QR generation failed:", err);
    }
  };

  const formatCountdown = (neededBefore: string) => {
    const now = new Date();
    const deadline = new Date(neededBefore);
    const diff = deadline.getTime() - now.getTime();
    
    if (diff <= 0) return { text: "EXPIRED", isUrgent: true };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return { text: `${days}d ${hours % 24}h`, isUrgent: days <= 1 };
    }
    return { text: `${hours}h ${minutes}m`, isUrgent: hours <= 6 };
  };

  const getUrgencyConfig = () => {
    switch (request.urgency) {
      case 'critical':
        return { label: 'CRITICAL', bgClass: 'bg-red-600', pulseClass: 'animate-pulse' };
      case 'urgent':
        return { label: 'URGENT', bgClass: 'bg-orange-500', pulseClass: '' };
      default:
        return { label: 'NEEDED', bgClass: 'bg-primary', pulseClass: '' };
    }
  };

  const urgencyConfig = getUrgencyConfig();

  const downloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 600;
    canvas.height = 400;

    // Modern gradient background
    const gradient = ctx.createLinearGradient(0, 0, 600, 400);
    gradient.addColorStop(0, "#ef4444");
    gradient.addColorStop(0.5, "#dc2626");
    gradient.addColorStop(1, "#991b1b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 400);

    // Decorative circles
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(500, 50, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(50, 350, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // White card
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    ctx.beginPath();
    ctx.roundRect(30, 30, 540, 340, 20);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Urgency badge
    ctx.fillStyle = request.urgency === 'critical' ? "#dc2626" : "#f97316";
    ctx.beginPath();
    ctx.roundRect(40, 40, 140, 32, 16);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`🩸 ${urgencyConfig.label}`, 110, 62);

    // Blood group - hero element
    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 80px Arial";
    ctx.textAlign = "left";
    ctx.fillText(request.blood_group, 50, 150);

    // Units badge
    ctx.fillStyle = "#fef2f2";
    ctx.beginPath();
    ctx.roundRect(50, 165, 100, 28, 14);
    ctx.fill();
    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 14px Arial";
    ctx.fillText(`${request.units_needed} UNITS`, 100, 185);

    // Hospital info
    ctx.fillStyle = "#6b7280";
    ctx.font = "16px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`📍 ${request.hospital_name}`, 50, 230);

    // Countdown
    if (request.needed_before) {
      const countdown = formatCountdown(request.needed_before);
      ctx.fillStyle = countdown.isUrgent ? "#dc2626" : "#f97316";
      ctx.font = "bold 18px Arial";
      ctx.fillText(`⏰ ${countdown.text}`, 50, 265);
    }

    // QR Code
    if (qrDataUrl) {
      const qrImage = new Image();
      qrImage.onload = () => {
        // QR container with shadow
        ctx.fillStyle = "#f9fafb";
        ctx.beginPath();
        ctx.roundRect(430, 100, 130, 150, 12);
        ctx.fill();
        
        ctx.drawImage(qrImage, 445, 115, 100, 100);
        ctx.fillStyle = "#6b7280";
        ctx.font = "11px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Scan to donate", 495, 235);

        // Footer
        ctx.fillStyle = "#9ca3af";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText("LeyHadhiya Blood Donor Platform", 300, 355);
        
        // Heart icon simulation
        ctx.fillStyle = "#dc2626";
        ctx.font = "12px Arial";
        ctx.fillText("❤️", 185, 355);

        const link = document.createElement("a");
        link.download = `blood-request-${request.blood_group}-${request.id.slice(0, 8)}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast({ title: "Downloaded!", description: "Share card saved to your device" });
      };
      qrImage.src = qrDataUrl;
    }
  };

  const shareCard = async () => {
    const countdown = request.needed_before ? formatCountdown(request.needed_before) : null;
    const text = `🩸 ${urgencyConfig.label}: ${request.blood_group} Blood Needed!\n\n📍 ${request.hospital_name}\n💉 ${request.units_needed} Units Required${countdown ? `\n⏰ Needed: ${countdown.text}` : ''}\n\n🔗 ${platformUrl}\n\n#BloodDonation #SaveLives #LeyHadhiya`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${request.blood_group} Blood Needed - LeyHadhiya`,
          text,
          url: platformUrl,
        });
      } catch (err) {
        copyToClipboard(text);
      }
    } else {
      copyToClipboard(text);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied!", description: "Share text copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const countdown = request.needed_before ? formatCountdown(request.needed_before) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary via-primary to-destructive/90 p-5 text-white relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-10 -translate-x-10" />
          
          <DialogHeader className="relative z-10">
            <DialogTitle className="text-white flex items-center gap-2 text-lg font-semibold">
              <Share2 className="h-5 w-5" />
              Share Blood Request
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-4">
          {/* Preview Card - Dynamic & Modern */}
          <div 
            className={`bg-gradient-to-br from-card via-card to-muted/50 rounded-2xl border border-border/50 overflow-hidden shadow-lg transition-all duration-500 ${isAnimating ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
          >
            {/* Card Header with urgency */}
            <div className={`${urgencyConfig.bgClass} ${urgencyConfig.pulseClass} px-4 py-2.5 flex items-center justify-between`}>
              <div className="flex items-center gap-2 text-white">
                <Droplet className="h-4 w-4 fill-white" />
                <span className="text-sm font-bold tracking-wide">{urgencyConfig.label} BLOOD NEEDED</span>
              </div>
              {countdown && (
                <div className={`flex items-center gap-1 text-white/90 text-xs font-medium ${countdown.isUrgent ? 'animate-pulse' : ''}`}>
                  <Clock className="h-3 w-3" />
                  {countdown.text}
                </div>
              )}
            </div>

            {/* Card Body */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-4">
                {/* Blood Info */}
                <div className="flex-1 space-y-3">
                  {/* Blood Group Hero */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-primary tracking-tight">
                      {request.blood_group}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Blood Type</span>
                      <span className="text-sm font-bold text-foreground">{request.units_needed} Units</span>
                    </div>
                  </div>

                  {/* Hospital */}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm font-medium truncate">{request.hospital_name}</span>
                  </div>

                  {/* Patient */}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Heart className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm">For: {request.patient_name}</span>
                  </div>
                </div>

                {/* QR Code */}
                {qrDataUrl && (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="p-2 bg-white rounded-xl shadow-sm border border-border/30">
                      <img src={qrDataUrl} alt="QR Code" className="w-20 h-20" />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">Scan to help</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card Footer */}
            <div className="px-4 py-2.5 bg-muted/30 border-t border-border/30 flex items-center justify-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[11px] text-muted-foreground font-medium">LeyHadhiya Blood Donor Platform</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={shareCard} 
              className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 font-semibold"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Now
                </>
              )}
            </Button>
            <Button 
              onClick={downloadCard} 
              variant="outline" 
              className="flex-1 h-12 rounded-xl border-2 font-semibold hover:bg-muted"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          {/* Quick Copy Link */}
          <button
            onClick={() => copyToClipboard(platformUrl)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
          >
            <Copy className="h-3 w-3" />
            <span className="truncate max-w-[200px]">{platformUrl}</span>
          </button>
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </DialogContent>
    </Dialog>
  );
};
