-- Phase 1.1: Fix check_availability_date() function to NOT reset status on unrelated profile updates
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
    -- No last_donation_date
    NEW.available_date := NULL;
    -- CRITICAL FIX: Only set available on INSERT, NOT on every UPDATE
    -- This prevents location/bio updates from resetting manually-set statuses
    IF TG_OP = 'INSERT' THEN
      NEW.availability_status := 'available';
    END IF;
    -- For UPDATE: preserve existing status (do nothing to availability_status)
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Phase 1.2: Remove duplicate triggers
DROP TRIGGER IF EXISTS trigger_check_availability ON profiles;
DROP TRIGGER IF EXISTS auto_add_donation_trigger ON profiles;

-- Phase 2.1: Fix availability status for users who should be available (90+ days since donation)
UPDATE profiles 
SET availability_status = 'available'
WHERE availability_status = 'unavailable'
  AND last_donation_date IS NOT NULL
  AND CURRENT_DATE - last_donation_date >= 90;

-- Phase 2.2: Fix points balances to match transaction sums
-- Inayath - reset to 0 (negative from test data)
UPDATE donor_points SET total_points = 0, lifetime_points = GREATEST(lifetime_points, 0) 
WHERE donor_id = '78f96d21-4d3a-4c26-a1dd-ede8fdab9119';

-- Mohamed Samyh - set to correct sum
UPDATE donor_points SET total_points = 0 
WHERE donor_id = 'cc6af075-7eb6-48bf-93bc-dad7ba834ce6';

-- Mohamed Ahmed - set to correct sum  
UPDATE donor_points SET total_points = 0 
WHERE donor_id = '866e5eac-0349-4766-ba0e-c557c172debf';

-- Ali Abdul Gafoor - set to correct sum
UPDATE donor_points SET total_points = 1000 
WHERE donor_id = 'e5f693d2-340a-47f1-9d29-0596dd101590';

-- Hussain Dawood - set to correct sum
UPDATE donor_points SET total_points = 100 
WHERE donor_id = '2033a5af-e288-4e8a-be86-4b4d4aaa51f5';

-- Hussain Ilhaam - set to correct sum
UPDATE donor_points SET total_points = 300 
WHERE donor_id = 'f68c15ed-453b-4e3e-8a22-cbc9a9b85a8a';

-- Abdulla Adam - set to correct sum
UPDATE donor_points SET total_points = 885 
WHERE donor_id = 'ffcd7eee-b3ef-4e81-81fd-a1fa1abbcff8';

-- Add audit transaction for Inayath's balance correction
INSERT INTO points_transactions (donor_id, points, transaction_type, description)
VALUES ('78f96d21-4d3a-4c26-a1dd-ede8fdab9119', 900, 'adjusted', 'Admin: Reset balance to 0 - corrected test data discrepancy');