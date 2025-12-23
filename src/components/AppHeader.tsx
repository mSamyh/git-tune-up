import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Droplet, LogIn } from "lucide-react";
import { TopDonorBadge, getTopDonorRank } from "@/components/TopDonorBadge";
import { useDonor } from "@/contexts/DonorContext";
import { NotificationBell } from "@/components/NotificationBell";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export const AppHeader = () => {
  const { profile, topDonors, isLoggedIn } = useDonor();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Droplet className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xl font-bold">LeyHadhiya</span>
            <span className="text-xs text-muted-foreground">Blood donors network</span>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {isLoggedIn && profile ? (
            <>
              <NotificationBell />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/profile")}
                className="rounded-full relative hover:bg-primary/10 transition-colors"
              >
                <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">{profile.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                {(() => {
                  const rank = getTopDonorRank(profile.id, topDonors);
                  return rank > 0 && <TopDonorBadge rank={rank} className="absolute -top-1 -right-1" />;
                })()}
              </Button>
            </>
          ) : (
            <Button variant="default" onClick={() => navigate("/auth")}>
              <LogIn className="h-4 w-4 mr-2" />
              Login
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
