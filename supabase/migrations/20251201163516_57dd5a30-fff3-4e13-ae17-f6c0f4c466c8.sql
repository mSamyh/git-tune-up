-- Create a partial unique index to prevent duplicate point transactions for the same donation
-- This ensures points are only awarded once per donation
CREATE UNIQUE INDEX unique_donation_points 
ON points_transactions (related_donation_id) 
WHERE related_donation_id IS NOT NULL;