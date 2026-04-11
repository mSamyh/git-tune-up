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

  // Instagram-optimized canvas (1080x1080 = 1:1 square)
  const downloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    // === BACKGROUND: Deep red gradient ===
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#C1121F");
    bgGrad.addColorStop(0.4, "#a01018");
    bgGrad.addColorStop(1, "#6b0f15");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle heartbeat line pattern
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    for (let row = 0; row < 5; row++) {
      const baseY = 120 + row * 220;
      ctx.beginPath();
      for (let x = 0; x < W; x += 4) {
        const phase = (x + row * 80) % 200;
        let y = baseY;
        if (phase > 70 && phase < 80) y = baseY - 30;
        else if (phase > 80 && phase < 90) y = baseY + 40;
        else if (phase > 90 && phase < 100) y = baseY - 20;
        else if (phase > 100 && phase < 110) y = baseY;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Subtle decorative blood drop shapes
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = "#fff";
    const drawDrop = (cx: number, cy: number, size: number) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - size);
      ctx.bezierCurveTo(cx + size * 0.6, cy - size * 0.3, cx + size * 0.7, cy + size * 0.4, cx, cy + size * 0.7);
      ctx.bezierCurveTo(cx - size * 0.7, cy + size * 0.4, cx - size * 0.6, cy - size * 0.3, cx, cy - size);
      ctx.fill();
    };
    drawDrop(920, 90, 60);
    drawDrop(130, 960, 50);
    drawDrop(980, 700, 40);
    drawDrop(60, 400, 35);
    ctx.globalAlpha = 1;

    // === TOP URGENCY BADGE ===
    const badgeW = 560;
    const badgeH = 56;
    const badgeX = (W - badgeW) / 2;
    const badgeY = 48;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 28);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px 'Arial', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const badgeLabel = request.urgency === "critical" ? "🚨 CRITICAL — BLOOD NEEDED" : "🚨 URGENT BLOOD NEEDED";
    ctx.fillText(badgeLabel, W / 2, badgeY + badgeH / 2);
    ctx.textBaseline = "alphabetic";

    // === COUNTDOWN (if available) ===
    if (request.needed_before) {
      const countdown = formatCountdown(request.needed_before);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      const cdW = 180;
      ctx.beginPath();
      ctx.roundRect((W - cdW) / 2, badgeY + badgeH + 12, cdW, 34, 17);
      ctx.fill();
      ctx.fillStyle = "#fecaca";
      ctx.font = "bold 16px 'Arial', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`⏱ ${countdown.text} remaining`, W / 2, badgeY + badgeH + 34);
    }

    // === CENTER WHITE CARD ===
    const cardW = W - 100;
    const cardH = 700;
    const cardX = 50;
    const cardY = 150;
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 32);
    ctx.fill();
    ctx.shadowColor = "transparent";

    // === BLOOD GROUP CIRCLE (hero) ===
    const circCX = W / 2;
    const circCY = cardY + 110;
    const circR = 72;
    // Red fill circle
    const circGrad = ctx.createRadialGradient(circCX, circCY, 0, circCX, circCY, circR);
    circGrad.addColorStop(0, "#ef4444");
    circGrad.addColorStop(1, "#C1121F");
    ctx.fillStyle = circGrad;
    ctx.beginPath();
    ctx.arc(circCX, circCY, circR, 0, Math.PI * 2);
    ctx.fill();
    // Outer ring
    ctx.strokeStyle = "#fecaca";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(circCX, circCY, circR + 8, 0, Math.PI * 2);
    ctx.stroke();
    // Blood group text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 64px 'Arial', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(request.blood_group, circCX, circCY + 2);
    ctx.textBaseline = "alphabetic";

    // === UNITS REQUIRED BADGE ===
    const unitsText = `${request.units_needed} UNIT${request.units_needed > 1 ? "S" : ""} REQUIRED`;
    ctx.font = "bold 20px 'Arial', sans-serif";
    const unitsMetric = ctx.measureText(unitsText).width + 48;
    const unitsY = circCY + circR + 32;
    ctx.fillStyle = "#fef2f2";
    ctx.beginPath();
    ctx.roundRect((W - unitsMetric) / 2, unitsY, unitsMetric, 40, 20);
    ctx.fill();
    ctx.fillStyle = "#C1121F";
    ctx.textAlign = "center";
    ctx.fillText(unitsText, W / 2, unitsY + 27);

    // === DIVIDER ===
    const divY = unitsY + 60;
    ctx.strokeStyle = "#f3f4f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 60, divY);
    ctx.lineTo(cardX + cardW - 60, divY);
    ctx.stroke();

    // === INFO ROWS ===
    const infoStartY = divY + 36;
    const infoLeftX = cardX + 72;
    const rowH = 72;

    const drawRow = (icon: string, label: string, value: string, y: number, valueColor?: string) => {
      // Icon circle
      ctx.fillStyle = "#fef2f2";
      ctx.beginPath();
      ctx.arc(infoLeftX + 2, y + 2, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.font = "20px 'Arial', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icon, infoLeftX + 2, y + 3);
      ctx.textBaseline = "alphabetic";

      // Label
      ctx.fillStyle = "#9ca3af";
      ctx.font = "600 15px 'Arial', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, infoLeftX + 38, y - 6);

      // Value (truncate if needed)
      ctx.fillStyle = valueColor || "#111827";
      ctx.font = "bold 22px 'Arial', sans-serif";
      const maxW = cardW - 200;
      let display = value;
      while (ctx.measureText(display).width > maxW && display.length > 3) {
        display = display.slice(0, -1);
      }
      if (display !== value) display += "…";
      ctx.fillText(display, infoLeftX + 38, y + 20);
    };

    drawRow("👤", "PATIENT", request.patient_name, infoStartY);
    drawRow("🏥", "HOSPITAL", request.hospital_name, infoStartY + rowH);
    drawRow("📞", "CONTACT", `${request.contact_name}  —  ${request.contact_phone}`, infoStartY + rowH * 2, "#C1121F");

    // === QR CODE SECTION ===
    if (qrDataUrl) {
      const qrImage = new Image();
      qrImage.onload = () => {
        const qrSectionY = infoStartY + rowH * 3 + 10;
        const qrSize = 120;

        // QR container
        ctx.fillStyle = "#f9fafb";
        ctx.beginPath();
        ctx.roundRect((W - qrSize - 40) / 2, qrSectionY, qrSize + 40, qrSize + 52, 16);
        ctx.fill();
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect((W - qrSize - 40) / 2, qrSectionY, qrSize + 40, qrSize + 52, 16);
        ctx.stroke();

        // QR image
        ctx.drawImage(qrImage, (W - qrSize) / 2, qrSectionY + 12, qrSize, qrSize);

        // Scan label
        ctx.fillStyle = "#6b7280";
        ctx.font = "500 13px 'Arial', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Scan to Respond", W / 2, qrSectionY + qrSize + 38);

        // === FOOTER ===
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath();
        ctx.roundRect(200, H - 72, W - 400, 44, 22);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 18px 'Arial', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("❤️  LeyHadhiya Blood Donor Platform", W / 2, H - 44);

        // Download
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = `blood-request-${request.blood_group}-${request.id.slice(0, 8)}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
          toast({ title: "Image saved!", description: "Instagram-ready card downloaded (1:1 square)" });
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
