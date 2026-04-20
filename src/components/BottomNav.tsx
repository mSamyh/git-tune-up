import { NavLink as RouterNavLink } from "react-router-dom";
import { Home, Droplet, User, History, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: Home, label: "Home", end: true },
  { to: "/blood-requests", icon: Droplet, label: "Requests" },
  { to: "/blood-stock", icon: Droplets, label: "Stock" },
  { to: "/history", icon: History, label: "History" },
  { to: "/profile", icon: User, label: "Profile" },
];

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-strong border-t border-border/50 z-50 safe-area-pb">
      <div className="container mx-auto max-w-lg">
        <div className="flex items-center justify-around h-16">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <RouterNavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-all tap-target",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    "relative flex items-center justify-center w-11 h-7 rounded-full transition-all duration-300",
                    isActive && "bg-primary/12 scale-100",
                    !isActive && "scale-95"
                  )}>
                    <Icon className={cn(
                      "h-5 w-5 transition-all duration-200",
                      isActive && "stroke-[2.5]"
                    )} />
                    {isActive && (
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary animate-scale-in" />
                    )}
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium leading-none transition-all",
                    isActive ? "text-primary font-semibold" : ""
                  )}>{label}</span>
                </>
              )}
            </RouterNavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};
