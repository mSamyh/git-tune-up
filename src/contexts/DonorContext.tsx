import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface DonorContextType {
  profile: Profile | null;
  topDonors: any[];
  isLoggedIn: boolean;
  refreshProfile: () => void;
  refreshTopDonors: () => void;
}

const DonorContext = createContext<DonorContextType | undefined>(undefined);

export const DonorProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [topDonors, setTopDonors] = useState<any[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
    const { data: profileDonors } = await supabase
      .from("profiles")
      .select("*")
      .in("user_type", ["donor", "both"]);

    const { data: directoryDonors } = await supabase
      .from("donor_directory")
      .select("*");

    const unlinkedDirectoryDonors = (directoryDonors || []).filter((d: any) => !d.linked_profile_id);

    const profileDonorsList = (profileDonors || []).map((d: any) => ({ ...d, source: 'profile', is_registered: true }));
    const directoryDonorsList = unlinkedDirectoryDonors.map((d: any) => ({ ...d, source: 'directory', is_registered: false }));

    // Use bulk fetch for donation counts instead of N+1 individual calls
    const profileIds = profileDonorsList.map(d => d.id);
    const directoryIds = directoryDonorsList.map(d => d.id);

    const [profileCountsResult, directoryCountsResult] = await Promise.all([
      profileIds.length > 0 
        ? supabase.rpc('get_bulk_donation_counts', { donor_ids: profileIds })
        : { data: [] },
      directoryIds.length > 0 
        ? supabase.rpc('get_bulk_directory_donation_counts', { donor_ids: directoryIds })
        : { data: [] }
    ]);

    // Create lookup maps for counts
    const profileCountMap = new Map((profileCountsResult.data || []).map((r: any) => [r.donor_id, r.donation_count]));
    const directoryCountMap = new Map((directoryCountsResult.data || []).map((r: any) => [r.donor_id, r.donation_count]));

    // Merge counts with donors
    const allDonors = [
      ...profileDonorsList.map(d => ({ ...d, donation_count: profileCountMap.get(d.id) || 0 })),
      ...directoryDonorsList.map(d => ({ ...d, donation_count: directoryCountMap.get(d.id) || 0 }))
    ];

    const top5 = allDonors
      .sort((a: any, b: any) => (b.donation_count || 0) - (a.donation_count || 0))
      .slice(0, 5);
    
    setTopDonors(top5);
  };

  const refreshProfile = () => {
    const user = supabase.auth.getUser();
    user.then(({ data: { user } }) => {
      if (user) fetchProfile(user.id);
    });
  };

  const refreshTopDonors = () => {
    fetchTopDonors();
  };

  return (
    <DonorContext.Provider value={{ profile, topDonors, isLoggedIn, refreshProfile, refreshTopDonors }}>
      {children}
    </DonorContext.Provider>
  );
};

export const useDonor = () => {
  const context = useContext(DonorContext);
  if (context === undefined) {
    throw new Error("useDonor must be used within a DonorProvider");
  }
  return context;
};
