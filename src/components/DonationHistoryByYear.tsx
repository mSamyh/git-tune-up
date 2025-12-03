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

  // Sort donations within each year by date (newest first)
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
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No donation history yet</p>
          <p className="text-sm text-muted-foreground">
            Your donations will appear here after you update your profile
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
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-semibold">{year}</span>
                <Badge variant="secondary" className="ml-2">
                  {yearDonations.length} donation{yearDonations.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{totalUnits} unit{totalUnits !== 1 ? 's' : ''}</span>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="space-y-2 pl-2 border-l-2 border-muted ml-2">
                {yearDonations.map((donation) => (
                  <div 
                    key={donation.id} 
                    className={cn(
                      "p-3 rounded-lg transition-colors",
                      variant === "standalone" 
                        ? "border hover:bg-muted/50" 
                        : "bg-background border"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <p className="font-medium">{donation.hospital_name}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(donation.donation_date).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground italic">
                          {getTimeAgo(donation.donation_date)}
                        </p>
                        {donation.notes && (
                          <p className="text-xs text-muted-foreground">{donation.notes}</p>
                        )}
                      </div>
                      <Badge variant="outline">{donation.units_donated || 1} unit{(donation.units_donated || 1) !== 1 ? 's' : ''}</Badge>
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
