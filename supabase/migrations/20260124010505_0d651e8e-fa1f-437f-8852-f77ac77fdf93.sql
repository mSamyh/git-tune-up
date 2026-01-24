-- Add columns for enhanced availability status metadata
ALTER TABLE profiles 
ADD COLUMN reserved_until DATE,
ADD COLUMN status_note TEXT;

-- Add constraint to limit note length (Instagram Notes style - 60 chars)
ALTER TABLE profiles 
ADD CONSTRAINT status_note_length CHECK (char_length(status_note) <= 60);

-- Auto-clear metadata fields when status changes
CREATE OR REPLACE FUNCTION clear_status_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Clear reserved_until when not reserved
  IF NEW.availability_status != 'reserved' THEN
    NEW.reserved_until := NULL;
  END IF;
  
  -- Clear status_note when not unavailable
  IF NEW.availability_status != 'unavailable' THEN
    NEW.status_note := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clear_status_metadata_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION clear_status_metadata();