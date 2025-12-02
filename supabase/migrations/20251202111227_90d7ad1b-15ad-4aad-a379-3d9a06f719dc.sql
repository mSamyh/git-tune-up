-- Fix 1: Update trigger to only auto-calculate when not explicitly preserving manual changes
-- The issue is that when updating last_donation_date without touching availability_status,
-- the trigger still overrides manual statuses like 'reserved' or 'unavailable'

CREATE OR REPLACE FUNCTION public.check_availability_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days_since_donation INTEGER;
  status_explicitly_set BOOLEAN;
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
      
      -- If status is 'reserved' or manually set to 'unavailable', preserve it
      -- Only auto-update if current status is 'available', 'unavailable' or 'available_soon'
      -- and the last_donation_date is being changed
      IF OLD.last_donation_date IS DISTINCT FROM NEW.last_donation_date THEN
        -- last_donation_date is being updated
        -- Only auto-calculate for 'available', 'unavailable', or 'available_soon' statuses
        IF OLD.availability_status IN ('available', 'unavailable', 'available_soon') THEN
          -- Auto-set availability_status based on 90-day rule
          IF days_since_donation < 90 THEN
            NEW.availability_status := 'unavailable';
          ELSE
            NEW.availability_status := 'available';
          END IF;
        END IF;
        -- For 'reserved' or other statuses, preserve them
      END IF;
    ELSIF TG_OP = 'INSERT' THEN
      -- For new records, auto-set based on 90-day rule
      IF days_since_donation < 90 THEN
        NEW.availability_status := 'unavailable';
      ELSE
        NEW.availability_status := 'available';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix 2: Add RLS policy to allow users to update their own donor_points
-- This is needed for reward redemption to work
CREATE POLICY "Users can update their own points"
ON donor_points
FOR UPDATE
USING (auth.uid() = donor_id)
WITH CHECK (auth.uid() = donor_id);