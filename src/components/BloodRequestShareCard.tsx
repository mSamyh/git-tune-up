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

    // === BACKGROUND ===
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#ef4444");
    bgGrad.addColorStop(0.5, "#dc2626");
    bgGrad.addColorStop(1, "#991b1b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle decorative circles
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(920, 80, 220, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(160, 1280, 200, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // === MAIN CARD ===
    const cardX = 56, cardY = 56, cardW = W - 112, cardH = H - 180;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 48;
    ctx.shadowOffsetY = 8;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 36);
    ctx.fill();
    ctx.shadowColor = "transparent";

    // === URGENCY BANNER ===
    const bannerH = 72;
    const bannerColor = request.urgency === "critical" ? "#dc2626" : request.urgency === "urgent" ? "#ea580c" : "#dc2626";
    ctx.fillStyle = bannerColor;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, bannerH, [36, 36, 0, 0]);
    ctx.fill();

    // Urgency text - left aligned
    ctx.fillStyle = "#fff";
    ctx.font = "bold 26px 'Arial', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`🩸  ${urgencyConfig.label} BLOOD NEEDED`, cardX + 36, cardY + 46);

    // Countdown - right aligned
    if (request.needed_before) {
      const countdown = formatCountdown(request.needed_before);
      ctx.textAlign = "right";
      ctx.font = "bold 24px 'Arial', sans-serif";
      ctx.fillText(`⏱ ${countdown.text}`, cardX + cardW - 36, cardY + 46);
    }

    // === BLOOD GROUP HERO ===
    const heroY = cardY + bannerH + 40;
    // Blood group ring
    const ringCX = W / 2, ringCY = heroY + 100, ringR = 90;
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(ringCX, ringCY, ringR, 0, Math.PI * 2);
    ctx.stroke();
    // Blood group text
    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 88px 'Arial', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(request.blood_group, ringCX, ringCY + 2);
    ctx.textBaseline = "alphabetic";

    // === UNITS BADGE ===
    const unitsY = heroY + 210;
    const unitsText = `${request.units_needed} UNIT${request.units_needed > 1 ? "S" : ""} REQUIRED`;
    ctx.font = "bold 20px 'Arial', sans-serif";
    const unitsW = ctx.measureText(unitsText).width + 56;
    ctx.fillStyle = "#fef2f2";
    ctx.beginPath();
    ctx.roundRect((W - unitsW) / 2, unitsY, unitsW, 44, 22);
    ctx.fill();
    ctx.fillStyle = "#dc2626";
    ctx.textAlign = "center";
    ctx.fillText(unitsText, W / 2, unitsY + 29);

    // === DIVIDER ===
    const divY = unitsY + 72;
    const grad = ctx.createLinearGradient(cardX + 60, divY, cardX + cardW - 60, divY);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.2, "#e5e7eb");
    grad.addColorStop(0.8, "#e5e7eb");
    grad.addColorStop(1, "transparent");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cardX + 60, divY);
    ctx.lineTo(cardX + cardW - 60, divY);
    ctx.stroke();

    // === INFO SECTION ===
    const infoX = cardX + 80;
    const infoRight = cardX + cardW - 80;
    let infoY = divY + 48;

    const drawInfoRow = (emoji: string, label: string, value: string, subValue?: string, subColor?: string) => {
      ctx.fillStyle = "#9ca3af";
      ctx.font = "600 16px 'Arial', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${emoji}  ${label}`, infoX, infoY);
      infoY += 32;
      ctx.fillStyle = "#111827";
      ctx.font = "bold 28px 'Arial', sans-serif";
      // Truncate long text
      let displayVal = value;
      while (ctx.measureText(displayVal).width > infoRight - infoX && displayVal.length > 3) {
        displayVal = displayVal.slice(0, -1);
      }
      if (displayVal !== value) displayVal += "…";
      ctx.fillText(displayVal, infoX, infoY);
      infoY += 10;
      if (subValue) {
        infoY += 28;
        ctx.fillStyle = subColor || "#111827";
        ctx.font = "bold 28px 'Arial', sans-serif";
        ctx.fillText(subValue, infoX, infoY);
        infoY += 10;
      }
      infoY += 32;
    };

    drawInfoRow("👤", "PATIENT", request.patient_name);
    drawInfoRow("📍", "HOSPITAL", request.hospital_name);
    drawInfoRow("📞", "CONTACT", request.contact_name, request.contact_phone, "#dc2626");

    // === QR CODE ===
    if (qrDataUrl) {
      const qrImage = new Image();
      qrImage.onload = () => {
        const qrSize = 160;
        const qrContW = qrSize + 48;
        const qrContH = qrSize + 64;
        const qrContX = (W - qrContW) / 2;
        const qrContY = infoY + 8;

        // QR container bg
        ctx.fillStyle = "#f9fafb";
        ctx.beginPath();
        ctx.roundRect(qrContX, qrContY, qrContW, qrContH, 20);
        ctx.fill();
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(qrContX, qrContY, qrContW, qrContH, 20);
        ctx.stroke();

        // QR image
        ctx.drawImage(qrImage, qrContX + 24, qrContY + 16, qrSize, qrSize);

        // Scan label
        ctx.fillStyle = "#6b7280";
        ctx.font = "500 15px 'Arial', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Scan to respond", W / 2, qrContY + qrSize + 44);

        // === CARD FOOTER ===
        ctx.fillStyle = "#9ca3af";
        ctx.font = "16px 'Arial', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("❤️  LeyHadhiya Blood Donor Platform", W / 2, cardY + cardH - 32);

        // === BOTTOM URL BAR ===
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.beginPath();
        ctx.roundRect(180, H - 100, W - 360, 56, 28);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px 'Arial', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("leyhadhiya.lovable.app", W / 2, H - 64);

        // Download as image
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = `blood-request-${request.blood_group}-${request.id.slice(0, 8)}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
          toast({ title: "Image saved!", description: "Instagram-ready card downloaded (4:5 ratio)" });
        }, "image/png");
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
