import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, Clock, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReferenceData } from "@/contexts/ReferenceDataContext";
import { LucideIcon } from "lucide-react";

interface AvailabilityToggleProps {
  value: string;
  onChange: (status: string) => void;
  canSetAvailable: boolean;
  daysUntilAvailable?: number;
}

// Icon mapping for dynamic icons from database
const iconMap: Record<string, LucideIcon> = {
  Check: Check,
  Ban: Ban,
  Clock: Clock,
};

// Fallback statuses if database data not available
const FALLBACK_STATUSES = [
  {
    code: "available",
    label: "Available",
    icon_name: "Check",
    color: "text-green-600",
    bg_color: "bg-green-50",
  },
  {
    code: "unavailable",
    label: "Unavailable",
    icon_name: "Ban",
    color: "text-red-600",
    bg_color: "bg-red-50",
  },
  {
    code: "reserved",
    label: "Reserved",
    icon_name: "Clock",
    color: "text-orange-600",
    bg_color: "bg-orange-50",
  },
];

// Color mapping for active states
const activeClassMap: Record<string, string> = {
  available: "bg-green-500 hover:bg-green-600 text-white border-green-500",
  unavailable: "bg-red-500 hover:bg-red-600 text-white border-red-500",
  reserved: "bg-orange-500 hover:bg-orange-600 text-white border-orange-500",
};

const pulseClassMap: Record<string, string> = {
  available: "ring-4 ring-green-400/50",
  unavailable: "ring-4 ring-red-400/50",
  reserved: "ring-4 ring-orange-400/50",
};

export const AvailabilityToggle = ({
  value,
  onChange,
  canSetAvailable,
  daysUntilAvailable = 0,
}: AvailabilityToggleProps) => {
  const { availabilityStatuses } = useReferenceData();
  const [animatingStatus, setAnimatingStatus] = useState<string | null>(null);

  // Use database statuses if available, otherwise fallback
  const statuses = availabilityStatuses.length > 0 
    ? availabilityStatuses.map(s => ({
        code: s.code,
        label: s.label,
        icon_name: s.icon_name,
        color: s.color,
        bg_color: s.bg_color,
      }))
    : FALLBACK_STATUSES;

  const handleClick = (status: string) => {
    if (status === value) return;
    setAnimatingStatus(status);
    onChange(status);
  };

  useEffect(() => {
    if (animatingStatus) {
      const timer = setTimeout(() => setAnimatingStatus(null), 400);
      return () => clearTimeout(timer);
    }
  }, [animatingStatus]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {statuses.map((status) => {
          const Icon = iconMap[status.icon_name] || Check;
          const isActive = value === status.code;
          const isAnimating = animatingStatus === status.code;
          const isDisabled = status.code === "available" && !canSetAvailable;
          
          return (
            <Button
              key={status.code}
              variant="outline"
              size="sm"
              disabled={isDisabled}
              onClick={() => handleClick(status.code)}
              className={cn(
                "flex-1 gap-1.5 transition-all duration-200",
                isActive && activeClassMap[status.code],
                isAnimating && pulseClassMap[status.code],
                isAnimating && "animate-scale-in",
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Icon className={cn(
                "h-4 w-4 transition-transform",
                isAnimating && "animate-[spin_0.3s_ease-out]"
              )} />
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
