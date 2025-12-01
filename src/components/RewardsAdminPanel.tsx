import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, Plus, Gift, Settings, Trophy, Award, Users } from "lucide-react";
import { TierManagement } from "./TierManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUserTier } from "@/lib/tierSystem";

interface Reward {
  id: string;
  title: string;
  description: string | null;
  points_required: number;
  partner_name: string;
  partner_logo_url: string | null;
  category: string;
  is_active: boolean;
  terms_conditions: string | null;
}

interface RewardSettings {
  points_per_donation: string;
  qr_expiry_hours: string;
  rewards_enabled: string;
}

export function RewardsAdminPanel() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [allDonorPoints, setAllDonorPoints] = useState<any[]>([]);
  const [settings, setSettings] = useState<RewardSettings>({
    points_per_donation: "100",
    qr_expiry_hours: "24",
    rewards_enabled: "true",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    points_required: 100,
    partner_name: "",
    category: "",
    is_active: true,
    terms_conditions: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchRewardsData();
  }, []);

  const fetchRewardsData = async () => {
    // Fetch rewards
    const { data: rewardsData } = await supabase
      .from("reward_catalog")
      .select("*")
      .order("points_required");
    
    setRewards(rewardsData || []);

    // Fetch redemptions
    const { data: redemptionsData } = await supabase
      .from("redemption_history")
      .select(`
        *,
        reward_catalog (
          title,
          partner_name
        ),
        profiles (
          full_name,
          phone
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50);
    
    setRedemptions(redemptionsData || []);

    // Fetch all donor points
    const { data: donorPointsData } = await supabase
      .from("donor_points")
      .select("*")
      .order("lifetime_points", { ascending: false });
    
    // Fetch all profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, phone, blood_group");
    
    // Fetch all donors with donation history from profiles
    const { data: donorsWithDonations } = await supabase
      .from("donation_history")
      .select("donor_id");
    
    // Fetch directory donors with linked profiles
    const { data: directoryDonors } = await supabase
      .from("donor_directory")
      .select("id, linked_profile_id")
      .not("linked_profile_id", "is", null);
    
    // Fetch directory donation history
    const { data: directoryDonations } = await supabase
      .from("donor_directory_history")
      .select("donor_id");
    
    // Create a set of unique donor IDs who have donations
    const donorIdsWithDonations = new Set(
      donorsWithDonations?.map(d => d.donor_id) || []
    );
    
    // Add linked profile IDs from directory donors who have donation history
    const directoryDonorIds = new Set(directoryDonations?.map(d => d.donor_id) || []);
    directoryDonors?.forEach(dd => {
      if (dd.linked_profile_id && directoryDonorIds.has(dd.id)) {
        donorIdsWithDonations.add(dd.linked_profile_id);
      }
    });
    
    // Fetch tier info for each donor and match with profiles
    if (profilesData) {
      const pointsMap = new Map(donorPointsData?.map(p => [p.donor_id, p]) || []);
      const profilesMap = new Map(profilesData.map(p => [p.id, p]));
      
      // Get all donors who have either points, donations, or simply exist as profiles
      const allDonorIds = new Set([
        ...(donorPointsData?.map(d => d.donor_id) || []),
        ...Array.from(donorIdsWithDonations),
        ...profilesData.map(p => p.id),
      ]);
      
      const donorsWithTiers = await Promise.all(
        Array.from(allDonorIds).map(async (donorId) => {
          const pointsRecord = pointsMap.get(donorId);
          const profile = profilesMap.get(donorId);
          
          // If no points record exists, create a default one
          const lifetimePoints = pointsRecord?.lifetime_points || 0;
          const totalPoints = pointsRecord?.total_points || 0;
          
          return {
            donor_id: donorId,
            total_points: totalPoints,
            lifetime_points: lifetimePoints,
            created_at: pointsRecord?.created_at || new Date().toISOString(),
            updated_at: pointsRecord?.updated_at || new Date().toISOString(),
            id: pointsRecord?.id || donorId,
            profiles: profile,
            tier: await getUserTier(lifetimePoints)
          };
        })
      );
      
      // Sort by lifetime points descending
      donorsWithTiers.sort((a, b) => b.lifetime_points - a.lifetime_points);
      setAllDonorPoints(donorsWithTiers);
    }

    // Fetch settings
    const { data: settingsData } = await supabase
      .from("reward_settings")
      .select("*");
    
    if (settingsData) {
      const settingsObj: any = {};
      settingsData.forEach(setting => {
        settingsObj[setting.setting_key] = setting.setting_value;
      });
      setSettings(settingsObj);
    }
  };

  const openDialog = (reward?: Reward) => {
    if (reward) {
      setEditingReward(reward);
      setFormData({
        title: reward.title,
        description: reward.description || "",
        points_required: reward.points_required,
        partner_name: reward.partner_name,
        category: reward.category,
        is_active: reward.is_active,
        terms_conditions: reward.terms_conditions || "",
      });
    } else {
      setEditingReward(null);
      setFormData({
        title: "",
        description: "",
        points_required: 100,
        partner_name: "",
        category: "",
        is_active: true,
        terms_conditions: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.partner_name || !formData.category) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in all required fields",
      });
      return;
    }

    if (editingReward) {
      const { error } = await supabase
        .from("reward_catalog")
        .update(formData)
        .eq("id", editingReward.id);

      if (error) {
        toast({
          variant: "destructive",
          title: "Update failed",
          description: error.message,
        });
      } else {
        toast({ title: "Reward updated successfully" });
        setDialogOpen(false);
        fetchRewardsData();
      }
    } else {
      const { error } = await supabase
        .from("reward_catalog")
        .insert(formData);

      if (error) {
        toast({
          variant: "destructive",
          title: "Creation failed",
          description: error.message,
        });
      } else {
        toast({ title: "Reward created successfully" });
        setDialogOpen(false);
        fetchRewardsData();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this reward? This will not affect existing redemptions.")) return;

    const { error } = await supabase
      .from("reward_catalog")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message,
      });
    } else {
      toast({ title: "Reward deleted successfully" });
      fetchRewardsData();
    }
  };

  const handleSettingUpdate = async (key: string, value: string) => {
    const { error } = await supabase
      .from("reward_settings")
      .update({ setting_value: value })
      .eq("setting_key", key);

    if (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    } else {
      toast({ title: "Setting updated successfully" });
      fetchRewardsData();
    }
  };

  const cancelRedemption = async (id: string) => {
    if (!confirm("Cancel this redemption? Points will be refunded to the donor.")) return;

    const redemption = redemptions.find(r => r.id === id);
    if (!redemption) return;

    // Update redemption status
    const { error: redemptionError } = await supabase
      .from("redemption_history")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (redemptionError) {
      toast({
        variant: "destructive",
        title: "Cancel failed",
        description: redemptionError.message,
      });
      return;
    }

    // Refund points
    const { data: pointsData } = await supabase
      .from("donor_points")
      .select("total_points")
      .eq("donor_id", redemption.donor_id)
      .single();

    if (pointsData) {
      await supabase
        .from("donor_points")
        .update({ 
          total_points: pointsData.total_points + redemption.points_spent 
        })
        .eq("donor_id", redemption.donor_id);

      // Record transaction
      await supabase
        .from("points_transactions")
        .insert({
          donor_id: redemption.donor_id,
          points: redemption.points_spent,
          transaction_type: "adjusted",
          description: `Refund for cancelled redemption: ${redemption.reward_catalog.title}`,
        });
    }

    toast({ title: "Redemption cancelled and points refunded" });
    fetchRewardsData();
  };

  const runCleanup = async () => {
    if (!confirm("Run expired voucher cleanup? This will:\n- Refund points for expired vouchers\n- Delete vouchers older than 7 days")) return;

    toast({ title: "Running cleanup...", description: "This may take a few moments" });

    try {
      const { data, error } = await supabase.functions.invoke("cleanup-expired-vouchers");

      if (error) throw error;

      toast({
        title: "Cleanup completed",
        description: `Expired: ${data.expired_and_refunded || 0}, Deleted: ${data.deleted_old_vouchers || 0}`,
      });

      fetchRewardsData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Cleanup failed",
        description: error.message || "Failed to run cleanup",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Tier Management */}
      <TierManagement />

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="redemptions">Redemptions</TabsTrigger>
          <TabsTrigger value="users">All Users</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          {/* Settings Card */}
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Reward System Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Points Per Donation</Label>
              <Input
                type="number"
                value={settings.points_per_donation}
                onChange={(e) => setSettings({ ...settings, points_per_donation: e.target.value })}
                onBlur={() => handleSettingUpdate("points_per_donation", settings.points_per_donation)}
              />
            </div>
            <div className="space-y-2">
              <Label>QR Code Expiry (hours)</Label>
              <Input
                type="number"
                value={settings.qr_expiry_hours}
                onChange={(e) => setSettings({ ...settings, qr_expiry_hours: e.target.value })}
                onBlur={() => handleSettingUpdate("qr_expiry_hours", settings.qr_expiry_hours)}
              />
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <Switch
                checked={settings.rewards_enabled === "true"}
                onCheckedChange={(checked) => {
                  const value = checked ? "true" : "false";
                  setSettings({ ...settings, rewards_enabled: value });
                  handleSettingUpdate("rewards_enabled", value);
                }}
              />
              <Label>Enable Rewards System</Label>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Voucher Cleanup</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Manually run cleanup to refund expired vouchers and delete old ones
                </p>
              </div>
              <Button onClick={runCleanup} variant="outline">
                Run Cleanup
              </Button>
            </div>
          </div>
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards">
          {/* Rewards Catalog */}
          <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Rewards Catalog
              </CardTitle>
              <CardDescription>Manage available rewards for donors</CardDescription>
            </div>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Reward
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rewards.map((reward) => (
                <TableRow key={reward.id}>
                  <TableCell className="font-medium">{reward.title}</TableCell>
                  <TableCell>{reward.partner_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{reward.category}</Badge>
                  </TableCell>
                  <TableCell>{reward.points_required} pts</TableCell>
                  <TableCell>
                    {reward.is_active ? (
                      <Badge className="bg-green-500">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openDialog(reward)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(reward.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redemptions">
          {/* Redemptions */}
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Recent Redemptions
          </CardTitle>
          <CardDescription>Manage voucher redemptions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Donor</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {redemptions.map((redemption) => (
                <TableRow key={redemption.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{redemption.profiles?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{redemption.profiles?.phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>{redemption.reward_catalog?.title}</TableCell>
                  <TableCell>{redemption.points_spent} pts</TableCell>
                  <TableCell>
                    {redemption.status === "verified" ? (
                      <Badge className="bg-green-500">Verified</Badge>
                    ) : redemption.status === "cancelled" ? (
                      <Badge variant="outline">Cancelled</Badge>
                    ) : redemption.status === "expired" ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(redemption.expires_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {redemption.status === "pending" && (
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => cancelRedemption(redemption.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          {/* All Users Points */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Donor Points & Tiers
              </CardTitle>
              <CardDescription>View all donors' reward points and tier status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Donor</TableHead>
                    <TableHead>Blood Group</TableHead>
                    <TableHead>Current Points</TableHead>
                    <TableHead>Lifetime Points</TableHead>
                    <TableHead>Tier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allDonorPoints.map((donor) => (
                    <TableRow key={donor.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{donor.profiles?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{donor.profiles?.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{donor.profiles?.blood_group}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{donor.total_points}</span> pts
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{donor.lifetime_points}</span> pts
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={
                            donor.tier?.name === "Platinum" ? "bg-purple-500" :
                            donor.tier?.name === "Gold" ? "bg-yellow-500" :
                            donor.tier?.name === "Silver" ? "bg-gray-400" :
                            "bg-orange-500"
                          }
                        >
                          {donor.tier?.name} ({donor.tier?.discount}% off)
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reward Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingReward ? "Edit Reward" : "Add New Reward"}</DialogTitle>
            <DialogDescription>
              Configure reward details and partner information
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="partner">Partner Name *</Label>
                <Input
                  id="partner"
                  value={formData.partner_name}
                  onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="points">Points Required *</Label>
                <Input
                  id="points"
                  type="number"
                  value={formData.points_required}
                  onChange={(e) => setFormData({ ...formData, points_required: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Fitness">Fitness</SelectItem>
                  <SelectItem value="Restaurant">Restaurant</SelectItem>
                  <SelectItem value="Retail">Retail</SelectItem>
                  <SelectItem value="Entertainment">Entertainment</SelectItem>
                  <SelectItem value="Transportation">Transportation</SelectItem>
                  <SelectItem value="Education">Education</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="terms">Terms & Conditions</Label>
              <Textarea
                id="terms"
                value={formData.terms_conditions}
                onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}