-- Drop hospital_address column from blood_requests table
ALTER TABLE blood_requests DROP COLUMN IF EXISTS hospital_address;