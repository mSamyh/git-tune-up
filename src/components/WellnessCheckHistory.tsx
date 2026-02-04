import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { History, Search, RefreshCw, Loader2, MessageSquare, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface WellnessLog {
  id: string;
  donor_id: string;
  notification_type: string;
  sent_at: string;
  sent_via: string;
  message_sent: string | null;
  status: string;
  error_message: string | null;
  profiles?: {
    full_name: string;
    phone: string;
    blood_group: string;
  };
}

const PAGE_SIZE = 10;

export function WellnessCheckHistory() {
  const [logs, setLogs] = useState<WellnessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, [currentPage, typeFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    
    let query = supabase
      .from("donor_wellness_logs")
      .select(`
        *,
        profiles:donor_id (full_name, phone, blood_group)
      `, { count: "exact" })
      .order("sent_at", { ascending: false })
      .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

    if (typeFilter !== "all") {
      query = query.eq("notification_type", typeFilter);
    }

    const { data, error, count } = await query;

    if (error) {
      toast({
        variant: "destructive",
        title: "Error loading logs",
        description: error.message,
      });
    } else {
      setLogs(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const donorName = log.profiles?.full_name?.toLowerCase() || "";
    return donorName.includes(searchQuery.toLowerCase());
  });

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "availability_restored":
        return "Ready to Donate";
      case "wellness_check_first":
        return "First Check-in";
      case "wellness_check_followup":
        return "Follow-up";
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "availability_restored":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "wellness_check_first":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "wellness_check_followup":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      default:
        return "";
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <Card className="rounded-2xl border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              Notification History
            </CardTitle>
            <CardDescription>
              Log of all automated notifications sent to donors
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by donor name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="availability_restored">Ready to Donate</SelectItem>
              <SelectItem value="wellness_check_first">First Check-in</SelectItem>
              <SelectItem value="wellness_check_followup">Follow-up</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">No notifications found</p>
          </div>
        ) : (
          <>
            {/* Mobile view */}
            <div className="sm:hidden space-y-3">
              {filteredLogs.map((log) => (
                <div key={log.id} className="border rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{log.profiles?.full_name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">
                        {log.profiles?.blood_group} · {log.profiles?.phone}
                      </p>
                    </div>
                    {log.status === "sent" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getTypeColor(log.notification_type)}>
                      {getTypeLabel(log.notification_type)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.sent_at), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  {log.error_message && (
                    <p className="text-xs text-destructive bg-destructive/10 rounded p-2">
                      {log.error_message}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop view */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Donor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{log.profiles?.full_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.profiles?.blood_group} · {log.profiles?.phone}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(log.notification_type)}>
                          {getTypeLabel(log.notification_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(log.sent_at), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell>
                        {log.status === "sent" ? (
                          <div className="flex items-center gap-1.5 text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm">Sent</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-destructive">
                            <XCircle className="h-4 w-4" />
                            <span className="text-sm">Failed</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => p - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
