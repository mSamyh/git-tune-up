-- Create atolls table
CREATE TABLE public.atolls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create islands table
CREATE TABLE public.islands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  atoll_id UUID NOT NULL REFERENCES public.atolls(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(atoll_id, name)
);

-- Create SMS templates table
CREATE TABLE public.sms_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT NOT NULL UNIQUE,
  template_body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add atoll and island to profiles table
ALTER TABLE public.profiles ADD COLUMN atoll TEXT;
ALTER TABLE public.profiles ADD COLUMN island TEXT;

-- Enable RLS on new tables
ALTER TABLE public.atolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.islands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for atolls (viewable by everyone, manageable by admins)
CREATE POLICY "Atolls are viewable by everyone"
ON public.atolls
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage atolls"
ON public.atolls
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for islands (viewable by everyone, manageable by admins)
CREATE POLICY "Islands are viewable by everyone"
ON public.islands
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage islands"
ON public.islands
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for SMS templates (viewable by admins only)
CREATE POLICY "Admins can view SMS templates"
ON public.sms_templates
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage SMS templates"
ON public.sms_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert initial atolls
INSERT INTO public.atolls (name) VALUES 
  ('Ha'),
  ('Hdh'),
  ('Sh');

-- Insert initial islands
INSERT INTO public.islands (atoll_id, name)
SELECT a.id, i.name
FROM public.atolls a
CROSS JOIN (
  SELECT 'Ihavandhoo' AS name UNION ALL
  SELECT 'Dhidhoo'
) i
WHERE a.name = 'Ha';

INSERT INTO public.islands (atoll_id, name)
SELECT a.id, i.name
FROM public.atolls a
CROSS JOIN (
  SELECT 'Kulhudhuffushi' AS name UNION ALL
  SELECT 'Nolhivaram' UNION ALL
  SELECT 'Nolhivaranfaru'
) i
WHERE a.name = 'Hdh';

-- Insert default SMS template
INSERT INTO public.sms_templates (template_name, template_body)
VALUES (
  'blood_request_notification',
  'URGENT: Blood needed! {blood_group} blood required at {hospital_name}. Patient: {patient_name}. Contact: {contact_name} ({contact_phone})'
);

-- Add trigger for SMS templates updated_at
CREATE TRIGGER update_sms_templates_updated_at
BEFORE UPDATE ON public.sms_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();