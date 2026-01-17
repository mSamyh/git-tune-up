
-- =============================================
-- PHASE 1: REFERENCE DATA TABLES
-- =============================================

-- 1.1 Blood Groups Configuration Table
CREATE TABLE IF NOT EXISTS public.blood_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  rarity_percent numeric(4,1),
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 1.2 Blood Compatibility Matrix Table
CREATE TABLE IF NOT EXISTS public.blood_compatibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_blood_group text NOT NULL,
  recipient_blood_group text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(donor_blood_group, recipient_blood_group)
);

-- 1.3 Availability Status Configuration Table
CREATE TABLE IF NOT EXISTS public.availability_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL,
  bg_color text NOT NULL,
  icon_name text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 1.4 Urgency Options Configuration Table
CREATE TABLE IF NOT EXISTS public.urgency_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  hours integer,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 1.5 Emergency Types Configuration Table
CREATE TABLE IF NOT EXISTS public.emergency_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- PHASE 2: RLS POLICIES FOR REFERENCE TABLES
-- =============================================

-- Enable RLS on all reference tables
ALTER TABLE public.blood_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urgency_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_types ENABLE ROW LEVEL SECURITY;

-- Public read access for all reference tables
CREATE POLICY "Public read blood_groups" ON public.blood_groups FOR SELECT USING (true);
CREATE POLICY "Public read blood_compatibility" ON public.blood_compatibility FOR SELECT USING (true);
CREATE POLICY "Public read availability_statuses" ON public.availability_statuses FOR SELECT USING (true);
CREATE POLICY "Public read urgency_options" ON public.urgency_options FOR SELECT USING (true);
CREATE POLICY "Public read emergency_types" ON public.emergency_types FOR SELECT USING (true);

-- Admin write access for all reference tables
CREATE POLICY "Admin write blood_groups" ON public.blood_groups FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin write blood_compatibility" ON public.blood_compatibility FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin write availability_statuses" ON public.availability_statuses FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin write urgency_options" ON public.urgency_options FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin write emergency_types" ON public.emergency_types FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PHASE 3: SEED DATA
-- =============================================

-- 3.1 Seed Blood Groups
INSERT INTO public.blood_groups (code, label, rarity_percent, description, sort_order) VALUES
('A+', 'A Positive', 30.0, 'Common Type', 1),
('A-', 'A Negative', 6.0, 'Rare Type', 2),
('B+', 'B Positive', 8.0, 'Fairly Common', 3),
('B-', 'B Negative', 2.0, 'Rare Type', 4),
('AB+', 'AB Positive', 4.0, 'Universal Recipient', 5),
('AB-', 'AB Negative', 1.0, 'Rarest Type', 6),
('O+', 'O Positive', 37.0, 'Most Common', 7),
('O-', 'O Negative', 7.0, 'Universal Donor', 8)
ON CONFLICT (code) DO NOTHING;

-- 3.2 Seed Blood Compatibility Matrix
-- A+ can donate to: A+, AB+
INSERT INTO public.blood_compatibility (donor_blood_group, recipient_blood_group) VALUES
('A+', 'A+'), ('A+', 'AB+'),
-- A- can donate to: A+, A-, AB+, AB-
('A-', 'A+'), ('A-', 'A-'), ('A-', 'AB+'), ('A-', 'AB-'),
-- B+ can donate to: B+, AB+
('B+', 'B+'), ('B+', 'AB+'),
-- B- can donate to: B+, B-, AB+, AB-
('B-', 'B+'), ('B-', 'B-'), ('B-', 'AB+'), ('B-', 'AB-'),
-- AB+ can donate to: AB+
('AB+', 'AB+'),
-- AB- can donate to: AB+, AB-
('AB-', 'AB+'), ('AB-', 'AB-'),
-- O+ can donate to: A+, B+, AB+, O+
('O+', 'A+'), ('O+', 'B+'), ('O+', 'AB+'), ('O+', 'O+'),
-- O- can donate to: Everyone (Universal Donor)
('O-', 'A+'), ('O-', 'A-'), ('O-', 'B+'), ('O-', 'B-'), ('O-', 'AB+'), ('O-', 'AB-'), ('O-', 'O+'), ('O-', 'O-')
ON CONFLICT (donor_blood_group, recipient_blood_group) DO NOTHING;

-- 3.3 Seed Availability Statuses
INSERT INTO public.availability_statuses (code, label, color, bg_color, icon_name, sort_order) VALUES
('available', 'Available', 'text-green-600', 'bg-green-50', 'Check', 1),
('unavailable', 'Unavailable', 'text-red-600', 'bg-red-50', 'Ban', 2),
('reserved', 'Reserved', 'text-amber-600', 'bg-amber-50', 'Clock', 3)
ON CONFLICT (code) DO NOTHING;

-- 3.4 Seed Urgency Options
INSERT INTO public.urgency_options (value, label, hours, sort_order) VALUES
('2', '2 hours', 2, 1),
('4', '4 hours', 4, 2),
('6', '6 hours', 6, 3),
('12', '12 hours', 12, 4),
('24', '24 hours', 24, 5),
('48', '48 hours', 48, 6),
('custom', 'Custom Date/Time', NULL, 7)
ON CONFLICT (value) DO NOTHING;

-- 3.5 Seed Emergency Types
INSERT INTO public.emergency_types (code, label, sort_order) VALUES
('thalassaemia', 'Thalassaemia', 1),
('pregnancy', 'Pregnancy', 2),
('surgery', 'Surgery', 3),
('emergency_surgery', 'Emergency Surgery', 4),
('custom', 'Other (Specify)', 5)
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- PHASE 4: INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_blood_groups_code ON public.blood_groups(code);
CREATE INDEX IF NOT EXISTS idx_blood_groups_active ON public.blood_groups(is_active);
CREATE INDEX IF NOT EXISTS idx_blood_compatibility_donor ON public.blood_compatibility(donor_blood_group);
CREATE INDEX IF NOT EXISTS idx_blood_compatibility_recipient ON public.blood_compatibility(recipient_blood_group);
CREATE INDEX IF NOT EXISTS idx_availability_statuses_code ON public.availability_statuses(code);

-- =============================================
-- PHASE 5: DATABASE FUNCTIONS
-- =============================================

-- 5.1 Get User Tier Function
CREATE OR REPLACE FUNCTION public.get_user_tier(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points integer;
  v_tier_name text;
  v_tier_color text;
  v_tier_discount integer;
  v_tier_icon text;
  v_min_points integer;
  v_max_points integer;
  v_bronze_min integer;
  v_silver_min integer;
  v_gold_min integer;
  v_platinum_min integer;
  v_bronze_discount integer;
  v_silver_discount integer;
  v_gold_discount integer;
  v_platinum_discount integer;
BEGIN
  -- Get current points
  SELECT COALESCE(total_points, 0) INTO v_points 
  FROM donor_points WHERE donor_id = p_user_id;
  
  IF v_points IS NULL THEN
    v_points := 0;
  END IF;
  
  -- Get tier thresholds from settings
  SELECT COALESCE(setting_value::int, 0) INTO v_bronze_min FROM reward_settings WHERE setting_key = 'tier_bronze_min';
  SELECT COALESCE(setting_value::int, 100) INTO v_silver_min FROM reward_settings WHERE setting_key = 'tier_silver_min';
  SELECT COALESCE(setting_value::int, 500) INTO v_gold_min FROM reward_settings WHERE setting_key = 'tier_gold_min';
  SELECT COALESCE(setting_value::int, 1000) INTO v_platinum_min FROM reward_settings WHERE setting_key = 'tier_platinum_min';
  
  -- Get tier discounts from settings
  SELECT COALESCE(setting_value::int, 0) INTO v_bronze_discount FROM reward_settings WHERE setting_key = 'tier_bronze_discount';
  SELECT COALESCE(setting_value::int, 5) INTO v_silver_discount FROM reward_settings WHERE setting_key = 'tier_silver_discount';
  SELECT COALESCE(setting_value::int, 10) INTO v_gold_discount FROM reward_settings WHERE setting_key = 'tier_gold_discount';
  SELECT COALESCE(setting_value::int, 15) INTO v_platinum_discount FROM reward_settings WHERE setting_key = 'tier_platinum_discount';
  
  -- Set defaults if null
  v_bronze_min := COALESCE(v_bronze_min, 0);
  v_silver_min := COALESCE(v_silver_min, 100);
  v_gold_min := COALESCE(v_gold_min, 500);
  v_platinum_min := COALESCE(v_platinum_min, 1000);
  v_bronze_discount := COALESCE(v_bronze_discount, 0);
  v_silver_discount := COALESCE(v_silver_discount, 5);
  v_gold_discount := COALESCE(v_gold_discount, 10);
  v_platinum_discount := COALESCE(v_platinum_discount, 15);
  
  -- Determine tier
  IF v_points >= v_platinum_min THEN
    v_tier_name := 'Platinum';
    v_tier_color := 'from-slate-400 to-slate-600';
    v_tier_discount := v_platinum_discount;
    v_tier_icon := 'Crown';
    v_min_points := v_platinum_min;
    v_max_points := NULL;
  ELSIF v_points >= v_gold_min THEN
    v_tier_name := 'Gold';
    v_tier_color := 'from-yellow-400 to-yellow-600';
    v_tier_discount := v_gold_discount;
    v_tier_icon := 'Trophy';
    v_min_points := v_gold_min;
    v_max_points := v_platinum_min - 1;
  ELSIF v_points >= v_silver_min THEN
    v_tier_name := 'Silver';
    v_tier_color := 'from-gray-300 to-gray-500';
    v_tier_discount := v_silver_discount;
    v_tier_icon := 'Medal';
    v_min_points := v_silver_min;
    v_max_points := v_gold_min - 1;
  ELSE
    v_tier_name := 'Bronze';
    v_tier_color := 'from-orange-400 to-orange-600';
    v_tier_discount := v_bronze_discount;
    v_tier_icon := 'Award';
    v_min_points := v_bronze_min;
    v_max_points := v_silver_min - 1;
  END IF;
  
  RETURN jsonb_build_object(
    'name', v_tier_name,
    'color', v_tier_color,
    'discount', v_tier_discount,
    'minPoints', v_min_points,
    'maxPoints', v_max_points,
    'icon', v_tier_icon,
    'currentPoints', v_points
  );
END;
$$;

-- 5.2 Get All Tiers Function
CREATE OR REPLACE FUNCTION public.get_all_tiers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bronze_min integer;
  v_silver_min integer;
  v_gold_min integer;
  v_platinum_min integer;
  v_bronze_discount integer;
  v_silver_discount integer;
  v_gold_discount integer;
  v_platinum_discount integer;
BEGIN
  -- Get tier thresholds
  SELECT COALESCE(setting_value::int, 0) INTO v_bronze_min FROM reward_settings WHERE setting_key = 'tier_bronze_min';
  SELECT COALESCE(setting_value::int, 100) INTO v_silver_min FROM reward_settings WHERE setting_key = 'tier_silver_min';
  SELECT COALESCE(setting_value::int, 500) INTO v_gold_min FROM reward_settings WHERE setting_key = 'tier_gold_min';
  SELECT COALESCE(setting_value::int, 1000) INTO v_platinum_min FROM reward_settings WHERE setting_key = 'tier_platinum_min';
  
  -- Get tier discounts
  SELECT COALESCE(setting_value::int, 0) INTO v_bronze_discount FROM reward_settings WHERE setting_key = 'tier_bronze_discount';
  SELECT COALESCE(setting_value::int, 5) INTO v_silver_discount FROM reward_settings WHERE setting_key = 'tier_silver_discount';
  SELECT COALESCE(setting_value::int, 10) INTO v_gold_discount FROM reward_settings WHERE setting_key = 'tier_gold_discount';
  SELECT COALESCE(setting_value::int, 15) INTO v_platinum_discount FROM reward_settings WHERE setting_key = 'tier_platinum_discount';
  
  -- Set defaults
  v_bronze_min := COALESCE(v_bronze_min, 0);
  v_silver_min := COALESCE(v_silver_min, 100);
  v_gold_min := COALESCE(v_gold_min, 500);
  v_platinum_min := COALESCE(v_platinum_min, 1000);
  v_bronze_discount := COALESCE(v_bronze_discount, 0);
  v_silver_discount := COALESCE(v_silver_discount, 5);
  v_gold_discount := COALESCE(v_gold_discount, 10);
  v_platinum_discount := COALESCE(v_platinum_discount, 15);
  
  RETURN jsonb_build_array(
    jsonb_build_object(
      'name', 'Bronze',
      'color', 'from-orange-400 to-orange-600',
      'discount', v_bronze_discount,
      'minPoints', v_bronze_min,
      'maxPoints', v_silver_min - 1,
      'icon', 'Award'
    ),
    jsonb_build_object(
      'name', 'Silver',
      'color', 'from-gray-300 to-gray-500',
      'discount', v_silver_discount,
      'minPoints', v_silver_min,
      'maxPoints', v_gold_min - 1,
      'icon', 'Medal'
    ),
    jsonb_build_object(
      'name', 'Gold',
      'color', 'from-yellow-400 to-yellow-600',
      'discount', v_gold_discount,
      'minPoints', v_gold_min,
      'maxPoints', v_platinum_min - 1,
      'icon', 'Trophy'
    ),
    jsonb_build_object(
      'name', 'Platinum',
      'color', 'from-slate-400 to-slate-600',
      'discount', v_platinum_discount,
      'minPoints', v_platinum_min,
      'maxPoints', NULL,
      'icon', 'Crown'
    )
  );
END;
$$;

-- 5.3 Award Donation Points Secure Function
CREATE OR REPLACE FUNCTION public.award_donation_points_secure(
  p_donor_id uuid,
  p_donation_id uuid,
  p_hospital_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points_per_donation integer;
  v_existing_tx uuid;
BEGIN
  -- Get points per donation from settings
  SELECT COALESCE(setting_value::int, 100) INTO v_points_per_donation 
  FROM reward_settings WHERE setting_key = 'points_per_donation';
  
  v_points_per_donation := COALESCE(v_points_per_donation, 100);
  
  -- Check for duplicate transaction
  SELECT id INTO v_existing_tx FROM points_transactions 
  WHERE related_donation_id = p_donation_id 
  AND transaction_type = 'earned';
  
  IF v_existing_tx IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_awarded', 'points', 0);
  END IF;
  
  -- Insert points transaction
  INSERT INTO points_transactions (
    donor_id, 
    points, 
    transaction_type, 
    description, 
    related_donation_id
  )
  VALUES (
    p_donor_id, 
    v_points_per_donation, 
    'earned', 
    'Points earned from blood donation at ' || COALESCE(p_hospital_name, 'Unknown Hospital'), 
    p_donation_id
  );
  
  -- Update or insert donor_points
  INSERT INTO donor_points (donor_id, total_points, lifetime_points)
  VALUES (p_donor_id, v_points_per_donation, v_points_per_donation)
  ON CONFLICT (donor_id) DO UPDATE SET
    total_points = donor_points.total_points + v_points_per_donation,
    lifetime_points = donor_points.lifetime_points + v_points_per_donation,
    updated_at = now();
  
  RETURN jsonb_build_object('success', true, 'points', v_points_per_donation);
END;
$$;

-- 5.4 Deduct Donation Points Secure Function
CREATE OR REPLACE FUNCTION public.deduct_donation_points_secure(
  p_donor_id uuid,
  p_donation_id uuid,
  p_hospital_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points_per_donation integer;
  v_existing_deduction uuid;
  v_current_points integer;
BEGIN
  -- Get points per donation from settings
  SELECT COALESCE(setting_value::int, 100) INTO v_points_per_donation 
  FROM reward_settings WHERE setting_key = 'points_per_donation';
  
  v_points_per_donation := COALESCE(v_points_per_donation, 100);
  
  -- Check for existing deduction
  SELECT id INTO v_existing_deduction FROM points_transactions 
  WHERE related_donation_id = p_donation_id 
  AND transaction_type = 'adjusted'
  AND points < 0;
  
  IF v_existing_deduction IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_deducted', 'points', 0);
  END IF;
  
  -- Get current points
  SELECT COALESCE(total_points, 0) INTO v_current_points 
  FROM donor_points WHERE donor_id = p_donor_id;
  
  -- Update donor_points (ensure non-negative)
  UPDATE donor_points 
  SET total_points = GREATEST(0, total_points - v_points_per_donation),
      updated_at = now()
  WHERE donor_id = p_donor_id;
  
  -- Insert negative points transaction
  INSERT INTO points_transactions (
    donor_id, 
    points, 
    transaction_type, 
    description, 
    related_donation_id
  )
  VALUES (
    p_donor_id, 
    -v_points_per_donation, 
    'adjusted', 
    'Points deducted - donation record deleted from ' || COALESCE(p_hospital_name, 'Unknown Hospital'), 
    p_donation_id
  );
  
  RETURN jsonb_build_object('success', true, 'points', v_points_per_donation);
END;
$$;

-- 5.5 Sync Donor Last Donation Function
CREATE OR REPLACE FUNCTION public.sync_donor_last_donation(p_donor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_donation_date date;
BEGIN
  -- Get most recent donation date
  SELECT donation_date INTO v_last_donation_date
  FROM donation_history
  WHERE donor_id = p_donor_id
  ORDER BY donation_date DESC
  LIMIT 1;
  
  -- Update profile
  IF v_last_donation_date IS NOT NULL THEN
    UPDATE profiles 
    SET last_donation_date = v_last_donation_date,
        availability_status = 'unavailable',
        updated_at = now()
    WHERE id = p_donor_id;
  ELSE
    UPDATE profiles 
    SET last_donation_date = NULL,
        availability_status = 'available',
        updated_at = now()
    WHERE id = p_donor_id;
  END IF;
END;
$$;

-- 5.6 Auto Expire Blood Requests Function
CREATE OR REPLACE FUNCTION public.auto_expire_blood_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count integer;
BEGIN
  UPDATE blood_requests
  SET status = 'expired', updated_at = now()
  WHERE status IN ('active', 'open')
    AND needed_before IS NOT NULL
    AND needed_before < now();
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  
  RETURN v_expired_count;
END;
$$;

-- 5.7 Get Blood Compatibility Function
CREATE OR REPLACE FUNCTION public.get_blood_compatibility(
  p_blood_group text,
  p_mode text -- 'donate' or 'receive'
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result text[];
BEGIN
  IF p_mode = 'donate' THEN
    -- Who can this blood type donate to?
    SELECT array_agg(recipient_blood_group ORDER BY recipient_blood_group) INTO v_result
    FROM blood_compatibility
    WHERE donor_blood_group = p_blood_group;
  ELSE
    -- Who can this blood type receive from?
    SELECT array_agg(donor_blood_group ORDER BY donor_blood_group) INTO v_result
    FROM blood_compatibility
    WHERE recipient_blood_group = p_blood_group;
  END IF;
  
  RETURN COALESCE(v_result, ARRAY[]::text[]);
END;
$$;

-- 5.8 Get Points Per Donation Function
CREATE OR REPLACE FUNCTION public.get_points_per_donation()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points integer;
BEGIN
  SELECT COALESCE(setting_value::int, 100) INTO v_points 
  FROM reward_settings WHERE setting_key = 'points_per_donation';
  
  RETURN COALESCE(v_points, 100);
END;
$$;
