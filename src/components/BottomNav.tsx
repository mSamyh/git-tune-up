import { NavLink } from "@/components/NavLink";
import { Home, Droplet, User, History } from "lucide-react";

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border/50 z-50 safe-area-pb">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-around py-2">
          <NavLink
            to="/"
            end
            className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-primary transition-all duration-200 p-2 rounded-xl hover:bg-primary/5"
            activeClassName="text-primary font-semibold"
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px]">Home</span>
          </NavLink>

          <NavLink
            to="/blood-requests"
            className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-primary transition-all duration-200 p-2 rounded-xl hover:bg-primary/5"
            activeClassName="text-primary font-semibold"
          >
            <Droplet className="h-5 w-5" />
            <span className="text-[10px]">Requests</span>
          </NavLink>

          <NavLink
            to="/history"
            className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-primary transition-all duration-200 p-2 rounded-xl hover:bg-primary/5"
            activeClassName="text-primary font-semibold"
          >
            <History className="h-5 w-5" />
            <span className="text-[10px]">History</span>
          </NavLink>

          <NavLink
            to="/profile"
            className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-primary transition-all duration-200 p-2 rounded-xl hover:bg-primary/5"
            activeClassName="text-primary font-semibold"
          >
            <User className="h-5 w-5" />
            <span className="text-[10px]">Profile</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
};
