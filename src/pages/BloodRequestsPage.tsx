import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Heart, CheckCircle2, Clock, Droplet, Flame, Activity, ArrowUpRight } from "lucide-react";
import BloodRequests from "@/components/BloodRequests";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const BloodRequestsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [filter, setFilter] = useState<"active" | "fulfilled" | "expired">("active");
  const [stats, setStats] = useState({ active: 0, fulfilled: 0, expired: 0 });
  const [urgentCount, setUrgentCount] = useState(0);

  useEffect(() => {
    if (highlightId) {
      const timer = setTimeout(() => {
        navigate("/blood-requests", { replace: true });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [highlightId, navigate]);

  useEffect(() => {
    fetchStats();
    const channel = supabase
      .channel("blood_requests_stats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blood_requests" },
        () => fetchStats()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStats = async () => {
    const { data } = await supabase.from("blood_requests").select("status, urgency");
    if (data) {
      setStats({
        active: data.filter((r) => r.status === "active").length,
        fulfilled: data.filter((r) => r.status === "fulfilled").length,
        expired: data.filter((r) => r.status === "expired").length,
      });
      setUrgentCount(
        data.filter((r) => r.status === "active" && r.urgency === "Emergency").length
      );
    }
  };

  const total = stats.active + stats.fulfilled + stats.expired;
  const fulfillmentRate = total > 0 ? Math.round((stats.fulfilled / total) * 100) : 0;

  const tabs = [
    {
      key: "active" as const,
      label: "Active",
      count: stats.active,
      icon: Heart,
      color: "text-rose-500",
      activeBg: "bg-rose-500",
      ringColor: "ring-rose-500/30",
    },
    {
      key: "fulfilled" as const,
      label: "Saved",
      count: stats.fulfilled,
      icon: CheckCircle2,
      color: "text-emerald-500",
      activeBg: "bg-emerald-500",
      ringColor: "ring-emerald-500/30",
    },
    {
      key: "expired" as const,
      label: "Expired",
      count: stats.expired,
      icon: Clock,
      color: "text-muted-foreground",
      activeBg: "bg-muted-foreground",
      ringColor: "ring-muted-foreground/20",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 pb-28">
      <AppHeader />

      <main className="container mx-auto max-w-2xl px-4 pt-3 pb-4 space-y-4 animate-fade-in">
        {/* ============ HERO CARD ============ */}
        <section className="relative overflow-hidden rounded-[28px] shadow-2xl border border-border/40">
          <div
            className="relative px-5 pt-5 pb-5"
            style={{
              background:
                "radial-gradient(circle at 80% 10%, hsl(0 75% 24%) 0%, hsl(0 80% 14%) 50%, hsl(348 60% 10%) 100%)",
            }}
          >
            {/* Decorative blobs */}
            <div className="absolute -top-16 -right-12 w-48 h-48 rounded-full bg-rose-500/30 blur-3xl" />
            <div className="absolute -bottom-12 -left-10 w-40 h-40 rounded-full bg-amber-500/20 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(hsl(0 0% 100%) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />

            {/* Top row */}
            <div className="relative flex items-start justify-between mb-5">
              <div>
                <p className="text-white/55 text-[10px] uppercase tracking-[0.25em] font-bold mb-1.5">
                  Community pulse
                </p>
                <h1 className="text-white text-2xl font-black leading-tight">
                  Blood Requests
                </h1>
                <p className="text-white/65 text-xs mt-1">
                  Help save lives in your area
                </p>
              </div>
              <div className="relative shrink-0">
                <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-lg">
                  <Droplet className="h-6 w-6 text-white fill-rose-300/40" />
                </div>
                {urgentCount > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-amber-400 flex items-center justify-center shadow-lg animate-pulse">
                    <span className="text-[10px] font-black text-rose-950">{urgentCount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Live counters */}
            <div className="relative flex items-end justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-white text-6xl font-black tabular-nums leading-none drop-shadow-lg">
                    {stats.active}
                  </span>
                  <span className="text-white/70 text-sm font-medium">live now</span>
                </div>
                {urgentCount > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 backdrop-blur-md">
                    <Flame className="h-3 w-3 text-amber-200" />
                    <span className="text-amber-100 text-[11px] font-bold">
                      {urgentCount} emergency
                    </span>
                  </div>
                )}
              </div>

              {/* Fulfillment ring */}
              {total > 0 && (
                <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
                  <svg width="64" height="64" className="-rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="6"
                      fill="none"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      stroke="hsl(142 76% 56%)"
                      strokeWidth="6"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 26}
                      strokeDashoffset={2 * Math.PI * 26 - (fulfillmentRate / 100) * 2 * Math.PI * 26}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-white text-base font-black tabular-nums leading-none">
                      {fulfillmentRate}%
                    </p>
                    <p className="text-white/60 text-[8px] font-bold uppercase tracking-wider">
                      saved
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CTA strip */}
          <button
            onClick={() => navigate("/request-blood")}
            className="w-full px-5 py-3.5 bg-card hover:bg-muted/50 transition-colors flex items-center justify-between group border-t border-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-foreground">Need blood?</p>
                <p className="text-[11px] text-muted-foreground">Post a request in 30 seconds</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </button>
        </section>

        {/* ============ SEGMENTED FILTER CHIPS ============ */}
        <div className="grid grid-cols-3 gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "relative overflow-hidden rounded-2xl border transition-all duration-200 active:scale-95 px-3 py-3",
                  isActive
                    ? "bg-card border-border shadow-md ring-2 " + tab.ringColor
                    : "bg-muted/40 border-transparent hover:bg-muted/60"
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Icon className={cn("h-4 w-4", isActive ? tab.color : "text-muted-foreground")} />
                  {isActive && (
                    <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", tab.activeBg)} />
                  )}
                </div>
                <p
                  className={cn(
                    "text-2xl font-black tabular-nums leading-none text-left",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {tab.count}
                </p>
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider text-left mt-1",
                    isActive ? "text-foreground/70" : "text-muted-foreground/70"
                  )}
                >
                  {tab.label}
                </p>
              </button>
            );
          })}
        </div>

        {/* ============ REQUEST LIST ============ */}
        <section className="rounded-3xl bg-card border border-border/60 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold capitalize">{filter} requests</h2>
            </div>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              {tabs.find((t) => t.key === filter)?.count ?? 0}
            </span>
          </div>
          <div className="px-4 pb-4 pt-2">
            <BloodRequests
              status={filter}
              highlightId={highlightId}
              onStatusChange={(s) => setFilter(s as any)}
            />
          </div>
        </section>
      </main>

      {/* Floating Add Button */}
      <Button
        size="lg"
        className="fixed bottom-24 right-4 h-14 w-14 rounded-2xl shadow-2xl z-50 btn-press bg-gradient-to-br from-primary to-rose-600 hover:opacity-95 ring-4 ring-primary/20"
        onClick={() => navigate("/request-blood")}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <BottomNav />
    </div>
  );
};

export default BloodRequestsPage;
