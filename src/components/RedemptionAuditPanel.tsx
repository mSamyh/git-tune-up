import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Calendar, CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react";
import { format, subDays, subMonths, startOfDay, endOfDay } from "date-fns";

interface RedemptionRecord {
  id: string;
  voucher_code: string;
  status: string;
  points_spent: number;
  created_at: string;
  verified_at: string | null;
  expires_at: string;
  profiles: {
    full_name: string;
    phone: string;
  } | null;
  reward_catalog: {
    title: string;
    partner_name: string;
  } | null;
}

interface AuditStats {
  total: number;
  verified: number;
  pending: number;
  expired: number;
  totalPoints: number;
}

export const RedemptionAuditPanel = () => {
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7days");
  const [stats, setStats] = useState<AuditStats>({ total: 0, verified: 0, pending: 0, expired: 0, totalPoints: 0 });
  const { toast } = useToast();

  useEffect(() => {
    fetchRedemptions();
  }, [period]);

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "7days":
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case "30days":
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case "90days":
        return { start: startOfDay(subDays(now, 90)), end: endOfDay(now) };
      case "6months":
        return { start: startOfDay(subMonths(now, 6)), end: endOfDay(now) };
      case "1year":
        return { start: startOfDay(subMonths(now, 12)), end: endOfDay(now) };
      default:
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    }
  };

  const fetchRedemptions = async () => {
    setLoading(true);
    const { start, end } = getDateRange();

    const { data, error } = await supabase
      .from("redemption_history")
      .select(`
        id,
        voucher_code,
        status,
        points_spent,
        created_at,
        verified_at,
        expires_at,
        profiles (full_name, phone),
        reward_catalog (title, partner_name)
      `)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      setRedemptions(data || []);
      
      // Calculate stats
      const verified = data?.filter(r => r.status === 'verified').length || 0;
      const pending = data?.filter(r => r.status === 'pending').length || 0;
      const expired = data?.filter(r => r.status === 'expired').length || 0;
      const totalPoints = data?.reduce((sum, r) => sum + (r.points_spent || 0), 0) || 0;
      
      setStats({
        total: data?.length || 0,
        verified,
        pending,
        expired,
        totalPoints,
      });
    }
    setLoading(false);
  };

  const exportToCSV = () => {
    if (redemptions.length === 0) {
      toast({ variant: "destructive", title: "No data", description: "Nothing to export" });
      return;
    }

    const headers = ["Date", "Voucher Code", "Customer", "Phone", "Reward", "Partner", "Points", "Status", "Verified At"];
    const rows = redemptions.map(r => [
      format(new Date(r.created_at), "yyyy-MM-dd HH:mm"),
      r.voucher_code,
      r.profiles?.full_name || "N/A",
      r.profiles?.phone || "N/A",
      r.reward_catalog?.title || "N/A",
      r.reward_catalog?.partner_name || "N/A",
      r.points_spent.toString(),
      r.status,
      r.verified_at ? format(new Date(r.verified_at), "yyyy-MM-dd HH:mm") : "N/A",
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `redemptions_${period}_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "Exported", description: "CSV file downloaded" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>;
      case "expired":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Redemption Audit
            </CardTitle>
            <CardDescription>Track and verify voucher redemptions</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32 rounded-xl">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="1year">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="bg-green-500/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="bg-primary/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.totalPoints}</p>
            <p className="text-xs text-muted-foreground">Points Used</p>
          </div>
        </div>

        {/* Redemption rate */}
        {stats.total > 0 && (
          <div className="mb-4 p-3 bg-muted/30 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm">Redemption Rate</span>
            </div>
            <span className="font-bold text-green-600">
              {((stats.verified / stats.total) * 100).toFixed(1)}%
            </span>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : redemptions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No redemptions found for this period
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {redemptions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      {format(new Date(r.created_at), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{r.profiles?.full_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{r.profiles?.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{r.reward_catalog?.title || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{r.reward_catalog?.partner_name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{r.points_spent}</TableCell>
                    <TableCell>{getStatusBadge(r.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
