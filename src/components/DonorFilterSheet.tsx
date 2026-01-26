import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Check, Ban, Clock, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Island {
  id: string;
  atoll_id: string;
  name: string;
}

interface DonorFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAtoll: string;
  onAtollChange: (atoll: string) => void;
  selectedIsland: string;
  onIslandChange: (island: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  atolls: { id: string; name: string }[];
}

export const DonorFilterSheet = ({
  open,
  onOpenChange,
  selectedAtoll,
  onAtollChange,
  selectedIsland,
  onIslandChange,
  selectedStatus,
  onStatusChange,
  atolls,
}: DonorFilterSheetProps) => {
  const [islands, setIslands] = useState<Island[]>([]);

  // Fetch islands when atoll changes
  useEffect(() => {
    const fetchIslands = async () => {
      if (selectedAtoll && selectedAtoll !== "all") {
        const selectedAtollData = atolls.find(a => a.name === selectedAtoll);
        if (selectedAtollData) {
          const { data } = await supabase
            .from("islands")
            .select("*")
            .eq("atoll_id", selectedAtollData.id)
            .order("name");
          if (data) setIslands(data);
        }
      } else {
        setIslands([]);
      }
    };
    fetchIslands();
  }, [selectedAtoll, atolls]);

  const clearFilters = () => {
    onAtollChange("all");
    onIslandChange("all");
    onStatusChange("all");
  };

  const handleAtollChange = (atoll: string) => {
    onAtollChange(atoll);
    onIslandChange("all"); // Reset island when atoll changes
  };

  const hasActiveFilters = selectedAtoll !== "all" || selectedIsland !== "all" || selectedStatus !== "all";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-8">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg font-display">Filter Donors</SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Availability Status */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-muted-foreground">Availability</Label>
            <ToggleGroup 
              type="single" 
              value={selectedStatus} 
              onValueChange={(value) => value && onStatusChange(value)}
              className="flex flex-wrap gap-2 justify-start"
            >
              <ToggleGroupItem 
                value="all" 
                className="h-9 px-4 rounded-xl border border-border/50 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
              >
                All
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="available" 
                className="h-9 px-4 rounded-xl border border-border/50 data-[state=on]:bg-emerald-500 data-[state=on]:text-white data-[state=on]:border-emerald-500 gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                Available
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="unavailable" 
                className="h-9 px-4 rounded-xl border border-border/50 data-[state=on]:bg-red-500 data-[state=on]:text-white data-[state=on]:border-red-500 gap-1.5"
              >
                <Ban className="h-3.5 w-3.5" />
                Unavailable
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="reserved" 
                className="h-9 px-4 rounded-xl border border-border/50 data-[state=on]:bg-blue-500 data-[state=on]:text-white data-[state=on]:border-blue-500 gap-1.5"
              >
                <Clock className="h-3.5 w-3.5" />
                Reserved
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Location: Atoll & Island */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={selectedAtoll} onValueChange={handleAtollChange}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="All Atolls" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">All Atolls</SelectItem>
                  {atolls.map((atoll) => (
                    <SelectItem key={atoll.id} value={atoll.name}>
                      {atoll.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={selectedIsland} 
                onValueChange={onIslandChange}
                disabled={selectedAtoll === "all"}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="All Islands" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">All Islands</SelectItem>
                  {islands.map((island) => (
                    <SelectItem key={island.id} value={island.name}>
                      {island.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-6 mt-6 border-t border-border/50">
          <Button 
            variant="outline" 
            onClick={clearFilters} 
            className="flex-1 h-12 rounded-xl"
            disabled={!hasActiveFilters}
          >
            Clear All
          </Button>
          <Button 
            onClick={() => onOpenChange(false)} 
            className="flex-1 h-12 rounded-xl"
          >
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};