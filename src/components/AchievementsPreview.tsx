import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Lock, Trophy, Star, Flame, Heart } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Award,
  Trophy,
  Star,
  Flame,
  Heart,
};

export function AchievementsPreview({ donationCount, totalPoints }: AchievementsPreviewProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

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
                <div
                  key={achievement.id}
                  className="flex flex-col items-center gap-1.5 min-w-[70px]"
                >
                  <div
                    className={`relative h-14 w-14 rounded-xl flex items-center justify-center transition-all ${
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
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" className="h-1.5" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
