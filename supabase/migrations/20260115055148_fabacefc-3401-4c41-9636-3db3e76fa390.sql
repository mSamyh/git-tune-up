-- Add performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_blood_group ON profiles(blood_group);
CREATE INDEX IF NOT EXISTS idx_profiles_availability_status ON profiles(availability_status);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_donation_history_donor_date ON donation_history(donor_id, donation_date DESC);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status_created ON blood_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blood_requests_blood_group ON blood_requests(blood_group);
CREATE INDEX IF NOT EXISTS idx_points_transactions_donor ON points_transactions(donor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donor_points_donor ON donor_points(donor_id);

-- Create bulk donation count function to fix N+1 query
CREATE OR REPLACE FUNCTION get_bulk_donation_counts(donor_ids UUID[])
RETURNS TABLE(donor_id UUID, donation_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    dh.donor_id,
    COUNT(*)::BIGINT as donation_count
  FROM donation_history dh
  WHERE dh.donor_id = ANY(donor_ids)
  GROUP BY dh.donor_id
$$;

-- Create bulk directory donation count function
CREATE OR REPLACE FUNCTION get_bulk_directory_donation_counts(donor_ids UUID[])
RETURNS TABLE(donor_id UUID, donation_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ddh.donor_id,
    COUNT(*)::BIGINT as donation_count
  FROM donor_directory_history ddh
  WHERE ddh.donor_id = ANY(donor_ids)
  GROUP BY ddh.donor_id
$$;