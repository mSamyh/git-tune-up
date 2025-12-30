-- Update the check_availability_date function to set 'available' (not 'unavailable') after 90 days
CREATE OR REPLACE FUNCTION public.check_availability_date()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  days_since_donation INTEGER;
BEGIN
  IF NEW.last_donation_date IS NOT NULL THEN
    -- Calculate days since last donation
    days_since_donation := CURRENT_DATE - NEW.last_donation_date;
    
    -- Set available_date to 90 days after last donation
    NEW.available_date := NEW.last_donation_date + INTERVAL '90 days';
    
    -- Check if availability_status is being explicitly changed in this operation
    IF TG_OP = 'UPDATE' THEN
      -- If OLD and NEW status are different, user/admin is explicitly changing it
      IF OLD.availability_status IS DISTINCT FROM NEW.availability_status THEN
        -- Manual change detected - respect it
        RETURN NEW;
      END IF;
      
      -- If status is 'reserved', preserve it (manual choice)
      IF OLD.availability_status = 'reserved' THEN
        RETURN NEW;
      END IF;
      
      -- If last_donation_date is being updated, recalculate availability
      IF OLD.last_donation_date IS DISTINCT FROM NEW.last_donation_date THEN
        IF days_since_donation < 90 THEN
          NEW.availability_status := 'unavailable';
        ELSE
          NEW.availability_status := 'available';
        END IF;
      ELSE
        -- last_donation_date not changing, but check if 90 days have passed
        -- This handles the case where we need to auto-update after waiting period
        IF OLD.availability_status = 'unavailable' AND days_since_donation >= 90 THEN
          NEW.availability_status := 'available';
        END IF;
      END IF;
    ELSIF TG_OP = 'INSERT' THEN
      -- For new records, auto-set based on 90-day rule
      IF days_since_donation < 90 THEN
        NEW.availability_status := 'unavailable';
      ELSE
        NEW.availability_status := 'available';
      END IF;
    END IF;
  ELSE
    -- No last_donation_date means they can be available
    NEW.available_date := NULL;
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.availability_status IS NOT DISTINCT FROM NEW.availability_status) THEN
      NEW.availability_status := 'available';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;