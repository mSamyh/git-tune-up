import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, Building2, ChevronDown, Droplets } from "lucide-react";
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
    <div className="space-y-2">
      {sortedYears.map((year) => {
        const yearDonations = donationsByYear[year];
        const totalUnits = yearDonations.reduce((sum, d) => sum + (d.units_donated || 1), 0);
        const isOpen = openYears.includes(year);

        return (
          <Collapsible key={year} open={isOpen} onOpenChange={() => toggleYear(year)}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/40 hover:bg-muted/60 rounded-xl transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <span className="font-semibold text-sm">{year}</span>
                <Badge variant="secondary" className="rounded-full text-[10px] px-2 h-5">
                  {yearDonations.length} donation{yearDonations.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">{totalUnits}u</span>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="space-y-1.5 ml-3 pl-3 border-l-2 border-primary/20">
                {yearDonations.map((donation, idx) => (
                  <div 
                    key={donation.id} 
                    className="flex items-center gap-3 p-2.5 bg-background hover:bg-muted/30 rounded-lg transition-colors"
                  >
                    {/* Date indicator */}
                    <div className="flex-shrink-0 w-10 text-center">
                      <p className="text-lg font-bold text-primary leading-none">
                        {new Date(donation.donation_date).getDate()}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {new Date(donation.donation_date).toLocaleDateString('en-US', { month: 'short' })}
                      </p>
                    </div>
                    
                    {/* Hospital info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{donation.hospital_name}</p>
                      <p className="text-xs text-muted-foreground">{getTimeAgo(donation.donation_date)}</p>
                    </div>
                    
                    {/* Units badge */}
                    <Badge variant="outline" className="rounded-full text-[10px] px-2 h-5 flex-shrink-0">
                      {donation.units_donated || 1}u
                    </Badge>
                  </div>
                ))}
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