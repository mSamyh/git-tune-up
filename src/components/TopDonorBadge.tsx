import { Medal } from "lucide-react";

interface TopDonorBadgeProps {
  rank: number;
  className?: string;
}

export const TopDonorBadge = ({ rank, className = "" }: TopDonorBadgeProps) => {
  if (rank < 1 || rank > 5) return null;

  const colors = {
    1: "text-yellow-500",
    2: "text-gray-400",
    3: "text-amber-700",
    4: "text-orange-500",
    5: "text-orange-400",
  };

  return (
    <div className={className}>
      <Medal className={`h-6 w-6 ${colors[rank as keyof typeof colors]}`} />
    </div>
  );
};

export const getTopDonorRank = (donorId: string, topDonors: any[]): number => {
  const index = topDonors.findIndex(d => d.id === donorId);
  return index >= 0 && index < 5 ? index + 1 : 0;
};
