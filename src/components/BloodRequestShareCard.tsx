import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Share2, Download, Clock, MapPin, Droplet } from "lucide-react";
import QRCode from "qrcode";

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

  const platformUrl = `${window.location.origin}/requests?highlight=${request.id}`;

  useEffect(() => {
    if (open) {
      generateQR();
    }
  }, [open, request.id]);

  const generateQR = async () => {
    try {
      const url = await QRCode.toDataURL(platformUrl, {
        width: 100,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
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
    
    if (diff <= 0) return "EXPIRED";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const downloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size for social media (1200x630 for Open Graph)
    canvas.width = 600;
    canvas.height = 400;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 600, 400);
    gradient.addColorStop(0, "#dc2626");
    gradient.addColorStop(1, "#7f1d1d");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 400);

    // White card area
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(20, 20, 560, 360, 16);
    ctx.fill();

    // Header bar
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.roundRect(20, 20, 560, 60, [16, 16, 0, 0]);
    ctx.fill();

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("🩸 URGENT BLOOD NEEDED", 300, 58);

    // Blood group - large centered
    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 72px Arial";
    ctx.fillText(request.blood_group, 200, 160);

    // Units needed
    ctx.fillStyle = "#374151";
    ctx.font = "24px Arial";
    ctx.fillText(`${request.units_needed} Units`, 200, 200);

    // Hospital
    ctx.font = "18px Arial";
    ctx.fillStyle = "#6b7280";
    ctx.fillText(`📍 ${request.hospital_name}`, 200, 240);

    // Countdown if available
    if (request.needed_before) {
      const countdown = formatCountdown(request.needed_before);
      ctx.fillStyle = countdown === "EXPIRED" ? "#dc2626" : "#ea580c";
      ctx.font = "bold 20px Arial";
      ctx.fillText(`⏰ Needed within: ${countdown}`, 200, 280);
    }

    // QR Code area
    if (qrDataUrl) {
      const qrImage = new Image();
      qrImage.onload = () => {
        ctx.drawImage(qrImage, 450, 120, 100, 100);
        ctx.fillStyle = "#6b7280";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Scan to help", 500, 235);
        
        // Footer
        ctx.fillStyle = "#9ca3af";
        ctx.font = "14px Arial";
        ctx.fillText("LeyHadhiya Blood Donor Platform", 300, 360);
        
        // Download
        const link = document.createElement("a");
        link.download = `blood-request-${request.blood_group}-${request.id.slice(0, 8)}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      };
      qrImage.src = qrDataUrl;
    }
  };

  const shareCard = async () => {
    const text = `🩸 URGENT: ${request.blood_group} Blood Needed!\n\n📍 ${request.hospital_name}\n💉 ${request.units_needed} Units Required\n${request.needed_before ? `⏰ Needed within: ${formatCountdown(request.needed_before)}\n` : ""}\n🔗 ${platformUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${request.blood_group} Blood Needed - LeyHadhiya`,
          text,
          url: platformUrl,
        });
      } catch (err) {
        // User cancelled or error
        copyToClipboard(text);
      }
    } else {
      copyToClipboard(text);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Share Blood Request</DialogTitle>
        </DialogHeader>

        {/* Preview Card */}
        <div className="bg-gradient-to-br from-destructive to-destructive/80 p-4 rounded-xl">
          <div className="bg-background rounded-lg p-4 space-y-3">
            <div className="text-center">
              <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-1 rounded-full">
                🩸 URGENT BLOOD NEEDED
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <div className="text-4xl font-bold text-destructive">{request.blood_group}</div>
                <div className="text-sm text-muted-foreground">{request.units_needed} Units</div>
              </div>
              {qrDataUrl && (
                <div className="text-center">
                  <img src={qrDataUrl} alt="QR Code" className="w-20 h-20 rounded" />
                  <div className="text-[10px] text-muted-foreground mt-1">Scan to help</div>
                </div>
              )}
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{request.hospital_name}</span>
              </div>
              {request.needed_before && (
                <div className="flex items-center gap-2 text-orange-500 font-medium">
                  <Clock className="h-3 w-3" />
                  <span>Needed within: {formatCountdown(request.needed_before)}</span>
                </div>
              )}
            </div>

            <div className="text-center text-[10px] text-muted-foreground pt-2 border-t">
              LeyHadhiya Blood Donor Platform
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={shareCard} className="flex-1 rounded-xl" variant="default">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button onClick={downloadCard} variant="outline" className="flex-1 rounded-xl">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </DialogContent>
    </Dialog>
  );
};
