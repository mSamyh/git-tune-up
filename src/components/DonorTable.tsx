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
  source?: string;
  is_registered?: boolean;
}

interface DonorTableProps {
  bloodGroupFilter?: string;
}

export const DonorTable = ({ bloodGroupFilter = "all" }: DonorTableProps) => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [filteredDonors, setFilteredDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);

  const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

  useEffect(() => {
    fetchDonors();
  }, []);

  useEffect(() => {
    filterAndSortDonors();
  }, [donors, searchTerm, bloodGroupFilter]);

  useEffect(() => {
    filterAndSortDonors();
  }, [bloodGroupFilter]);

  const fetchDonors = async () => {
    // Fetch registered donors (from profiles where user_type is 'donor' or 'both')
    const { data: profileDonors } = await supabase
      .from("profiles")
      .select("*")
      .in("user_type", ["donor", "both"]);

    // Fetch unregistered donors (from donor_directory where is_registered is false)
    const { data: directoryDonors } = await supabase
      .from("donor_directory")
      .select("*")
      .eq("is_registered", false);

    // Combine and fetch donation counts
    const allDonors = [
      ...(profileDonors || []).map(d => ({ ...d, source: 'profile' })),
      ...(directoryDonors || []).map(d => ({ ...d, source: 'directory' }))
    ];

    const donorsWithCounts = await Promise.all(
      allDonors.map(async (donor) => {
        if (donor.source === 'profile') {
          const { data: countData } = await supabase.rpc('get_donation_count', { donor_uuid: donor.id });
          return { ...donor, donation_count: countData || 0 };
        } else {
          const { data: countData } = await supabase.rpc('get_directory_donation_count', { donor_uuid: donor.id });
          return { ...donor, donation_count: countData || 0 };
        }
      })
    );

    setDonors(donorsWithCounts);
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

    // Sort by: available -> available_soon (fewer days first) -> reserved -> unavailable -> registered users -> blank (unregistered)
    filtered.sort((a, b) => {
      // First priority: registration status
      const aRegistered = a.is_registered !== false ? 1 : 0;
      const bRegistered = b.is_registered !== false ? 1 : 0;
      
      if (aRegistered !== bRegistered) {
        return bRegistered - aRegistered; // Registered first
      }

      // Only sort by availability for registered users
      if (aRegistered) {
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
                      <Avatar className={donor.source === 'directory' ? "ring-2 ring-yellow-500" : ""}>
                        <AvatarImage src={donor.avatar_url || undefined} />
                        <AvatarFallback>{donor.full_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {isTopDonor && (
                        <div className="absolute -top-1 -right-1">
                          {getTopDonorBadge(topDonorIndex)}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="font-medium">{donor.full_name}</span>
                      {donor.source === 'directory' && (
                        <p className="text-xs text-muted-foreground">Not registered</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{donor.blood_group}</Badge>
                  </TableCell>
                  <TableCell>
                    {donor.is_registered !== false ? (
                      getAvailabilityBadge(donor)
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
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
