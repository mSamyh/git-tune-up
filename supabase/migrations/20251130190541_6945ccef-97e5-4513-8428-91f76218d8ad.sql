-- Fix the auto_add_donation_history function to prevent duplicates
CREATE OR REPLACE FUNCTION public.auto_add_donation_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only proceed if last_donation_date changed and is not null
  IF NEW.last_donation_date IS NOT NULL AND 
     (OLD.last_donation_date IS NULL OR OLD.last_donation_date != NEW.last_donation_date) THEN
    
    -- Check if this exact date already exists in history for this donor
    IF NOT EXISTS (
      SELECT 1 FROM donation_history 
      WHERE donor_id = NEW.id 
      AND donation_date = NEW.last_donation_date
    ) THEN
      -- Add to donation history only if it doesn't exist
      INSERT INTO donation_history (donor_id, donation_date, hospital_name, units_donated)
      VALUES (NEW.id, NEW.last_donation_date, 'Updated from profile', 1);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Ensure there's only one trigger for this function
DROP TRIGGER IF EXISTS auto_add_donation_trigger ON profiles;

CREATE TRIGGER auto_add_donation_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION auto_add_donation_history();