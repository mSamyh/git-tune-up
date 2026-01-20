import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Award, Lock, Trophy, Star, Flame, Heart, Share2, Download, CheckCircle, Target, Droplets, Coins } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon_name: string;
  color: string;
  requirement_type: string;
  requirement_value: number;
  is_active: boolean;
}

interface AchievementsPreviewProps {
  donationCount: number;
  totalPoints: number;
  userName?: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Award,
  Trophy,
  Star,
  Flame,
  Heart,
};

export function AchievementsPreview({ donationCount, totalPoints, userName }: AchievementsPreviewProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    const { data, error } = await supabase
      .from("achievements")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    if (!error && data) {
      setAchievements(data);
    }
    setLoading(false);
  };

  const isUnlocked = (achievement: Achievement) => {
    if (achievement.requirement_type === "donations") {
      return donationCount >= achievement.requirement_value;
    } else if (achievement.requirement_type === "points") {
      return totalPoints >= achievement.requirement_value;
    }
    return false;
  };

  const getProgress = (achievement: Achievement) => {
    if (achievement.requirement_type === "donations") {
      return Math.min(100, (donationCount / achievement.requirement_value) * 100);
    } else if (achievement.requirement_type === "points") {
      return Math.min(100, (totalPoints / achievement.requirement_value) * 100);
    }
    return 0;
  };

  const getCurrentValue = (achievement: Achievement) => {
    if (achievement.requirement_type === "donations") {
      return donationCount;
    } else if (achievement.requirement_type === "points") {
      return totalPoints;
    }
    return 0;
  };

  const getRequirementLabel = (achievement: Achievement) => {
    if (achievement.requirement_type === "donations") {
      return `${achievement.requirement_value} donation${achievement.requirement_value > 1 ? 's' : ''}`;
    } else if (achievement.requirement_type === "points") {
      return `${achievement.requirement_value} points`;
    }
    return "";
  };

  const handleShare = async (achievement: Achievement) => {
    if (!isUnlocked(achievement)) {
      toast.error("Unlock this achievement first to share it!");
      return;
    }

    setIsSharing(true);

    const shareText = `🏆 I just earned the "${achievement.title}" badge on LeyHadhiya Blood Bank! ${achievement.description} 🩸\n\nJoin me in saving lives: leyhadhiya.lovable.app`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${achievement.title} - LeyHadhiya Achievement`,
          text: shareText,
          url: "https://leyhadhiya.lovable.app",
        });
        toast.success("Shared successfully!");
      } else {
        await navigator.clipboard.writeText(shareText);
        toast.success("Achievement copied to clipboard!");
      }
    } catch (err) {
      // User cancelled or error
      if ((err as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(shareText);
        toast.success("Achievement copied to clipboard!");
      }
    } finally {
      setIsSharing(false);
    }
  };

  if (loading) {
    return (
      <Card className="rounded-xl border-border/50">
        <CardContent className="p-4">
          <div className="h-20 flex items-center justify-center">
            <div className="animate-pulse flex space-x-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 w-14 rounded-xl bg-muted" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (achievements.length === 0) {
    return null;
  }

  const unlockedCount = achievements.filter(isUnlocked).length;

  return (
    <>
      <Card className="rounded-xl border-border/50 overflow-hidden">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Achievements
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {unlockedCount}/{achievements.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-3 p-4">
              {achievements.map((achievement) => {
                const unlocked = isUnlocked(achievement);
                const progress = getProgress(achievement);
                const IconComponent = iconMap[achievement.icon_name] || Award;

                return (
                  <button
                    key={achievement.id}
                    className="flex flex-col items-center gap-1.5 min-w-[70px] group"
                    onClick={() => setSelectedAchievement(achievement)}
                  >
                    <div
                      className={`relative h-14 w-14 rounded-xl flex items-center justify-center transition-all group-hover:scale-105 group-active:scale-95 ${
                        unlocked
                          ? "ring-2 shadow-lg"
                          : "bg-muted/50 opacity-60"
                      }`}
                      style={{
                        backgroundColor: unlocked ? `${achievement.color}15` : undefined,
                        borderColor: unlocked ? achievement.color : undefined,
                        boxShadow: unlocked ? `0 4px 12px ${achievement.color}30` : undefined,
                        ...(unlocked && { ringColor: achievement.color }),
                      }}
                    >
                      {unlocked ? (
                        <IconComponent
                          className="h-6 w-6"
                          style={{ color: achievement.color }}
                        />
                      ) : (
                        <>
                          <Lock className="h-5 w-5 text-muted-foreground" />
                          {/* Progress ring */}
                          <svg
                            className="absolute inset-0 h-full w-full -rotate-90"
                            viewBox="0 0 100 100"
                          >
                            <circle
                              cx="50"
                              cy="50"
                              r="46"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="4"
                              className="text-border"
                            />
                            <circle
                              cx="50"
                              cy="50"
                              r="46"
                              fill="none"
                              stroke={achievement.color}
                              strokeWidth="4"
                              strokeDasharray={`${progress * 2.89} 289`}
                              strokeLinecap="round"
                              className="transition-all duration-500"
                            />
                          </svg>
                        </>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-medium text-center leading-tight max-w-[70px] truncate ${
                        unlocked ? "text-foreground" : "text-muted-foreground"
                      }`}
                      title={achievement.title}
                    >
                      {achievement.title}
                    </span>
                  </button>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" className="h-1.5" />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Achievement Detail Sheet */}
      <Sheet open={!!selectedAchievement} onOpenChange={(open) => !open && setSelectedAchievement(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh]">
          {selectedAchievement && (
            <div className="space-y-6 pb-6">
              <SheetHeader className="text-center">
                <SheetTitle className="sr-only">Achievement Details</SheetTitle>
              </SheetHeader>

              {/* Achievement Badge - Large Display */}
              <div className="flex flex-col items-center pt-2">
                {(() => {
                  const unlocked = isUnlocked(selectedAchievement);
                  const IconComponent = iconMap[selectedAchievement.icon_name] || Award;
                  
                  return (
                    <div
                      className={`relative h-24 w-24 rounded-2xl flex items-center justify-center transition-all ${
                        unlocked ? "ring-4 shadow-xl animate-scale-in" : "bg-muted/50"
                      }`}
                      style={{
                        backgroundColor: unlocked ? `${selectedAchievement.color}15` : undefined,
                        borderColor: unlocked ? selectedAchievement.color : undefined,
                        boxShadow: unlocked ? `0 8px 24px ${selectedAchievement.color}40` : undefined,
                        ...(unlocked && { ringColor: selectedAchievement.color }),
                      }}
                    >
                      {unlocked ? (
                        <IconComponent
                          className="h-12 w-12"
                          style={{ color: selectedAchievement.color }}
                        />
                      ) : (
                        <Lock className="h-10 w-10 text-muted-foreground" />
                      )}
                      
                      {/* Unlocked checkmark */}
                      {unlocked && (
                        <div 
                          className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full flex items-center justify-center shadow-lg"
                          style={{ backgroundColor: selectedAchievement.color }}
                        >
                          <CheckCircle className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Title & Status */}
                <h3 className="text-xl font-bold mt-4">{selectedAchievement.title}</h3>
                <Badge 
                  variant={isUnlocked(selectedAchievement) ? "default" : "secondary"}
                  className="mt-2"
                  style={isUnlocked(selectedAchievement) ? { 
                    backgroundColor: selectedAchievement.color,
                    color: 'white'
                  } : undefined}
                >
                  {isUnlocked(selectedAchievement) ? "🏆 Unlocked" : "🔒 Locked"}
                </Badge>
              </div>

              {/* Description */}
              <div className="text-center px-4">
                <p className="text-muted-foreground">{selectedAchievement.description}</p>
              </div>

              {/* How to Earn Section */}
              <Card className="rounded-xl border-border/50 mx-2">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">How to Earn</span>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                    {selectedAchievement.requirement_type === "donations" ? (
                      <Droplets className="h-5 w-5 text-primary" />
                    ) : (
                      <Coins className="h-5 w-5 text-amber-500" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {selectedAchievement.requirement_type === "donations" 
                          ? `Make ${selectedAchievement.requirement_value} blood donation${selectedAchievement.requirement_value > 1 ? 's' : ''}`
                          : `Earn ${selectedAchievement.requirement_value} reward points`
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedAchievement.requirement_type === "donations"
                          ? "Each donation saves up to 3 lives"
                          : "Points are earned with every donation"
                        }
                      </p>
                    </div>
                  </div>

                  {/* Progress */}
                  {!isUnlocked(selectedAchievement) && (
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {getCurrentValue(selectedAchievement)} / {selectedAchievement.requirement_value}
                        </span>
                      </div>
                      <Progress 
                        value={getProgress(selectedAchievement)} 
                        className="h-2"
                        style={{ 
                          ['--progress-background' as any]: selectedAchievement.color 
                        }}
                      />
                      <p className="text-xs text-center text-muted-foreground">
                        {selectedAchievement.requirement_value - getCurrentValue(selectedAchievement)} more {selectedAchievement.requirement_type === "donations" ? "donations" : "points"} to unlock
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Share Button - Only for Unlocked */}
              {isUnlocked(selectedAchievement) && (
                <div className="px-4">
                  <Button
                    onClick={() => handleShare(selectedAchievement)}
                    disabled={isSharing}
                    className="w-full h-12 rounded-xl text-base font-medium gap-2"
                    style={{ 
                      backgroundColor: selectedAchievement.color,
                    }}
                  >
                    <Share2 className="h-5 w-5" />
                    Share Achievement
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Share your achievement on social media and inspire others to donate!
                  </p>
                </div>
              )}

              {/* Encouragement for Locked */}
              {!isUnlocked(selectedAchievement) && (
                <div className="px-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Keep donating to unlock this achievement! 💪
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
