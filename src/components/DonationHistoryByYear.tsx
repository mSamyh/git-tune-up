import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, Building2, ChevronDown, Droplets, Heart, MapPin, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface DonationRecord {
  id: string;
  donation_date: string;
  hospital_name: string;
  notes: string | null;
  units_donated: number;
}

interface DonationHistoryByYearProps {
  donorId: string;
  variant?: "card" | "standalone";
}

export const DonationHistoryByYear = ({ donorId, variant = "card" }: DonationHistoryByYearProps) => {
  const [history, setHistory] = useState<DonationRecord[]>([]);
  const [openYears, setOpenYears] = useState<string[]>([]);

  useEffect(() => {
    fetchHistory();
  }, [donorId]);

  const fetchHistory = async () => {
    const { data } = await supabase
      .from("donation_history")
      .select("*")
      .eq("donor_id", donorId)
      .order("donation_date", { ascending: false });

    if (data) {
      setHistory(data);
      if (data.length > 0) {
        const mostRecentYear = new Date(data[0].donation_date).getFullYear().toString();
        setOpenYears([mostRecentYear]);
      }
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears > 0) {
      return `${diffYears}y ago`;
    } else if (diffMonths > 0) {
      return `${diffMonths}mo ago`;
    } else if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else {
      return 'Today';
    }
  };

  const donationsByYear = history.reduce((acc, donation) => {
    const year = new Date(donation.donation_date).getFullYear().toString();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(donation);
    return acc;
  }, {} as Record<string, DonationRecord[]>);

  Object.keys(donationsByYear).forEach(year => {
    donationsByYear[year].sort((a, b) => 
      new Date(b.donation_date).getTime() - new Date(a.donation_date).getTime()
    );
  });

  const sortedYears = Object.keys(donationsByYear).sort((a, b) => Number(b) - Number(a));

  const toggleYear = (year: string) => {
    setOpenYears(prev => 
      prev.includes(year) 
        ? prev.filter(y => y !== year)
        : [...prev, year]
    );
  };

  if (history.length === 0) {
    if (variant === "standalone") {
      return (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Droplets className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground font-medium mb-1">No donations yet</p>
          <p className="text-sm text-muted-foreground/70">
            Tap + to record your first donation
          </p>
        </div>
      );
    }
    return null;
  }

  const content = (
    <div className="space-y-3">
      {sortedYears.map((year) => {
        const yearDonations = donationsByYear[year];
        const totalUnits = yearDonations.reduce((sum, d) => sum + (d.units_donated || 1), 0);
        const isOpen = openYears.includes(year);
        const isCurrentYear = year === new Date().getFullYear().toString();

        return (
          <Collapsible key={year} open={isOpen} onOpenChange={() => toggleYear(year)}>
            <CollapsibleTrigger
              className={cn(
                "flex items-center justify-between w-full px-4 py-3 rounded-2xl transition-all duration-200 group",
                isOpen
                  ? "bg-gradient-to-r from-primary/15 via-rose-500/10 to-transparent border border-primary/20 shadow-sm"
                  : "bg-muted/40 hover:bg-muted/70 border border-transparent"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-10 w-10 rounded-xl flex flex-col items-center justify-center shadow-sm transition-all",
                    isOpen
                      ? "bg-gradient-to-br from-primary to-rose-600 text-white"
                      : "bg-card border border-border text-foreground"
                  )}
                >
                  <span className="text-[8px] uppercase tracking-wider font-bold opacity-70 leading-none">
                    Year
                  </span>
                  <span className="text-[11px] font-black tabular-nums leading-none mt-0.5">
                    {year.slice(-2)}
                  </span>
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-base leading-none">{year}</span>
                    {isCurrentYear && (
                      <span className="text-[8px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                        Now
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 font-semibold uppercase tracking-wider">
                    {yearDonations.length} donation{yearDonations.length !== 1 ? "s" : ""} · {totalUnits} unit{totalUnits !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-rose-500/10">
                  <Heart className="h-3 w-3 text-rose-500 fill-rose-500" />
                  <span className="text-[10px] font-black tabular-nums text-rose-600 dark:text-rose-400">
                    {yearDonations.length}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-300",
                    isOpen && "rotate-180 text-primary"
                  )}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 animate-fade-in">
              <div className="space-y-2.5 ml-1 pl-4 border-l-2 border-dashed border-primary/20 relative">
                {yearDonations.map((donation, idx) => {
                  const date = new Date(donation.donation_date);
                  const day = date.getDate();
                  const month = date.toLocaleDateString("en-US", { month: "short" });
                  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
                  const isLatest = idx === 0;

                  return (
                    <div
                      key={donation.id}
                      className={cn(
                        "relative group/item flex items-stretch gap-3 rounded-2xl overflow-hidden border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                        isLatest
                          ? "border-primary/30 bg-gradient-to-r from-primary/[0.07] via-card to-card shadow-sm"
                          : "border-border/50 bg-card hover:border-primary/30"
                      )}
                    >
                      {/* Timeline dot */}
                      <span
                        className={cn(
                          "absolute -left-[22px] top-1/2 -translate-y-1/2 h-3 w-3 rounded-full ring-4 ring-background transition-all",
                          isLatest
                            ? "bg-gradient-to-br from-primary to-rose-600 shadow-glow-primary scale-110"
                            : "bg-primary/40 group-hover/item:bg-primary"
                        )}
                      />

                      {/* Date block — tear-off calendar */}
                      <div
                        className={cn(
                          "shrink-0 w-16 flex flex-col items-center justify-center py-2.5 relative",
                          isLatest
                            ? "bg-gradient-to-b from-rose-600 to-primary text-white"
                            : "bg-muted/60 text-foreground"
                        )}
                      >
                        {/* Punched holes */}
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 flex gap-1">
                          <span className={cn("h-0.5 w-0.5 rounded-full", isLatest ? "bg-white/50" : "bg-foreground/30")} />
                          <span className={cn("h-0.5 w-0.5 rounded-full", isLatest ? "bg-white/50" : "bg-foreground/30")} />
                        </div>
                        <span
                          className={cn(
                            "text-[9px] font-black uppercase tracking-widest mt-1 leading-none",
                            isLatest ? "text-white/90" : "text-muted-foreground"
                          )}
                        >
                          {month}
                        </span>
                        <span className="text-2xl font-black tabular-nums leading-none mt-0.5">
                          {day}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] font-bold uppercase tracking-wider mt-1 leading-none",
                            isLatest ? "text-white/70" : "text-muted-foreground/70"
                          )}
                        >
                          {weekday}
                        </span>
                      </div>

                      {/* Hospital + meta */}
                      <div className="flex-1 min-w-0 py-2.5 pr-3 flex flex-col justify-center">
                        <div className="flex items-start gap-1.5">
                          <Building2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                          <p className="text-sm font-bold text-foreground leading-tight line-clamp-2">
                            {donation.hospital_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {getTimeAgo(donation.donation_date)}
                          </span>
                          {isLatest && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                              <Sparkles className="h-2 w-2" />
                              Latest
                            </span>
                          )}
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-wider">
                            <Droplets className="h-2 w-2" />
                            {donation.units_donated || 1}u
                          </span>
                        </div>
                        {donation.notes && (
                          <p className="text-[10px] text-muted-foreground italic mt-1 line-clamp-1">
                            "{donation.notes}"
                          </p>
                        )}
                      </div>

                      {/* Life saved chip — 1 donation = 1 life */}
                      <div className="shrink-0 flex flex-col items-center justify-center px-3 border-l border-dashed border-border/50">
                        <Heart className="h-3 w-3 text-rose-500 fill-rose-500 mb-0.5" />
                        <span className="text-base font-black tabular-nums leading-none text-rose-600 dark:text-rose-400">
                          1
                        </span>
                        <span className="text-[8px] uppercase tracking-wider font-bold text-muted-foreground mt-0.5">
                          life
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );

  if (variant === "standalone") {
    return content;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">Donation History</CardTitle>
        <CardDescription>Your past donations grouped by year</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
};