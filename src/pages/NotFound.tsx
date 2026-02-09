import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Droplet, Home, ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-primary/10 rounded-full blur-3xl" />
        </div>

        <div className="text-center max-w-md">
          {/* Icon */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-xl scale-150" />
            <div className="relative h-20 w-20 rounded-3xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30">
              <Droplet className="h-10 w-10 text-primary-foreground fill-primary-foreground/30" />
            </div>
          </div>

          {/* Text */}
          <h1 className="font-display text-7xl font-bold tracking-tight mb-2 bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">
            404
          </h1>
          <p className="text-xl font-semibold text-foreground mb-2">Page not found</p>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => navigate("/")}
              className="h-12 rounded-xl px-8 font-semibold btn-press shadow-lg shadow-primary/25"
            >
              <Home className="h-4 w-4 mr-2" />
              Return Home
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="h-12 rounded-xl px-8 font-semibold btn-press"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default NotFound;
