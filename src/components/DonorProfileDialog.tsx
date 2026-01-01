import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Phone, Calendar, Edit, Save, X, Check, Clock, Droplet, Heart, ChevronRight, Sparkles, MessageCircle } from "lucide-react";
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

  const getStatusColor = () => {
    const status = donor.availability_status || 'available';
    switch (status) {
      case 'available': return 'from-green-400 to-emerald-500';
      case 'reserved': return 'from-amber-400 to-orange-500';
      case 'available_soon': return 'from-amber-400 to-orange-500';
      default: return 'from-red-400 to-rose-500';
    }
  };

  const getStatusDotColor = () => {
    const status = donor.availability_status || 'available';
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'reserved': return 'bg-amber-500';
      case 'available_soon': return 'bg-amber-500';
      default: return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    const status = donor.availability_status || 'available';
    
    if (status === 'available') {
      return 'Available to donate';
    } else if (status === 'unavailable') {
      if (donor.last_donation_date) {
        const daysSinceLastDonation = Math.floor(
          (new Date().getTime() - new Date(donor.last_donation_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceLastDonation < 90) {
          const daysUntil = 90 - daysSinceLastDonation;
          return `Available in ${daysUntil} days`;
        }
      }
      return 'Currently unavailable';
    } else if (status === 'available_soon') {
      const daysUntil = donor.available_date 
        ? Math.ceil((new Date(donor.available_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return `Available in ${daysUntil} days`;
    } else if (status === 'reserved') {
      return 'Reserved for donation';
    }
    return 'Currently unavailable';
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

  const handleCall = () => {
    window.location.href = `tel:${donor.phone}`;
  };

  const handleSMS = () => {
    window.location.href = `sms:${donor.phone}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-background border-border p-0 gap-0 rounded-xl">
        <DialogTitle className="sr-only">Donor Profile</DialogTitle>
        
        {/* Instagram-style Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
          <button onClick={onClose} className="p-1">
            <X className="h-6 w-6" />
          </button>
          <span className="font-semibold">Profile</span>
          <div className="w-6" /> {/* Spacer */}
        </div>

        <div className="p-4">
          {/* Profile Header - Instagram style */}
          <div className="flex items-center gap-4 mb-4">
            {/* Avatar with gradient ring */}
            <div className="relative flex-shrink-0">
              <div className={`p-[3px] rounded-full bg-gradient-to-tr ${getStatusColor()}`}>
                <div className="p-[2px] rounded-full bg-background">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={donor.avatar_url || undefined} />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary font-semibold">
                      {donor.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
              {/* Status indicator */}
              <div className={`absolute bottom-0 right-0 h-5 w-5 rounded-full border-2 border-background flex items-center justify-center ${getStatusDotColor()}`}>
                {donor.availability_status === 'available' && <Check className="h-3 w-3 text-white" />}
                {donor.availability_status === 'reserved' && <Clock className="h-3 w-3 text-white" />}
                {donor.availability_status === 'available_soon' && <Clock className="h-3 w-3 text-white" />}
                {donor.availability_status === 'unavailable' && <X className="h-3 w-3 text-white" />}
              </div>
              {(() => {
                const rank = getTopDonorRank(donor.id, topDonors);
                return rank > 0 && <TopDonorBadge rank={rank} className="absolute -top-1 -left-1" />;
              })()}
            </div>

            {/* Stats */}
            <div className="flex-1 flex justify-around">
              <div className="text-center">
                <p className="text-xl font-bold">{donor.donation_count || 0}</p>
                <p className="text-xs text-muted-foreground">Donations</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-primary">{donor.blood_group}</p>
                <p className="text-xs text-muted-foreground">Blood</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-emerald-500">{donor.donation_count || 0}</p>
                <p className="text-xs text-muted-foreground">Lives</p>
              </div>
            </div>
          </div>

          {/* Name and Bio */}
          <div className="mb-4">
            <h1 className="text-base font-bold">{donor.full_name}</h1>
            {donor.title && (
              <Badge 
                className="text-[10px] border-0 font-medium px-2 py-0.5 mt-1"
                style={{ 
                  backgroundColor: donor.title_color ? `${donor.title_color}20` : 'hsl(var(--primary) / 0.1)',
                  color: donor.title_color || 'hsl(var(--primary))'
                }}
              >
                {donor.title}
              </Badge>
            )}
            
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-full ${getStatusDotColor()}`} />
              {getStatusText()}
            </p>
            
            {/* Badges */}
            <div className="flex flex-wrap gap-1 mt-2">
              {donor.source === 'directory' && (
                <Badge variant="outline" className="text-xs rounded-full px-2 border-amber-500 text-amber-600">
                  Not Registered
                </Badge>
              )}
              {isFirstTimeDonor && (
                <Badge variant="secondary" className="text-xs rounded-full px-2">First Time</Badge>
              )}
            </div>

            {donor.bio && (
              <p className="text-sm mt-2">{donor.bio}</p>
            )}
            
            {/* Location */}
            {donor.district && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {donor.district.split(' - ')[1] || donor.district}
              </p>
            )}
          </div>

          {/* Action Buttons - Instagram style */}
          {!isEditing ? (
            <div className="flex gap-2 mb-4">
              <Button 
                className="flex-1 rounded-lg h-9 text-sm font-semibold"
                onClick={handleCall}
              >
                <Phone className="h-4 w-4 mr-1" />
                Call
              </Button>
              <Button 
                variant="secondary" 
                className="flex-1 rounded-lg h-9 text-sm font-semibold"
                onClick={handleSMS}
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                Message
              </Button>
              {isAdmin && donor.source === 'profile' && (
                <Button 
                  variant="outline"
                  size="icon"
                  className="rounded-lg h-9 w-9"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            /* Edit Mode */
            <Card className="rounded-xl border-border/50 mb-4">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Full Name</Label>
                  <Input
                    value={editedDonor.full_name}
                    onChange={(e) => setEditedDonor({ ...editedDonor, full_name: e.target.value })}
                    className="h-9 rounded-xl"
                  />
                </div>
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
                
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit} className="flex-1 rounded-xl">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveProfile} className="flex-1 rounded-xl">
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Cards */}
          {!isEditing && (
            <div className="space-y-2">
              <Card className="rounded-xl border-border/50 overflow-hidden">
                <button className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="text-sm font-medium">{donor.phone}</p>
                    </div>
                  </div>
                </button>
                
                {donor.district && (
                  <>
                    <div className="border-t border-border/50" />
                    <div className="flex items-center gap-3 p-3">
                      <MapPin className="h-5 w-5 text-emerald-500" />
                      <div className="text-left">
                        <p className="text-xs text-muted-foreground">Location</p>
                        <p className="text-sm font-medium">{donor.district}</p>
                      </div>
                    </div>
                  </>
                )}
                
                {donor.last_donation_date && (
                  <>
                    <div className="border-t border-border/50" />
                    <div className="flex items-center gap-3 p-3">
                      <Calendar className="h-5 w-5 text-blue-500" />
                      <div className="text-left">
                        <p className="text-xs text-muted-foreground">Last Donation</p>
                        <p className="text-sm font-medium">
                          {new Date(donor.last_donation_date).toLocaleDateString('en-US', { 
                            year: 'numeric', month: 'short', day: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
