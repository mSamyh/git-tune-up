-- Create achievements table for admin-manageable milestones
CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'Award',
  color TEXT NOT NULL DEFAULT '#f59e0b',
  requirement_type TEXT NOT NULL CHECK (requirement_type IN ('donations', 'points')),
  requirement_value INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Everyone can view active achievements
CREATE POLICY "Everyone can view active achievements"
ON public.achievements
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

-- Only admins can manage achievements
CREATE POLICY "Admins can manage achievements"
ON public.achievements
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_achievements_updated_at
  BEFORE UPDATE ON public.achievements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default achievements
INSERT INTO public.achievements (title, description, icon_name, color, requirement_type, requirement_value, sort_order) VALUES
('First Drop', 'Complete your first donation', 'Heart', '#ef4444', 'donations', 1, 1),
('Regular Donor', 'Donate 5 times', 'Star', '#3b82f6', 'donations', 5, 2),
('Blood Hero', 'Donate 10 times', 'Award', '#a855f7', 'donations', 10, 3),
('Life Champion', 'Donate 25 times', 'Trophy', '#f59e0b', 'donations', 25, 4),
('Blood Legend', 'Donate 50 times', 'Crown', '#eab308', 'donations', 50, 5),
('Points Starter', 'Earn 100 points', 'Zap', '#22c55e', 'points', 100, 6),
('Points Collector', 'Earn 500 points', 'Target', '#14b8a6', 'points', 500, 7),
('Points Master', 'Earn 1000 points', 'Medal', '#6366f1', 'points', 1000, 8),
('Elite Status', 'Earn 2500 points', 'Sparkles', '#ec4899', 'points', 2500, 9);