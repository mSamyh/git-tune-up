-- Fix blood_requests UPDATE policy with WITH CHECK clause
DROP POLICY IF EXISTS "Users can update their own requests" ON blood_requests;

CREATE POLICY "Users can update their own requests" ON blood_requests
  FOR UPDATE
  USING ((auth.uid() = requested_by) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = requested_by) OR has_role(auth.uid(), 'admin'::app_role));