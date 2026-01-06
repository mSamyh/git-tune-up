import { cn } from "@/lib/utils";

interface AdminTabIndicatorProps {
  totalTabs: number;
  activeIndex: number;
  className?: string;
}

export function AdminTabIndicator({ totalTabs, activeIndex, className }: AdminTabIndicatorProps) {
  return (
    <div className={cn("flex items-center justify-center gap-1.5 py-3", className)}>
      {Array.from({ length: totalTabs }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === activeIndex 
              ? "w-6 bg-primary" 
              : "w-1.5 bg-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}
