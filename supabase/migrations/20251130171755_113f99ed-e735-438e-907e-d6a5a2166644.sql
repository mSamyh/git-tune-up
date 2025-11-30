-- Add emergency_type to blood_requests
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS emergency_type text;

-- Create request_responses table
CREATE TABLE IF NOT EXISTS request_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES blood_requests(id) ON DELETE CASCADE NOT NULL,
  donor_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on request_responses
ALTER TABLE request_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies for request_responses
CREATE POLICY "Donors can create responses to requests"
ON request_responses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = donor_id);

CREATE POLICY "Donors can view their own responses"
ON request_responses FOR SELECT
TO authenticated
USING (auth.uid() = donor_id);

CREATE POLICY "Requestors can view responses to their requests"
ON request_responses FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM blood_requests 
    WHERE blood_requests.id = request_responses.request_id 
    AND blood_requests.requested_by = auth.uid()
  )
);

CREATE POLICY "Requestors can update responses to their requests"
ON request_responses FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM blood_requests 
    WHERE blood_requests.id = request_responses.request_id 
    AND blood_requests.requested_by = auth.uid()
  )
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  related_request_id uuid REFERENCES blood_requests(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Update donation_history RLS policies (only admins can insert/update/delete)
DROP POLICY IF EXISTS "Users can add their own donation history" ON donation_history;

CREATE POLICY "Only admins can insert donation history"
ON donation_history FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update donation history"
ON donation_history FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete donation history"
ON donation_history FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Trigger for request_responses updated_at
CREATE TRIGGER update_request_responses_updated_at
BEFORE UPDATE ON request_responses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-add donation history when last_donation_date is updated
CREATE OR REPLACE FUNCTION auto_add_donation_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if last_donation_date changed and is not null
  IF NEW.last_donation_date IS NOT NULL AND 
     (OLD.last_donation_date IS NULL OR OLD.last_donation_date != NEW.last_donation_date) THEN
    
    -- Check if this date already exists in history
    IF NOT EXISTS (
      SELECT 1 FROM donation_history 
      WHERE donor_id = NEW.id 
      AND donation_date = NEW.last_donation_date
    ) THEN
      -- Add to donation history
      INSERT INTO donation_history (donor_id, donation_date, hospital_name)
      VALUES (NEW.id, NEW.last_donation_date, 'Updated from profile');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-adding donation history
DROP TRIGGER IF EXISTS auto_add_donation_history_trigger ON profiles;
CREATE TRIGGER auto_add_donation_history_trigger
AFTER UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION auto_add_donation_history();