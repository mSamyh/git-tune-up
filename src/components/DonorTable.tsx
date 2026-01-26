import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Phone, MessageSquare, Clock, Ban, CalendarCheck, Droplet, UserPlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
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
  reserved_until?: string | null;
  status_note?: string | null;
}

interface DonorTableProps {
  bloodGroupFilter?: string;
  searchTerm?: string;
  atollFilter?: string;
  statusFilter?: string;
}

const ITEMS_PER_PAGE = 15;

export const DonorTable = ({ bloodGroupFilter = "all", searchTerm = "", atollFilter = "all", statusFilter = "all" }: DonorTableProps) => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [filteredDonors, setFilteredDonors] = useState<Donor[]>([]);
  const [paginatedDonors, setPaginatedDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalDonors, setTotalDonors] = useState(0);

  useEffect(() => {
    fetchDonors();
  }, []);

  useEffect(() => {
    filterAndSortDonors();
  }, [donors, searchTerm, bloodGroupFilter, atollFilter, statusFilter]);

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

    // Atoll filter - match against district field (format: "Atoll - Island")
    if (atollFilter && atollFilter !== "all") {
      filtered = filtered.filter(donor =>
        donor.district?.startsWith(atollFilter + " -") || donor.district === atollFilter
      );
    }

    // Status filter
    if (statusFilter && statusFilter !== "all") {
      filtered = filtered.filter(donor =>
        donor.availability_status === statusFilter
      );
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

  const getStatusConfig = (donor: Donor) => {
    if (donor.is_registered === false) {
      return { 
        color: "bg-muted-foreground/30", 
        textColor: "text-muted-foreground",
        icon: <UserPlus className="h-3 w-3" />, 
        label: "Not registered",
        ringColor: "ring-muted-foreground/30"
      };
    }

    const status = donor.availability_status || 'available';
    
    if (status === 'available') {
      return { 
        color: "bg-emerald-500", 
        textColor: "text-emerald-600 dark:text-emerald-400",
        icon: null, 
        label: "Available",
        ringColor: "ring-emerald-500/50"
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
            textColor: "text-amber-600 dark:text-amber-400",
            icon: <Clock className="h-3 w-3" />, 
            label: `${daysUntil}d`,
            ringColor: "ring-amber-500/50"
          };
        }
      }
      return { 
        color: "bg-red-500", 
        textColor: "text-red-600 dark:text-red-400",
        icon: <Ban className="h-3 w-3" />, 
        label: "Unavailable",
        ringColor: "ring-red-500/50"
      };
    } else if (status === 'available_soon') {
      const daysUntil = donor.available_date 
        ? Math.ceil((new Date(donor.available_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return { 
        color: "bg-amber-500", 
        textColor: "text-amber-600 dark:text-amber-400",
        icon: <Clock className="h-3 w-3" />, 
        label: `${daysUntil}d`,
        ringColor: "ring-amber-500/50"
      };
    } else if (status === 'reserved') {
      let label = "Reserved";
      if (donor.reserved_until) {
        const date = new Date(donor.reserved_until);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear();
        label = `Reserved for ${monthName} ${year}`;
      }
      return { 
        color: "bg-blue-500", 
        textColor: "text-blue-600 dark:text-blue-400",
        icon: <CalendarCheck className="h-3 w-3" />, 
        label: label,
        ringColor: "ring-blue-500/50"
      };
    }
    
    return { 
      color: "bg-red-500", 
      textColor: "text-red-600 dark:text-red-400",
      icon: <Ban className="h-3 w-3" />, 
      label: "Unavailable",
      ringColor: "ring-red-500/50"
    };
  };

  const topDonors = [...donors]
    .sort((a, b) => (b.donation_count || 0) - (a.donation_count || 0))
    .slice(0, 5);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Stats Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-muted/50 to-muted/30 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Droplet className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">{totalDonors}</span>
            <span className="text-sm text-muted-foreground ml-1">donors</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Available
          </span>
          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 ml-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Soon
          </span>
        </div>
      </div>

      {/* Donor Cards */}
      <div className="divide-y divide-border/40">
        {paginatedDonors.map((donor) => {
          const topDonorRank = getTopDonorRank(donor.id, topDonors);
          const statusConfig = getStatusConfig(donor);
          
          // Get note content for Instagram Notes bubble
          const getNoteContent = () => {
            if (donor.availability_status === "reserved" && donor.reserved_until) {
              const date = new Date(donor.reserved_until);
              const monthName = date.toLocaleDateString('en-US', { month: 'short' });
              const year = date.getFullYear();
              return `Reserved for ${monthName} ${year}`;
            }
            if (donor.availability_status === "unavailable" && donor.status_note) {
              return donor.status_note;
            }
            return null;
          };
          
          const noteContent = getNoteContent();
          
          return (
            <div key={donor.id}>
              {/* Instagram Notes bubble ABOVE card - positioned over avatar */}
              {noteContent && (
                <div className="flex justify-start pl-7 pt-2 pb-0.5">
                  <div className="relative bg-gray-100 dark:bg-muted border border-gray-200 dark:border-muted-foreground/20 rounded-xl px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                    {noteContent}
                    {/* Bubble tail pointing down - aligned with avatar */}
                    <div className="absolute -bottom-1.5 left-4 w-2.5 h-2.5 bg-gray-100 dark:bg-muted border-r border-b border-gray-200 dark:border-muted-foreground/20 rotate-45" />
                  </div>
                </div>
              )}
              
              {/* Card content */}
              <div 
                className="group flex items-center gap-3 p-3 hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer"
                onClick={() => setSelectedDonor(donor)}
              >
              {/* Avatar with Status */}
              <div className="relative flex-shrink-0">
                <Avatar className={`h-12 w-12 ring-2 ${statusConfig.ringColor} ring-offset-2 ring-offset-background ${donor.source === 'directory' ? "opacity-75" : ""}`}>
                  <AvatarImage src={donor.avatar_url || undefined} />
                  <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                    {donor.full_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {/* Status dot */}
                <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full ${statusConfig.color} border-2 border-background flex items-center justify-center`}>
                  {statusConfig.icon && <span className="text-white text-[8px]">{statusConfig.icon}</span>}
                </div>
                {topDonorRank > 0 && (
                  <TopDonorBadge rank={topDonorRank} className="absolute -top-1.5 -left-1.5" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex flex-wrap items-baseline gap-1.5 mb-0.5">
                  <p className="font-semibold text-sm leading-tight break-words">{donor.full_name}</p>
                  {typeof donor.donation_count === 'number' && donor.donation_count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex-shrink-0">
                      {donor.donation_count}x
                    </span>
                  )}
                </div>
                <p className={`text-xs ${statusConfig.textColor}`}>
                  {donor.is_registered === false ? "Invite to register" : statusConfig.label}
                </p>
              </div>

              {/* Blood Group */}
              <Badge 
                variant="outline" 
                className="font-bold text-sm px-2.5 py-1 border-primary/30 text-primary bg-primary/5 flex-shrink-0"
              >
                {donor.blood_group}
              </Badge>

              {/* Quick Actions - Always visible on mobile, hover-reveal on desktop */}
              <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `tel:${donor.phone}`;
                    toast({ title: "Calling", description: `Calling ${donor.full_name}...` });
                  }}
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 hover:text-blue-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `sms:${donor.phone}`;
                    toast({ title: "SMS", description: `Opening SMS for ${donor.full_name}...` });
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {paginatedDonors.length === 0 && (
        <div className="py-12 text-center">
          <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Droplet className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">No donors found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your filters</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-9 rounded-xl px-3 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-1">
            {/* First page */}
            {currentPage > 2 && (
              <>
                <button
                  onClick={() => setCurrentPage(1)}
                  className="h-8 w-8 rounded-lg text-sm font-medium hover:bg-muted text-muted-foreground"
                >
                  1
                </button>
                {currentPage > 3 && <span className="text-muted-foreground text-xs px-1">…</span>}
              </>
            )}
            
            {/* Current page range */}
            {[currentPage - 1, currentPage, currentPage + 1]
              .filter(p => p >= 1 && p <= totalPages)
              .map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === pageNum 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            
            {/* Last page */}
            {currentPage < totalPages - 1 && (
              <>
                {currentPage < totalPages - 2 && <span className="text-muted-foreground text-xs px-1">…</span>}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className="h-8 w-8 rounded-lg text-sm font-medium hover:bg-muted text-muted-foreground"
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="h-9 rounded-xl px-3 disabled:opacity-40"
          >
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
