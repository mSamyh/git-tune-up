-- Add unavailable_until column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unavailable_until DATE;

-- Update clear_status_metadata trigger to also clear unavailable_until
CREATE OR REPLACE FUNCTION public.clear_status_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Clear reserved_until when not reserved
  IF NEW.availability_status != 'reserved' THEN
    NEW.reserved_until := NULL;
  END IF;
  
  -- Clear status_note and unavailable_until when not unavailable
  IF NEW.availability_status != 'unavailable' THEN
    NEW.status_note := NULL;
    NEW.unavailable_until := NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;