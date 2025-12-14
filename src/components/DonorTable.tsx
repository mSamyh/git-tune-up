import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Medal, ChevronLeft, ChevronRight } from "lucide-react";
import { DonorProfileDialog } from "./DonorProfileDialog";
import { TopDonorBadge, getTopDonorRank } from "./TopDonorBadge";

interface Donor {
  id: string;
  full_name: string;
  phone: string;
  blood_group: string;
  district: string | null;
  address: string | null;
  is_available: boolean;
  avatar_url: string | null;
  availability_status: string;
  available_date: string | null;
  last_donation_date: string | null;
  donation_count?: number;
  source?: string;
  is_registered?: boolean;
  title?: string | null;
}

interface DonorTableProps {
  bloodGroupFilter?: string;
  searchTerm?: string;
}

const ITEMS_PER_PAGE = 20;

export const DonorTable = ({ bloodGroupFilter = "all", searchTerm = "" }: DonorTableProps) => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [filteredDonors, setFilteredDonors] = useState<Donor[]>([]);
  const [paginatedDonors, setPaginatedDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalDonors, setTotalDonors] = useState(0);

  const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

  useEffect(() => {
    fetchDonors();
  }, []);

  useEffect(() => {
    filterAndSortDonors();
  }, [donors, searchTerm, bloodGroupFilter]);

  useEffect(() => {
    paginateDonors();
  }, [filteredDonors, currentPage]);

  const fetchDonors = async () => {
    // Fetch ALL registered profiles who are donors or both
    const { data: profileDonors } = await supabase
      .from("profiles")
      .select("*")
      .in("user_type", ["donor", "both"]);

    // Fetch ALL donors from donor_directory (registered and unregistered)
    const { data: directoryDonors } = await supabase
      .from("donor_directory")
      .select("*");

    // Avoid duplicates: skip directory entries that are already linked to profiles
    const unlinkedDirectoryDonors = (directoryDonors || []).filter(d => !d.linked_profile_id);

    // Combine and fetch donation counts
    const allDonors = [
      ...(profileDonors || []).map(d => ({ ...d, source: 'profile', is_registered: true })),
      ...unlinkedDirectoryDonors.map(d => ({ ...d, source: 'directory', is_registered: false }))
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

    // Sort by: available -> available_soon (earliest first) -> reserved -> registered users (unavailable) -> non-registered users
    filtered.sort((a, b) => {
      const statusOrder = {
        'available': 0,
        'available_soon': 1,
        'reserved': 2,
        'unavailable': 3,
        'unregistered': 4
      };

      // Determine status for each donor
      const aStatus = a.is_registered === false ? 'unregistered' : (a.availability_status || 'available');
      const bStatus = b.is_registered === false ? 'unregistered' : (b.availability_status || 'available');
      
      // First priority: availability status
      if (statusOrder[aStatus] !== statusOrder[bStatus]) {
        return statusOrder[aStatus] - statusOrder[bStatus];
      }

      // For available_soon with same status, sort by available_date (earliest first)
      if (aStatus === 'available_soon' && bStatus === 'available_soon') {
        if (a.available_date && b.available_date) {
          return new Date(a.available_date).getTime() - new Date(b.available_date).getTime();
        }
      }

      // For unavailable donors with last_donation_date, sort by days until available (earliest first)
      if (aStatus === 'unavailable' && bStatus === 'unavailable') {
        const getDaysUntilAvailable = (donor: Donor) => {
          if (!donor.last_donation_date) return 999; // Put donors without dates at the end
          const daysSince = Math.floor(
            (new Date().getTime() - new Date(donor.last_donation_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysSince < 90 ? (90 - daysSince) : 999;
        };
        const aDays = getDaysUntilAvailable(a);
        const bDays = getDaysUntilAvailable(b);
        if (aDays !== bDays) {
          return aDays - bDays;
        }
      }

      return 0;
    });

    setFilteredDonors(filtered);
    setTotalDonors(filtered.length);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const paginateDonors = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    setPaginatedDonors(filteredDonors.slice(startIndex, endIndex));
  };

  const totalPages = Math.ceil(totalDonors / ITEMS_PER_PAGE);

  const getAvailabilityBadge = (donor: Donor) => {
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

  // Sort by donation count to get top 5 donors (only from unique combined list)
  const topDonors = [...donors]
    .sort((a, b) => (b.donation_count || 0) - (a.donation_count || 0))
    .slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      {/* Header with count */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <span className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{totalDonors}</span> donors
        </span>
      </div>

      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Donor</TableHead>
              <TableHead>Blood Group</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDonors.map((donor, index) => {
              const topDonorRank = getTopDonorRank(donor.id, topDonors);
              
              return (
                <TableRow key={donor.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell 
                    className="flex items-center gap-3"
                    onClick={() => setSelectedDonor(donor)}
                  >
                    <div className="relative cursor-pointer">
                      <Avatar className={donor.source === 'directory' ? "ring-2 ring-yellow-500" : ""}>
                        <AvatarImage src={donor.avatar_url || undefined} />
                        <AvatarFallback>{donor.full_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {topDonorRank > 0 && (
                        <TopDonorBadge rank={topDonorRank} className="absolute -top-1 -right-1" />
                      )}
                    </div>
                    <div>
                      <span className="font-medium">{donor.full_name}</span>
                      {donor.source === 'directory' && (
                        <p className="text-xs text-muted-foreground">Not registered</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={() => setSelectedDonor(donor)}>
                    <Badge variant="outline">{donor.blood_group}</Badge>
                  </TableCell>
                  <TableCell onClick={() => setSelectedDonor(donor)}>
                    {donor.is_registered !== false ? (
                      getAvailabilityBadge(donor)
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 p-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-xl"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-xl"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {selectedDonor && (
        <DonorProfileDialog
          donor={selectedDonor}
          isOpen={!!selectedDonor}
          onClose={() => setSelectedDonor(null)}
          topDonors={topDonors}
          onUpdate={fetchDonors}
        />
      )}
    </div>
  );
};
