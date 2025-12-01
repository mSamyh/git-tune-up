-- Drop the existing trigger
DROP TRIGGER IF EXISTS trigger_check_availability_date ON profiles;

-- Recreate the function to respect manual status changes
CREATE OR REPLACE FUNCTION public.check_availability_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days_since_donation INTEGER;
BEGIN
  IF NEW.last_donation_date IS NOT NULL THEN
    -- Calculate days since last donation
    days_since_donation := CURRENT_DATE - NEW.last_donation_date;
    
    -- Set available_date to 90 days after last donation
    NEW.available_date := NEW.last_donation_date + INTERVAL '90 days';
    
    -- Only auto-update availability_status if it wasn't manually changed
    -- Check if OLD exists (UPDATE) and if the status was manually modified
    IF TG_OP = 'UPDATE' AND OLD.availability_status IS DISTINCT FROM NEW.availability_status THEN
      -- Manual change detected - respect it
      RETURN NEW;
    END IF;
    
    -- Auto-set availability_status only for INSERT or when status wasn't manually changed
    IF days_since_donation < 90 THEN
      NEW.availability_status := 'unavailable';
    ELSIF NEW.availability_status = 'unavailable' OR NEW.availability_status = 'available_soon' THEN
      NEW.availability_status := 'available';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trigger_check_availability_date
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_availability_date();