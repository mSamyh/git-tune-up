import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Send, Users, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface DonorGroup {
  id: string;
  label: string;
  status: string;
  count: number;
}

export const TelegramBroadcast = () => {
  const [message, setMessage] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [donorGroups, setDonorGroups] = useState<DonorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDonorCounts();
  }, []);

  const fetchDonorCounts = async () => {
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("availability_status, phone")
        .in("user_type", ["donor", "both"]);

      if (profiles) {
        const availableCount = profiles.filter(p => p.availability_status === "available").length;
        const unavailableCount = profiles.filter(p => p.availability_status === "unavailable").length;
        const reservedCount = profiles.filter(p => p.availability_status === "reserved").length;
        const allCount = profiles.length;

        setDonorGroups([
          { id: "all", label: "All Donors", status: "all", count: allCount },
          { id: "available", label: "Available", status: "available", count: availableCount },
          { id: "unavailable", label: "Unavailable", status: "unavailable", count: unavailableCount },
          { id: "reserved", label: "Reserved", status: "reserved", count: reservedCount },
        ]);
      }
    } catch (error) {
      console.error("Error fetching donor counts:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    if (groupId === "all") {
      // If "All" is selected, clear other selections
      setSelectedGroups(prev => 
        prev.includes("all") ? [] : ["all"]
      );
    } else {
      // Remove "all" if selecting individual groups
      setSelectedGroups(prev => {
        const newGroups = prev.filter(g => g !== "all");
        if (newGroups.includes(groupId)) {
          return newGroups.filter(g => g !== groupId);
        }
        return [...newGroups, groupId];
      });
    }
  };

  const getSelectedCount = () => {
    if (selectedGroups.includes("all")) {
      return donorGroups.find(g => g.id === "all")?.count || 0;
    }
    return donorGroups
      .filter(g => selectedGroups.includes(g.id))
      .reduce((sum, g) => sum + g.count, 0);
  };

  const sendBroadcast = async () => {
    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message to broadcast",
        variant: "destructive",
      });
      return;
    }

    if (selectedGroups.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one donor group",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("broadcast-sms", {
        body: {
          message: message.trim(),
          groups: selectedGroups,
        },
      });

      if (error) throw error;

      toast({
        title: "Broadcast Sent",
        description: `SMS broadcast sent to ${getSelectedCount()} donors`,
      });

      setMessage("");
      setSelectedGroups([]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send broadcast",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          SMS Broadcast
        </CardTitle>
        <CardDescription>
          Send SMS messages to selected donor groups
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Select Donor Groups</Label>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {donorGroups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => toggleGroup(group.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedGroups.includes(group.id)
                      ? "bg-primary/10 border-primary"
                      : "bg-card border-border hover:border-primary/50"
                  }`}
                >
                  <Checkbox
                    checked={selectedGroups.includes(group.id)}
                    onCheckedChange={() => toggleGroup(group.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{group.label}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {group.count} donors
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="broadcast-message">Message</Label>
          <Textarea
            id="broadcast-message"
            placeholder="Type your message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {message.length}/160 characters (1 SMS)
          </p>
        </div>

        {selectedGroups.length > 0 && (
          <div className="rounded-lg bg-muted p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Recipients:</span>
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" />
                {getSelectedCount()} donors
              </Badge>
            </div>
          </div>
        )}

        <Button 
          onClick={sendBroadcast} 
          disabled={sending || selectedGroups.length === 0 || !message.trim()}
          className="w-full gap-2"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send Broadcast
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
