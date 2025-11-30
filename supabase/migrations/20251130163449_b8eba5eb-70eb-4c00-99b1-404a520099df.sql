-- Add new columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available', 'unavailable', 'reserved', 'available_soon')),
ADD COLUMN IF NOT EXISTS available_date DATE;

-- Create index for sorting by availability
CREATE INDEX IF NOT EXISTS idx_profiles_availability ON public.profiles(availability_status, available_date);

-- Update donation_history to be more detailed
ALTER TABLE public.donation_history
ADD COLUMN IF NOT EXISTS units_donated INTEGER DEFAULT 1;

-- Create a function to calculate donation count
CREATE OR REPLACE FUNCTION get_donation_count(donor_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM donation_history WHERE donor_id = donor_uuid;
$$;

-- Create a function to auto-update availability based on 90-day rule
CREATE OR REPLACE FUNCTION check_availability_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If last_donation_date is set and availability is 'available_soon'
  IF NEW.last_donation_date IS NOT NULL THEN
    -- Calculate available date (90 days from last donation)
    NEW.available_date := NEW.last_donation_date + INTERVAL '90 days';
    
    -- If 90 days have passed and status is available_soon, auto-change to available
    IF NEW.availability_status = 'available_soon' AND NEW.available_date <= CURRENT_DATE THEN
      NEW.availability_status := 'available';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for availability check
DROP TRIGGER IF EXISTS trigger_check_availability ON public.profiles;
CREATE TRIGGER trigger_check_availability
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION check_availability_date();

-- Enable realtime for profiles table
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;