import { NavLink as RouterNavLink } from "react-router-dom";
import { Home, Droplet, User, History } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: Home, label: "Home", end: true },
  { to: "/blood-requests", icon: Droplet, label: "Requests" },
  { to: "/history", icon: History, label: "History" },
  { to: "/profile", icon: User, label: "Profile" },
];

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border/50 z-50 safe-area-pb">
      <div className="container mx-auto max-w-lg">
        <div className="flex items-center justify-around h-16">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <RouterNavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-2xl transition-colors",
                    isActive && "bg-primary/10"
                  )}>
                    <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium",
                    isActive && "text-primary"
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