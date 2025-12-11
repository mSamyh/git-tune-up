-- Add INSERT policy for notifications so application can create notifications
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Function to create notification when donor responds to a blood request
CREATE OR REPLACE FUNCTION public.notify_on_donor_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record blood_requests%ROWTYPE;
  donor_record profiles%ROWTYPE;
BEGIN
  -- Get the blood request details
  SELECT * INTO request_record FROM blood_requests WHERE id = NEW.request_id;
  
  -- Get the donor details
  SELECT * INTO donor_record FROM profiles WHERE id = NEW.donor_id;
  
  -- Notify the blood request poster
  IF request_record.requested_by IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, related_request_id)
    VALUES (
      request_record.requested_by,
      'Donor Response',
      donor_record.full_name || ' (' || donor_record.blood_group || ') has responded to your blood request',
      'response',
      NEW.request_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for donor responses
DROP TRIGGER IF EXISTS notify_donor_response_trigger ON request_responses;
CREATE TRIGGER notify_donor_response_trigger
AFTER INSERT ON request_responses
FOR EACH ROW
EXECUTE FUNCTION notify_on_donor_response();

-- Function to notify donors when blood request status changes to fulfilled
CREATE OR REPLACE FUNCTION public.notify_on_request_fulfilled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  response_record RECORD;
  poster_name TEXT;
BEGIN
  -- Only trigger when status changes to 'fulfilled'
  IF NEW.status = 'fulfilled' AND (OLD.status IS NULL OR OLD.status != 'fulfilled') THEN
    -- Get poster name
    SELECT full_name INTO poster_name FROM profiles WHERE id = NEW.requested_by;
    
    -- Notify all donors who responded to this request
    FOR response_record IN 
      SELECT DISTINCT donor_id FROM request_responses WHERE request_id = NEW.id
    LOOP
      INSERT INTO notifications (user_id, title, message, type, related_request_id)
      VALUES (
        response_record.donor_id,
        'Request Fulfilled',
        'The blood request for ' || NEW.blood_group || ' at ' || NEW.hospital_name || ' has been fulfilled. Thank you for your response!',
        'fulfilled',
        NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for fulfilled requests
DROP TRIGGER IF EXISTS notify_request_fulfilled_trigger ON blood_requests;
CREATE TRIGGER notify_request_fulfilled_trigger
AFTER UPDATE ON blood_requests
FOR EACH ROW
EXECUTE FUNCTION notify_on_request_fulfilled();

-- Function to notify matching donors when new blood request is created
CREATE OR REPLACE FUNCTION public.notify_matching_donors_on_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  donor_record RECORD;
BEGIN
  -- Notify all available donors with matching blood type
  FOR donor_record IN 
    SELECT id FROM profiles 
    WHERE blood_group = NEW.blood_group 
    AND user_type IN ('donor', 'both')
    AND availability_status = 'available'
    AND id != COALESCE(NEW.requested_by, '00000000-0000-0000-0000-000000000000')
  LOOP
    INSERT INTO notifications (user_id, title, message, type, related_request_id)
    VALUES (
      donor_record.id,
      'Urgent: ' || NEW.blood_group || ' Blood Needed',
      NEW.urgency || ' request at ' || NEW.hospital_name || ' for ' || NEW.patient_name || '. ' || NEW.units_needed || ' unit(s) needed.',
      'blood_request',
      NEW.id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new blood requests
DROP TRIGGER IF EXISTS notify_matching_donors_trigger ON blood_requests;
CREATE TRIGGER notify_matching_donors_trigger
AFTER INSERT ON blood_requests
FOR EACH ROW
EXECUTE FUNCTION notify_matching_donors_on_request();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;