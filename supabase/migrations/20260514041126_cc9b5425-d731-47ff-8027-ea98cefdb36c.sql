-- Fix 1: Allow admins to delete donor profiles
CREATE POLICY "Admins can delete profiles"
  ON public.profiles
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix 2: Resolve ambiguous donor_id in find_matching_donors
CREATE OR REPLACE FUNCTION public.find_matching_donors(p_request_id uuid, p_limit integer DEFAULT 25)
 RETURNS TABLE(donor_id uuid, full_name text, blood_group text, district text, atoll text, island text, match_score integer, proximity_rank text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request blood_requests%ROWTYPE;
  v_compatible_groups TEXT[];
BEGIN
  SELECT * INTO v_request FROM blood_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT array_agg(bc.donor_blood_group)
  INTO v_compatible_groups
  FROM blood_compatibility bc
  WHERE bc.recipient_blood_group = v_request.blood_group;

  IF v_compatible_groups IS NULL THEN
    v_compatible_groups := ARRAY[v_request.blood_group];
  END IF;

  RETURN QUERY
  SELECT
    p.id AS donor_id,
    p.full_name,
    p.blood_group,
    p.district,
    p.atoll,
    p.island,
    (
      CASE WHEN p.blood_group = v_request.blood_group THEN 50 ELSE 25 END
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
      + LEAST(COALESCE((SELECT COUNT(*) FROM donation_history dh WHERE dh.donor_id = p.id), 0) * 2, 20)::int
    )::INTEGER AS match_score,
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
$function$;