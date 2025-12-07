import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Phone, Calendar, Edit, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LocationSelector } from "./LocationSelector";
import { TopDonorBadge, getTopDonorRank } from "./TopDonorBadge";

interface Donor {
  id: string;
  full_name: string;
  phone: string;
  blood_group: string;
  district: string;
  address: string | null;
  avatar_url: string | null;
  availability_status: string;
  available_date: string | null;
  last_donation_date: string | null;
  donation_count?: number;
  source?: string;
  is_registered?: boolean;
  title?: string | null;
  title_color?: string | null;
  bio?: string | null;
}

interface DonorProfileDialogProps {
  donor: Donor;
  isOpen: boolean;
  onClose: () => void;
  topDonors?: any[];
  onUpdate?: () => void;
}

export const DonorProfileDialog = ({ donor, isOpen, onClose, topDonors = [], onUpdate }: DonorProfileDialogProps) => {
  const [donationHistory, setDonationHistory] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDonor, setEditedDonor] = useState(donor);
  const [selectedAtoll, setSelectedAtoll] = useState("");
  const [selectedIsland, setSelectedIsland] = useState("");
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setEditedDonor(donor);
      setIsEditing(false);
      
      // Extract atoll and island from district if available
      if (donor.district && donor.district.includes(' - ')) {
        const [atoll, island] = donor.district.split(' - ');
        setSelectedAtoll(atoll);
        setSelectedIsland(island);
      }
      
      checkOwnProfile();
      fetchDonationHistory();
      checkAdmin();
    }
  }, [isOpen, donor]);

  const checkOwnProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsOwnProfile(false);
      return;
    }
    setIsOwnProfile(user.id === donor.id);
  };

  const fetchDonationHistory = async () => {
    if (donor.source === 'profile') {
      const { data } = await supabase
        .from("donation_history")
        .select("*")
        .eq("donor_id", donor.id)
        .order("donation_date", { ascending: false });
      setDonationHistory(data || []);
    } else {
      const { data } = await supabase
        .from("donor_directory_history")
        .select("*")
        .eq("donor_id", donor.id)
        .order("donation_date", { ascending: false });
      setDonationHistory(data || []);
    }
  };

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    setIsAdmin(!!data);
  };

  const getAvailabilityText = () => {
    const status = donor.availability_status || 'available';
    
    if (status === 'available') {
      return <Badge variant="default" className="bg-green-600">Available</Badge>;
    } else if (status === 'unavailable') {
      // Check if unavailable due to 90-day rule
      if (donor.last_donation_date) {
        const daysSinceLastDonation = Math.floor(
          (new Date().getTime() - new Date(donor.last_donation_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceLastDonation < 90) {
          const daysUntil = 90 - daysSinceLastDonation;
          return <Badge variant="secondary">Available in {daysUntil} days</Badge>;
        }
      }
      return <Badge variant="destructive">Unavailable</Badge>;
    } else if (status === 'available_soon') {
      const daysUntil = donor.available_date 
        ? Math.ceil((new Date(donor.available_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return <Badge variant="secondary">Available in {daysUntil} days</Badge>;
    } else if (status === 'reserved') {
      return <Badge variant="outline">Reserved</Badge>;
    } else {
      return <Badge variant="destructive">Unavailable</Badge>;
    }
  };

  const isFirstTimeDonor = !donor.last_donation_date && donationHistory.length === 0;

  const handleSaveProfile = async () => {
    if (!donor.source || donor.source !== 'profile') {
      toast({
        variant: "destructive",
        title: "Cannot edit",
        description: "Can only edit registered users",
      });
      return;
    }

    const updateData: any = {
      full_name: editedDonor.full_name,
      phone: editedDonor.phone,
      blood_group: editedDonor.blood_group,
      availability_status: editedDonor.availability_status,
    };

    if (selectedAtoll && selectedIsland) {
      updateData.atoll = selectedAtoll;
      updateData.island = selectedIsland;
      updateData.district = `${selectedAtoll} - ${selectedIsland}`;
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", donor.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    } else {
      toast({
        title: "Profile updated",
        description: "Donor profile has been updated successfully",
      });
      setIsEditing(false);
      onUpdate?.();
      onClose();
    }
  };

  const handleCancelEdit = () => {
    setEditedDonor(donor);
    setIsEditing(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="sr-only">Donor Profile</DialogTitle>
            {isAdmin && donor.source === 'profile' && !isEditing && (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Profile Card with Border */}
          <div className="border border-border rounded-2xl p-5 bg-card">
            {/* Centered Profile Header */}
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <Avatar className={`h-24 w-24 ring-4 ring-background shadow-lg ${donor.source === 'directory' ? 'ring-yellow-500/30' : 'ring-primary/10'}`}>
                  <AvatarImage src={donor.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary font-semibold">{donor.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                {(() => {
                  const rank = getTopDonorRank(donor.id, topDonors);
                  return rank > 0 && <TopDonorBadge rank={rank} className="absolute -top-1 -right-1" />;
                })()}
              </div>
              
              {isEditing ? (
                <div className="space-y-1 mt-4 w-full">
                  <Label className="text-xs">Full Name</Label>
                  <Input
                    value={editedDonor.full_name}
                    onChange={(e) => setEditedDonor({ ...editedDonor, full_name: e.target.value })}
                    className="h-9 text-center rounded-xl"
                  />
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-bold mt-4">{donor.full_name}</h3>
                  <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                    {donor.title && (
                      <Badge className={`text-xs rounded-full px-3 ${donor.title_color || "bg-secondary text-secondary-foreground"}`}>
                        {donor.title}
                      </Badge>
                    )}
                    {donor.source === 'directory' && (
                      <Badge variant="outline" className="text-xs rounded-full px-3 border-yellow-500 text-yellow-600">
                        Not Registered
                      </Badge>
                    )}
                    {isFirstTimeDonor && (
                      <Badge variant="secondary" className="text-xs rounded-full px-3">First Time</Badge>
                    )}
                  </div>
                </>
              )}

              {/* Bio */}
              {donor.bio && !isEditing && (
                <p className="text-sm text-muted-foreground mt-3 px-2 max-w-xs">{donor.bio}</p>
              )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2 mt-5">
              <div className="text-center p-3 bg-muted/50 rounded-xl border border-border/50">
                <p className="text-2xl font-bold text-primary">{donor.blood_group}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Blood Type</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-xl border border-border/50">
                <p className="text-2xl font-bold">{donor.donation_count || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Donations</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-xl border border-border/50 flex flex-col items-center justify-center">
                {getAvailabilityText()}
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Status</p>
              </div>
            </div>
          </div>

          {isEditing ? (
            /* Edit Mode - Compact Form */
            <div className="border border-border rounded-2xl p-4 bg-card space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Blood Group</Label>
                  <Select
                    value={editedDonor.blood_group}
                    onValueChange={(value) => setEditedDonor({ ...editedDonor, blood_group: value })}
                  >
                    <SelectTrigger className="h-9 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((group) => (
                        <SelectItem key={group} value={group}>{group}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    value={editedDonor.phone}
                    onChange={(e) => setEditedDonor({ ...editedDonor, phone: e.target.value })}
                    className="h-9 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Location</Label>
                <LocationSelector
                  selectedAtoll={selectedAtoll}
                  selectedIsland={selectedIsland}
                  onAtollChange={setSelectedAtoll}
                  onIslandChange={setSelectedIsland}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Availability Status</Label>
                <Select
                  value={editedDonor.availability_status}
                  onValueChange={(value) => setEditedDonor({ ...editedDonor, availability_status: value })}
                >
                  <SelectTrigger className="h-9 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="unavailable">Unavailable</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="available_soon">Available Soon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            /* View Mode - Contact & Location */
            <div className="border border-border rounded-2xl p-4 bg-card space-y-2">
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">{donor.phone}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{donor.district || 'Not specified'}</p>
                  {donor.address && (
                    <p className="text-xs text-muted-foreground truncate">{donor.address}</p>
                  )}
                </div>
              </div>
              {donor.last_donation_date && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm font-medium">
                      {new Date(donor.last_donation_date).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">(Last donation)</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {isAdmin && donor.source === 'profile' && isEditing && (
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={handleCancelEdit}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSaveProfile}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
