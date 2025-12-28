import { useState, useEffect, useRef } from "react";
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
import { Edit, Trash2, Plus, Gift, Settings, Trophy, Award, Users, Upload, X, ImageIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TierManagement } from "./TierManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUserTier } from "@/lib/tierSystem";
import { PointsAuditPanel } from "./PointsAuditPanel";

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
    partner_logo_url: "",
    category: "",
    is_active: true,
    terms_conditions: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [pointsEditDialogOpen, setPointsEditDialogOpen] = useState(false);
  const [editingDonorPoints, setEditingDonorPoints] = useState<any>(null);
  const [pointsFormData, setPointsFormData] = useState({
    total_points: 0,
    lifetime_points: 0,
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

    // Fetch ALL redemptions for complete audit trail
    const { data: redemptionsData, error: redemptionsError } = await supabase
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
      .order("created_at", { ascending: false });
    
    if (redemptionsError) {
      console.error("Error fetching redemptions:", redemptionsError);
    }
    
    console.log("Redemptions fetched:", redemptionsData?.length || 0, "items");
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
            // Tier is now based on CURRENT points (total_points), not lifetime
            tier: await getUserTier(totalPoints)
          };
        })
      );
      
      // Sort by current points descending (tier-relevant)
      donorsWithTiers.sort((a, b) => b.total_points - a.total_points);
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
        partner_logo_url: reward.partner_logo_url || "",
        category: reward.category,
        is_active: reward.is_active,
        terms_conditions: reward.terms_conditions || "",
      });
      setLogoPreview(reward.partner_logo_url || null);
    } else {
      setEditingReward(null);
      setFormData({
        title: "",
        description: "",
        points_required: 100,
        partner_name: "",
        partner_logo_url: "",
        category: "",
        is_active: true,
        terms_conditions: "",
      });
      setLogoPreview(null);
    }
    setLogoFile(null);
    setDialogOpen(true);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Logo must be less than 2MB",
        });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return formData.partner_logo_url || null;

    setUploadingLogo(true);
    try {
      const fileExt = logoFile.name.split(".").pop();
      const fileName = `partner-logos/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, logoFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setFormData({ ...formData, partner_logo_url: "" });
    if (logoInputRef.current) logoInputRef.current.value = "";
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

    // Upload logo if new file selected
    const logoUrl = await uploadLogo();
    const saveData = {
      ...formData,
      partner_logo_url: logoUrl,
    };

    if (editingReward) {
      const { error } = await supabase
        .from("reward_catalog")
        .update(saveData)
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
        .insert(saveData);

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

  const openPointsEditDialog = (donor: any) => {
    setEditingDonorPoints(donor);
    setPointsFormData({
      total_points: donor.total_points,
      lifetime_points: donor.lifetime_points,
    });
    setPointsEditDialogOpen(true);
  };

  const handlePointsSave = async () => {
    if (!editingDonorPoints) return;

    // Update donor_points record (we know it exists since we're editing)
    const { error } = await supabase
      .from("donor_points")
      .update({
        total_points: pointsFormData.total_points,
        lifetime_points: pointsFormData.lifetime_points,
        updated_at: new Date().toISOString(),
      })
      .eq("donor_id", editingDonorPoints.donor_id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
      return;
    }

    // Record transaction for manual adjustment
    await supabase
      .from("points_transactions")
      .insert({
        donor_id: editingDonorPoints.donor_id,
        points: pointsFormData.total_points - editingDonorPoints.total_points,
        transaction_type: "adjusted",
        description: `Manual points adjustment by admin`,
      });

    toast({ title: "Points updated successfully" });
    setPointsEditDialogOpen(false);
    fetchRewardsData();
  };

  return (
    <div className="space-y-6">
      {/* Tier Management */}
      <TierManagement />

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="w-full h-auto flex flex-wrap gap-1 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="settings" className="flex-1 min-w-[60px] text-xs sm:text-sm px-2 py-1.5">Settings</TabsTrigger>
          <TabsTrigger value="rewards" className="flex-1 min-w-[60px] text-xs sm:text-sm px-2 py-1.5">Rewards</TabsTrigger>
          <TabsTrigger value="redemptions" className="flex-1 min-w-[70px] text-xs sm:text-sm px-2 py-1.5">Redemptions</TabsTrigger>
          <TabsTrigger value="users" className="flex-1 min-w-[60px] text-xs sm:text-sm px-2 py-1.5">Users</TabsTrigger>
          <TabsTrigger value="audit" className="flex-1 min-w-[50px] text-xs sm:text-sm px-2 py-1.5">Audit</TabsTrigger>
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
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[500px] sm:min-w-0 px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Logo</TableHead>
                    <TableHead className="text-xs">Title</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Partner</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs">Points</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.map((reward) => (
                    <TableRow key={reward.id}>
                      <TableCell className="py-2">
                        {reward.partner_logo_url ? (
                          <img 
                            src={reward.partner_logo_url} 
                            alt={reward.partner_name}
                            className="w-8 h-8 rounded-lg object-cover border"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{reward.title}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{reward.partner_name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{reward.partner_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{reward.category}</Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">{reward.points_required}</TableCell>
                      <TableCell>
                        {reward.is_active ? (
                          <Badge className="bg-green-500 text-[10px]">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Off</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openDialog(reward)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(reward.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redemptions">
          {/* Redemptions - Full History */}
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            All Redemptions History
          </CardTitle>
          <CardDescription>Complete audit trail of all reward redemptions ({redemptions.length} total)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">Pending: {redemptions.filter(r => r.status === 'pending').length}</Badge>
            <Badge variant="outline" className="bg-green-50 text-xs">Verified: {redemptions.filter(r => r.status === 'verified').length}</Badge>
            <Badge variant="outline" className="bg-red-50 text-xs">Expired: {redemptions.filter(r => r.status === 'expired').length}</Badge>
            <Badge variant="outline" className="text-xs">Cancelled: {redemptions.filter(r => r.status === 'cancelled').length}</Badge>
          </div>
          <div className="max-h-[600px] overflow-y-auto overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[600px] sm:min-w-0 px-4 sm:px-0">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Donor</TableHead>
                    <TableHead className="text-xs">Reward</TableHead>
                    <TableHead className="text-xs">Pts</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Verified</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Expires</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redemptions.map((redemption) => (
                    <TableRow key={redemption.id}>
                      <TableCell className="text-xs whitespace-nowrap py-2">
                        {new Date(redemption.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-xs sm:text-sm">{redemption.profiles?.full_name}</p>
                          <p className="text-[10px] text-muted-foreground hidden sm:block">{redemption.profiles?.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-xs sm:text-sm">{redemption.reward_catalog?.title}</p>
                          <p className="text-[10px] text-muted-foreground hidden sm:block">{redemption.reward_catalog?.partner_name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{redemption.points_spent}</TableCell>
                      <TableCell>
                        {redemption.status === "verified" ? (
                          <Badge className="bg-green-500 text-[10px]">✓</Badge>
                        ) : redemption.status === "cancelled" ? (
                          <Badge variant="outline" className="text-[10px]">Canc</Badge>
                        ) : redemption.status === "expired" ? (
                          <Badge variant="destructive" className="text-[10px]">Exp</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Pend</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap hidden md:table-cell">
                        {redemption.verified_at ? new Date(redemption.verified_at).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap hidden sm:table-cell">
                        {new Date(redemption.expires_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {redemption.status === "pending" && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
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
            </div>
          </div>
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          {/* All Users Points - Grouped by Blood Group */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Donor Points & Tiers
              </CardTitle>
              <CardDescription>View all donors' reward points and tier status (grouped by blood group)</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full" defaultValue={["A+", "B+", "O+", "AB+"]}>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bloodGroup) => {
                  const groupDonors = allDonorPoints.filter(d => d.profiles?.blood_group === bloodGroup);
                  if (groupDonors.length === 0) return null;
                  return (
                    <AccordionItem key={bloodGroup} value={bloodGroup}>
                      <AccordionTrigger className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-bold">{bloodGroup}</Badge>
                          <span className="text-muted-foreground">({groupDonors.length} donors)</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                          <div className="min-w-[450px] sm:min-w-0 px-4 sm:px-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Donor</TableHead>
                                  <TableHead className="text-xs">Current</TableHead>
                                  <TableHead className="text-xs hidden sm:table-cell">Lifetime</TableHead>
                                  <TableHead className="text-xs">Tier</TableHead>
                                  <TableHead className="text-xs">Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {groupDonors.map((donor) => (
                                  <TableRow key={donor.id}>
                                    <TableCell className="py-2">
                                      <div>
                                        <p className="font-medium text-sm">{donor.profiles?.full_name}</p>
                                        <p className="text-[10px] text-muted-foreground hidden sm:block">{donor.profiles?.phone}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <span className="font-semibold text-sm">{donor.total_points}</span>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">
                                      <span className="text-sm text-muted-foreground">{donor.lifetime_points}</span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge 
                                        className={`text-[10px] ${
                                          donor.tier?.name === "Platinum" ? "bg-purple-500" :
                                          donor.tier?.name === "Gold" ? "bg-yellow-500" :
                                          donor.tier?.name === "Silver" ? "bg-gray-400" :
                                          "bg-orange-500"
                                        }`}
                                      >
                                        {donor.tier?.name}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-7 w-7 p-0"
                                        onClick={() => openPointsEditDialog(donor)}
                                      >
                                        <Edit className="h-3.5 w-3.5" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <PointsAuditPanel />
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
            {/* Partner Logo Upload */}
            <div className="grid gap-2">
              <Label>Partner Logo</Label>
              <div className="flex items-center gap-3">
                {logoPreview ? (
                  <div className="relative">
                    <img 
                      src={logoPreview} 
                      alt="Partner logo" 
                      className="w-16 h-16 rounded-lg object-cover border"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                      onClick={removeLogo}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30">
                    <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    className="hidden"
                    id="logo-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {logoPreview ? "Change" : "Upload"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max 2MB. JPG, PNG recommended.
                  </p>
                </div>
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
            <Button onClick={handleSave} disabled={uploadingLogo}>
              {uploadingLogo ? "Uploading..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Points Edit Dialog */}
      <Dialog open={pointsEditDialogOpen} onOpenChange={setPointsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Points - {editingDonorPoints?.profiles?.full_name}</DialogTitle>
            <DialogDescription>
              Manually adjust donor's reward points. This will create a transaction record.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="total_points">Current Points</Label>
              <Input
                id="total_points"
                type="number"
                value={pointsFormData.total_points}
                onChange={(e) => setPointsFormData({ ...pointsFormData, total_points: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Points available for redemption
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lifetime_points">Lifetime Points</Label>
              <Input
                id="lifetime_points"
                type="number"
                value={pointsFormData.lifetime_points}
                onChange={(e) => setPointsFormData({ ...pointsFormData, lifetime_points: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Total points earned (affects tier status)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPointsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePointsSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}