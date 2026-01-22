-- =====================================================
-- FIX ALL CURRENT POINT BALANCES AND PREVENT FUTURE MISMATCHES
-- =====================================================

-- Step 1: Fix all donor_points to match actual transaction sums
UPDATE donor_points dp
SET 
  total_points = COALESCE((
    SELECT SUM(points) 
    FROM points_transactions pt 
    WHERE pt.donor_id = dp.donor_id
  ), 0),
  lifetime_points = COALESCE((
    SELECT SUM(points) 
    FROM points_transactions pt 
    WHERE pt.donor_id = dp.donor_id AND pt.points > 0
  ), 0),
  updated_at = now();

-- Step 2: Create trigger function to auto-sync donor_points after ANY transaction change
CREATE OR REPLACE FUNCTION sync_donor_points_from_transactions()
RETURNS TRIGGER AS $$
DECLARE
  target_donor_id uuid;
BEGIN
  -- Get the donor_id from either NEW or OLD record
  target_donor_id := COALESCE(NEW.donor_id, OLD.donor_id);
  
  -- Recalculate and update donor_points based on all transactions
  UPDATE donor_points 
  SET 
    total_points = COALESCE((
      SELECT SUM(points) 
      FROM points_transactions 
      WHERE donor_id = target_donor_id
    ), 0),
    lifetime_points = COALESCE((
      SELECT SUM(points) 
      FROM points_transactions 
      WHERE donor_id = target_donor_id 
      AND points > 0
    ), 0),
    updated_at = now()
  WHERE donor_id = target_donor_id;
  
  -- If no donor_points record exists, create one
  IF NOT FOUND THEN
    INSERT INTO donor_points (donor_id, total_points, lifetime_points, created_at, updated_at)
    VALUES (
      target_donor_id,
      COALESCE((SELECT SUM(points) FROM points_transactions WHERE donor_id = target_donor_id), 0),
      COALESCE((SELECT SUM(points) FROM points_transactions WHERE donor_id = target_donor_id AND points > 0), 0),
      now(),
      now()
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 3: Create the trigger on points_transactions table
DROP TRIGGER IF EXISTS sync_points_after_transaction ON points_transactions;
CREATE TRIGGER sync_points_after_transaction
AFTER INSERT OR UPDATE OR DELETE ON points_transactions
FOR EACH ROW
EXECUTE FUNCTION sync_donor_points_from_transactions();

-- Step 4: Create validation function for manual audits
CREATE OR REPLACE FUNCTION validate_points_integrity()
RETURNS TABLE(
  donor_id uuid,
  donor_name text,
  stored_total int,
  calculated_total bigint,
  stored_lifetime int,
  calculated_lifetime bigint,
  discrepancy bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dp.donor_id,
    p.full_name as donor_name,
    dp.total_points as stored_total,
    COALESCE(SUM(pt.points), 0)::bigint as calculated_total,
    dp.lifetime_points as stored_lifetime,
    COALESCE(SUM(CASE WHEN pt.points > 0 THEN pt.points ELSE 0 END), 0)::bigint as calculated_lifetime,
    (dp.total_points - COALESCE(SUM(pt.points), 0))::bigint as discrepancy
  FROM donor_points dp
  LEFT JOIN points_transactions pt ON pt.donor_id = dp.donor_id
  LEFT JOIN profiles p ON p.id = dp.donor_id
  GROUP BY dp.donor_id, dp.total_points, dp.lifetime_points, p.full_name
  HAVING dp.total_points != COALESCE(SUM(pt.points), 0)
     OR dp.lifetime_points != COALESCE(SUM(CASE WHEN pt.points > 0 THEN pt.points ELSE 0 END), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;