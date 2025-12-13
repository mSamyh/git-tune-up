-- Add needed_before column for countdown timer
ALTER TABLE public.blood_requests 
ADD COLUMN needed_before TIMESTAMP WITH TIME ZONE;

-- Add index for efficient expiry queries
CREATE INDEX idx_blood_requests_needed_before ON public.blood_requests(needed_before) WHERE status = 'active';