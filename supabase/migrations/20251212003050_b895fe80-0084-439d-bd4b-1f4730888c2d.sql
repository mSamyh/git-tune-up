-- Add notification_preferences column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"blood_requests": true, "responses": true, "fulfilled": true}'::jsonb;

-- Update existing profiles to have default notification preferences
UPDATE public.profiles
SET notification_preferences = '{"blood_requests": true, "responses": true, "fulfilled": true}'::jsonb
WHERE notification_preferences IS NULL;