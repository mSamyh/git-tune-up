import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, Flame, Award, Star, Heart, Zap, Crown, Medal, Sparkles } from "lucide-react";

interface DonorMilestonesProps {
  donorId: string;
  totalDonations: number;
  currentPoints: number;
  lifetimePoints: number;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  requirement: number;
  type: "donations" | "points";
  color: string;
  unlocked: boolean;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  earnedAt?: string;
}

export function DonorMilestones({ donorId, totalDonations, currentPoints, lifetimePoints }: DonorMilestonesProps) {
  const [donationStreak, setDonationStreak] = useState(0);
  const [lastDonationDate, setLastDonationDate] = useState<string | null>(null);

  useEffect(() => {
    fetchDonationStreak();
  }, [donorId]);

  const fetchDonationStreak = async () => {
    const { data } = await supabase
      .from("donation_history")
      .select("donation_date")
      .eq("donor_id", donorId)
      .order("donation_date", { ascending: false });

    if (data && data.length > 0) {
      setLastDonationDate(data[0].donation_date);
      
      // Calculate yearly streak (donations per year)
      const currentYear = new Date().getFullYear();
      const donationsThisYear = data.filter(d => 
        new Date(d.donation_date).getFullYear() === currentYear
      ).length;
      setDonationStreak(donationsThisYear);
    }
  };

  // Define milestones
  const donationMilestones: Milestone[] = [
    { id: "first", title: "First Drop", description: "Complete your first donation", icon: <Heart className="h-5 w-5" />, requirement: 1, type: "donations", color: "bg-red-500", unlocked: totalDonations >= 1 },
    { id: "regular", title: "Regular Donor", description: "Donate 5 times", icon: <Star className="h-5 w-5" />, requirement: 5, type: "donations", color: "bg-blue-500", unlocked: totalDonations >= 5 },
    { id: "hero", title: "Blood Hero", description: "Donate 10 times", icon: <Award className="h-5 w-5" />, requirement: 10, type: "donations", color: "bg-purple-500", unlocked: totalDonations >= 10 },
    { id: "champion", title: "Life Champion", description: "Donate 25 times", icon: <Trophy className="h-5 w-5" />, requirement: 25, type: "donations", color: "bg-amber-500", unlocked: totalDonations >= 25 },
    { id: "legend", title: "Blood Legend", description: "Donate 50 times", icon: <Crown className="h-5 w-5" />, requirement: 50, type: "donations", color: "bg-gradient-to-r from-amber-400 to-amber-600", unlocked: totalDonations >= 50 },
  ];

  const pointMilestones: Milestone[] = [
    { id: "starter", title: "Points Starter", description: "Earn 100 points", icon: <Zap className="h-5 w-5" />, requirement: 100, type: "points", color: "bg-green-500", unlocked: lifetimePoints >= 100 },
    { id: "collector", title: "Points Collector", description: "Earn 500 points", icon: <Target className="h-5 w-5" />, requirement: 500, type: "points", color: "bg-teal-500", unlocked: lifetimePoints >= 500 },
    { id: "accumulator", title: "Points Master", description: "Earn 1000 points", icon: <Medal className="h-5 w-5" />, requirement: 1000, type: "points", color: "bg-indigo-500", unlocked: lifetimePoints >= 1000 },
    { id: "elite", title: "Elite Status", description: "Earn 2500 points", icon: <Sparkles className="h-5 w-5" />, requirement: 2500, type: "points", color: "bg-pink-500", unlocked: lifetimePoints >= 2500 },
  ];

  // Get next milestone
  const nextDonationMilestone = donationMilestones.find(m => !m.unlocked);
  const nextPointMilestone = pointMilestones.find(m => !m.unlocked);

  const unlockedDonationCount = donationMilestones.filter(m => m.unlocked).length;
  const unlockedPointCount = pointMilestones.filter(m => m.unlocked).length;

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-background to-muted/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Achievements & Milestones</CardTitle>
            <CardDescription className="text-xs">Track your donor journey</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Streak Section */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-lg">{donationStreak} Donations</p>
            <p className="text-xs text-muted-foreground">This year's contributions</p>
          </div>
          {donationStreak >= 4 && (
            <Badge className="bg-gradient-to-r from-orange-500 to-red-500 border-0">
              🔥 On Fire!
            </Badge>
          )}
        </div>

        {/* Progress to Next Milestone */}
        {nextDonationMilestone && (
          <div className="p-3 rounded-xl bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-lg ${nextDonationMilestone.color} flex items-center justify-center opacity-50`}>
                  {nextDonationMilestone.icon}
                </div>
                <div>
                  <p className="text-sm font-medium">Next: {nextDonationMilestone.title}</p>
                  <p className="text-xs text-muted-foreground">{nextDonationMilestone.description}</p>
                </div>
              </div>
              <span className="text-sm font-mono">{totalDonations}/{nextDonationMilestone.requirement}</span>
            </div>
            <Progress 
              value={(totalDonations / nextDonationMilestone.requirement) * 100} 
              className="h-2"
            />
          </div>
        )}

        {/* Unlocked Badges */}
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            Earned Badges ({unlockedDonationCount + unlockedPointCount})
          </p>
          <div className="flex flex-wrap gap-2">
            {[...donationMilestones, ...pointMilestones]
              .filter(m => m.unlocked)
              .map(milestone => (
                <div
                  key={milestone.id}
                  className={`h-10 w-10 rounded-full ${milestone.color} flex items-center justify-center shadow-md hover:scale-110 transition-transform cursor-pointer`}
                  title={`${milestone.title}: ${milestone.description}`}
                >
                  <span className="text-white">{milestone.icon}</span>
                </div>
              ))}
            {unlockedDonationCount + unlockedPointCount === 0 && (
              <p className="text-xs text-muted-foreground italic">Complete milestones to earn badges!</p>
            )}
          </div>
        </div>

        {/* Locked Milestones Preview */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Upcoming Milestones</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[...donationMilestones, ...pointMilestones]
              .filter(m => !m.unlocked)
              .slice(0, 3)
              .map(milestone => (
                <div
                  key={milestone.id}
                  className="flex-shrink-0 p-2 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/30 opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                      {milestone.icon}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{milestone.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {milestone.type === "donations" 
                          ? `${milestone.requirement} donations`
                          : `${milestone.requirement} pts`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
