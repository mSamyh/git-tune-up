import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Medal } from "lucide-react";
import { DonorProfileDialog } from "./DonorProfileDialog";

interface Donor {
  id: string;
  full_name: string;
  phone: string;
  blood_group: string;
  district: string;
  address: string | null;
  is_available: boolean;
  avatar_url: string | null;
  availability_status: string;
  available_date: string | null;
  last_donation_date: string | null;
  donation_count?: number;
}

export const DonorTable = () => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [filteredDonors, setFilteredDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [bloodGroupFilter, setBloodGroupFilter] = useState("all");
  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);

  const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

  useEffect(() => {
    fetchDonors();
  }, []);

  useEffect(() => {
    filterAndSortDonors();
  }, [donors, searchTerm, bloodGroupFilter]);

  const fetchDonors = async () => {
    const { data, error } = await supabase
      .from("donor_directory")
      .select("*")
      .order("full_name");

    if (!error && data) {
      // Fetch donation counts for each donor
      const donorsWithCounts = await Promise.all(
        data.map(async (donor) => {
          const { data: countData } = await supabase.rpc('get_directory_donation_count', { donor_uuid: donor.id });
          return { ...donor, donation_count: countData || 0 };
        })
      );
      setDonors(donorsWithCounts);
    }
    setLoading(false);
  };

  const filterAndSortDonors = () => {
    let filtered = [...donors];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(donor =>
        donor.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply blood group filter
    if (bloodGroupFilter !== "all") {
      filtered = filtered.filter(donor => donor.blood_group === bloodGroupFilter);
    }

    // Sort by availability and available_date
    filtered.sort((a, b) => {
      const statusOrder = {
        'available': 0,
        'available_soon': 1,
        'reserved': 2,
        'unavailable': 3
      };

      const aStatus = a.availability_status || 'available';
      const bStatus = b.availability_status || 'available';
      
      if (statusOrder[aStatus] !== statusOrder[bStatus]) {
        return statusOrder[aStatus] - statusOrder[bStatus];
      }

      // For available_soon, sort by available_date (earliest first)
      if (aStatus === 'available_soon' && bStatus === 'available_soon') {
        if (a.available_date && b.available_date) {
          return new Date(a.available_date).getTime() - new Date(b.available_date).getTime();
        }
      }

      return 0;
    });

    setFilteredDonors(filtered);
  };

  const getAvailabilityBadge = (donor: Donor) => {
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

  const getTopDonorBadge = (index: number) => {
    if (index === 0) return <Medal className="h-4 w-4 text-yellow-500" />;
    if (index === 1) return <Medal className="h-4 w-4 text-gray-400" />;
    if (index === 2) return <Medal className="h-4 w-4 text-amber-700" />;
    return null;
  };

  // Sort by donation count to get top donors
  const topDonors = [...donors].sort((a, b) => (b.donation_count || 0) - (a.donation_count || 0)).slice(0, 3);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Select value={bloodGroupFilter} onValueChange={setBloodGroupFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Blood Group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {bloodGroups.map(group => (
              <SelectItem key={group} value={group}>{group}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Donor</TableHead>
              <TableHead>Blood Group</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Donations</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDonors.map((donor, index) => {
              const isTopDonor = topDonors.some(td => td.id === donor.id);
              const topDonorIndex = topDonors.findIndex(td => td.id === donor.id);
              
              return (
                <TableRow key={donor.id}>
                  <TableCell className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={donor.avatar_url || undefined} />
                        <AvatarFallback>{donor.full_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {isTopDonor && (
                        <div className="absolute -top-1 -right-1">
                          {getTopDonorBadge(topDonorIndex)}
                        </div>
                      )}
                    </div>
                    <span className="font-medium">{donor.full_name}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{donor.blood_group}</Badge>
                  </TableCell>
                  <TableCell>{getAvailabilityBadge(donor)}</TableCell>
                  <TableCell>{donor.donation_count || 0}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDonor(donor)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selectedDonor && (
        <DonorProfileDialog
          donor={selectedDonor}
          isOpen={!!selectedDonor}
          onClose={() => setSelectedDonor(null)}
        />
      )}
    </div>
  );
};
