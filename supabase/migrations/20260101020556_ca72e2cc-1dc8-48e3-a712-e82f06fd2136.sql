-- Add storage policy for partner logos
-- Allow authenticated admins to upload partner logos to the avatars bucket

-- First, ensure we have policies for the partner-logos folder
CREATE POLICY "Admins can upload partner logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'partner-logos'
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can update partner logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'partner-logos'
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete partner logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'partner-logos'
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Partner logos should be publicly viewable
CREATE POLICY "Partner logos are publicly accessible"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'partner-logos'
);