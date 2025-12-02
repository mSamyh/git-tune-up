import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Award, Star, Crown } from "lucide-react";

interface TierConfig {
  name: string;
  icon: any;
  color: string;
  minPoints: number;
  discount: number;
}

export function TierManagement() {
  const [tiers, setTiers] = useState<TierConfig[]>([
    { name: "Bronze", icon: Award, color: "text-orange-600", minPoints: 0, discount: 5 },
    { name: "Silver", icon: Trophy, color: "text-gray-400", minPoints: 500, discount: 10 },
    { name: "Gold", icon: Star, color: "text-yellow-500", minPoints: 1000, discount: 15 },
    { name: "Platinum", icon: Crown, color: "text-purple-500", minPoints: 2000, discount: 20 },
  ]);
  const { toast } = useToast();

  useEffect(() => {
    fetchTierSettings();
  }, []);

  const fetchTierSettings = async () => {
    const { data } = await supabase
      .from("reward_settings")
      .select("*")
      .in("setting_key", [
        "tier_bronze_min", "tier_bronze_discount",
        "tier_silver_min", "tier_silver_discount",
        "tier_gold_min", "tier_gold_discount",
        "tier_platinum_min", "tier_platinum_discount"
      ]);

    if (data) {
      const settingsMap: any = {};
      data.forEach(setting => {
        settingsMap[setting.setting_key] = parseInt(setting.setting_value);
      });

      setTiers([
        {
          name: "Bronze",
          icon: Award,
          color: "text-orange-600",
          minPoints: settingsMap.tier_bronze_min ?? 0,
          discount: settingsMap.tier_bronze_discount ?? 5,
        },
        {
          name: "Silver",
          icon: Trophy,
          color: "text-gray-400",
          minPoints: settingsMap.tier_silver_min ?? 500,
          discount: settingsMap.tier_silver_discount ?? 10,
        },
        {
          name: "Gold",
          icon: Star,
          color: "text-yellow-500",
          minPoints: settingsMap.tier_gold_min ?? 1000,
          discount: settingsMap.tier_gold_discount ?? 15,
        },
        {
          name: "Platinum",
          icon: Crown,
          color: "text-purple-500",
          minPoints: settingsMap.tier_platinum_min ?? 2000,
          discount: settingsMap.tier_platinum_discount ?? 20,
        },
      ]);
    }
  };

  const updateTierSetting = async (tierName: string, field: 'min' | 'discount', value: number) => {
    const key = `tier_${tierName.toLowerCase()}_${field === 'min' ? 'min' : 'discount'}`;
    
    const { error } = await supabase
      .from("reward_settings")
      .update({ setting_value: value.toString() })
      .eq("setting_key", key);

    if (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    } else {
      toast({
        title: "Tier updated",
        description: `${tierName} tier settings saved successfully`,
      });
      fetchTierSettings();
    }
  };

  const handleMinPointsChange = (index: number, value: string) => {
    const numValue = parseInt(value) || 0;
    const updatedTiers = [...tiers];
    updatedTiers[index].minPoints = numValue;
    setTiers(updatedTiers);
  };

  const handleDiscountChange = (index: number, value: string) => {
    const numValue = parseInt(value) || 0;
    const updatedTiers = [...tiers];
    updatedTiers[index].discount = numValue;
    setTiers(updatedTiers);
  };

  // Calculate next tier threshold for display
  const getNextTierThreshold = (index: number) => {
    if (index < tiers.length - 1) {
      return tiers[index + 1].minPoints - 1;
    }
    return null; // Top tier has no max
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tier System Configuration</CardTitle>
        <CardDescription>
          Configure membership tiers based on current points balance. Merchants apply tier discounts at point of sale.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {tiers.map((tier, index) => {
            const Icon = tier.icon;
            const maxPoints = getNextTierThreshold(index);
            return (
              <Card key={tier.name} className="border-2">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Icon className={`h-6 w-6 ${tier.color}`} />
                    <CardTitle className="text-lg">{tier.name} Tier</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`${tier.name}-min`}>Minimum Current Points</Label>
                    <Input
                      id={`${tier.name}-min`}
                      type="number"
                      min="0"
                      value={tier.minPoints}
                      onChange={(e) => handleMinPointsChange(index, e.target.value)}
                      onBlur={() => updateTierSetting(tier.name, 'min', tier.minPoints)}
                      disabled={tier.name === "Bronze"} // Bronze is always 0
                    />
                    <p className="text-xs text-muted-foreground">
                      {tier.name === "Bronze" 
                        ? "Starting tier for all new donors"
                        : `Users need ${tier.minPoints}+ current points for this tier`
                      }
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${tier.name}-discount`}>Merchant Discount %</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`${tier.name}-discount`}
                        type="number"
                        min="0"
                        max="100"
                        value={tier.discount}
                        onChange={(e) => handleDiscountChange(index, e.target.value)}
                        onBlur={() => updateTierSetting(tier.name, 'discount', tier.discount)}
                      />
                      <span className="text-sm font-medium">%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Merchant applies {tier.discount}% discount at checkout
                    </p>
                  </div>
                  <div className="pt-2">
                    <Badge variant="secondary" className="w-full justify-center">
                      Range: {tier.minPoints} - {maxPoints ?? "∞"} pts
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">How Tiers Work:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Users are assigned to a tier based on their <strong>current points balance</strong></li>
            <li>• Tier changes dynamically as points are earned or spent</li>
            <li>• When redeeming rewards, <strong>full points are deducted</strong></li>
            <li>• Merchants apply the tier discount % at point of sale</li>
            <li>• QR code displays donor's tier for merchant reference</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}