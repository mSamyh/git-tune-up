-- Drop the existing policy first
DROP POLICY IF EXISTS "Only admins can update donation history" ON public.donation_history;

-- Recreate policy allowing donors to update their own donation history
CREATE POLICY "Donors and admins can update donation history"
ON public.donation_history
FOR UPDATE
USING (auth.uid() = donor_id OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = donor_id OR has_role(auth.uid(), 'admin'::app_role));