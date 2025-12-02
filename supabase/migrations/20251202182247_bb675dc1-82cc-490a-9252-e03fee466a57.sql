-- Add title_color column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN title_color text DEFAULT NULL;