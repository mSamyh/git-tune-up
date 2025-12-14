import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Save, Power, PowerOff, Bot, Link } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface TelegramConfig {
  id: string;
  bot_token: string;
  admin_chat_ids: string[];
  is_enabled: boolean;
}

export const TelegramConfigManager = () => {
  const [config, setConfig] = useState<TelegramConfig | null>(null);
  const [botToken, setBotToken] = useState("");
  const [chatIds, setChatIds] = useState<string[]>([]);
  const [newChatId, setNewChatId] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("telegram_config")
        .select("*")
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setConfig(data);
        setBotToken(data.bot_token);
        setChatIds(data.admin_chat_ids);
        setIsEnabled(data.is_enabled);
      }
    } catch (error: any) {
      console.error("Error fetching config:", error);
    }
  };

  const addChatId = () => {
    if (newChatId.trim() && !chatIds.includes(newChatId.trim())) {
      setChatIds([...chatIds, newChatId.trim()]);
      setNewChatId("");
    }
  };

  const removeChatId = (id: string) => {
    setChatIds(chatIds.filter(chatId => chatId !== id));
  };

  const saveConfig = async () => {
    if (!botToken.trim()) {
      toast({
        title: "Error",
        description: "Bot token is required",
        variant: "destructive",
      });
      return;
    }

    if (chatIds.length === 0) {
      toast({
        title: "Error",
        description: "At least one admin chat ID is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const configData = {
        bot_token: botToken.trim(),
        admin_chat_ids: chatIds,
        is_enabled: isEnabled,
      };

      if (config) {
        const { error } = await supabase
          .from("telegram_config")
          .update(configData)
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("telegram_config")
          .insert([configData]);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Telegram configuration saved successfully",
      });
      fetchConfig();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testNotification = async () => {
    try {
      const { error } = await supabase.functions.invoke("send-telegram-notification", {
        body: {
          eventType: "Test Notification",
          message: "This is a test notification from your Blood Donation Management System",
          details: {
            "Test Time": new Date().toLocaleString(),
            "Status": "Testing"
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Test Sent",
        description: "Check your Telegram for the test message",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const setupWebhook = async () => {
    if (!botToken.trim()) {
      toast({
        title: "Error",
        description: "Please save the bot token first",
        variant: "destructive",
      });
      return;
    }

    try {
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-bot-webhook`;
      
      const response = await fetch(
        `https://api.telegram.org/bot${botToken.trim()}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl })
        }
      );

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "Webhook Set",
          description: "Bot webhook configured successfully. Use /start in Telegram to test.",
        });
      } else {
        throw new Error(result.description || "Failed to set webhook");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Telegram Notifications</CardTitle>
            <CardDescription>
              Configure Telegram bot to receive real-time notifications for all system events
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
            />
            {isEnabled ? (
              <Badge variant="default" className="gap-1">
                <Power className="h-3 w-3" />
                Enabled
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <PowerOff className="h-3 w-3" />
                Disabled
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="bot-token">Telegram Bot Token</Label>
          <Input
            id="bot-token"
            type="password"
            placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Get your bot token from{" "}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              @BotFather
            </a>{" "}
            on Telegram
          </p>
        </div>

        <div className="space-y-2">
          <Label>Admin Chat IDs</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Enter chat ID (e.g., 123456789)"
              value={newChatId}
              onChange={(e) => setNewChatId(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addChatId()}
            />
            <Button onClick={addChatId} size="icon" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Send /start to your bot and use{" "}
            <a
              href="https://t.me/userinfobot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              @userinfobot
            </a>{" "}
            to get your chat ID
          </p>
          
          {chatIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {chatIds.map((id) => (
                <Badge key={id} variant="secondary" className="gap-2">
                  {id}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => removeChatId(id)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={saveConfig} disabled={loading} className="gap-2">
            <Save className="h-4 w-4" />
            {loading ? "Saving..." : "Save Configuration"}
          </Button>
          {config && (
            <>
              <Button onClick={testNotification} variant="outline" className="gap-2">
                <Power className="h-4 w-4" />
                Test Notification
              </Button>
              <Button onClick={setupWebhook} variant="outline" className="gap-2">
                <Link className="h-4 w-4" />
                Setup Bot Webhook
              </Button>
            </>
          )}
        </div>

        <div className="rounded-lg bg-muted p-4 text-sm space-y-3">
          <div>
            <p className="font-medium mb-2">Notification Events:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• New user registrations</li>
              <li>• New blood requests</li>
              <li>• Blood request status updates</li>
              <li>• User profile updates</li>
              <li>• Donation history changes</li>
              <li>• Admin role assignments</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-2 flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Bot Commands:
            </p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• <code>/broadcast</code> - Send SMS to donor groups</li>
              <li>• <code>/stats</code> - View donor statistics</li>
              <li>• <code>/help</code> - Show available commands</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};