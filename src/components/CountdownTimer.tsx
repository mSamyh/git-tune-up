import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  neededBefore: string;
  compact?: boolean;
  className?: string;
}

export const CountdownTimer = ({ neededBefore, compact = false, className }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; expired: boolean }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    expired: false,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const deadline = new Date(neededBefore);
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        return { hours: 0, minutes: 0, seconds: 0, expired: true };
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      return { hours, minutes, seconds, expired: false };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [neededBefore]);

  if (timeLeft.expired) {
    return (
      <div className={cn("flex items-center gap-1.5 text-destructive font-medium", className)}>
        <AlertTriangle className="h-3 w-3" />
        <span className="text-xs">EXPIRED</span>
      </div>
    );
  }

  const isUrgent = timeLeft.hours < 6;
  const isCritical = timeLeft.hours < 2;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 font-medium text-xs",
          isCritical ? "text-destructive animate-pulse" : isUrgent ? "text-orange-500" : "text-muted-foreground",
          className
        )}
      >
        <Clock className="h-3 w-3" />
        <span>
          {timeLeft.hours > 24
            ? `${Math.floor(timeLeft.hours / 24)}d ${timeLeft.hours % 24}h`
            : `${timeLeft.hours}h ${timeLeft.minutes}m`}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded-lg",
        isCritical
          ? "bg-destructive/10 text-destructive animate-pulse"
          : isUrgent
          ? "bg-orange-500/10 text-orange-500"
          : "bg-muted text-muted-foreground",
        className
      )}
    >
      <Clock className="h-3.5 w-3.5" />
      <div className="flex items-center gap-1 text-xs font-medium">
        <span>Needed in:</span>
        <div className="flex items-center gap-0.5">
          {timeLeft.hours > 0 && (
            <>
              <span className="font-bold">{timeLeft.hours}</span>
              <span className="text-[10px]">h</span>
            </>
          )}
          <span className="font-bold">{timeLeft.minutes}</span>
          <span className="text-[10px]">m</span>
          <span className="font-bold">{timeLeft.seconds}</span>
          <span className="text-[10px]">s</span>
        </div>
      </div>
    </div>
  );
};
