-- Allow admins to update any profile (while users can still update their own)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users and admins can update profiles"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id OR has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = id OR has_role(auth.uid(), 'admin'));

-- Drop existing donor_directory SELECT policy since we'll add a broader admin policy
DROP POLICY IF EXISTS "Donor directory viewable by everyone" ON public.donor_directory;

-- Allow everyone to view donor_directory
CREATE POLICY "Donor directory viewable by everyone"
ON public.donor_directory
FOR SELECT
USING (true);

-- Allow admins to fully manage donor_directory (needed for CSV import and admin delete)
CREATE POLICY "Admins can manage donor directory"
ON public.donor_directory
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
