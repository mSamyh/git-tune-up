import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Droplet, LogOut, LogIn } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export const AppHeader = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();

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
                className="rounded-full"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback>{profile.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
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
