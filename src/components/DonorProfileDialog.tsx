import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Droplet, MapPin, Phone, Calendar, Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
}

interface DonorProfileDialogProps {
  donor: Donor;
  isOpen: boolean;
  onClose: () => void;
}

export const DonorProfileDialog = ({ donor, isOpen, onClose }: DonorProfileDialogProps) => {
  const [donationHistory, setDonationHistory] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchDonationHistory();
    }
  }, [isOpen, donor.id]);

  const fetchDonationHistory = async () => {
    const { data } = await supabase
      .from("donation_history")
      .select("*")
      .eq("donor_id", donor.id)
      .order("donation_date", { ascending: false });

    setDonationHistory(data || []);
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Donor Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={donor.avatar_url || undefined} />
                <AvatarFallback className="text-2xl">{donor.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              {donor.donation_count && donor.donation_count >= 3 && (
                <div className="absolute -top-1 -right-1">
                  <Medal className="h-6 w-6 text-yellow-500" />
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold">{donor.full_name}</h3>
              {isFirstTimeDonor && (
                <Badge variant="secondary" className="mt-1">First Time Donor</Badge>
              )}
            </div>
          </div>

          <div className="space-y-4">
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
      </DialogContent>
    </Dialog>
  );
};
