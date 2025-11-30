-- Fix function search paths by recreating trigger
DROP TRIGGER IF EXISTS trigger_check_availability ON public.profiles CASCADE;

CREATE OR REPLACE FUNCTION check_availability_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.last_donation_date IS NOT NULL THEN
    NEW.available_date := NEW.last_donation_date + INTERVAL '90 days';
    
    IF NEW.availability_status = 'available_soon' AND NEW.available_date <= CURRENT_DATE THEN
      NEW.availability_status := 'available';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER trigger_check_availability
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION check_availability_date();

-- Fix get_donation_count function
CREATE OR REPLACE FUNCTION get_donation_count(donor_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM donation_history WHERE donor_id = donor_uuid;
$$;