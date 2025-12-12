-- Update notify_matching_donors_on_request to check notification preferences
CREATE OR REPLACE FUNCTION public.notify_matching_donors_on_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  donor_record RECORD;
  prefs jsonb;
BEGIN
  -- Notify all available donors with matching blood type who have blood_requests notifications enabled
  FOR donor_record IN 
    SELECT id, notification_preferences FROM profiles 
    WHERE blood_group = NEW.blood_group 
    AND user_type IN ('donor', 'both')
    AND availability_status = 'available'
    AND id != COALESCE(NEW.requested_by, '00000000-0000-0000-0000-000000000000')
  LOOP
    prefs := COALESCE(donor_record.notification_preferences, '{"blood_requests": true}'::jsonb);
    IF (prefs->>'blood_requests')::boolean IS NOT FALSE THEN
      INSERT INTO notifications (user_id, title, message, type, related_request_id)
      VALUES (
        donor_record.id,
        'Urgent: ' || NEW.blood_group || ' Blood Needed',
        NEW.urgency || ' request at ' || NEW.hospital_name || ' for ' || NEW.patient_name || '. ' || NEW.units_needed || ' unit(s) needed.',
        'blood_request',
        NEW.id
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- Update notify_on_donor_response to check notification preferences
CREATE OR REPLACE FUNCTION public.notify_on_donor_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  request_record blood_requests%ROWTYPE;
  donor_record profiles%ROWTYPE;
  prefs jsonb;
BEGIN
  -- Get the blood request details
  SELECT * INTO request_record FROM blood_requests WHERE id = NEW.request_id;
  
  -- Get the donor details
  SELECT * INTO donor_record FROM profiles WHERE id = NEW.donor_id;
  
  -- Notify the blood request poster if they have responses notifications enabled
  IF request_record.requested_by IS NOT NULL THEN
    SELECT notification_preferences INTO prefs FROM profiles WHERE id = request_record.requested_by;
    prefs := COALESCE(prefs, '{"responses": true}'::jsonb);
    IF (prefs->>'responses')::boolean IS NOT FALSE THEN
      INSERT INTO notifications (user_id, title, message, type, related_request_id)
      VALUES (
        request_record.requested_by,
        'Donor Response',
        donor_record.full_name || ' (' || donor_record.blood_group || ') has responded to your blood request',
        'response',
        NEW.request_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update notify_on_request_fulfilled to check notification preferences
CREATE OR REPLACE FUNCTION public.notify_on_request_fulfilled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  response_record RECORD;
  poster_name TEXT;
  prefs jsonb;
BEGIN
  -- Only trigger when status changes to 'fulfilled'
  IF NEW.status = 'fulfilled' AND (OLD.status IS NULL OR OLD.status != 'fulfilled') THEN
    -- Get poster name
    SELECT full_name INTO poster_name FROM profiles WHERE id = NEW.requested_by;
    
    -- Notify all donors who responded to this request (if they have fulfilled notifications enabled)
    FOR response_record IN 
      SELECT DISTINCT rr.donor_id, p.notification_preferences 
      FROM request_responses rr
      JOIN profiles p ON p.id = rr.donor_id
      WHERE rr.request_id = NEW.id
    LOOP
      prefs := COALESCE(response_record.notification_preferences, '{"fulfilled": true}'::jsonb);
      IF (prefs->>'fulfilled')::boolean IS NOT FALSE THEN
        INSERT INTO notifications (user_id, title, message, type, related_request_id)
        VALUES (
          response_record.donor_id,
          'Request Fulfilled',
          'The blood request for ' || NEW.blood_group || ' at ' || NEW.hospital_name || ' has been fulfilled. Thank you for your response!',
          'fulfilled',
          NEW.id
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;