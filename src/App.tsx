import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ReferenceDataProvider } from "@/contexts/ReferenceDataContext";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import RequestBlood from "./pages/RequestBlood";
import History from "./pages/History";
import BloodRequestsPage from "./pages/BloodRequestsPage";
import FAQ from "./pages/FAQ";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import VerifyQR from "./pages/VerifyQR";
import VerifyDonor from "./pages/VerifyDonor";
import Rewards from "./pages/Rewards";
import BloodStock from "./pages/BloodStock";

// Code-split heavy admin/portal routes (used by < 5% of users)
const Admin = lazy(() => import("./pages/Admin"));
const MerchantPortal = lazy(() => import("./pages/MerchantPortal"));
const HospitalPortal = lazy(() => import("./pages/HospitalPortal"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ReferenceDataProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/register" element={<Register />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/request-blood" element={<RequestBlood />} />
              <Route path="/blood-requests" element={<BloodRequestsPage />} />
              <Route path="/history" element={<History />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/about" element={<About />} />
              <Route path="/verify-qr/:voucherCode" element={<VerifyQR />} />
              <Route path="/verify-donor/:donorId" element={<VerifyDonor />} />
              <Route path="/merchant" element={<MerchantPortal />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/hospital" element={<HospitalPortal />} />
              <Route path="/blood-stock" element={<BloodStock />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ReferenceDataProvider>
  </QueryClientProvider>
);

export default App;
