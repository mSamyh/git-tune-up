-- Add unique constraint to prevent duplicate donations for the same donor on the same date
-- This prevents race conditions when users click the button multiple times
ALTER TABLE donation_history 
ADD CONSTRAINT unique_donor_donation_date UNIQUE (donor_id, donation_date);