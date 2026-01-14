-- Update the blood_requests status check constraint to include 'expired' and 'open' statuses
ALTER TABLE blood_requests DROP CONSTRAINT blood_requests_status_check;

ALTER TABLE blood_requests ADD CONSTRAINT blood_requests_status_check 
CHECK (status = ANY (ARRAY['active'::text, 'open'::text, 'fulfilled'::text, 'expired'::text, 'cancelled'::text]));

-- Now update the request that should be expired
UPDATE blood_requests SET status = 'expired' WHERE id = '35f90dc4-f8c1-4eb7-9c19-11906f5f61cb';