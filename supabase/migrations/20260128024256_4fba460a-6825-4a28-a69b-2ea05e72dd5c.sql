-- Create donor_health_records table
CREATE TABLE public.donor_health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  donation_id UUID REFERENCES donation_history(id) ON DELETE SET NULL,
  record_date DATE NOT NULL,
  hemoglobin_level NUMERIC(4,1),
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  pulse_rate INTEGER,
  weight_kg NUMERIC(5,2),
  deferral_reason TEXT,
  deferral_duration_days INTEGER,
  health_notes TEXT,
  recorded_by TEXT DEFAULT 'self',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.donor_health_records ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_health_records_donor ON donor_health_records(donor_id);
CREATE INDEX idx_health_records_date ON donor_health_records(donor_id, record_date DESC);

-- RLS Policies
-- Users can only view their own health records
CREATE POLICY "Users can view own health records"
ON donor_health_records FOR SELECT
USING (auth.uid() = donor_id);

-- Users can insert their own health records
CREATE POLICY "Users can insert own health records"
ON donor_health_records FOR INSERT
WITH CHECK (auth.uid() = donor_id);

-- Users can update their own health records
CREATE POLICY "Users can update own health records"
ON donor_health_records FOR UPDATE
USING (auth.uid() = donor_id);

-- Users can delete their own health records
CREATE POLICY "Users can delete own health records"
ON donor_health_records FOR DELETE
USING (auth.uid() = donor_id);

-- Admins can manage all records
CREATE POLICY "Admins can manage all health records"
ON donor_health_records FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Add updated_at trigger
CREATE TRIGGER update_health_records_updated_at
  BEFORE UPDATE ON donor_health_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();