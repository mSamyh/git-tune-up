
-- Fix foreign key: Point donor_id to profiles instead of auth.users
-- This allows Supabase REST API to properly join redemptions with profiles

-- Drop the incorrect foreign key
ALTER TABLE redemption_history
DROP CONSTRAINT redemption_history_donor_id_fkey;

-- Add correct foreign key pointing to profiles table
ALTER TABLE redemption_history
ADD CONSTRAINT redemption_history_donor_id_fkey 
FOREIGN KEY (donor_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_redemption_history_donor_id 
ON redemption_history(donor_id);

-- Add comment for documentation
COMMENT ON CONSTRAINT redemption_history_donor_id_fkey ON redemption_history 
IS 'Links redemptions to donor profiles (not auth.users) for REST API joins';
