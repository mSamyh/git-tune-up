import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Phone, MapPin, Droplet } from "lucide-react";

const BLOOD_GROUPS = ["All", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const DISTRICTS = ["All", "Dhaka", "Chittagong", "Rajshahi", "Khulna", "Barisal", "Sylhet", "Rangpur", "Mymensingh"];

interface Donor {
  id: string;
  full_name: string;
  phone: string;
  blood_group: string;
  district: string;
  address: string;
  is_available: boolean;
}

const DonorDirectory = () => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [filteredDonors, setFilteredDonors] = useState<Donor[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBloodGroup, setSelectedBloodGroup] = useState("All");
  const [selectedDistrict, setSelectedDistrict] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDonors();
  }, []);

  useEffect(() => {
    filterDonors();
  }, [donors, searchTerm, selectedBloodGroup, selectedDistrict]);

  const fetchDonors = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("user_type", ["donor", "both"]);

    if (!error && data) {
      // Custom sorting logic
      const sortedData = data.sort((a, b) => {
        // Helper function to get days until available
        const getDaysUntilAvailable = (lastDonationDate: string | null) => {
          if (!lastDonationDate) return -1; // Available now
          const daysSince = Math.floor(
            (new Date().getTime() - new Date(lastDonationDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          return Math.max(0, 90 - daysSince);
        };

        // Determine priority for each donor
        const getPriority = (donor: any) => {
          const daysUntil = getDaysUntilAvailable(donor.last_donation_date);
          
          // 1. Available (registered users first)
          if (donor.availability_status === 'available' && daysUntil <= 0) {
            return donor.id ? 1 : 5; // id exists = registered, else = not registered
          }
          
          // 2. Available in X days
          if (daysUntil > 0 && daysUntil < 90) {
            return 2;
          }
          
          // 3. Reserved
          if (donor.availability_status === 'reserved') {
            return 3;
          }
          
          // 4. Unavailable
          if (donor.availability_status === 'unavailable') {
            return 4;
          }
          
          // 5. Not registered (fallback)
          return 6;
        };

        const priorityA = getPriority(a);
        const priorityB = getPriority(b);
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        // Within same priority, sort by name
        return a.full_name.localeCompare(b.full_name);
      });

      setDonors(sortedData);
    }
    setLoading(false);
  };

  const filterDonors = () => {
    let filtered = donors;

    if (searchTerm) {
      filtered = filtered.filter((donor) =>
        donor.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedBloodGroup !== "All") {
      filtered = filtered.filter((donor) => donor.blood_group === selectedBloodGroup);
    }

    if (selectedDistrict !== "All") {
      filtered = filtered.filter((donor) => donor.district === selectedDistrict);
    }

    setFilteredDonors(filtered);
  };

  if (loading) {
    return <div className="text-center py-8">Loading donors...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Input
          placeholder="Search by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Select value={selectedBloodGroup} onValueChange={setSelectedBloodGroup}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLOOD_GROUPS.map((group) => (
              <SelectItem key={group} value={group}>
                {group}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISTRICTS.map((district) => (
              <SelectItem key={district} value={district}>
                {district}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredDonors.map((donor) => (
          <Card key={donor.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{donor.full_name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-4 w-4" />
                    {donor.district}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge className="bg-primary text-primary-foreground">
                    <Droplet className="h-3 w-3 mr-1" />
                    {donor.blood_group}
                  </Badge>
                  {donor.is_available && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Available
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{donor.phone}</span>
              </div>
              {donor.address && (
                <p className="text-sm text-muted-foreground mt-2">{donor.address}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDonors.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No donors found matching your criteria
        </div>
      )}
    </div>
  );
};

export default DonorDirectory;