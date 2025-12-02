import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";

interface AuditResult {
  donor_id: string;
  full_name: string;
  current_balance: number;
  calculated_balance: number;
  discrepancy: number;
  total_earned: number;
  total_spent: number;
  lifetime_points: number;
}

export function PointsAuditPanel() {
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const runAudit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('audit_donor_points' as any);
      
      if (error) {
        // Fallback to manual audit if RPC doesn't exist
        const { data: auditData } = await supabase
          .from("donor_points")
          .select("donor_id, total_points, lifetime_points");
        
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name");
        
        const { data: transactions } = await supabase
          .from("points_transactions")
          .select("donor_id, points");
        
        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
        const results: AuditResult[] = [];
        
        for (const dp of auditData || []) {
          const userTransactions = transactions?.filter(t => t.donor_id === dp.donor_id) || [];
          const calculatedBalance = userTransactions.reduce((sum, t) => sum + t.points, 0);
          const totalEarned = userTransactions.filter(t => t.points > 0).reduce((sum, t) => sum + t.points, 0);
          const totalSpent = userTransactions.filter(t => t.points < 0).reduce((sum, t) => sum + t.points, 0);
          const discrepancy = dp.total_points - calculatedBalance;
          
          if (discrepancy !== 0) {
            results.push({
              donor_id: dp.donor_id,
              full_name: profileMap.get(dp.donor_id) || "Unknown",
              current_balance: dp.total_points,
              calculated_balance: calculatedBalance,
              discrepancy,
              total_earned: totalEarned,
              total_spent: totalSpent,
              lifetime_points: dp.lifetime_points,
            });
          }
        }
        
        setAuditResults(results.sort((a, b) => Math.abs(b.discrepancy) - Math.abs(a.discrepancy)));
      }
      
      toast({
        title: "Audit complete",
        description: `Found ${auditResults.length} discrepancies`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Audit failed",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fixDiscrepancy = async (result: AuditResult) => {
    if (!confirm(`Fix ${result.full_name}'s balance?\n\nCurrent: ${result.current_balance} pts\nShould be: ${result.calculated_balance} pts\n\nThis will ${result.discrepancy > 0 ? 'deduct' : 'add'} ${Math.abs(result.discrepancy)} points.`)) {
      return;
    }

    try {
      // Update to correct balance
      const { error: updateError } = await supabase
        .from("donor_points")
        .update({
          total_points: result.calculated_balance,
          updated_at: new Date().toISOString(),
        })
        .eq("donor_id", result.donor_id);

      if (updateError) throw updateError;

      // Record audit correction
      await supabase
        .from("points_transactions")
        .insert({
          donor_id: result.donor_id,
          points: result.calculated_balance - result.current_balance,
          transaction_type: "adjusted",
          description: `Audit correction: Balance mismatch fixed (was ${result.current_balance}, corrected to ${result.calculated_balance})`,
        });

      toast({
        title: "Balance corrected",
        description: `${result.full_name}'s balance updated to ${result.calculated_balance} points`,
      });

      // Re-run audit
      await runAudit();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fix failed",
        description: error.message,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Points Audit & Security
        </CardTitle>
        <CardDescription>
          Detect and fix point balance discrepancies, overspending, and transaction mismatches
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Button onClick={runAudit} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Run Security Audit
          </Button>
        </div>

        {auditResults.length > 0 ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {auditResults.length} Issues Found
              </Badge>
              <Badge variant="outline">
                Total Discrepancy: {auditResults.reduce((sum, r) => sum + Math.abs(r.discrepancy), 0)} pts
              </Badge>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Donor</TableHead>
                    <TableHead>Current Balance</TableHead>
                    <TableHead>Calculated Balance</TableHead>
                    <TableHead>Discrepancy</TableHead>
                    <TableHead>Earned</TableHead>
                    <TableHead>Spent</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditResults.map((result) => (
                    <TableRow key={result.donor_id}>
                      <TableCell className="font-medium">{result.full_name}</TableCell>
                      <TableCell>
                        <Badge variant={result.current_balance < 0 ? "destructive" : "outline"}>
                          {result.current_balance} pts
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={result.calculated_balance < 0 ? "destructive" : "secondary"}>
                          {result.calculated_balance} pts
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={result.discrepancy !== 0 ? "destructive" : "outline"}>
                          {result.discrepancy > 0 ? '+' : ''}{result.discrepancy} pts
                        </Badge>
                      </TableCell>
                      <TableCell className="text-green-600 font-mono">+{result.total_earned}</TableCell>
                      <TableCell className="text-red-600 font-mono">{result.total_spent}</TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => fixDiscrepancy(result)}
                        >
                          Fix Balance
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : auditResults.length === 0 && !loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <p className="font-medium">No discrepancies found</p>
            <p className="text-sm">All donor point balances match transaction history</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
