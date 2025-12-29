import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, Target, Flame, Award, Star, Heart, Zap, Crown, Medal, Sparkles, Share2, icons } from "lucide-react";
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

// Icon mapping for dynamic icons
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
          icon: <IconComponent className="h-5 w-5" />
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
    <>
      <Card className="border-0 shadow-md bg-gradient-to-br from-background to-muted/20">
        <CardHeader className="pb-2 pt-3 px-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
              <Trophy className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Achievements</CardTitle>
              <CardDescription className="text-[10px]">Track your milestones</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-3 pb-3">
          {/* Compact Streak */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0">
              <Flame className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{donationStreak} Donations</p>
              <p className="text-[10px] text-muted-foreground">This year</p>
            </div>
            {donationStreak >= 4 && (
              <Badge className="bg-gradient-to-r from-orange-500 to-red-500 border-0 text-[10px] px-1.5 py-0.5">
                🔥
              </Badge>
            )}
          </div>

          {/* Progress to Next - Compact */}
          {nextAchievement && (
            <div className="p-2 rounded-lg bg-muted/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div 
                    className="h-6 w-6 rounded-md flex items-center justify-center opacity-60"
                    style={{ backgroundColor: nextAchievement.color }}
                  >
                    <span className="text-white scale-75">{nextAchievement.icon}</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium leading-tight">{nextAchievement.title}</p>
                    <p className="text-[10px] text-muted-foreground">{nextAchievement.description}</p>
                  </div>
                </div>
                <span className="text-xs font-mono">
                  {nextAchievement.requirement_type === "donations" ? totalDonations : lifetimePoints}/{nextAchievement.requirement_value}
                </span>
              </div>
              <Progress value={getProgressValue()} className="h-1.5" />
            </div>
          )}

          {/* Earned Badges - Compact Grid */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium flex items-center gap-1">
              <Award className="h-3 w-3 text-amber-500" />
              Earned ({unlockedAchievements.length})
              <span className="text-[10px] text-muted-foreground">• Tap to share</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {unlockedAchievements.map(achievement => (
                <button
                  key={achievement.id}
                  onClick={() => handleShareBadge(achievement)}
                  className="h-8 w-8 rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform relative group"
                  style={{ backgroundColor: achievement.color }}
                  title={achievement.title}
                >
                  <span className="text-white scale-90">{achievement.icon}</span>
                  <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Share2 className="h-2 w-2 text-primary-foreground" />
                  </div>
                </button>
              ))}
              {unlockedAchievements.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">Complete milestones to earn badges!</p>
              )}
            </div>
          </div>

          {/* Locked Preview - Horizontal Scroll */}
          {lockedAchievements.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground">Upcoming</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {lockedAchievements.slice(0, 4).map(achievement => (
                  <div
                    key={achievement.id}
                    className="flex-shrink-0 flex items-center gap-1.5 p-1.5 rounded-md bg-muted/30 border border-dashed border-muted-foreground/20 opacity-50"
                  >
                    <div className="h-5 w-5 rounded bg-muted flex items-center justify-center">
                      <span className="scale-75">{achievement.icon}</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium leading-tight">{achievement.title}</p>
                      <p className="text-[8px] text-muted-foreground">
                        {achievement.requirement_type === "donations" 
                          ? `${achievement.requirement_value} donations`
                          : `${achievement.requirement_value} pts`
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Share Dialog - Compact */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-xs rounded-2xl p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-center text-base">Share Achievement</DialogTitle>
          </DialogHeader>
          
          {selectedBadge && (
            <div className="space-y-3">
              {/* Badge Preview */}
              <div className="bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4 rounded-xl border border-primary/20 text-center">
                <div 
                  className="h-14 w-14 rounded-full flex items-center justify-center shadow-lg mx-auto mb-2"
                  style={{ backgroundColor: selectedBadge.color }}
                >
                  <span className="text-white scale-125">{selectedBadge.icon}</span>
                </div>
                <h3 className="text-base font-bold">{selectedBadge.title}</h3>
                <p className="text-xs text-muted-foreground">{selectedBadge.description}</p>
                <p className="text-xs font-medium mt-2">{donorName}</p>
              </div>

              {/* Share Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-lg bg-green-500/10 hover:bg-green-500/20 border-green-500/30 flex-col gap-0.5"
                  onClick={shareToWhatsApp}
                >
                  <svg className="h-4 w-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span className="text-[10px]">WhatsApp</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 flex-col gap-0.5"
                  onClick={shareToTwitter}
                >
                  <svg className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  <span className="text-[10px]">X</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-lg flex-col gap-0.5"
                  onClick={handleNativeShare}
                >
                  <Share2 className="h-4 w-4" />
                  <span className="text-[10px]">More</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}