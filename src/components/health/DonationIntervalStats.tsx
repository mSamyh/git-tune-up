import { differenceInDays } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface DonationIntervalStatsProps {
  donations: { donation_date: string }[];
}

export const DonationIntervalStats = ({ donations }: DonationIntervalStatsProps) => {
  // Calculate average interval between donations
  const calculateAverageInterval = () => {
    if (donations.length < 2) return null;

    const sortedDonations = [...donations]
      .sort((a, b) => new Date(a.donation_date).getTime() - new Date(b.donation_date).getTime());

    let totalDays = 0;
    for (let i = 1; i < sortedDonations.length; i++) {
      const days = differenceInDays(
        new Date(sortedDonations[i].donation_date),
        new Date(sortedDonations[i - 1].donation_date)
      );
      totalDays += days;
    }

    return Math.round(totalDays / (sortedDonations.length - 1));
  };

  const averageInterval = calculateAverageInterval();
  
  // Check if donating too frequently (< 56 days average)
  const isTooFrequent = averageInterval !== null && averageInterval < 56;
  const isHealthy = averageInterval !== null && averageInterval >= 90;

  return (
    <Card className="rounded-xl border-border/50">
      <CardContent className="p-3 text-center">
        <div className={`h-8 w-8 rounded-lg mx-auto mb-1 flex items-center justify-center ${
          isTooFrequent 
            ? 'bg-amber-500/10' 
            : isHealthy 
              ? 'bg-emerald-500/10' 
              : 'bg-primary/10'
        }`}>
          <Clock className={`h-4 w-4 ${
            isTooFrequent 
              ? 'text-amber-500' 
              : isHealthy 
                ? 'text-emerald-500' 
                : 'text-primary'
          }`} />
        </div>
        <p className="text-xl font-bold">
          {averageInterval !== null ? averageInterval : "—"}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {averageInterval !== null ? "Avg. Days" : "No Data"}
        </p>
        {isTooFrequent && (
          <p className="text-[9px] text-amber-500 mt-0.5">Too frequent!</p>
        )}
      </CardContent>
    </Card>
  );
};
