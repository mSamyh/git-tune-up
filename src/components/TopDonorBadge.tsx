import { Badge } from "@/components/ui/badge";

interface TopDonorBadgeProps {
  rank: number;
  className?: string;
}

export const TopDonorBadge = ({ rank, className = "" }: TopDonorBadgeProps) => {
  if (rank < 1 || rank > 5) return null;

  const styles = {
    1: "bg-yellow-500 text-black border-yellow-600",
    2: "bg-gray-400 text-black border-gray-500",
    3: "bg-amber-700 text-white border-amber-800",
    4: "bg-orange-500 text-white border-orange-600",
    5: "bg-orange-400 text-white border-orange-500",
  };

  return (
    <Badge 
      className={`${styles[rank as keyof typeof styles]} font-bold px-2 py-1 text-sm ${className}`}
    >
      {rank}
    </Badge>
  );
};

export const getTopDonorRank = (donorId: string, topDonors: any[]): number => {
  const index = topDonors.findIndex(d => d.id === donorId);
  return index >= 0 && index < 5 ? index + 1 : 0;
};
