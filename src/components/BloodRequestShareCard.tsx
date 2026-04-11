import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Share2, Download, Clock, MapPin, Droplet, Heart, Phone, User, Copy, Check, Sparkles } from "lucide-react";
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
    contact_name: string;
    contact_phone: string;
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
        width: 200,
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
        return { label: 'CRITICAL', bgClass: 'bg-red-600', pulseClass: 'animate-pulse', color: '#dc2626' };
      case 'urgent':
        return { label: 'URGENT', bgClass: 'bg-orange-500', pulseClass: '', color: '#f97316' };
      default:
        return { label: 'NEEDED', bgClass: 'bg-primary', pulseClass: '', color: '#dc2626' };
    }
  };

  const urgencyConfig = getUrgencyConfig();

  // Instagram-optimized canvas (1080x1350 = 4:5 ratio)
  const downloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080;
    const H = 1350;
    canvas.width = W;
    canvas.height = H;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#ef4444");
    bgGrad.addColorStop(0.4, "#dc2626");
    bgGrad.addColorStop(1, "#7f1d1d");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Decorative circles
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(900, 100, 200, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(100, 1200, 180, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(540, 700, 400, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Main white card
    const cardX = 60, cardY = 80, cardW = W - 120, cardH = H - 220;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 12;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 32);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Urgency banner at top of card
    const bannerColor = request.urgency === 'critical' ? '#dc2626' : request.urgency === 'urgent' ? '#f97316' : '#dc2626';
    ctx.fillStyle = bannerColor;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, 80, [32, 32, 0, 0]);
    ctx.fill();

    // Urgency label
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`🩸 ${urgencyConfig.label} BLOOD NEEDED`, W / 2, cardY + 52);

    // Countdown on banner right
    if (request.needed_before) {
      const countdown = formatCountdown(request.needed_before);
      ctx.font = "bold 22px Arial, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`⏰ ${countdown.text}`, cardX + cardW - 30, cardY + 52);
      ctx.textAlign = "center";
      ctx.fillText(`🩸 ${urgencyConfig.label}`, cardX + cardW / 2 - 80, cardY + 52);
    }

    // Blood group - hero
    const heroY = cardY + 160;
    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 140px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(request.blood_group, W / 2, heroY + 110);

    // Units badge below blood group
    const unitsY = heroY + 140;
    const unitsText = `${request.units_needed} UNIT${request.units_needed > 1 ? 'S' : ''} REQUIRED`;
    ctx.fillStyle = "#fef2f2";
    const unitsW = ctx.measureText(unitsText).width + 60;
    ctx.beginPath();
    ctx.roundRect((W - unitsW) / 2, unitsY, unitsW, 48, 24);
    ctx.fill();
    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.fillText(unitsText, W / 2, unitsY + 32);

    // Divider line
    const divY = unitsY + 80;
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cardX + 60, divY);
    ctx.lineTo(cardX + cardW - 60, divY);
    ctx.stroke();

    // Info section
    const infoY = divY + 40;
    ctx.textAlign = "left";
    const infoX = cardX + 80;

    // Patient name
    ctx.fillStyle = "#6b7280";
    ctx.font = "18px Arial, sans-serif";
    ctx.fillText("PATIENT", infoX, infoY);
    ctx.fillStyle = "#111827";
    ctx.font = "bold 26px Arial, sans-serif";
    ctx.fillText(request.patient_name, infoX, infoY + 35);

    // Hospital
    const hospY = infoY + 80;
    ctx.fillStyle = "#6b7280";
    ctx.font = "18px Arial, sans-serif";
    ctx.fillText("📍 HOSPITAL", infoX, hospY);
    ctx.fillStyle = "#111827";
    ctx.font = "bold 26px Arial, sans-serif";
    ctx.fillText(request.hospital_name, infoX, hospY + 35);

    // Contact section
    const contactY = hospY + 80;
    ctx.fillStyle = "#6b7280";
    ctx.font = "18px Arial, sans-serif";
    ctx.fillText("📞 CONTACT", infoX, contactY);
    ctx.fillStyle = "#111827";
    ctx.font = "bold 26px Arial, sans-serif";
    ctx.fillText(request.contact_name, infoX, contactY + 35);
    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 28px Arial, sans-serif";
    ctx.fillText(request.contact_phone, infoX, contactY + 72);

    // QR Code section
    if (qrDataUrl) {
      const qrImage = new Image();
      qrImage.onload = () => {
        // QR container
        const qrBoxSize = 180;
        const qrBoxX = (W - qrBoxSize) / 2;
        const qrBoxY = contactY + 110;

        ctx.fillStyle = "#f9fafb";
        ctx.beginPath();
        ctx.roundRect(qrBoxX - 20, qrBoxY, qrBoxSize + 40, qrBoxSize + 60, 16);
        ctx.fill();
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(qrBoxX - 20, qrBoxY, qrBoxSize + 40, qrBoxSize + 60, 16);
        ctx.stroke();

        ctx.drawImage(qrImage, qrBoxX, qrBoxY + 10, qrBoxSize, qrBoxSize);
        ctx.fillStyle = "#6b7280";
        ctx.font = "16px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Scan to respond", W / 2, qrBoxY + qrBoxSize + 40);

        // Footer inside card
        const footerY = cardY + cardH - 50;
        ctx.fillStyle = "#9ca3af";
        ctx.font = "18px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("❤️ LeyHadhiya Blood Donor Platform", W / 2, footerY);

        // Bottom CTA outside card
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.beginPath();
        ctx.roundRect(140, H - 110, W - 280, 60, 30);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px Arial, sans-serif";
        ctx.fillText("leyhadhiya.lovable.app", W / 2, H - 72);

        const link = document.createElement("a");
        link.download = `blood-request-${request.blood_group}-${request.id.slice(0, 8)}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast({ title: "Downloaded!", description: "Instagram-ready card saved (4:5 ratio)" });
      };
      qrImage.src = qrDataUrl;
    }
  };

  const shareCard = async () => {
    const countdown = request.needed_before ? formatCountdown(request.needed_before) : null;
    const text = `🩸 ${urgencyConfig.label}: ${request.blood_group} Blood Needed!\n\n📍 ${request.hospital_name}\n💉 ${request.units_needed} Units Required\n👤 Patient: ${request.patient_name}${countdown ? `\n⏰ Needed: ${countdown.text}` : ''}\n\n📞 Contact: ${request.contact_name}\n📱 ${request.contact_phone}\n\n🔗 ${platformUrl}\n\n#BloodDonation #SaveLives #LeyHadhiya`;

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
          {/* Preview Card */}
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

                  {/* Contact */}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Phone className="h-3 w-3 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{request.contact_name}</span>
                      <a href={`tel:${request.contact_phone}`} className="text-xs text-primary font-semibold">{request.contact_phone}</a>
                    </div>
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
