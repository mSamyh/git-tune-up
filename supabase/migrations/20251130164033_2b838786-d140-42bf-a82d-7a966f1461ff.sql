-- Create donation history for donor_directory
CREATE TABLE IF NOT EXISTS public.donor_directory_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES public.donor_directory(id) ON DELETE CASCADE,
  donation_date DATE NOT NULL,
  hospital_name TEXT NOT NULL,
  notes TEXT,
  units_donated INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.donor_directory_history ENABLE ROW LEVEL SECURITY;

-- Anyone can view donation history
CREATE POLICY "Donor directory history viewable by everyone"
ON public.donor_directory_history
FOR SELECT
USING (true);

-- Create function to get donation count for directory donors
CREATE OR REPLACE FUNCTION get_directory_donation_count(donor_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM donor_directory_history WHERE donor_id = donor_uuid;
$$;