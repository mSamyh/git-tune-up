-- Add auth columns to hospitals table
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS login_email TEXT;

-- Create blood_units table for individual unit tracking
CREATE TABLE public.blood_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  blood_group TEXT NOT NULL,
  
  -- Collection Details
  collection_date DATE NOT NULL,
  donor_id TEXT,
  donor_name TEXT,
  
  -- Unit Details  
  bag_number TEXT,
  volume_ml INTEGER DEFAULT 450,
  
  -- Expiry & Status
  expiry_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  
  -- Tracking
  reserved_for TEXT,
  reserved_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  
  -- Metadata
  batch_number TEXT,
  component_type TEXT DEFAULT 'whole_blood',
  
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create indexes for performance
CREATE INDEX idx_blood_units_hospital ON public.blood_units(hospital_id);
CREATE INDEX idx_blood_units_blood_group ON public.blood_units(blood_group);
CREATE INDEX idx_blood_units_status ON public.blood_units(status);
CREATE INDEX idx_blood_units_expiry ON public.blood_units(expiry_date);

-- Create blood_unit_history table for audit trail
CREATE TABLE public.blood_unit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blood_unit_id UUID REFERENCES public.blood_units(id) ON DELETE SET NULL,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id),
  blood_group TEXT NOT NULL,
  
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  
  patient_name TEXT,
  notes TEXT,
  
  performed_by UUID,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.blood_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_unit_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blood_units

-- Hospitals can manage their own units (using auth_user_id link)
CREATE POLICY "Hospitals can manage own units"
ON public.blood_units FOR ALL
USING (
  hospital_id IN (
    SELECT id FROM public.hospitals WHERE auth_user_id = auth.uid()
  )
);

-- Public can view available units for stock display
CREATE POLICY "Public can view blood units"
ON public.blood_units FOR SELECT
USING (true);

-- Admins can manage all blood units
CREATE POLICY "Admins can manage all blood units"
ON public.blood_units FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for blood_unit_history

-- Hospitals can view their own history
CREATE POLICY "Hospitals can view own history"
ON public.blood_unit_history FOR SELECT
USING (
  hospital_id IN (
    SELECT id FROM public.hospitals WHERE auth_user_id = auth.uid()
  )
);

-- Admins can manage all history
CREATE POLICY "Admins can manage all history"
ON public.blood_unit_history FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert history (for edge functions)
CREATE POLICY "Service can insert history"
ON public.blood_unit_history FOR INSERT
WITH CHECK (true);

-- Trigger to update updated_at on blood_units
CREATE TRIGGER update_blood_units_updated_at
BEFORE UPDATE ON public.blood_units
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();