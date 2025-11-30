import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Droplet, LogOut, LogIn } from "lucide-react";
import { TopDonorBadge, getTopDonorRank } from "@/components/TopDonorBadge";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export const AppHeader = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [topDonors, setTopDonors] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    fetchTopDonors();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setIsLoggedIn(true);
          fetchProfile(session.user.id);
        } else {
          setIsLoggedIn(false);
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      setIsLoggedIn(true);
      fetchProfile(user.id);
    }
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", userId)
      .single();

    if (data) {
      setProfile(data);
    }
  };

  const fetchTopDonors = async () => {
    // Fetch all profiles
    const { data: profileDonors } = await supabase
      .from("profiles")
      .select("*");

    // Fetch all directory donors
    const { data: directoryDonors } = await supabase
      .from("donor_directory")
      .select("*");

    const unlinkedDirectoryDonors = (directoryDonors || []).filter((d: any) => !d.linked_profile_id);

    const allDonors = [
      ...(profileDonors || []).map((d: any) => ({ ...d, source: 'profile', is_registered: true })),
      ...unlinkedDirectoryDonors.map((d: any) => ({ ...d, source: 'directory', is_registered: false }))
    ];

    const donorsWithCounts = await Promise.all(
      allDonors.map(async (donor: any) => {
        if (donor.source === 'profile') {
          const { data: countData } = await supabase.rpc('get_donation_count', { donor_uuid: donor.id });
          return { ...donor, donation_count: countData || 0 };
        } else {
          const { data: countData } = await supabase.rpc('get_directory_donation_count', { donor_uuid: donor.id });
          return { ...donor, donation_count: countData || 0 };
        }
      })
    );

    const top5 = donorsWithCounts
      .sort((a: any, b: any) => (b.donation_count || 0) - (a.donation_count || 0))
      .slice(0, 5);
    
    setTopDonors(top5);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/profile")}
                className="rounded-full relative"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback>{profile.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                {(() => {
                  const rank = getTopDonorRank(profile.id, topDonors);
                  return rank > 0 && <TopDonorBadge rank={rank} className="absolute -top-1 -right-1" />;
                })()}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
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
