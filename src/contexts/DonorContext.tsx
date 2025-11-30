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
      .select("*");

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
