CREATE TABLE public.hospital_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  atoll text,
  island text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.hospital_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active hospital names"
ON public.hospital_names FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage hospital names"
ON public.hospital_names FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_hospital_names_updated_at
BEFORE UPDATE ON public.hospital_names
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed from existing hospitals (portal accounts) so the dropdown isn't empty
INSERT INTO public.hospital_names (name, atoll, island)
SELECT DISTINCT name, atoll, island FROM public.hospitals WHERE is_active = true
ON CONFLICT (name) DO NOTHING;