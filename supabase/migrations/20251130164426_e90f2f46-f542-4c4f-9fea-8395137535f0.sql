-- Add user_type to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'donor' CHECK (user_type IN ('donor', 'receiver', 'both'));

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add is_registered flag to donor_directory
ALTER TABLE public.donor_directory
ADD COLUMN IF NOT EXISTS is_registered BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS linked_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create function to merge donor_directory with profiles on registration
CREATE OR REPLACE FUNCTION merge_donor_on_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  directory_record RECORD;
BEGIN
  -- Check if phone number exists in donor_directory
  SELECT * INTO directory_record
  FROM donor_directory
  WHERE phone = NEW.phone
  AND is_registered = false
  LIMIT 1;

  IF FOUND THEN
    -- Merge data from directory to profile
    NEW.blood_group := COALESCE(NEW.blood_group, directory_record.blood_group);
    NEW.full_name := COALESCE(NEW.full_name, directory_record.full_name);
    NEW.avatar_url := COALESCE(NEW.avatar_url, directory_record.avatar_url);
    NEW.last_donation_date := COALESCE(NEW.last_donation_date, directory_record.last_donation_date);
    
    -- Mark directory record as registered and link it
    UPDATE donor_directory
    SET is_registered = true,
        linked_profile_id = NEW.id
    WHERE id = directory_record.id;

    -- Copy donation history from directory to profile history
    INSERT INTO donation_history (donor_id, donation_date, hospital_name, notes, units_donated)
    SELECT NEW.id, donation_date, hospital_name, notes, units_donated
    FROM donor_directory_history
    WHERE donor_id = directory_record.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for merging
DROP TRIGGER IF EXISTS trigger_merge_donor_on_registration ON public.profiles;
CREATE TRIGGER trigger_merge_donor_on_registration
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION merge_donor_on_registration();