-- Create SMS logs table to track all SMS notifications
CREATE TABLE public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blood_request_id UUID REFERENCES blood_requests(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, delivered, failed
  blood_group TEXT,
  hospital_name TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all SMS logs
CREATE POLICY "Admins can view all SMS logs"
ON public.sms_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage SMS logs
CREATE POLICY "Admins can manage SMS logs"
ON public.sms_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for better query performance
CREATE INDEX idx_sms_logs_blood_request ON sms_logs(blood_request_id);
CREATE INDEX idx_sms_logs_status ON sms_logs(status);
CREATE INDEX idx_sms_logs_sent_at ON sms_logs(sent_at DESC);