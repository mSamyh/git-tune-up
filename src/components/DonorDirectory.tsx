import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, MapPin, Droplet, Search, Users, Loader2, X } from "lucide-react";
import { useReferenceData, FALLBACK_BLOOD_GROUPS } from "@/contexts/ReferenceDataContext";

interface Donor {
  id: string;
  full_name: string;
  phone: string;
  blood_group: string;
  district: string;
  address: string;
  is_available: boolean;
  availability_status?: string;
  available_date?: string;
}

const DonorDirectory = () => {
  const { bloodGroupCodes } = useReferenceData();
  const bloodGroups = ["All", ...(bloodGroupCodes.length > 0 ? bloodGroupCodes : FALLBACK_BLOOD_GROUPS)];
  
  const [donors, setDonors] = useState<Donor[]>([]);
  const [filteredDonors, setFilteredDonors] = useState<Donor[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBloodGroup, setSelectedBloodGroup] = useState("All");
  const [selectedDistrict, setSelectedDistrict] = useState("All");
  const [atolls, setAtolls] = useState<string[]>(["All"]);
  const [loading, setLoading] = useState(true);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDonors();
    fetchAtolls();
  }, []);
  
  const fetchAtolls = async () => {
    const { data } = await supabase.from("atolls").select("name").order("name");
    if (data) {
      setAtolls(["All", ...data.map(a => a.name)]);
    }
  };

  useEffect(() => {
    filterDonors();
  }, [donors, searchTerm, selectedBloodGroup, selectedDistrict]);

  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  const fetchDonors = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("user_type", ["donor", "both"]);

    if (!error && data) {
      const sortedData = data.sort((a, b) => {
        const getDaysUntilAvailable = (availableDate: string | null) => {
          if (!availableDate) return 0;
          const diff = Math.floor(
            (new Date(availableDate).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
          );
          return Math.max(0, diff);
        };

        const getPriority = (donor: any) => {
          const status = donor.availability_status as string | null;
          const daysUntil = getDaysUntilAvailable(donor.available_date);

          if (status === "available") return 1;
          if (status === "unavailable" && daysUntil > 0) return 2;
          if (status === "reserved") return 3;
          if (status === "unavailable") return 4;
          return 5;
        };

        const priorityA = getPriority(a);
        const priorityB = getPriority(b);

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        if (priorityA === 2 && priorityB === 2) {
          const daysA = getDaysUntilAvailable(a.available_date);
          const daysB = getDaysUntilAvailable(b.available_date);
          if (daysA !== daysB) {
            return daysA - daysB;
          }
        }

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

  const getStatusBadge = (donor: Donor) => {
    const status = donor.availability_status;
    if (status === "available") {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Available</Badge>;
    }
    if (status === "reserved") {
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs">Reserved</Badge>;
    }
    if (status === "unavailable" && donor.available_date) {
      const daysUntil = Math.ceil(
        (new Date(donor.available_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntil > 0) {
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">In {daysUntil}d</Badge>;
      }
    }
    return <Badge variant="outline" className="text-muted-foreground text-xs">Unavailable</Badge>;
  };

  const toggleSearch = () => {
    if (isSearchExpanded && searchTerm) {
      setSearchTerm("");
    }
    setIsSearchExpanded(!isSearchExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header with Filters */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md pb-3 -mx-4 px-4 pt-1">
        <div className="flex items-center gap-2">
          {/* Search Icon / Expanded Search */}
          <div className={`transition-all duration-300 ${isSearchExpanded ? 'flex-1' : 'flex-none'}`}>
            {isSearchExpanded ? (
              <div className="relative flex items-center">
                <Input
                  ref={searchInputRef}
                  placeholder="Search donors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 rounded-xl border-border/30 bg-card/80 pr-8 text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 h-10 w-10"
                  onClick={toggleSearch}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl border-border/30 bg-card/80"
                onClick={toggleSearch}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Filter Pills */}
          <Select value={selectedBloodGroup} onValueChange={setSelectedBloodGroup}>
            <SelectTrigger className={`h-10 rounded-xl border-border/30 bg-card/80 shadow-sm text-sm ${isSearchExpanded ? 'w-24' : 'flex-1'}`}>
              <Droplet className="h-3.5 w-3.5 mr-1 text-primary flex-shrink-0" />
              <SelectValue placeholder="Blood" />
            </SelectTrigger>
            <SelectContent>
              {bloodGroups.map((group) => (
                <SelectItem key={group} value={group}>
                  {group === "All" ? "All" : group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {!isSearchExpanded && (
            <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
              <SelectTrigger className="flex-1 h-10 rounded-xl border-border/30 bg-card/80 shadow-sm text-sm">
                <MapPin className="h-3.5 w-3.5 mr-1 text-primary flex-shrink-0" />
                <SelectValue placeholder="District" />
              </SelectTrigger>
            <SelectContent>
              {atolls.map((atoll) => (
                <SelectItem key={atoll} value={atoll}>
                  {atoll === "All" ? "All" : atoll}
                </SelectItem>
              ))}
            </SelectContent>
            </Select>
          )}
          
          {/* Results Badge */}
          <Badge variant="secondary" className="text-xs font-medium h-6 px-2">
            {filteredDonors.length}
          </Badge>
        </div>
        
        {/* Separator line */}
        <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent mt-3" />
      </div>

      {/* Donor List */}
      <div className="space-y-3 pt-2 flex-1">
        {filteredDonors.map((donor) => (
          <div
            key={donor.id}
            className="bg-card/50 backdrop-blur-sm rounded-2xl p-4 border border-border/50 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{donor.full_name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{donor.district || "Unknown"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs mt-1.5">
                  <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <a href={`tel:${donor.phone}`} className="text-primary hover:underline">
                    {donor.phone}
                  </a>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5">
                  <Droplet className="h-3 w-3 mr-1" />
                  {donor.blood_group}
                </Badge>
                {getStatusBadge(donor)}
              </div>
            </div>
            {donor.address && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{donor.address}</p>
            )}
          </div>
        ))}
      </div>

      {filteredDonors.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">No donors found</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
};

export default DonorDirectory;