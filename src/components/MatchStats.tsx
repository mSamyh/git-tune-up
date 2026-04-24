import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, CheckCircle2 } from "lucide-react";

interface MatchStatsProps {
  requestId: string;
  notifiedCount?: number | null;
}

/**
 * Live match stats badge for blood requests.
 * Shows: "X donors notified · Y responding"
 * Uses Smart Donor Matching system data from request_matches table.
 */
export const MatchStats = ({ requestId, notifiedCount }: MatchStatsProps) => {
  const [stats, setStats] = useState<{ notified: number; responded: number } | null>(
    notifiedCount != null ? { notified: notifiedCount, responded: 0 } : null
  );

  useEffect(() => {
    let isMounted = true;

    const fetchStats = async () => {
      const { data } = await supabase.rpc("get_request_match_stats", {
        p_request_id: requestId,
      });
      if (isMounted && data) {
        setStats(data as { notified: number; responded: number });
      }
    };

    fetchStats();

    // Realtime updates when responses come in
    const channel = supabase
      .channel(`match_stats_${requestId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "request_matches", filter: `request_id=eq.${requestId}` },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  if (!stats || stats.notified === 0) return null;

  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1.5">
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-info/10 text-info border border-info/20">
        <Users className="h-2.5 w-2.5" />
        <span className="font-medium tabular-nums">{stats.notified}</span>
        <span>notified</span>
      </span>
      {stats.responded > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-success/10 text-success border border-success/20">
          <CheckCircle2 className="h-2.5 w-2.5" />
          <span className="font-medium tabular-nums">{stats.responded}</span>
          <span>responding</span>
        </span>
      )}
    </div>
  );
};
