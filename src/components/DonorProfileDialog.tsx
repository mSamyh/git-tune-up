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
import {
  MapPin, Phone, Calendar, Edit, Save, X, Check, Clock, Droplet, Heart,
  ChevronRight, MessageCircle, Sparkles, Activity, Award, Share2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LocationSelector } from "./LocationSelector";
import { TopDonorBadge, getTopDonorRank } from "./TopDonorBadge";
import { format, differenceInDays, formatDistanceToNow } from "date-fns";

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
  reserved_until?: string | null;
  status_note?: string | null;
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
    if (!user) { setIsOwnProfile(false); return; }
    setIsOwnProfile(user.id === donor.id);
  };

  const fetchDonationHistory = async () => {
    if (donor.source === 'profile') {
      const { data } = await supabase
        .from("donation_history")
        .select("*")
        .eq("donor_id", donor.id)
        .order("donation_date", { ascending: false })
        .limit(5);
      setDonationHistory(data || []);
    } else {
      const { data } = await supabase
        .from("donor_directory_history")
        .select("*")
        .eq("donor_id", donor.id)
        .order("donation_date", { ascending: false })
        .limit(5);
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

  const status = donor.availability_status || 'available';

  const statusGradient = {
    available: 'from-emerald-400 via-success to-teal-500',
    reserved: 'from-amber-400 via-warning to-orange-500',
    available_soon: 'from-amber-400 via-warning to-orange-500',
    unavailable: 'from-rose-400 via-destructive to-red-500',
  }[status] || 'from-rose-400 via-destructive to-red-500';

  const statusDot = {
    available: 'bg-success',
    reserved: 'bg-warning',
    available_soon: 'bg-warning',
    unavailable: 'bg-destructive',
  }[status] || 'bg-destructive';

  const getStatusText = () => {
    if (status === 'available') return 'Available to donate';
    if (status === 'unavailable') {
      if (donor.last_donation_date) {
        const days = differenceInDays(new Date(), new Date(donor.last_donation_date));
        if (days < 90) return `Available in ${90 - days} days`;
      }
      return 'Currently unavailable';
    }
    if (status === 'available_soon' && donor.available_date) {
      const days = Math.ceil((new Date(donor.available_date).getTime() - Date.now()) / 86400000);
      return `Available in ${days} days`;
    }
    if (status === 'reserved' && donor.reserved_until) {
      return `Reserved for ${new Date(donor.reserved_until).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    }
    return 'Currently unavailable';
  };

  const isFirstTimeDonor = !donor.last_donation_date && donationHistory.length === 0;
  const totalDonations = donor.donation_count || 0;
  const livesSaved = totalDonations * 3;
  const rank = getTopDonorRank(donor.id, topDonors);

  const handleSaveProfile = async () => {
    if (!donor.source || donor.source !== 'profile') {
      toast({ variant: "destructive", title: "Cannot edit", description: "Can only edit registered users" });
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
    const { error } = await supabase.from("profiles").update(updateData).eq("id", donor.id);
    if (error) {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    } else {
      toast({ title: "Profile updated", description: "Donor profile has been updated successfully" });
      setIsEditing(false);
      onUpdate?.();
      onClose();
    }
  };

  const handleCancelEdit = () => { setEditedDonor(donor); setIsEditing(false); };
  const handleCall = () => { window.location.href = `tel:${donor.phone}`; };
  const handleSMS = () => { window.location.href = `sms:${donor.phone}`; };
  const handleWhatsApp = () => {
    const phone = donor.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone.startsWith("960") ? phone : "960" + phone}`, "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto bg-background border-border/50 p-0 gap-0 rounded-3xl shadow-2xl">
        <DialogTitle className="sr-only">Donor Profile</DialogTitle>

        {/* Sticky glass header */}
        <div className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border/40 px-4 py-3 flex items-center justify-between">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted/60 active:scale-95 transition" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
          <span className="font-semibold text-sm tracking-wide">Donor Profile</span>
          <div className="w-8" />
        </div>

        {/* Cover with animated gradient mesh */}
        <div className="relative h-32 overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${statusGradient} opacity-90`} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_80%_60%,rgba(255,255,255,0.2),transparent_45%)]" />
          {/* Decorative blood drop pattern */}
          <Droplet className="absolute -right-2 -top-2 h-24 w-24 text-white/10 rotate-12" fill="currentColor" />
          <Heart className="absolute right-16 top-8 h-6 w-6 text-white/30" fill="currentColor" />
          {/* Top rank ribbon */}
          {rank > 0 && rank <= 3 && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/30 backdrop-blur-md text-white text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full">
              <Sparkles className="h-3 w-3" />
              Top #{rank} Donor
            </div>
          )}
        </div>

        {/* Avatar pulled over cover */}
        <div className="px-5 -mt-14 relative">
          <div className="flex items-end justify-between">
            <div className="relative">
              <div className={`p-[3px] rounded-full bg-gradient-to-tr ${statusGradient} shadow-xl`}>
                <div className="p-[3px] rounded-full bg-background">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={donor.avatar_url || undefined} className="object-cover" />
                    <AvatarFallback className="text-3xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-bold">
                      {donor.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
              {/* Status pulse dot */}
              <div className={`absolute bottom-1 right-1 h-6 w-6 rounded-full border-[3px] border-background flex items-center justify-center shadow-lg ${statusDot}`}>
                {status === 'available' && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
                {(status === 'reserved' || status === 'available_soon') && <Clock className="h-3 w-3 text-white" strokeWidth={3.5} />}
                {status === 'unavailable' && <X className="h-3 w-3 text-white" strokeWidth={3.5} />}
                {status === 'available' && (
                  <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-30" />
                )}
              </div>
            </div>

            {/* Quick action: edit (admin) */}
            {isAdmin && donor.source === 'profile' && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full h-9 mb-2 backdrop-blur-md bg-background/70 border-border/60"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            )}
          </div>
        </div>

        <div className="px-5 pt-3 pb-5 space-y-4">
          {/* Identity block */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold leading-tight">{donor.full_name}</h1>
              {donor.title && (
                <Badge
                  className="text-[10px] border-0 font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: donor.title_color ? `${donor.title_color}22` : 'hsl(var(--primary) / 0.12)',
                    color: donor.title_color || 'hsl(var(--primary))',
                  }}
                >
                  {donor.title}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-1">
              <span className={`inline-block h-2 w-2 rounded-full ${statusDot} ${status === 'available' ? 'animate-pulse' : ''}`} />
              <p className="text-sm text-muted-foreground">{getStatusText()}</p>
            </div>

            {/* Status note bubble */}
            {status === 'unavailable' && donor.status_note && (
              <div className="mt-2 inline-block">
                <div className="relative bg-muted/70 rounded-2xl px-3 py-1.5 text-xs text-muted-foreground shadow-sm border border-border/30">
                  {donor.status_note}
                </div>
              </div>
            )}

            {donor.bio && <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{donor.bio}</p>}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
              {donor.district && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {donor.district.split(' - ')[1] || donor.district}
                </span>
              )}
              {donor.source === 'directory' && (
                <Badge variant="warning" className="text-[10px] rounded-full px-2 h-4">Not Registered</Badge>
              )}
              {isFirstTimeDonor && (
                <Badge variant="secondary" className="text-[10px] rounded-full px-2 h-4">First Time</Badge>
              )}
            </div>
          </div>

          {/* Stats row — modern segmented */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-3 text-center border border-primary/10">
              <Droplet className="h-4 w-4 text-primary mx-auto mb-1" fill="currentColor" />
              <p className="text-lg font-bold tabular-nums leading-none">{totalDonations}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Donations</p>
            </div>
            <div className="bg-gradient-to-br from-rose-500/10 to-rose-500/5 rounded-2xl p-3 text-center border border-rose-500/10">
              <span className="block text-lg font-bold text-primary leading-none">{donor.blood_group}</span>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2">Blood Type</p>
            </div>
            <div className="bg-gradient-to-br from-success/10 to-success/5 rounded-2xl p-3 text-center border border-success/10">
              <Heart className="h-4 w-4 text-success mx-auto mb-1" fill="currentColor" />
              <p className="text-lg font-bold tabular-nums text-success leading-none">{livesSaved}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Lives</p>
            </div>
          </div>

          {/* Action buttons */}
          {!isEditing && (
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={handleCall} className="rounded-2xl h-11 font-semibold shadow-md" variant="gradient">
                <Phone className="h-4 w-4 mr-1.5" />
                Call
              </Button>
              <Button onClick={handleSMS} variant="secondary" className="rounded-2xl h-11 font-semibold">
                <MessageCircle className="h-4 w-4 mr-1.5" />
                SMS
              </Button>
              <Button onClick={handleWhatsApp} variant="outline" className="rounded-2xl h-11 font-semibold border-success/40 text-success hover:bg-success/10 hover:text-success">
                <Share2 className="h-4 w-4 mr-1.5" />
                Chat
              </Button>
            </div>
          )}

          {/* Edit form */}
          {isEditing && (
            <Card className="rounded-2xl border-border/50">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Full Name</Label>
                  <Input value={editedDonor.full_name} onChange={(e) => setEditedDonor({ ...editedDonor, full_name: e.target.value })} className="h-10 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Blood Group</Label>
                    <Select value={editedDonor.blood_group} onValueChange={(v) => setEditedDonor({ ...editedDonor, blood_group: v })}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone</Label>
                    <Input value={editedDonor.phone} onChange={(e) => setEditedDonor({ ...editedDonor, phone: e.target.value })} className="h-10 rounded-xl" />
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
                  <Select value={editedDonor.availability_status} onValueChange={(v) => setEditedDonor({ ...editedDonor, availability_status: v })}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                      <SelectItem value="available_soon">Available Soon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit} className="flex-1 rounded-xl">Cancel</Button>
                  <Button size="sm" onClick={handleSaveProfile} className="flex-1 rounded-xl">
                    <Save className="h-4 w-4 mr-2" />Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info card */}
          {!isEditing && (
            <Card className="rounded-2xl border-border/50 overflow-hidden">
              <a href={`tel:${donor.phone}`} className="flex items-center justify-between p-3.5 hover:bg-muted/40 transition active:scale-[0.99]">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Phone</p>
                    <p className="text-sm font-semibold tabular-nums">{donor.phone}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </a>

              {donor.district && (
                <>
                  <div className="border-t border-border/40" />
                  <div className="flex items-center gap-3 p-3.5">
                    <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Location</p>
                      <p className="text-sm font-semibold">{donor.district}</p>
                    </div>
                  </div>
                </>
              )}

              {donor.last_donation_date && (
                <>
                  <div className="border-t border-border/40" />
                  <div className="flex items-center gap-3 p-3.5">
                    <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-info" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Last Donation</p>
                      <p className="text-sm font-semibold">
                        {format(new Date(donor.last_donation_date), 'MMM d, yyyy')}
                        <span className="text-xs text-muted-foreground font-normal ml-1.5">
                          · {formatDistanceToNow(new Date(donor.last_donation_date), { addSuffix: true })}
                        </span>
                      </p>
                    </div>
                  </div>
                </>
              )}
            </Card>
          )}

          {/* Recent donations timeline */}
          {!isEditing && donationHistory.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Recent Donations
                </h3>
                <span className="text-[10px] text-muted-foreground">Last {donationHistory.length}</span>
              </div>
              <Card className="rounded-2xl border-border/50 overflow-hidden">
                <div className="divide-y divide-border/40">
                  {donationHistory.map((d, i) => (
                    <div key={d.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 transition">
                      <div className="relative">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <Droplet className="h-4 w-4 text-primary" fill="currentColor" />
                        </div>
                        {i === 0 && (
                          <div className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-success rounded-full ring-2 ring-background" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.hospital_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(d.donation_date), 'MMM d, yyyy')}
                          <span className="mx-1.5">·</span>
                          {formatDistanceToNow(new Date(d.donation_date), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant="secondary" className="rounded-full text-[10px] h-5 px-2 shrink-0">
                        {d.units_donated || 1}u
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Achievement footer */}
          {!isEditing && totalDonations > 0 && (
            <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-amber-500/20 p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Award className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold">Hero of {livesSaved} lives</p>
                <p className="text-[11px] text-muted-foreground">Every donation can save up to 3 lives</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
