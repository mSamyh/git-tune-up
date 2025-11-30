import { NavLink } from "@/components/NavLink";
import { Home, Droplet, User, History } from "lucide-react";

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-around py-3">
          <NavLink
            to="/"
            end
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            activeClassName="text-primary font-semibold"
          >
            <Home className="h-5 w-5" />
            <span className="text-xs">Home</span>
          </NavLink>

          <button
            onClick={() => window.location.href = "/"}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
          >
            <Droplet className="h-5 w-5" />
            <span className="text-xs">Donors</span>
          </button>

          <NavLink
            to="/history"
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            activeClassName="text-primary font-semibold"
          >
            <History className="h-5 w-5" />
            <span className="text-xs">History</span>
          </NavLink>

          <NavLink
            to="/profile"
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            activeClassName="text-primary font-semibold"
          >
            <User className="h-5 w-5" />
            <span className="text-xs">Profile</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
};
