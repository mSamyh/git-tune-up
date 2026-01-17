import { supabase } from "@/integrations/supabase/client";

export interface TierInfo {
  name: string;
  color: string;
  discount: number;
  minPoints: number;
  maxPoints: number | null;
  icon: string;
  currentPoints?: number;
}

const DEFAULT_TIERS: TierInfo[] = [
  { name: 'Bronze', color: 'from-orange-400 to-orange-600', discount: 0, minPoints: 0, maxPoints: 99, icon: 'Award' },
  { name: 'Silver', color: 'from-gray-300 to-gray-500', discount: 5, minPoints: 100, maxPoints: 499, icon: 'Medal' },
  { name: 'Gold', color: 'from-yellow-400 to-yellow-600', discount: 10, minPoints: 500, maxPoints: 999, icon: 'Trophy' },
  { name: 'Platinum', color: 'from-slate-400 to-slate-600', discount: 15, minPoints: 1000, maxPoints: null, icon: 'Crown' },
];

/**
 * Get the user's current tier based on their points
 * Uses the secure database function
 */
export async function getUserTier(userIdOrPoints: string | number): Promise<TierInfo> {
  try {
    if (typeof userIdOrPoints === 'number') {
      return getTierByPoints(userIdOrPoints);
    }

    const { data, error } = await supabase.rpc('get_user_tier', {
      p_user_id: userIdOrPoints
    });

    if (error) {
      console.error('Error fetching user tier:', error);
      return DEFAULT_TIERS[0];
    }

    const tierData = data as unknown as TierInfo;
    return {
      name: tierData?.name || 'Bronze',
      color: tierData?.color || DEFAULT_TIERS[0].color,
      discount: tierData?.discount || 0,
      minPoints: tierData?.minPoints || 0,
      maxPoints: tierData?.maxPoints || null,
      icon: tierData?.icon || 'Award',
      currentPoints: tierData?.currentPoints || 0
    };
  } catch (error) {
    console.error('Exception fetching user tier:', error);
    return DEFAULT_TIERS[0];
  }
}

/**
 * Get tier info based on points
 */
export async function getTierByPoints(currentPoints: number): Promise<TierInfo> {
  try {
    const { data: tiers, error } = await supabase.rpc('get_all_tiers');
    
    if (error || !tiers || !Array.isArray(tiers)) {
      return calculateTierLocally(currentPoints);
    }

    const tierArray = tiers as unknown as TierInfo[];
    for (let i = tierArray.length - 1; i >= 0; i--) {
      if (currentPoints >= tierArray[i].minPoints) {
        return { ...tierArray[i], currentPoints };
      }
    }

    return { ...tierArray[0], currentPoints };
  } catch (error) {
    console.error('Exception fetching tier by points:', error);
    return calculateTierLocally(currentPoints);
  }
}

/**
 * Get all available tiers
 */
export async function getAllTiers(): Promise<TierInfo[]> {
  try {
    const { data, error } = await supabase.rpc('get_all_tiers');

    if (error || !data || !Array.isArray(data) || data.length === 0) {
      return DEFAULT_TIERS;
    }

    return (data as unknown as TierInfo[]).map((tier) => ({
      name: tier.name,
      color: tier.color,
      discount: tier.discount,
      minPoints: tier.minPoints,
      maxPoints: tier.maxPoints,
      icon: tier.icon
    }));
  } catch (error) {
    console.error('Exception fetching all tiers:', error);
    return DEFAULT_TIERS;
  }
}

function calculateTierLocally(points: number): TierInfo {
  if (points >= 1000) return { ...DEFAULT_TIERS[3], currentPoints: points };
  if (points >= 500) return { ...DEFAULT_TIERS[2], currentPoints: points };
  if (points >= 100) return { ...DEFAULT_TIERS[1], currentPoints: points };
  return { ...DEFAULT_TIERS[0], currentPoints: points };
}
