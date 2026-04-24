
-- ============================================
-- 1. ADMIN AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
ON public.admin_audit_log FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert audit log"
ON public.admin_audit_log FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.admin_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.admin_audit_log(entity_type, entity_id);

-- ============================================
-- 2. REQUEST MATCHES (Smart Matching)
-- ============================================
CREATE TABLE IF NOT EXISTS public.request_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  donor_id UUID NOT NULL,
  match_score INTEGER NOT NULL DEFAULT 0,
  proximity_rank TEXT,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  response_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(request_id, donor_id)
);

ALTER TABLE public.request_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Donors can view own matches"
ON public.request_matches FOR SELECT
USING (auth.uid() = donor_id);

CREATE POLICY "Requesters can view matches for own requests"
ON public.request_matches FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.blood_requests br
  WHERE br.id = request_matches.request_id AND br.requested_by = auth.uid()
));

CREATE POLICY "Admins can manage matches"
ON public.request_matches FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Donors can update own match response"
ON public.request_matches FOR UPDATE
USING (auth.uid() = donor_id)
WITH CHECK (auth.uid() = donor_id);

CREATE INDEX IF NOT EXISTS idx_request_matches_request ON public.request_matches(request_id);
CREATE INDEX IF NOT EXISTS idx_request_matches_donor ON public.request_matches(donor_id);
CREATE INDEX IF NOT EXISTS idx_request_matches_score ON public.request_matches(match_score DESC);

-- ============================================
-- 3. BLOOD REQUESTS: Soft-delete & match counter
-- ============================================
ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notified_donor_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_blood_requests_active 
  ON public.blood_requests(status, created_at DESC) 
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_blood_requests_blood_group 
  ON public.blood_requests(blood_group) 
  WHERE deleted_at IS NULL;

-- ============================================
-- 4. REQUEST RESPONSES: response timestamp
-- ============================================
ALTER TABLE public.request_responses
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ DEFAULT now();

-- ============================================
-- 5. PERFORMANCE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_blood_group_status 
  ON public.profiles(blood_group, availability_status);
CREATE INDEX IF NOT EXISTS idx_profiles_district 
  ON public.profiles(district);
CREATE INDEX IF NOT EXISTS idx_profiles_atoll_island 
  ON public.profiles(atoll, island);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type 
  ON public.profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_donation_history_donor_date 
  ON public.donation_history(donor_id, donation_date DESC);
CREATE INDEX IF NOT EXISTS idx_points_tx_donor 
  ON public.points_transactions(donor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON public.notifications(user_id, read, created_at DESC);

-- ============================================
-- 6. SMART MATCHING FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.find_matching_donors(
  p_request_id UUID,
  p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  donor_id UUID,
  full_name TEXT,
  blood_group TEXT,
  district TEXT,
  atoll TEXT,
  island TEXT,
  match_score INTEGER,
  proximity_rank TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request blood_requests%ROWTYPE;
  v_compatible_groups TEXT[];
BEGIN
  SELECT * INTO v_request FROM blood_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Get all donor blood groups that can give to the recipient
  SELECT array_agg(donor_blood_group)
  INTO v_compatible_groups
  FROM blood_compatibility
  WHERE recipient_blood_group = v_request.blood_group;

  -- Fallback: exact match only
  IF v_compatible_groups IS NULL THEN
    v_compatible_groups := ARRAY[v_request.blood_group];
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.blood_group,
    p.district,
    p.atoll,
    p.island,
    -- Match score: compatibility + location + recency
    (
      -- Exact blood group match: +50, compatible: +25
      CASE WHEN p.blood_group = v_request.blood_group THEN 50 ELSE 25 END
      -- Same island: +30, same atoll: +15, same district: +10
      + CASE 
          WHEN p.island IS NOT NULL AND p.island = (
            SELECT h.island FROM hospitals h WHERE h.name = v_request.hospital_name LIMIT 1
          ) THEN 30
          WHEN p.atoll IS NOT NULL AND p.atoll = (
            SELECT h.atoll FROM hospitals h WHERE h.name = v_request.hospital_name LIMIT 1
          ) THEN 15
          WHEN p.district IS NOT NULL AND p.district = (
            SELECT h.atoll FROM hospitals h WHERE h.name = v_request.hospital_name LIMIT 1
          ) THEN 10
          ELSE 0
        END
      -- Donation count (reliability): up to +20
      + LEAST(COALESCE((SELECT COUNT(*) FROM donation_history WHERE donor_id = p.id), 0) * 2, 20)::int
    )::INTEGER AS match_score,
    -- Proximity label
    CASE
      WHEN p.island IS NOT NULL AND p.island = (
        SELECT h.island FROM hospitals h WHERE h.name = v_request.hospital_name LIMIT 1
      ) THEN 'same_island'
      WHEN p.atoll IS NOT NULL AND p.atoll = (
        SELECT h.atoll FROM hospitals h WHERE h.name = v_request.hospital_name LIMIT 1
      ) THEN 'same_atoll'
      ELSE 'other'
    END AS proximity_rank
  FROM profiles p
  WHERE p.blood_group = ANY(v_compatible_groups)
    AND p.user_type IN ('donor', 'both')
    AND p.availability_status = 'available'
    AND p.id != COALESCE(v_request.requested_by, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      p.last_donation_date IS NULL 
      OR p.last_donation_date < CURRENT_DATE - INTERVAL '90 days'
    )
  ORDER BY match_score DESC, p.full_name
  LIMIT p_limit;
END;
$$;

-- ============================================
-- 7. AUTO-NOTIFY ON NEW REQUEST (Smart)
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_notify_matching_donors()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_record RECORD;
  prefs JSONB;
  v_count INTEGER := 0;
BEGIN
  -- Only fire on new active requests
  IF NEW.status NOT IN ('active', 'open') THEN RETURN NEW; END IF;

  FOR match_record IN
    SELECT * FROM find_matching_donors(NEW.id, 25)
  LOOP
    -- Insert match record
    INSERT INTO request_matches (request_id, donor_id, match_score, proximity_rank)
    VALUES (NEW.id, match_record.donor_id, match_record.match_score, match_record.proximity_rank)
    ON CONFLICT (request_id, donor_id) DO NOTHING;

    -- Check donor notification preferences
    SELECT notification_preferences INTO prefs FROM profiles WHERE id = match_record.donor_id;
    prefs := COALESCE(prefs, '{"blood_requests": true}'::jsonb);

    IF (prefs->>'blood_requests')::boolean IS NOT FALSE THEN
      INSERT INTO notifications (user_id, title, message, type, related_request_id)
      VALUES (
        match_record.donor_id,
        '🩸 You''re a match for ' || NEW.blood_group,
        NEW.urgency || ' need at ' || NEW.hospital_name || ' for ' || NEW.patient_name 
          || '. Tap to respond — you''re ranked highly for this request.',
        'blood_request_match',
        NEW.id
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- Update notified count on the request
  UPDATE blood_requests SET notified_donor_count = v_count WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Replace old broad-blast trigger with smart matching
DROP TRIGGER IF EXISTS trg_notify_matching_donors ON public.blood_requests;
DROP TRIGGER IF EXISTS trg_auto_notify_matching_donors ON public.blood_requests;

CREATE TRIGGER trg_auto_notify_matching_donors
AFTER INSERT ON public.blood_requests
FOR EACH ROW
EXECUTE FUNCTION public.auto_notify_matching_donors();

-- ============================================
-- 8. TRIGGER: when donor responds, update match
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_match_on_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE request_matches
  SET responded_at = COALESCE(responded_at, now()),
      response_status = NEW.status
  WHERE request_id = NEW.request_id AND donor_id = NEW.donor_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_match_on_response ON public.request_responses;
CREATE TRIGGER trg_sync_match_on_response
AFTER INSERT OR UPDATE ON public.request_responses
FOR EACH ROW
EXECUTE FUNCTION public.sync_match_on_response();

-- ============================================
-- 9. HELPER: get response stats for a request
-- ============================================
CREATE OR REPLACE FUNCTION public.get_request_match_stats(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notified INTEGER;
  v_responded INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_notified
  FROM request_matches WHERE request_id = p_request_id;

  SELECT COUNT(*) INTO v_responded
  FROM request_matches 
  WHERE request_id = p_request_id AND responded_at IS NOT NULL;

  RETURN jsonb_build_object(
    'notified', COALESCE(v_notified, 0),
    'responded', COALESCE(v_responded, 0)
  );
END;
$$;
