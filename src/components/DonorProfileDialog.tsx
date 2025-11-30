import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Droplet, MapPin, Phone, Calendar, Medal, Edit, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LocationSelector } from "./LocationSelector";

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
}

interface DonorProfileDialogProps {
  donor: Donor;
  isOpen: boolean;
  onClose: () => void;
}

export const DonorProfileDialog = ({ donor, isOpen, onClose }: DonorProfileDialogProps) => {
  const [donationHistory, setDonationHistory] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDonor, setEditedDonor] = useState(donor);
  const [selectedAtoll, setSelectedAtoll] = useState("");
  const [selectedIsland, setSelectedIsland] = useState("");
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
      
      fetchDonationHistory();
      checkAdmin();
    }
  }, [isOpen, donor]);

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
      // Refresh the donor data
      window.location.reload();
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
            <DialogTitle>Donor Profile</DialogTitle>
            {isAdmin && donor.source === 'profile' && !isEditing && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className={`h-20 w-20 ${donor.source === 'directory' ? 'ring-2 ring-yellow-500' : ''}`}>
                <AvatarImage src={donor.avatar_url || undefined} />
                <AvatarFallback className="text-2xl">{donor.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              {donor.donation_count && donor.donation_count >= 3 && (
                <div className="absolute -top-1 -right-1">
                  <Medal className="h-6 w-6 text-yellow-500" />
                </div>
              )}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={editedDonor.full_name}
                    onChange={(e) => setEditedDonor({ ...editedDonor, full_name: e.target.value })}
                  />
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-semibold">{donor.full_name}</h3>
                  {donor.source === 'directory' && (
                    <Badge variant="outline" className="mt-1 border-yellow-500 text-yellow-600">
                      Not Registered
                    </Badge>
                  )}
                  {isFirstTimeDonor && (
                    <Badge variant="secondary" className="mt-1">First Time Donor</Badge>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {isEditing ? (
              <>
                <div className="space-y-2">
                  <Label>Blood Group</Label>
                  <Select
                    value={editedDonor.blood_group}
                    onValueChange={(value) => setEditedDonor({ ...editedDonor, blood_group: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((group) => (
                        <SelectItem key={group} value={group}>
                          {group}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editedDonor.phone}
                    onChange={(e) => setEditedDonor({ ...editedDonor, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Location</Label>
                  <LocationSelector
                    selectedAtoll={selectedAtoll}
                    selectedIsland={selectedIsland}
                    onAtollChange={setSelectedAtoll}
                    onIslandChange={setSelectedIsland}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Availability Status</Label>
                  <Select
                    value={editedDonor.availability_status}
                    onValueChange={(value) => setEditedDonor({ ...editedDonor, availability_status: value })}
                  >
                    <SelectTrigger>
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
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Droplet className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Blood Group</p>
                    <p className="font-semibold">{donor.blood_group}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Phone className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-semibold">{donor.phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-semibold">{donor.district}</p>
                    {donor.address && (
                      <p className="text-sm text-muted-foreground">{donor.address}</p>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Availability Status</p>
                  {getAvailabilityText()}
                </div>
              </>
            )}

            {donor.last_donation_date && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Last Donation</p>
                  <p className="font-semibold">
                    {new Date(donor.last_donation_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total Donations</p>
              <p className="text-2xl font-bold text-primary">{donor.donation_count || 0}</p>
            </div>

            {donationHistory.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Recent Donations</h4>
                <div className="space-y-2">
                  {donationHistory.slice(0, 5).map((donation) => (
                    <div key={donation.id} className="p-2 bg-muted rounded text-sm">
                      <p className="font-medium">{donation.hospital_name}</p>
                      <p className="text-muted-foreground">
                        {new Date(donation.donation_date).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
