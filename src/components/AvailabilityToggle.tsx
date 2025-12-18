import { Button } from "@/components/ui/button";
import { Check, Clock, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvailabilityToggleProps {
  value: string;
  onChange: (status: string) => void;
  canSetAvailable: boolean;
  daysUntilAvailable?: number;
}

export const AvailabilityToggle = ({
  value,
  onChange,
  canSetAvailable,
  daysUntilAvailable = 0,
}: AvailabilityToggleProps) => {
  const statuses = [
    {
      value: "available",
      label: "Available",
      icon: Check,
      activeClass: "bg-green-500 hover:bg-green-600 text-white border-green-500",
      disabled: !canSetAvailable,
    },
    {
      value: "unavailable",
      label: "Unavailable",
      icon: Ban,
      activeClass: "bg-red-500 hover:bg-red-600 text-white border-red-500",
      disabled: false,
    },
    {
      value: "reserved",
      label: "Reserved",
      icon: Clock,
      activeClass: "bg-orange-500 hover:bg-orange-600 text-white border-orange-500",
      disabled: false,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {statuses.map((status) => {
          const Icon = status.icon;
          const isActive = value === status.value;
          
          return (
            <Button
              key={status.value}
              variant="outline"
              size="sm"
              disabled={status.disabled}
              onClick={() => onChange(status.value)}
              className={cn(
                "flex-1 gap-1.5 transition-all",
                isActive && status.activeClass,
                status.disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{status.label}</span>
            </Button>
          );
        })}
      </div>
      {!canSetAvailable && daysUntilAvailable > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {daysUntilAvailable} days until you can set available
        </p>
      )}
    </div>
  );
};
