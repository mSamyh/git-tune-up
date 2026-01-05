import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Droplet, LogIn } from "lucide-react";
import { TopDonorBadge, getTopDonorRank } from "@/components/TopDonorBadge";
import { useDonor } from "@/contexts/DonorContext";
import { NotificationBell } from "@/components/NotificationBell";

export const AppHeader = () => {
  const { profile, topDonors, isLoggedIn } = useDonor();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2.5 group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary transition-transform group-hover:scale-105">
            <Droplet className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-lg font-display font-bold tracking-tight">LeyHadhiya</span>
            <span className="text-[10px] text-muted-foreground -mt-0.5 tracking-wide">Blood donors network</span>
          </div>
        </button>

        {/* Right side actions */}
        <div className="flex items-center gap-1.5">
          {isLoggedIn && profile ? (
            <>
              <NotificationBell />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/profile")}
                className="rounded-full relative h-10 w-10 hover:bg-primary/5 transition-colors"
              >
                <Avatar className="h-8 w-8 ring-2 ring-primary/15 ring-offset-1 ring-offset-background">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {profile.full_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {(() => {
                  const rank = getTopDonorRank(profile.id, topDonors);
                  return rank > 0 && <TopDonorBadge rank={rank} className="absolute -top-0.5 -right-0.5" />;
                })()}
              </Button>
            </>
          ) : (
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => navigate("/auth")}
              className="rounded-xl h-9 px-4 font-medium"
            >
              <LogIn className="h-4 w-4 mr-1.5" />
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};