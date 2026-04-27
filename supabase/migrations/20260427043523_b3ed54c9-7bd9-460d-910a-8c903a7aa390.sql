CREATE OR REPLACE FUNCTION public.enforce_donation_gap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflict_date DATE;
  diff_days INTEGER;
BEGIN
  -- Find any existing donation within 90 days for this donor
  SELECT donation_date INTO conflict_date
  FROM public.donation_history
  WHERE donor_id = NEW.donor_id
    AND id IS DISTINCT FROM NEW.id
    AND ABS(donation_date - NEW.donation_date) < 90
  ORDER BY ABS(donation_date - NEW.donation_date) ASC
  LIMIT 1;

  IF conflict_date IS NOT NULL THEN
    diff_days := ABS(conflict_date - NEW.donation_date);
    RAISE EXCEPTION 'Donations must be at least 90 days apart. You have a donation on % (% day(s) away). Please wait % more day(s).',
      to_char(conflict_date, 'Mon DD, YYYY'),
      diff_days,
      (90 - diff_days)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;