import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Phone, MessageSquare, Clock, Ban, CalendarCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { DonorProfileDialog } from "./DonorProfileDialog";
import { TopDonorBadge, getTopDonorRank } from "./TopDonorBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    const { data: profileDonors } = await supabase
      .from("profiles")
      .select("*")
      .in("user_type", ["donor", "both"]);

    const { data: directoryDonors } = await supabase
      .from("donor_directory")
      .select("*");

    const unlinkedDirectoryDonors = (directoryDonors || []).filter(d => !d.linked_profile_id);

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

    if (searchTerm) {
      filtered = filtered.filter(donor =>
        donor.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (bloodGroupFilter !== "all") {
      filtered = filtered.filter(donor => donor.blood_group === bloodGroupFilter);
    }

    filtered.sort((a, b) => {
      const statusOrder = {
        'available': 0,
        'available_soon': 1,
        'reserved': 2,
        'unavailable': 3,
        'unregistered': 4
      };

      const aStatus = a.is_registered === false ? 'unregistered' : (a.availability_status || 'available');
      const bStatus = b.is_registered === false ? 'unregistered' : (b.availability_status || 'available');
      
      if (statusOrder[aStatus] !== statusOrder[bStatus]) {
        return statusOrder[aStatus] - statusOrder[bStatus];
      }

      if (aStatus === 'available_soon' && bStatus === 'available_soon') {
        if (a.available_date && b.available_date) {
          return new Date(a.available_date).getTime() - new Date(b.available_date).getTime();
        }
      }

      if (aStatus === 'unavailable' && bStatus === 'unavailable') {
        const getDaysUntilAvailable = (donor: Donor) => {
          if (!donor.last_donation_date) return 999;
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
    setCurrentPage(1);
  };

  const paginateDonors = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    setPaginatedDonors(filteredDonors.slice(startIndex, endIndex));
  };

  const totalPages = Math.ceil(totalDonors / ITEMS_PER_PAGE);

  // Get status info for icon indicator
  const getStatusInfo = (donor: Donor): { color: string; icon: React.ReactNode; label: string; daysText?: string } => {
    if (donor.is_registered === false) {
      return { color: "bg-muted-foreground/40", icon: null, label: "Not registered" };
    }

    const status = donor.availability_status || 'available';
    
    if (status === 'available') {
      return { 
        color: "bg-green-500", 
        icon: null, 
        label: "Available" 
      };
    } else if (status === 'unavailable') {
      if (donor.last_donation_date) {
        const daysSinceLastDonation = Math.floor(
          (new Date().getTime() - new Date(donor.last_donation_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceLastDonation < 90) {
          const daysUntil = 90 - daysSinceLastDonation;
          return { 
            color: "bg-amber-500", 
            icon: <Clock className="h-3 w-3" />, 
            label: `Available in ${daysUntil}d`,
            daysText: `${daysUntil}d`
          };
        }
      }
      return { 
        color: "bg-red-500", 
        icon: <Ban className="h-3 w-3" />, 
        label: "Unavailable" 
      };
    } else if (status === 'available_soon') {
      const daysUntil = donor.available_date 
        ? Math.ceil((new Date(donor.available_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return { 
        color: "bg-amber-500", 
        icon: <Clock className="h-3 w-3" />, 
        label: `Available in ${daysUntil}d`,
        daysText: `${daysUntil}d`
      };
    } else if (status === 'reserved') {
      return { 
        color: "bg-blue-500", 
        icon: <CalendarCheck className="h-3 w-3" />, 
        label: "Reserved" 
      };
    }
    
    return { 
      color: "bg-red-500", 
      icon: <Ban className="h-3 w-3" />, 
      label: "Unavailable" 
    };
  };

  // Sort by donation count to get top 5 donors
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
    <TooltipProvider>
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
                <TableHead className="w-full">Donor</TableHead>
                <TableHead className="text-center whitespace-nowrap">Blood</TableHead>
                <TableHead className="text-right whitespace-nowrap pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDonors.map((donor, index) => {
                const topDonorRank = getTopDonorRank(donor.id, topDonors);
                const isEvenRow = index % 2 === 0;
                const statusInfo = getStatusInfo(donor);
                
                return (
                  <TableRow 
                    key={donor.id} 
                    className={`cursor-pointer transition-colors ${isEvenRow ? 'bg-primary/5 dark:bg-primary/10' : 'bg-background'} hover:bg-primary/15`}
                  >
                    <TableCell 
                      className="py-2.5"
                      onClick={() => setSelectedDonor(donor)}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Avatar with status indicator */}
                        <div className="relative flex-shrink-0">
                          <Avatar className={`h-10 w-10 ${donor.source === 'directory' ? "ring-2 ring-yellow-500" : ""}`}>
                            <AvatarImage src={donor.avatar_url || undefined} />
                            <AvatarFallback className="text-sm">{donor.full_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          {/* Status indicator dot */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-background ${statusInfo.color} ${statusInfo.daysText ? 'h-5 w-5' : 'h-3.5 w-3.5'}`}>
                                {statusInfo.icon && <span className="text-white">{statusInfo.icon}</span>}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {statusInfo.label}
                            </TooltipContent>
                          </Tooltip>
                          {topDonorRank > 0 && (
                            <TopDonorBadge rank={topDonorRank} className="absolute -top-1 -left-1" />
                          )}
                        </div>
                        {/* Name and subtitle */}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate leading-tight">{donor.full_name}</p>
                          {donor.source === 'directory' ? (
                            <p className="text-xs text-muted-foreground truncate">Not registered</p>
                          ) : statusInfo.daysText ? (
                            <p className="text-xs text-amber-600 dark:text-amber-400 truncate">{statusInfo.label}</p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-2.5" onClick={() => setSelectedDonor(donor)}>
                      <Badge variant="outline" className="font-semibold text-xs px-2 py-0.5">
                        {donor.blood_group}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-2.5 pr-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `tel:${donor.phone}`;
                            toast({ title: "Calling", description: `Calling ${donor.full_name}...` });
                          }}
                          title={`Call ${donor.phone}`}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `sms:${donor.phone}`;
                            toast({ title: "SMS", description: `Opening SMS for ${donor.full_name}...` });
                          }}
                          title={`SMS ${donor.phone}`}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
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
              <span className="hidden sm:inline">Previous</span>
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
              <span className="hidden sm:inline">Next</span>
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
    </TooltipProvider>
  );
};