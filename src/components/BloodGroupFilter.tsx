import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useReferenceData, FALLBACK_BLOOD_GROUPS } from "@/contexts/ReferenceDataContext";

interface BloodGroupFilterProps {
  selectedGroup: string;
  onSelectGroup: (group: string) => void;
}

export const BloodGroupFilter = ({ selectedGroup, onSelectGroup }: BloodGroupFilterProps) => {
  const { bloodGroupCodes, isLoading } = useReferenceData();
  const bloodGroups = bloodGroupCodes.length > 0 ? bloodGroupCodes : FALLBACK_BLOOD_GROUPS;
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <Badge
        variant={selectedGroup === "all" ? "default" : "outline"}
        className={cn(
          "cursor-pointer px-4 py-2 text-sm transition-all",
          selectedGroup === "all" && "bg-primary text-primary-foreground"
        )}
        onClick={() => onSelectGroup("all")}
      >
        All Groups
      </Badge>
      {bloodGroups.map((group) => (
        <Badge
          key={group}
          variant={selectedGroup === group ? "default" : "outline"}
          className={cn(
            "cursor-pointer px-4 py-2 text-sm transition-all",
            selectedGroup === group && "bg-primary text-primary-foreground"
          )}
          onClick={() => onSelectGroup(group)}
        >
          {group}
        </Badge>
      ))}
    </div>
  );
};
