-- Fix check_availability_date() to not auto-flip 'unavailable' -> 'available' on unrelated updates.
-- Previously, ANY profile update (incl. last_wellness_check) would flip the status if 90 days had
-- passed since the last donation. This overrode manual "unavailable" choices made for non-donation
-- reasons (travel, medical, etc). The wellness check SMS exists to let the donor update it themselves.

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
    days_since_donation := CURRENT_DATE - NEW.last_donation_date;
    NEW.available_date := NEW.last_donation_date + INTERVAL '90 days';

    IF TG_OP = 'UPDATE' THEN
      -- Manual status change in this same update — respect it
      IF OLD.availability_status IS DISTINCT FROM NEW.availability_status THEN
        RETURN NEW;
      END IF;

      -- Preserve "reserved" (manual choice)
      IF OLD.availability_status = 'reserved' THEN
        RETURN NEW;
      END IF;

      -- Only re-evaluate availability when last_donation_date itself changes.
      -- Do NOT auto-flip 'unavailable' -> 'available' on other field updates;
      -- the donor may have set themselves unavailable for travel/medical reasons.
      IF OLD.last_donation_date IS DISTINCT FROM NEW.last_donation_date THEN
        IF days_since_donation < 90 THEN
          NEW.availability_status := 'unavailable';
        ELSE
          NEW.availability_status := 'available';
        END IF;
      END IF;
    ELSIF TG_OP = 'INSERT' THEN
      IF days_since_donation < 90 THEN
        NEW.availability_status := 'unavailable';
      ELSE
        NEW.availability_status := 'available';
      END IF;
    END IF;
  ELSE
    NEW.available_date := NULL;
    IF TG_OP = 'INSERT' THEN
      NEW.availability_status := 'available';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;