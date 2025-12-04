-- Add bio field to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;