import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, Building2, ChevronDown } from "lucide-react";
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
      // Auto-expand the most recent year
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
      return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
    } else if (diffMonths > 0) {
      return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    } else if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return 'Today';
    }
  };

  // Group donations by year and sort within each year by date (newest first)
  const donationsByYear = history.reduce((acc, donation) => {
    const year = new Date(donation.donation_date).getFullYear().toString();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(donation);
    return acc;
  }, {} as Record<string, DonationRecord[]>);

  // Sort donations within each year by date (newest first within year)
  Object.keys(donationsByYear).forEach(year => {
    donationsByYear[year].sort((a, b) => 
      new Date(b.donation_date).getTime() - new Date(a.donation_date).getTime()
    );
  });

  // Sort years in descending order
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
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground font-medium mb-1">No donations yet</p>
          <p className="text-sm text-muted-foreground/70">
            Tap the + button to record your first donation
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

        return (
          <Collapsible key={year} open={isOpen} onOpenChange={() => toggleYear(year)}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <span className="font-semibold">{year}</span>
                <Badge variant="secondary" className="rounded-full text-xs">
                  {yearDonations.length}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{totalUnits} unit{totalUnits !== 1 ? 's' : ''}</span>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 animate-accordion-down">
              <div className="space-y-2 ml-4 pl-4 border-l-2 border-primary/20">
                {yearDonations.map((donation) => (
                  <div 
                    key={donation.id} 
                    className="p-3 bg-background rounded-xl border border-border/50 hover:border-border transition-colors"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-3 w-3 text-primary" />
                          </div>
                          <p className="font-medium text-sm truncate">{donation.hospital_name}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-8">
                          <span>
                            {new Date(donation.donation_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                          <span className="text-muted-foreground/50">•</span>
                          <span className="italic">{getTimeAgo(donation.donation_date)}</span>
                        </div>
                        {donation.notes && (
                          <p className="text-xs text-muted-foreground mt-1 ml-8">{donation.notes}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="rounded-full text-xs flex-shrink-0">
                        {donation.units_donated || 1}u
                      </Badge>
                    </div>
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
