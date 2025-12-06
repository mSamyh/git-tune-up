-- Add INSERT policies for donor_points and points_transactions so users can award themselves points
-- when they self-report donations

-- Allow users to INSERT their own donor_points record
CREATE POLICY "Users can insert their own points"
ON public.donor_points
FOR INSERT
WITH CHECK (auth.uid() = donor_id);

-- Allow users to INSERT their own points_transactions
CREATE POLICY "Users can insert their own transactions"
ON public.points_transactions
FOR INSERT
WITH CHECK (auth.uid() = donor_id);