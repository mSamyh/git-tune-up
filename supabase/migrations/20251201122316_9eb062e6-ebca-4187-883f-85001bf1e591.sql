-- Create table for Telegram configuration
CREATE TABLE IF NOT EXISTS public.telegram_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_token TEXT NOT NULL,
  admin_chat_ids TEXT[] NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_config ENABLE ROW LEVEL SECURITY;

-- Only admins can view and modify telegram config
CREATE POLICY "Admins can manage telegram config"
ON public.telegram_config
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_telegram_config_updated_at
BEFORE UPDATE ON public.telegram_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for notification logs
CREATE TABLE IF NOT EXISTS public.telegram_notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for notification logs
ALTER TABLE public.telegram_notification_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view notification logs
CREATE POLICY "Admins can view notification logs"
ON public.telegram_notification_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);