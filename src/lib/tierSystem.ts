import { supabase } from "@/integrations/supabase/client";

export interface TierInfo {
  name: string;
  color: string;
  discount: number;
  minPoints: number;
  maxPoints: number | null; // null means unlimited (top tier)
  icon: string;
}

export async function getUserTier(currentPoints: number): Promise<TierInfo> {
  // Fetch tier settings from database
  const { data: settings } = await supabase
    .from("reward_settings")
    .select("*")
    .in("setting_key", [
      "tier_bronze_min", "tier_bronze_discount",
      "tier_silver_min", "tier_silver_discount",
      "tier_gold_min", "tier_gold_discount",
      "tier_platinum_min", "tier_platinum_discount"
    ]);

  if (!settings) {
    // Default tier if settings not found
    return {
      name: "Bronze",
      color: "text-orange-600",
      discount: 5,
      minPoints: 0,
      maxPoints: 99,
      icon: "award"
    };
  }

  const settingsMap: any = {};
  settings.forEach(setting => {
    settingsMap[setting.setting_key] = parseInt(setting.setting_value);
  });

  // Build tiers with ranges (sorted by minPoints ascending)
  const tierConfigs = [
    {
      name: "Bronze",
      color: "text-orange-600",
      discount: settingsMap.tier_bronze_discount || 5,
      minPoints: settingsMap.tier_bronze_min || 0,
      icon: "award"
    },
    {
      name: "Silver",
      color: "text-gray-400",
      discount: settingsMap.tier_silver_discount || 10,
      minPoints: settingsMap.tier_silver_min || 100,
      icon: "trophy"
    },
    {
      name: "Gold",
      color: "text-yellow-500",
      discount: settingsMap.tier_gold_discount || 15,
      minPoints: settingsMap.tier_gold_min || 500,
      icon: "star"
    },
    {
      name: "Platinum",
      color: "text-purple-500",
      discount: settingsMap.tier_platinum_discount || 20,
      minPoints: settingsMap.tier_platinum_min || 1000,
      icon: "crown"
    }
  ].sort((a, b) => a.minPoints - b.minPoints);

  // Assign maxPoints based on next tier's minPoints
  const tiersWithRanges: TierInfo[] = tierConfigs.map((tier, index) => ({
    ...tier,
    maxPoints: index < tierConfigs.length - 1 
      ? tierConfigs[index + 1].minPoints - 1 
      : null // Top tier has no max
  }));

  // Find the highest tier the user qualifies for based on CURRENT points
  // (Check from highest to lowest)
  for (let i = tiersWithRanges.length - 1; i >= 0; i--) {
    if (currentPoints >= tiersWithRanges[i].minPoints) {
      return tiersWithRanges[i];
    }
  }

  // Default to Bronze
  return tiersWithRanges[0];
}

// Helper to get all tiers with their ranges (for display purposes)
export async function getAllTiers(): Promise<TierInfo[]> {
  const { data: settings } = await supabase
    .from("reward_settings")
    .select("*")
    .in("setting_key", [
      "tier_bronze_min", "tier_bronze_discount",
      "tier_silver_min", "tier_silver_discount",
      "tier_gold_min", "tier_gold_discount",
      "tier_platinum_min", "tier_platinum_discount"
    ]);

  const settingsMap: any = {};
  if (settings) {
    settings.forEach(setting => {
      settingsMap[setting.setting_key] = parseInt(setting.setting_value);
    });
  }

  const tierConfigs = [
    {
      name: "Bronze",
      color: "text-orange-600",
      discount: settingsMap.tier_bronze_discount || 5,
      minPoints: settingsMap.tier_bronze_min || 0,
      icon: "award"
    },
    {
      name: "Silver",
      color: "text-gray-400",
      discount: settingsMap.tier_silver_discount || 10,
      minPoints: settingsMap.tier_silver_min || 100,
      icon: "trophy"
    },
    {
      name: "Gold",
      color: "text-yellow-500",
      discount: settingsMap.tier_gold_discount || 15,
      minPoints: settingsMap.tier_gold_min || 500,
      icon: "star"
    },
    {
      name: "Platinum",
      color: "text-purple-500",
      discount: settingsMap.tier_platinum_discount || 20,
      minPoints: settingsMap.tier_platinum_min || 1000,
      icon: "crown"
    }
  ].sort((a, b) => a.minPoints - b.minPoints);

  return tierConfigs.map((tier, index) => ({
    ...tier,
    maxPoints: index < tierConfigs.length - 1 
      ? tierConfigs[index + 1].minPoints - 1 
      : null
  }));
}
