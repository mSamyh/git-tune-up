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
          minPoints: settingsMap.tier_bronze_min || 0,
          discount: settingsMap.tier_bronze_discount || 5,
        },
        {
          name: "Silver",
          icon: Trophy,
          color: "text-gray-400",
          minPoints: settingsMap.tier_silver_min || 500,
          discount: settingsMap.tier_silver_discount || 10,
        },
        {
          name: "Gold",
          icon: Star,
          color: "text-yellow-500",
          minPoints: settingsMap.tier_gold_min || 1000,
          discount: settingsMap.tier_gold_discount || 15,
        },
        {
          name: "Platinum",
          icon: Crown,
          color: "text-purple-500",
          minPoints: settingsMap.tier_platinum_min || 2000,
          discount: settingsMap.tier_platinum_discount || 20,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tier System Configuration</CardTitle>
        <CardDescription>
          Configure membership tiers based on lifetime points earned. Higher tiers get better discounts on rewards.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {tiers.map((tier, index) => {
            const Icon = tier.icon;
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
                    <Label htmlFor={`${tier.name}-min`}>Minimum Lifetime Points</Label>
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
                        : `Users need ${tier.minPoints} lifetime points to reach this tier`
                      }
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${tier.name}-discount`}>Discount Percentage</Label>
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
                      {tier.name} members save {tier.discount}% on all reward redemptions
                    </p>
                  </div>
                  <div className="pt-2">
                    <Badge variant="secondary" className="w-full justify-center">
                      Example: 1000 pts reward = {1000 - Math.round(1000 * tier.discount / 100)} pts after discount
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
            <li>• Users are automatically assigned to a tier based on their <strong>lifetime points</strong></li>
            <li>• Each donation earns points (configurable in main settings)</li>
            <li>• Higher tiers receive percentage discounts on all reward redemptions</li>
            <li>• Tier status is permanent - users never lose their tier even if they spend points</li>
            <li>• Discounts are automatically applied when redeeming rewards</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}