-- Create notification_messages table for configurable message templates
CREATE TABLE public.notification_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_key TEXT NOT NULL UNIQUE,
  message_title TEXT NOT NULL,
  message_template TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_messages ENABLE ROW LEVEL SECURITY;

-- Policies for notification_messages
CREATE POLICY "Admins can manage notification messages"
ON public.notification_messages FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view notification messages"
ON public.notification_messages FOR SELECT
USING (true);

-- Create donor_wellness_logs table to track sent notifications
CREATE TABLE public.donor_wellness_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_via TEXT NOT NULL DEFAULT 'sms',
  message_sent TEXT,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_wellness_logs_donor ON public.donor_wellness_logs(donor_id);
CREATE INDEX idx_wellness_logs_type_date ON public.donor_wellness_logs(notification_type, sent_at);

-- Enable RLS
ALTER TABLE public.donor_wellness_logs ENABLE ROW LEVEL SECURITY;

-- Policies for donor_wellness_logs
CREATE POLICY "Admins can manage wellness logs"
ON public.donor_wellness_logs FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own logs"
ON public.donor_wellness_logs FOR SELECT
USING (auth.uid() = donor_id);

-- Add last_wellness_check column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_wellness_check TIMESTAMPTZ;

-- Insert default message templates
INSERT INTO public.notification_messages (message_key, message_title, message_template, description) VALUES
(
  'availability_restored',
  'Ready to Donate Again',
  'Hi {full_name}! Great news - your 90-day waiting period is complete. You are now eligible to donate blood again! Your blood type ({blood_group}) can save lives. Thank you for being a hero! - LeyHadhiyaMv',
  'Sent when a donor becomes eligible after 90-day cooldown'
),
(
  'wellness_check_first',
  'First Wellness Check',
  'Hi {full_name}, we noticed you''ve been unavailable for a while. We hope everything is okay! When you''re feeling better, we''d love to have you back. Take care! - LeyHadhiyaMv',
  'First wellness check after 30 days of being unavailable'
),
(
  'wellness_check_followup',
  'Follow-up Wellness Check',
  'Hi {full_name}, just checking in! We miss you in our donor community. If there''s anything we can help with, please reach out. Hope to see you soon! - LeyHadhiyaMv',
  'Monthly follow-up for donors still unavailable'
);

-- Create trigger for updated_at on notification_messages
CREATE TRIGGER update_notification_messages_updated_at
BEFORE UPDATE ON public.notification_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();