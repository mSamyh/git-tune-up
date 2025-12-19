import { cn } from "@/lib/utils";

interface OTPResendTimerProps {
  seconds: number;
  totalSeconds?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export const OTPResendTimer = ({
  seconds,
  totalSeconds = 60,
  size = 28,
  strokeWidth = 3,
  className,
}: OTPResendTimerProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds / totalSeconds;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div className="relative">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold text-primary tabular-nums">
            {seconds}
          </span>
        </div>
      </div>
      <span className="text-sm text-muted-foreground">
        Resend available in <span className="font-medium text-foreground">{seconds}s</span>
      </span>
    </div>
  );
};
