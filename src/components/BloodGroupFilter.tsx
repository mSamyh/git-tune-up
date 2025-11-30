import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BloodGroupFilterProps {
  selectedGroup: string;
  onSelectGroup: (group: string) => void;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const BloodGroupFilter = ({ selectedGroup, onSelectGroup }: BloodGroupFilterProps) => {
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
      {BLOOD_GROUPS.map((group) => (
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
