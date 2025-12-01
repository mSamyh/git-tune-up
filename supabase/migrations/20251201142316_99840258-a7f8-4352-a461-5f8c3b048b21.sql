-- Function to deduct points when donation is deleted
CREATE OR REPLACE FUNCTION public.deduct_points_for_deleted_donation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  points_to_deduct INTEGER;
BEGIN
  -- Get points per donation from settings
  SELECT setting_value::INTEGER INTO points_to_deduct
  FROM reward_settings
  WHERE setting_key = 'points_per_donation';
  
  -- Deduct points from donor_points record
  UPDATE donor_points
  SET 
    total_points = GREATEST(0, total_points - points_to_deduct),
    lifetime_points = GREATEST(0, lifetime_points - points_to_deduct),
    updated_at = now()
  WHERE donor_id = OLD.donor_id;
  
  -- Record the transaction
  INSERT INTO points_transactions (donor_id, points, transaction_type, description, related_donation_id)
  VALUES (OLD.donor_id, -points_to_deduct, 'deducted', 'Points deducted for deleted donation at ' || OLD.hospital_name, OLD.id);
  
  RETURN OLD;
END;
$function$;

-- Create trigger for donation deletion
DROP TRIGGER IF EXISTS deduct_points_on_donation_delete ON donation_history;
CREATE TRIGGER deduct_points_on_donation_delete
AFTER DELETE ON donation_history
FOR EACH ROW
EXECUTE FUNCTION public.deduct_points_for_deleted_donation();