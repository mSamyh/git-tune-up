import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface Atoll {
  id: string;
  name: string;
}

interface Island {
  id: string;
  atoll_id: string;
  name: string;
}

interface LocationSelectorProps {
  selectedAtoll: string;
  selectedIsland: string;
  onAtollChange: (atoll: string) => void;
  onIslandChange: (island: string) => void;
}

export const LocationSelector = ({
  selectedAtoll,
  selectedIsland,
  onAtollChange,
  onIslandChange,
}: LocationSelectorProps) => {
  const [atolls, setAtolls] = useState<Atoll[]>([]);
  const [islands, setIslands] = useState<Island[]>([]);
  
  // Geographic order from north to south
  const atollOrder = ['Ha', 'Hdh', 'Sh', 'N', 'R', 'B', 'Lh', 'K', 'Aa', 'Adh', 'V', 'M', 'F', 'Dh', 'Th', 'L', 'Ga', 'Gdh', 'Gn', 'S'];

  useEffect(() => {
    let isMounted = true;
    
    const fetchAtolls = async () => {
      try {
        const { data, error } = await supabase.from("atolls").select("*");
        
        if (error) throw error;
        
        if (isMounted && data) {
          // Sort atolls by geographic order (north to south)
          const sorted = data.sort((a, b) => {
            const indexA = atollOrder.indexOf(a.name);
            const indexB = atollOrder.indexOf(b.name);
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
          });
          setAtolls(sorted);
        }
      } catch (error) {
        console.error("Error fetching atolls:", error);
      }
    };
    
    fetchAtolls();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    if (!selectedAtoll) {
      setIslands([]);
      onIslandChange("");
      return;
    }
    
    const fetchIslands = async () => {
      try {
        const { data: atollData, error: atollError } = await supabase
          .from("atolls")
          .select("id")
          .eq("name", selectedAtoll)
          .single();

        if (atollError) throw atollError;

        if (atollData && isMounted) {
          const { data: islandsData, error: islandsError } = await supabase
            .from("islands")
            .select("*")
            .eq("atoll_id", atollData.id)
            .order("name");
          
          if (islandsError) throw islandsError;
          if (isMounted && islandsData) setIslands(islandsData);
        }
      } catch (error) {
        console.error("Error fetching islands:", error);
        if (isMounted) setIslands([]);
      }
    };
    
    fetchIslands();
    return () => { isMounted = false; };
  }, [selectedAtoll]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Atoll</Label>
        <Select value={selectedAtoll} onValueChange={onAtollChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select atoll" />
          </SelectTrigger>
          <SelectContent>
            {atolls.map((atoll) => (
              <SelectItem key={atoll.id} value={atoll.name}>
                {atoll.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Island</Label>
        <Select 
          value={selectedIsland} 
          onValueChange={onIslandChange}
          disabled={!selectedAtoll}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select island" />
          </SelectTrigger>
          <SelectContent>
            {islands.map((island) => (
              <SelectItem key={island.id} value={island.name}>
                {island.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
