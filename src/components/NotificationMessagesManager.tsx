import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Save, Eye, Bell, Loader2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface NotificationMessage {
  id: string;
  message_key: string;
  message_title: string;
  message_template: string;
  description: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function NotificationMessagesManager() {
  const [messages, setMessages] = useState<NotificationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<NotificationMessage | null>(null);
  const [editForm, setEditForm] = useState({ message_title: "", message_template: "" });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<NotificationMessage | null>(null);
  const { toast } = useToast();

  const sampleDonor = {
    full_name: "Ahmed Ibrahim",
    blood_group: "O+",
    phone: "7915563",
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notification_messages")
      .select("*")
      .order("message_key");

    if (error) {
      toast({
        variant: "destructive",
        title: "Error loading messages",
        description: error.message,
      });
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  };

  const toggleEnabled = async (message: NotificationMessage) => {
    setSaving(message.id);
    const { error } = await supabase
      .from("notification_messages")
      .update({ is_enabled: !message.is_enabled })
      .eq("id", message.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error updating message",
        description: error.message,
      });
    } else {
      setMessages(messages.map(m => 
        m.id === message.id ? { ...m, is_enabled: !m.is_enabled } : m
      ));
      toast({
        title: message.is_enabled ? "Message disabled" : "Message enabled",
      });
    }
    setSaving(null);
  };

  const openEditDialog = (message: NotificationMessage) => {
    setEditingMessage(message);
    setEditForm({
      message_title: message.message_title,
      message_template: message.message_template,
    });
  };

  const handleSave = async () => {
    if (!editingMessage) return;
    
    setSaving(editingMessage.id);
    const { error } = await supabase
      .from("notification_messages")
      .update({
        message_title: editForm.message_title,
        message_template: editForm.message_template,
      })
      .eq("id", editingMessage.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error saving message",
        description: error.message,
      });
    } else {
      setMessages(messages.map(m => 
        m.id === editingMessage.id 
          ? { ...m, message_title: editForm.message_title, message_template: editForm.message_template }
          : m
      ));
      toast({ title: "Message saved successfully" });
      setEditingMessage(null);
    }
    setSaving(null);
  };

  const replaceVariables = (template: string) => {
    return template
      .replace(/{full_name}/g, sampleDonor.full_name)
      .replace(/{blood_group}/g, sampleDonor.blood_group)
      .replace(/{phone}/g, sampleDonor.phone);
  };

  const openPreview = (message: NotificationMessage) => {
    setPreviewMessage(message);
    setPreviewOpen(true);
  };

  const getMessageIcon = (key: string) => {
    if (key.includes("availability")) return "🎉";
    if (key.includes("wellness")) return "💚";
    return "📱";
  };

  const getVariablesUsed = (template: string) => {
    const variables = [];
    if (template.includes("{full_name}")) variables.push("full_name");
    if (template.includes("{blood_group}")) variables.push("blood_group");
    if (template.includes("{phone}")) variables.push("phone");
    return variables;
  };

  if (loading) {
    return (
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5 text-muted-foreground" />
                Donor Notifications
              </CardTitle>
              <CardDescription>
                Configure automated SMS messages sent to donors
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchMessages}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              No notification templates found
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`border rounded-xl p-4 transition-colors ${
                  message.is_enabled ? "bg-background" : "bg-muted/50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getMessageIcon(message.message_key)}</span>
                      <h4 className="font-medium truncate">{message.message_title}</h4>
                      {!message.is_enabled && (
                        <Badge variant="secondary" className="text-xs">Disabled</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {message.description}
                    </p>
                    <div className="bg-muted/50 rounded-lg p-3 mb-3">
                      <p className="text-sm font-mono line-clamp-2">
                        {message.message_template}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {getVariablesUsed(message.message_template).map((v) => (
                        <Badge key={v} variant="outline" className="text-xs font-mono">
                          {`{${v}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Switch
                      checked={message.is_enabled}
                      onCheckedChange={() => toggleEnabled(message)}
                      disabled={saving === message.id}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(message)}
                  >
                    <MessageSquare className="h-4 w-4 mr-1.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openPreview(message)}
                  >
                    <Eye className="h-4 w-4 mr-1.5" />
                    Preview
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingMessage} onOpenChange={() => setEditingMessage(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Notification Message</DialogTitle>
            <DialogDescription>
              Customize the message template. Use variables like {"{full_name}"} to personalize.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={editForm.message_title}
                onChange={(e) => setEditForm({ ...editForm, message_title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Message Template</Label>
              <Textarea
                value={editForm.message_template}
                onChange={(e) => setEditForm({ ...editForm, message_template: e.target.value })}
                rows={5}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Available variables: {"{full_name}"}, {"{blood_group}"}, {"{phone}"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="bg-muted rounded-lg p-3 text-sm">
                {replaceVariables(editForm.message_template)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMessage(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving === editingMessage?.id}>
              {saving === editingMessage?.id ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewMessage && getMessageIcon(previewMessage.message_key)}
              Message Preview
            </DialogTitle>
            <DialogDescription>
              How the message will appear to donors
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-medium">SMS Message</span>
              </div>
              <p className="text-sm">
                {previewMessage && replaceVariables(previewMessage.message_template)}
              </p>
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Sample data used:</strong><br />
                Name: {sampleDonor.full_name}<br />
                Blood Group: {sampleDonor.blood_group}<br />
                Phone: {sampleDonor.phone}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
