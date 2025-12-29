import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { 
  Trophy, Plus, Edit, Trash2, Save, X, Heart, Star, Award, Crown, Zap, 
  Target, Medal, Sparkles, Flame, GripVertical 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon_name: string;
  color: string;
  requirement_type: "donations" | "points";
  requirement_value: number;
  is_active: boolean;
  sort_order: number;
}

const iconOptions = [
  { name: "Heart", icon: Heart, label: "Heart" },
  { name: "Star", icon: Star, label: "Star" },
  { name: "Award", icon: Award, label: "Award" },
  { name: "Trophy", icon: Trophy, label: "Trophy" },
  { name: "Crown", icon: Crown, label: "Crown" },
  { name: "Zap", icon: Zap, label: "Zap" },
  { name: "Target", icon: Target, label: "Target" },
  { name: "Medal", icon: Medal, label: "Medal" },
  { name: "Sparkles", icon: Sparkles, label: "Sparkles" },
  { name: "Flame", icon: Flame, label: "Flame" },
];

const colorOptions = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#6366f1", label: "Indigo" },
  { value: "#a855f7", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
];

const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
  Heart, Star, Award, Trophy, Crown, Zap, Target, Medal, Sparkles, Flame
};

export function AchievementsAdminPanel() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    icon_name: "Award",
    color: "#f59e0b",
    requirement_type: "donations" as "donations" | "points",
    requirement_value: 1,
    is_active: true,
    sort_order: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("achievements")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      toast({ variant: "destructive", title: "Error loading achievements", description: error.message });
    } else {
      const typed = (data || []).map(a => ({
        ...a,
        requirement_type: a.requirement_type as "donations" | "points"
      }));
      setAchievements(typed);
    }
    setLoading(false);
  };

  const openCreateDialog = () => {
    setEditingAchievement(null);
    setFormData({
      title: "",
      description: "",
      icon_name: "Award",
      color: "#f59e0b",
      requirement_type: "donations",
      requirement_value: 1,
      is_active: true,
      sort_order: achievements.length + 1,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (achievement: Achievement) => {
    setEditingAchievement(achievement);
    setFormData({
      title: achievement.title,
      description: achievement.description,
      icon_name: achievement.icon_name,
      color: achievement.color,
      requirement_type: achievement.requirement_type,
      requirement_value: achievement.requirement_value,
      is_active: achievement.is_active,
      sort_order: achievement.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({ variant: "destructive", title: "Please fill in all fields" });
      return;
    }

    if (editingAchievement) {
      const { error } = await supabase
        .from("achievements")
        .update(formData)
        .eq("id", editingAchievement.id);

      if (error) {
        toast({ variant: "destructive", title: "Update failed", description: error.message });
      } else {
        toast({ title: "Achievement updated" });
        setDialogOpen(false);
        fetchAchievements();
      }
    } else {
      const { error } = await supabase
        .from("achievements")
        .insert(formData);

      if (error) {
        toast({ variant: "destructive", title: "Create failed", description: error.message });
      } else {
        toast({ title: "Achievement created" });
        setDialogOpen(false);
        fetchAchievements();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this achievement?")) return;

    const { error } = await supabase
      .from("achievements")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Delete failed", description: error.message });
    } else {
      toast({ title: "Achievement deleted" });
      fetchAchievements();
    }
  };

  const toggleActive = async (achievement: Achievement) => {
    const { error } = await supabase
      .from("achievements")
      .update({ is_active: !achievement.is_active })
      .eq("id", achievement.id);

    if (error) {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    } else {
      fetchAchievements();
    }
  };

  const IconPreview = iconMap[formData.icon_name] || Award;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Achievements</CardTitle>
              <CardDescription className="text-xs">Manage donor milestones and badges</CardDescription>
            </div>
          </div>
          <Button onClick={openCreateDialog} size="sm" className="rounded-xl">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Icon</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="hidden sm:table-cell">Requirement</TableHead>
                <TableHead className="w-16">Active</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {achievements.map((achievement) => {
                const IconComponent = iconMap[achievement.icon_name] || Award;
                return (
                  <TableRow key={achievement.id}>
                    <TableCell>
                      <div 
                        className="h-8 w-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: achievement.color }}
                      >
                        <IconComponent className="h-4 w-4 text-white" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{achievement.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{achievement.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {achievement.requirement_value} {achievement.requirement_type === "donations" ? "donations" : "points"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={achievement.is_active}
                        onCheckedChange={() => toggleActive(achievement)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditDialog(achievement)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(achievement.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {achievements.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No achievements yet. Create your first one!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingAchievement ? "Edit Achievement" : "New Achievement"}</DialogTitle>
            <DialogDescription>
              {editingAchievement ? "Update the achievement details" : "Create a new milestone badge"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Preview */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <div 
                className="h-12 w-12 rounded-full flex items-center justify-center shadow-md"
                style={{ backgroundColor: formData.color }}
              >
                <IconPreview className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-semibold">{formData.title || "Achievement Title"}</p>
                <p className="text-xs text-muted-foreground">{formData.description || "Description"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Blood Hero"
                  className="rounded-xl"
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Donate 10 times"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Icon</Label>
                <Select
                  value={formData.icon_name}
                  onValueChange={(value) => setFormData({ ...formData, icon_name: value })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((opt) => (
                      <SelectItem key={opt.name} value={opt.name}>
                        <div className="flex items-center gap-2">
                          <opt.icon className="h-4 w-4" />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <Select
                  value={formData.color}
                  onValueChange={(value) => setFormData({ ...formData, color: value })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-4 w-4 rounded-full" 
                          style={{ backgroundColor: formData.color }} 
                        />
                        {colorOptions.find(c => c.value === formData.color)?.label}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-4 w-4 rounded-full" 
                            style={{ backgroundColor: opt.value }} 
                          />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Requirement Type</Label>
                <Select
                  value={formData.requirement_type}
                  onValueChange={(value: "donations" | "points") => setFormData({ ...formData, requirement_type: value })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="donations">Donations</SelectItem>
                    <SelectItem value="points">Points</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Requirement Value</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.requirement_value}
                  onChange={(e) => setFormData({ ...formData, requirement_value: parseInt(e.target.value) || 1 })}
                  className="rounded-xl"
                />
              </div>

              <div className="col-span-2 flex items-center justify-between p-3 rounded-xl bg-muted/30">
                <div>
                  <Label className="text-sm font-medium">Active</Label>
                  <p className="text-xs text-muted-foreground">Show this achievement to donors</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleSave} className="rounded-xl">
              <Save className="h-4 w-4 mr-1" />
              {editingAchievement ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}