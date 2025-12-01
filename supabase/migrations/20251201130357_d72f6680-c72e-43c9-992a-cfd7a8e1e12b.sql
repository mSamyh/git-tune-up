-- Create donor_points table to track points balance
CREATE TABLE public.donor_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  donor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(donor_id)
);

-- Create points_transactions table for history
CREATE TABLE public.points_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  donor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'expired', 'adjusted')),
  description TEXT NOT NULL,
  related_donation_id UUID REFERENCES donation_history(id) ON DELETE SET NULL,
  related_redemption_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reward_catalog table
CREATE TABLE public.reward_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  partner_name TEXT NOT NULL,
  partner_logo_url TEXT,
  category TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  terms_conditions TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create redemption_history table
CREATE TABLE public.redemption_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  donor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES reward_catalog(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'cancelled')),
  voucher_code TEXT NOT NULL UNIQUE,
  qr_code_data TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reward_settings table for admin configuration
CREATE TABLE public.reward_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default reward settings
INSERT INTO public.reward_settings (setting_key, setting_value, description) VALUES
  ('points_per_donation', '100', 'Points awarded per blood donation'),
  ('qr_expiry_hours', '24', 'Hours until QR code expires'),
  ('rewards_enabled', 'true', 'Enable/disable rewards system');

-- Enable RLS on all tables
ALTER TABLE public.donor_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemption_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for donor_points
CREATE POLICY "Users can view their own points"
  ON public.donor_points FOR SELECT
  USING (auth.uid() = donor_id);

CREATE POLICY "Admins can manage all points"
  ON public.donor_points FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for points_transactions
CREATE POLICY "Users can view their own transactions"
  ON public.points_transactions FOR SELECT
  USING (auth.uid() = donor_id);

CREATE POLICY "Admins can manage all transactions"
  ON public.points_transactions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for reward_catalog
CREATE POLICY "Everyone can view active rewards"
  ON public.reward_catalog FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage rewards"
  ON public.reward_catalog FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for redemption_history
CREATE POLICY "Users can view their own redemptions"
  ON public.redemption_history FOR SELECT
  USING (auth.uid() = donor_id);

CREATE POLICY "Users can insert their own redemptions"
  ON public.redemption_history FOR INSERT
  WITH CHECK (auth.uid() = donor_id);

CREATE POLICY "Admins can manage all redemptions"
  ON public.redemption_history FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Public policy for verifying QR codes (no auth required)
CREATE POLICY "Anyone can verify QR codes"
  ON public.redemption_history FOR UPDATE
  USING (status = 'pending' AND expires_at > now());

-- RLS Policies for reward_settings
CREATE POLICY "Admins can manage reward settings"
  ON public.reward_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view reward settings"
  ON public.reward_settings FOR SELECT
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_donor_points_donor_id ON public.donor_points(donor_id);
CREATE INDEX idx_points_transactions_donor_id ON public.points_transactions(donor_id);
CREATE INDEX idx_redemption_history_donor_id ON public.redemption_history(donor_id);
CREATE INDEX idx_redemption_history_voucher_code ON public.redemption_history(voucher_code);
CREATE INDEX idx_redemption_history_status ON public.redemption_history(status);

-- Create trigger for updated_at columns
CREATE TRIGGER update_donor_points_updated_at
  BEFORE UPDATE ON public.donor_points
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reward_catalog_updated_at
  BEFORE UPDATE ON public.reward_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reward_settings_updated_at
  BEFORE UPDATE ON public.reward_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically award points when donation is added
CREATE OR REPLACE FUNCTION public.award_points_for_donation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points_to_award INTEGER;
BEGIN
  -- Get points per donation from settings
  SELECT setting_value::INTEGER INTO points_to_award
  FROM reward_settings
  WHERE setting_key = 'points_per_donation';
  
  -- Create or update donor_points record
  INSERT INTO donor_points (donor_id, total_points, lifetime_points)
  VALUES (NEW.donor_id, points_to_award, points_to_award)
  ON CONFLICT (donor_id) 
  DO UPDATE SET 
    total_points = donor_points.total_points + points_to_award,
    lifetime_points = donor_points.lifetime_points + points_to_award,
    updated_at = now();
  
  -- Record the transaction
  INSERT INTO points_transactions (donor_id, points, transaction_type, description, related_donation_id)
  VALUES (NEW.donor_id, points_to_award, 'earned', 'Points earned from blood donation at ' || NEW.hospital_name, NEW.id);
  
  RETURN NEW;
END;
$$;

-- Create trigger to award points on donation
CREATE TRIGGER award_points_on_donation
  AFTER INSERT ON public.donation_history
  FOR EACH ROW
  EXECUTE FUNCTION public.award_points_for_donation();