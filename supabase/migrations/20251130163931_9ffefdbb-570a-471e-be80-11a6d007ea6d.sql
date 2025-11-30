-- Create a separate table for imported donor records that don't require auth
CREATE TABLE IF NOT EXISTS public.donor_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  blood_group TEXT NOT NULL,
  district TEXT NOT NULL,
  address TEXT,
  avatar_url TEXT,
  availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available', 'unavailable', 'reserved', 'available_soon')),
  available_date DATE,
  last_donation_date DATE,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.donor_directory ENABLE ROW LEVEL SECURITY;

-- Anyone can view donor directory
CREATE POLICY "Donor directory viewable by everyone"
ON public.donor_directory
FOR SELECT
USING (true);

-- Create index for sorting
CREATE INDEX idx_donor_directory_availability ON public.donor_directory(availability_status, available_date);

-- Add trigger for updated_at
CREATE TRIGGER update_donor_directory_updated_at
BEFORE UPDATE ON public.donor_directory
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for availability check
CREATE TRIGGER trigger_check_donor_availability
BEFORE INSERT OR UPDATE ON public.donor_directory
FOR EACH ROW
EXECUTE FUNCTION check_availability_date();