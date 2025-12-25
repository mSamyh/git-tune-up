import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Phone, Calendar, Edit, Save, X, Check, Clock, Droplet, Heart, ChevronRight, Sparkles } from "lucide-react";
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-transparent border-none p-0 shadow-none [&>button]:hidden">
        <DialogTitle className="sr-only">Donor Profile</DialogTitle>
        
        <div className="relative">
          {/* Cover gradient */}
          <div className="h-20 bg-gradient-to-br from-primary via-primary/80 to-primary/60 rounded-t-2xl" />
          
          {/* Main card */}
          <div className="bg-card border border-border rounded-2xl shadow-xl -mt-8 mx-2 relative">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-3 top-3 h-8 w-8 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center transition-colors z-10"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            
            {/* Admin edit button */}
            {isAdmin && donor.source === 'profile' && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="absolute left-3 top-3 h-8 w-8 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center transition-colors z-10"
              >
                <Edit className="h-4 w-4 text-muted-foreground" />
              </button>
            )}

            <div className="p-4 pt-8">
              {/* Avatar with status ring - centered and overlapping */}
              <div className="flex flex-col items-center -mt-14 mb-3">
                <div className="relative">
                  <div className={`absolute inset-0 rounded-full ${getStatusColor()} animate-pulse opacity-30 scale-110`} />
                  <div className={`p-1 rounded-full ${getStatusColor()}`}>
                    <Avatar className="h-20 w-20 ring-4 ring-card">
                      <AvatarImage src={donor.avatar_url || undefined} />
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary font-semibold">
                        {donor.full_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  {/* Status dot */}
                  <div className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-3 border-card ${getStatusColor()} flex items-center justify-center`}>
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
              </div>

              {/* Name and info */}
              <div className="text-center mb-4">
                {isEditing ? (
                  <div className="space-y-2">
                    <Label className="text-xs">Full Name</Label>
                    <Input
                      value={editedDonor.full_name}
                      onChange={(e) => setEditedDonor({ ...editedDonor, full_name: e.target.value })}
                      className="h-9 text-center rounded-xl"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <h1 className="text-xl font-bold">{donor.full_name}</h1>
                      {donor.title && (
                        <Badge variant="secondary" className="text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          {donor.title}
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1.5">
                      <span className={`inline-block h-2 w-2 rounded-full ${getStatusColor()}`} />
                      {getStatusText()}
                    </p>

                    {/* Badges */}
                    <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                      {donor.source === 'directory' && (
                        <Badge variant="outline" className="text-xs rounded-full px-3 border-amber-500 text-amber-600">
                          Not Registered
                        </Badge>
                      )}
                      {isFirstTimeDonor && (
                        <Badge variant="secondary" className="text-xs rounded-full px-3">First Time</Badge>
                      )}
                    </div>

                    {donor.bio && (
                      <p className="text-sm text-foreground/80 mt-3 leading-relaxed max-w-xs mx-auto">{donor.bio}</p>
                    )}

                    {/* Quick info pills */}
                    <div className="flex flex-wrap justify-center gap-2 mt-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                        <Droplet className="h-3 w-3" />
                        {donor.blood_group}
                      </div>
                      {donor.district && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted text-muted-foreground rounded-full text-xs">
                          <MapPin className="h-3 w-3" />
                          {donor.district.split(' - ')[1] || donor.district}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-3 border border-border rounded-xl overflow-hidden bg-muted/30 mb-4">
                <div className="py-3 text-center">
                  <p className="text-xl font-bold text-primary">{donor.blood_group}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Blood</p>
                </div>
                <div className="py-3 text-center border-x border-border">
                  <p className="text-xl font-bold">{donor.donation_count || 0}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Donations</p>
                </div>
                <div className="py-3 text-center">
                  <p className="text-xl font-bold text-green-500">{donor.donation_count || 0}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lives</p>
                </div>
              </div>

              {isEditing ? (
                /* Edit Mode */
                <Card className="rounded-2xl border-border/50">
                  <CardContent className="p-4 space-y-3">
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
              ) : (
                /* View Mode - Action List Style */
                <Card className="rounded-2xl border-border/50">
                  <CardContent className="p-0">
                    <button className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-medium text-sm">{donor.phone}</p>
                        <p className="text-xs text-muted-foreground">Phone number</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                    
                    <Separator />
                    
                    <div className="flex items-center gap-3 p-4">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-medium text-sm">{donor.district || 'Not specified'}</p>
                        <p className="text-xs text-muted-foreground">Location</p>
                      </div>
                    </div>
                    
                    {donor.last_donation_date && (
                      <>
                        <Separator />
                        <div className="flex items-center gap-3 p-4">
                          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-amber-500" />
                          </div>
                          <div className="text-left flex-1">
                            <p className="font-medium text-sm">
                              {new Date(donor.last_donation_date).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground">Last donation</p>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};