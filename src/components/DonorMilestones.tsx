import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Trophy, Target, Flame, Award, Star, Heart, Zap, Crown, Medal, Sparkles, Share2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DonorMilestonesProps {
  donorId: string;
  totalDonations: number;
  currentPoints: number;
  lifetimePoints: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon_name: string;
  color: string;
  requirement_type: "donations" | "points";
  requirement_value: number;
  is_active: boolean;
  sort_order: number;
}

interface ProcessedAchievement extends Achievement {
  unlocked: boolean;
  icon: React.ReactNode;
}

const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
  Heart, Star, Award, Trophy, Crown, Zap, Target, Medal, Sparkles, Flame
};

export function DonorMilestones({ donorId, totalDonations, currentPoints, lifetimePoints }: DonorMilestonesProps) {
  const [donationStreak, setDonationStreak] = useState(0);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<ProcessedAchievement | null>(null);
  const [donorName, setDonorName] = useState("");
  const [achievements, setAchievements] = useState<ProcessedAchievement[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchDonationStreak();
    fetchDonorName();
    fetchAchievements();
  }, [donorId, totalDonations, lifetimePoints]);

  const fetchAchievements = async () => {
    const { data } = await supabase
      .from("achievements")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (data) {
      const processed = data.map((a) => {
        const IconComponent = iconMap[a.icon_name] || Award;
        const reqType = a.requirement_type as "donations" | "points";
        const unlocked = reqType === "donations" 
          ? totalDonations >= a.requirement_value
          : lifetimePoints >= a.requirement_value;
        
        return {
          ...a,
          requirement_type: reqType,
          unlocked,
          icon: <IconComponent className="h-4 w-4" />
        };
      });
      setAchievements(processed);
    }
  };

  const fetchDonorName = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", donorId)
      .single();
    if (data) {
      setDonorName(data.full_name);
    }
  };

  const fetchDonationStreak = async () => {
    const { data } = await supabase
      .from("donation_history")
      .select("donation_date")
      .eq("donor_id", donorId)
      .order("donation_date", { ascending: false });

    if (data && data.length > 0) {
      const currentYear = new Date().getFullYear();
      const donationsThisYear = data.filter(d => 
        new Date(d.donation_date).getFullYear() === currentYear
      ).length;
      setDonationStreak(donationsThisYear);
    }
  };

  const unlockedAchievements = achievements.filter(m => m.unlocked);
  const lockedAchievements = achievements.filter(m => !m.unlocked);
  const nextAchievement = lockedAchievements[0];

  const handleShareBadge = (achievement: ProcessedAchievement) => {
    setSelectedBadge(achievement);
    setShareDialogOpen(true);
  };

  const generateShareText = (achievement: ProcessedAchievement) => {
    return `🎉 I just earned the "${achievement.title}" badge! ${achievement.description}. Join me in saving lives! 💉❤️ #BloodDonation #SaveLives`;
  };

  const shareToWhatsApp = () => {
    if (!selectedBadge) return;
    const text = generateShareText(selectedBadge);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareToTwitter = () => {
    if (!selectedBadge) return;
    const text = generateShareText(selectedBadge);
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (!selectedBadge) return;
    const text = generateShareText(selectedBadge);
    
    if (navigator.share) {
      try {
        await navigator.share({ title: `${selectedBadge.title} Badge`, text });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          await navigator.clipboard.writeText(text);
          toast({ title: "Copied to clipboard!" });
        }
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard!" });
    }
  };

  const getProgressValue = () => {
    if (!nextAchievement) return 100;
    const current = nextAchievement.requirement_type === "donations" ? totalDonations : lifetimePoints;
    return Math.min((current / nextAchievement.requirement_value) * 100, 100);
  };

  return (
    <div className="space-y-4">
      {/* Streak Banner - Instagram Stories Style */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-orange-500/10 via-red-500/10 to-pink-500/10 border border-orange-500/20">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0 shadow-lg">
          <Flame className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg">{donationStreak}</p>
          <p className="text-xs text-muted-foreground">Donations this year</p>
        </div>
        {donationStreak >= 4 && (
          <Badge className="bg-gradient-to-r from-orange-500 to-red-500 border-0 text-xs px-2 py-0.5">
            🔥 On Fire
          </Badge>
        )}
      </div>

      {/* Progress to Next Achievement */}
      {nextAchievement && (
        <div className="p-3 rounded-xl bg-muted/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="h-8 w-8 rounded-full flex items-center justify-center opacity-70"
                style={{ backgroundColor: nextAchievement.color }}
              >
                <span className="text-white">{nextAchievement.icon}</span>
              </div>
              <div>
                <p className="text-sm font-medium">{nextAchievement.title}</p>
                <p className="text-xs text-muted-foreground">{nextAchievement.description}</p>
              </div>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {nextAchievement.requirement_type === "donations" ? totalDonations : lifetimePoints}/{nextAchievement.requirement_value}
            </span>
          </div>
          <Progress value={getProgressValue()} className="h-1.5" />
        </div>
      )}

      {/* Earned Badges - Instagram Highlights Style */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Award className="h-4 w-4 text-amber-500" />
            Badges ({unlockedAchievements.length})
          </p>
          <span className="text-xs text-muted-foreground">Tap to share</span>
        </div>
        
        {unlockedAchievements.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {unlockedAchievements.map(achievement => (
              <button
                key={achievement.id}
                onClick={() => handleShareBadge(achievement)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
              >
                <div 
                  className="h-14 w-14 rounded-full flex items-center justify-center shadow-md ring-2 ring-offset-2 ring-offset-background transition-all group-hover:scale-105 group-hover:shadow-lg"
                  style={{ 
                    backgroundColor: achievement.color,
                    boxShadow: `0 0 0 2px ${achievement.color}`
                  }}
                >
                  <span className="text-white scale-110">{achievement.icon}</span>
                </div>
                <span className="text-[10px] font-medium text-center max-w-[60px] truncate">
                  {achievement.title}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic py-2">
            Complete milestones to earn badges!
          </p>
        )}
      </div>

      {/* Locked Badges Preview */}
      {lockedAchievements.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Upcoming</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {lockedAchievements.slice(0, 5).map(achievement => (
              <div
                key={achievement.id}
                className="flex flex-col items-center gap-1 flex-shrink-0 opacity-40"
              >
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                  <span className="scale-90">{achievement.icon}</span>
                </div>
                <span className="text-[9px] text-muted-foreground text-center max-w-[50px] truncate">
                  {achievement.requirement_type === "donations" 
                    ? `${achievement.requirement_value} don.`
                    : `${achievement.requirement_value} pts`
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share Dialog - Modern Full-Screen Story Style */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-[320px] p-0 border-0 bg-transparent shadow-none gap-0">
          {selectedBadge && (
            <div className="flex flex-col items-center gap-4">
              {/* Branded Badge Card */}
              <div 
                className="w-full rounded-3xl overflow-hidden shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, ${selectedBadge.color}ee, ${selectedBadge.color}88)`
                }}
              >
                <div className="p-6 text-center text-white relative overflow-hidden">
                  {/* Decorative elements */}
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-white/10 translate-y-1/2 -translate-x-1/2" />
                  <div className="absolute top-1/2 left-1/4 w-3 h-3 rounded-full bg-white/20" />
                  <div className="absolute top-1/3 right-1/4 w-2 h-2 rounded-full bg-white/30" />
                  
                  {/* Achievement label */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur text-xs font-semibold mb-4 relative">
                    <Sparkles className="h-3.5 w-3.5" />
                    Achievement Unlocked!
                  </div>
                  
                  {/* Large Badge Icon */}
                  <div className="h-24 w-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 ring-4 ring-white/30 relative">
                    <span className="scale-[2.5] text-white">{selectedBadge.icon}</span>
                  </div>
                  
                  {/* Badge Info */}
                  <h2 className="text-2xl font-bold mb-1 drop-shadow-sm">{selectedBadge.title}</h2>
                  <p className="text-white/80 text-sm mb-4 px-4">{selectedBadge.description}</p>
                  
                  {/* Donor Name */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur relative">
                    <Heart className="h-4 w-4 fill-current" />
                    <span className="font-medium">{donorName}</span>
                  </div>
                </div>
                
                {/* Leyhadhiya Branding Footer */}
                <div className="bg-black/20 backdrop-blur px-4 py-3 flex items-center justify-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center">
                    <Heart className="h-3.5 w-3.5 text-white fill-white" />
                  </div>
                  <span className="text-white/90 text-sm font-semibold tracking-wide">Leyhadhiya Blood Bank</span>
                </div>
              </div>

              {/* Share Buttons */}
              <div className="flex gap-2 w-full">
                <Button
                  className="flex-1 h-12 rounded-2xl bg-green-500 hover:bg-green-600 text-white gap-2 font-semibold"
                  onClick={shareToWhatsApp}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </Button>
                <Button
                  className="flex-1 h-12 rounded-2xl bg-black hover:bg-gray-800 text-white gap-2 font-semibold"
                  onClick={shareToTwitter}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  X
                </Button>
                <Button
                  variant="secondary"
                  className="h-12 w-12 rounded-2xl p-0"
                  onClick={handleNativeShare}
                >
                  <Share2 className="h-5 w-5" />
                </Button>
              </div>
              
              {/* Close button */}
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setShareDialogOpen(false)}
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
