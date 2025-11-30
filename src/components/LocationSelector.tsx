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

  useEffect(() => {
    fetchAtolls();
  }, []);

  useEffect(() => {
    if (selectedAtoll) {
      fetchIslands(selectedAtoll);
    } else {
      setIslands([]);
      onIslandChange("");
    }
  }, [selectedAtoll]);

  const fetchAtolls = async () => {
    const { data } = await supabase
      .from("atolls")
      .select("*")
      .order("name");
    
    if (data) setAtolls(data);
  };

  const fetchIslands = async (atollName: string) => {
    const { data: atollData } = await supabase
      .from("atolls")
      .select("id")
      .eq("name", atollName)
      .single();

    if (atollData) {
      const { data: islandsData } = await supabase
        .from("islands")
        .select("*")
        .eq("atoll_id", atollData.id)
        .order("name");
      
      if (islandsData) setIslands(islandsData);
    }
  };

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
