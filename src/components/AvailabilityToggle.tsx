import { useState, useEffect } from "react";
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
  const [animatingStatus, setAnimatingStatus] = useState<string | null>(null);

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

  const statuses = [
    {
      value: "available",
      label: "Available",
      icon: Check,
      activeClass: "bg-green-500 hover:bg-green-600 text-white border-green-500",
      pulseClass: "ring-4 ring-green-400/50",
      disabled: !canSetAvailable,
    },
    {
      value: "unavailable",
      label: "Unavailable",
      icon: Ban,
      activeClass: "bg-red-500 hover:bg-red-600 text-white border-red-500",
      pulseClass: "ring-4 ring-red-400/50",
      disabled: false,
    },
    {
      value: "reserved",
      label: "Reserved",
      icon: Clock,
      activeClass: "bg-orange-500 hover:bg-orange-600 text-white border-orange-500",
      pulseClass: "ring-4 ring-orange-400/50",
      disabled: false,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {statuses.map((status) => {
          const Icon = status.icon;
          const isActive = value === status.value;
          const isAnimating = animatingStatus === status.value;
          
          return (
            <Button
              key={status.value}
              variant="outline"
              size="sm"
              disabled={status.disabled}
              onClick={() => handleClick(status.value)}
              className={cn(
                "flex-1 gap-1.5 transition-all duration-200",
                isActive && status.activeClass,
                isAnimating && status.pulseClass,
                isAnimating && "animate-scale-in",
                status.disabled && "opacity-50 cursor-not-allowed"
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
