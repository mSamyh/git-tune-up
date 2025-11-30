-- Fix the check_availability_date function to correctly calculate days since donation
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
    -- Calculate days since last donation (date difference returns integer)
    days_since_donation := CURRENT_DATE - NEW.last_donation_date;
    
    -- Set available_date to 90 days after last donation
    NEW.available_date := NEW.last_donation_date + INTERVAL '90 days';
    
    -- Automatically set availability_status based on 90-day rule
    IF days_since_donation < 90 THEN
      -- Less than 90 days: set to unavailable
      NEW.availability_status := 'unavailable';
    ELSIF NEW.availability_status = 'unavailable' OR NEW.availability_status = 'available_soon' THEN
      -- 90+ days and was unavailable/available_soon: set to available
      NEW.availability_status := 'available';
    END IF;
    -- If user manually set to 'reserved', keep it as reserved
  END IF;
  
  RETURN NEW;
END;
$function$;