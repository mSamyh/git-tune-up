-- =====================================================
-- PHASE 1: CRITICAL SECURITY FIXES
-- =====================================================

-- 1.1 Secure password_reset_tokens table (has no RLS policies)
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to password reset tokens" 
ON password_reset_tokens FOR SELECT 
USING (false);

CREATE POLICY "No insert to password reset tokens" 
ON password_reset_tokens FOR INSERT 
WITH CHECK (false);

CREATE POLICY "No update to password reset tokens" 
ON password_reset_tokens FOR UPDATE 
USING (false);

CREATE POLICY "No delete from password reset tokens" 
ON password_reset_tokens FOR DELETE 
USING (false);

-- 1.2 Fix redemption_history vulnerability - remove overly permissive UPDATE policy
DROP POLICY IF EXISTS "Anyone can verify QR codes" ON redemption_history;

-- 1.3 Restrict profiles to authenticated users only (contains phone numbers)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles viewable by authenticated users" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);

-- 1.4 Restrict donor_directory to authenticated users (contains phone numbers)
DROP POLICY IF EXISTS "Donor directory viewable by everyone" ON donor_directory;
CREATE POLICY "Donor directory viewable by authenticated users" 
ON donor_directory FOR SELECT 
TO authenticated 
USING (true);

-- 1.5 Restrict donor_directory_history to authenticated users
DROP POLICY IF EXISTS "Donor directory history viewable by everyone" ON donor_directory_history;
CREATE POLICY "Donor directory history viewable by authenticated users" 
ON donor_directory_history FOR SELECT 
TO authenticated 
USING (true);

-- 1.6 Restrict blood_requests to authenticated users (contains contact info)
DROP POLICY IF EXISTS "Blood requests are viewable by everyone" ON blood_requests;
CREATE POLICY "Blood requests viewable by authenticated users" 
ON blood_requests FOR SELECT 
TO authenticated 
USING (true);

-- 1.7 Fix notification INSERT policy (prevent spam) - use WITH CHECK for INSERT
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "Service role only can insert notifications" 
ON notifications FOR INSERT 
WITH CHECK (false);

-- =====================================================
-- PHASE 2: DATA INTEGRITY FIXES
-- =====================================================

-- 2.1 Fix points mismatch for user 78f96d21-4d3a-4c26-a1dd-ede8fdab9119
UPDATE donor_points 
SET total_points = (
  SELECT COALESCE(SUM(points), 0) 
  FROM points_transactions 
  WHERE donor_id = '78f96d21-4d3a-4c26-a1dd-ede8fdab9119'
)
WHERE donor_id = '78f96d21-4d3a-4c26-a1dd-ede8fdab9119';

-- =====================================================
-- PHASE 3: PERFORMANCE INDEXES
-- =====================================================

-- 3.1 Indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_blood_group ON profiles(blood_group);
CREATE INDEX IF NOT EXISTS idx_profiles_availability ON profiles(availability_status);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON blood_requests(status);
CREATE INDEX IF NOT EXISTS idx_blood_requests_needed_before ON blood_requests(needed_before);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status_needed ON blood_requests(status, needed_before);
CREATE INDEX IF NOT EXISTS idx_redemption_voucher_code ON redemption_history(voucher_code);
CREATE INDEX IF NOT EXISTS idx_redemption_status ON redemption_history(status);
CREATE INDEX IF NOT EXISTS idx_redemption_donor_status ON redemption_history(donor_id, status);
CREATE INDEX IF NOT EXISTS idx_donation_history_donor_date ON donation_history(donor_id, donation_date DESC);
CREATE INDEX IF NOT EXISTS idx_points_transactions_donor ON points_transactions(donor_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_type ON points_transactions(transaction_type);

-- =====================================================
-- HASH MERCHANT PINS (Phase 1.5)
-- =====================================================

-- Add a new column for hashed pins
ALTER TABLE merchant_accounts ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Create extension for hashing if not exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Hash existing pins using crypt with blowfish
UPDATE merchant_accounts 
SET pin_hash = crypt(pin, gen_salt('bf', 8))
WHERE pin_hash IS NULL AND pin IS NOT NULL;