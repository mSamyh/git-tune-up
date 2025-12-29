import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, Target, Flame, Award, Star, Heart, Zap, Crown, Medal, Sparkles, Share2, Download, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export function DonorMilestones({ donorId, totalDonations, currentPoints, lifetimePoints }: DonorMilestonesProps) {
  const [donationStreak, setDonationStreak] = useState(0);
  const [lastDonationDate, setLastDonationDate] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<Milestone | null>(null);
  const [donorName, setDonorName] = useState("");
  const shareCardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDonationStreak();
    fetchDonorName();
  }, [donorId]);

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

  const handleShareBadge = (milestone: Milestone) => {
    setSelectedBadge(milestone);
    setShareDialogOpen(true);
  };

  const generateShareText = (milestone: Milestone) => {
    return `🎉 I just earned the "${milestone.title}" badge on Lheymaan Blood Bank! ${milestone.description}. Join me in saving lives! 💉❤️ #BloodDonation #SaveLives #Lheymaan`;
  };

  const shareToWhatsApp = () => {
    if (!selectedBadge) return;
    const text = generateShareText(selectedBadge);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    toast({ title: "Opening WhatsApp..." });
  };

  const shareToTwitter = () => {
    if (!selectedBadge) return;
    const text = generateShareText(selectedBadge);
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    toast({ title: "Opening X (Twitter)..." });
  };

  const shareToFacebook = () => {
    if (!selectedBadge) return;
    const text = generateShareText(selectedBadge);
    const url = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    toast({ title: "Opening Facebook..." });
  };

  const copyShareLink = async () => {
    if (!selectedBadge) return;
    const text = generateShareText(selectedBadge);
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard!" });
    } catch {
      toast({ variant: "destructive", title: "Failed to copy" });
    }
  };

  const handleNativeShare = async () => {
    if (!selectedBadge) return;
    const text = generateShareText(selectedBadge);
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${selectedBadge.title} Badge`,
          text: text,
        });
        toast({ title: "Shared successfully!" });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          copyShareLink();
        }
      }
    } else {
      copyShareLink();
    }
  };

  return (
    <>
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
              <span className="text-xs text-muted-foreground ml-1">• Tap to share</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {[...donationMilestones, ...pointMilestones]
                .filter(m => m.unlocked)
                .map(milestone => (
                  <button
                    key={milestone.id}
                    onClick={() => handleShareBadge(milestone)}
                    className={`h-10 w-10 rounded-full ${milestone.color} flex items-center justify-center shadow-md hover:scale-110 transition-transform cursor-pointer relative group`}
                    title={`${milestone.title}: ${milestone.description} - Click to share`}
                  >
                    <span className="text-white">{milestone.icon}</span>
                    <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Share2 className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  </button>
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

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">Share Achievement</DialogTitle>
          </DialogHeader>
          
          {selectedBadge && (
            <div className="space-y-4">
              {/* Badge Preview Card */}
              <div 
                ref={shareCardRef}
                className="bg-gradient-to-br from-primary/10 via-background to-primary/5 p-6 rounded-2xl border border-primary/20 text-center"
              >
                <div className={`h-20 w-20 rounded-full ${selectedBadge.color} flex items-center justify-center shadow-xl mx-auto mb-4`}>
                  <span className="text-white scale-150">{selectedBadge.icon}</span>
                </div>
                <h3 className="text-xl font-bold">{selectedBadge.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{selectedBadge.description}</p>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">Earned by</p>
                  <p className="font-semibold">{donorName}</p>
                </div>
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs">
                    Lheymaan Blood Bank
                  </Badge>
                </div>
              </div>

              {/* Share Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-12 rounded-xl bg-green-500/10 hover:bg-green-500/20 border-green-500/30"
                  onClick={shareToWhatsApp}
                >
                  <svg className="h-5 w-5 mr-2 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30"
                  onClick={shareToTwitter}
                >
                  <svg className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  X / Twitter
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border-blue-600/30"
                  onClick={shareToFacebook}
                >
                  <svg className="h-5 w-5 mr-2 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-xl"
                  onClick={handleNativeShare}
                >
                  <Share2 className="h-5 w-5 mr-2" />
                  More
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}