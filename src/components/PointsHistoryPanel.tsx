import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  TrendingUp, 
  TrendingDown, 
  Gift, 
  RefreshCw, 
  History,
  Droplets,
  ArrowUpCircle,
  ArrowDownCircle
} from "lucide-react";
import { format } from "date-fns";

interface PointsTransaction {
  id: string;
  points: number;
  transaction_type: string;
  description: string;
  created_at: string;
  related_donation_id: string | null;
  related_redemption_id: string | null;
}

interface PointsHistoryPanelProps {
  userId: string;
}

export function PointsHistoryPanel({ userId }: PointsHistoryPanelProps) {
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ earned: 0, spent: 0, refunded: 0 });

  useEffect(() => {
    fetchTransactions();
  }, [userId]);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("points_transactions")
      .select("*")
      .eq("donor_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setTransactions(data);
      
      // Calculate stats
      const earned = data.filter(t => t.points > 0 && t.transaction_type === "earned")
        .reduce((sum, t) => sum + t.points, 0);
      const spent = Math.abs(data.filter(t => t.points < 0 && t.transaction_type === "redeemed")
        .reduce((sum, t) => sum + t.points, 0));
      const refunded = data.filter(t => t.points > 0 && (t.transaction_type === "adjusted" || t.transaction_type === "expired"))
        .reduce((sum, t) => sum + t.points, 0);
      
      setStats({ earned, spent, refunded });
    }
    setLoading(false);
  };

  const getTransactionIcon = (type: string, points: number) => {
    if (type === "earned") return <Droplets className="h-4 w-4 text-primary" />;
    if (type === "redeemed") return <Gift className="h-4 w-4 text-orange-500" />;
    if (type === "expired" || type === "adjusted") {
      return points > 0 
        ? <RefreshCw className="h-4 w-4 text-green-500" />
        : <RefreshCw className="h-4 w-4 text-destructive" />;
    }
    return <History className="h-4 w-4 text-muted-foreground" />;
  };

  const getTransactionBadge = (type: string, points: number) => {
    if (type === "earned") {
      return <Badge className="bg-green-500/10 text-green-600 border-0 text-xs">Donation</Badge>;
    }
    if (type === "redeemed") {
      return <Badge className="bg-orange-500/10 text-orange-600 border-0 text-xs">Redeemed</Badge>;
    }
    if (type === "adjusted") {
      return points > 0 
        ? <Badge className="bg-blue-500/10 text-blue-600 border-0 text-xs">Refund</Badge>
        : <Badge className="bg-red-500/10 text-red-600 border-0 text-xs">Adjustment</Badge>;
    }
    if (type === "expired") {
      return <Badge className="bg-purple-500/10 text-purple-600 border-0 text-xs">Expired Refund</Badge>;
    }
    return <Badge variant="outline" className="text-xs">{type}</Badge>;
  };

  if (loading) {
    return (
      <Card className="rounded-2xl border-0 shadow-md">
        <CardContent className="py-8 text-center text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
          Loading history...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <History className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Points History</CardTitle>
            <CardDescription className="text-xs">Your recent transactions</CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* Quick Stats */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-green-500/10 text-center">
            <ArrowUpCircle className="h-4 w-4 text-green-600 mx-auto mb-1" />
            <p className="text-sm font-bold text-green-600">+{stats.earned}</p>
            <p className="text-[10px] text-muted-foreground">Earned</p>
          </div>
          <div className="p-2.5 rounded-xl bg-orange-500/10 text-center">
            <ArrowDownCircle className="h-4 w-4 text-orange-600 mx-auto mb-1" />
            <p className="text-sm font-bold text-orange-600">-{stats.spent}</p>
            <p className="text-[10px] text-muted-foreground">Spent</p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-center">
            <RefreshCw className="h-4 w-4 text-blue-600 mx-auto mb-1" />
            <p className="text-sm font-bold text-blue-600">+{stats.refunded}</p>
            <p className="text-[10px] text-muted-foreground">Refunded</p>
          </div>
        </div>
      </div>

      <CardContent className="pt-0">
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No transactions yet</p>
            <p className="text-xs">Your points history will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-2 pr-3">
              {transactions.map((transaction) => (
                <div 
                  key={transaction.id} 
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center flex-shrink-0 shadow-sm">
                    {getTransactionIcon(transaction.transaction_type, transaction.points)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {getTransactionBadge(transaction.transaction_type, transaction.points)}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {transaction.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {format(new Date(transaction.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <div className={`text-right flex-shrink-0 font-bold text-sm ${
                    transaction.points > 0 ? "text-green-600" : "text-orange-600"
                  }`}>
                    {transaction.points > 0 ? "+" : ""}{transaction.points}
                    <span className="text-[10px] font-normal text-muted-foreground block">pts</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
