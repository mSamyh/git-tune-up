import { useState, useEffect } from "react";
import { Bell, Check, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  related_request_id: string | null;
}

interface NotificationPreferences {
  blood_requests: boolean;
  responses: boolean;
  fulfilled: boolean;
}

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [prefsDialogOpen, setPrefsDialogOpen] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    blood_requests: true,
    responses: true,
    fulfilled: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchNotifications();
      fetchPreferences();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel('notifications-channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const fetchNotifications = async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    }
  };

  const fetchPreferences = async () => {
    if (!userId) return;

    const { data } = await supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("id", userId)
      .single();

    if (data?.notification_preferences && typeof data.notification_preferences === 'object') {
      const prefs = data.notification_preferences as Record<string, unknown>;
      setPreferences({
        blood_requests: prefs.blood_requests !== false,
        responses: prefs.responses !== false,
        fulfilled: prefs.fulfilled !== false,
      });
    }
  };

  const savePreferences = async () => {
    if (!userId) return;
    setSavingPrefs(true);

    const prefsJson = {
      blood_requests: preferences.blood_requests,
      responses: preferences.responses,
      fulfilled: preferences.fulfilled,
    };

    const { error } = await supabase
      .from("profiles")
      .update({ notification_preferences: prefsJson })
      .eq("id", userId);

    setSavingPrefs(false);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save preferences",
      });
    } else {
      toast({
        title: "Saved",
        description: "Notification preferences updated",
      });
      setPrefsDialogOpen(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);
    
    fetchNotifications();
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    
    fetchNotifications();
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    setIsOpen(false);
    
    // Navigate to blood requests page with the related request
    if (notification.related_request_id) {
      navigate(`/blood-requests?highlight=${notification.related_request_id}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'blood_request':
        return '🩸';
      case 'response':
        return '💬';
      case 'fulfilled':
        return '✅';
      default:
        return '🔔';
    }
  };

  if (!userId) return null;

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 bg-popover border shadow-lg rounded-xl">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPrefsDialogOpen(true);
                }}
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
              {notifications.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.preventDefault();
                    markAllAsRead();
                  }}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Read all
                </Button>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ScrollArea className="h-[300px]">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-2 w-full">
                    <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notification Preferences Dialog */}
      <Dialog open={prefsDialogOpen} onOpenChange={setPrefsDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Notification Preferences</DialogTitle>
            <DialogDescription>
              Choose which notifications you want to receive
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Blood Requests</Label>
                <p className="text-xs text-muted-foreground">
                  New requests matching your blood type
                </p>
              </div>
              <Switch
                checked={preferences.blood_requests}
                onCheckedChange={(checked) => 
                  setPreferences(prev => ({ ...prev, blood_requests: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Responses</Label>
                <p className="text-xs text-muted-foreground">
                  When donors respond to your requests
                </p>
              </div>
              <Switch
                checked={preferences.responses}
                onCheckedChange={(checked) => 
                  setPreferences(prev => ({ ...prev, responses: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Fulfilled</Label>
                <p className="text-xs text-muted-foreground">
                  When requests you responded to are fulfilled
                </p>
              </div>
              <Switch
                checked={preferences.fulfilled}
                onCheckedChange={(checked) => 
                  setPreferences(prev => ({ ...prev, fulfilled: checked }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPrefsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePreferences} disabled={savingPrefs}>
              {savingPrefs ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
