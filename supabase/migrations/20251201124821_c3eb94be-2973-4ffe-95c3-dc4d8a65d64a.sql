-- Allow users to delete their own blood requests
DROP POLICY IF EXISTS "Admins can delete blood requests" ON blood_requests;

CREATE POLICY "Admins can delete blood requests" ON blood_requests
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own blood requests" ON blood_requests
FOR DELETE USING (auth.uid() = requested_by);