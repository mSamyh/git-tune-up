-- Create hospitals table
CREATE TABLE public.hospitals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  atoll TEXT,
  island TEXT,
  phone TEXT,
  email TEXT,
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create blood_stock table
CREATE TABLE public.blood_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  blood_group TEXT NOT NULL,
  units_available INTEGER NOT NULL DEFAULT 0,
  units_reserved INTEGER NOT NULL DEFAULT 0,
  expiry_date DATE,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'out_of_stock',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(hospital_id, blood_group)
);

-- Create blood_stock_history table for audit trail
CREATE TABLE public.blood_stock_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blood_stock_id UUID REFERENCES public.blood_stock(id) ON DELETE SET NULL,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  blood_group TEXT NOT NULL,
  previous_units INTEGER NOT NULL DEFAULT 0,
  new_units INTEGER NOT NULL DEFAULT 0,
  change_type TEXT NOT NULL,
  change_reason TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_stock_history ENABLE ROW LEVEL SECURITY;

-- Hospitals RLS policies
CREATE POLICY "Public can view active hospitals"
ON public.hospitals FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage all hospitals"
ON public.hospitals FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Blood stock RLS policies (public read, service role write)
CREATE POLICY "Everyone can view blood stock"
ON public.blood_stock FOR SELECT
USING (true);

CREATE POLICY "Service role manages blood stock"
ON public.blood_stock FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Blood stock history RLS policies
CREATE POLICY "Admins can view stock history"
ON public.blood_stock_history FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role inserts stock history"
ON public.blood_stock_history FOR INSERT
WITH CHECK (true);

-- Function to calculate stock status based on units and blood type
CREATE OR REPLACE FUNCTION public.calculate_blood_stock_status(units INTEGER, blood_group TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  is_rare BOOLEAN;
  critical_threshold INTEGER;
  low_threshold INTEGER;
BEGIN
  is_rare := blood_group IN ('AB-', 'B-', 'O-', 'A-');
  critical_threshold := CASE WHEN is_rare THEN 2 ELSE 5 END;
  low_threshold := CASE WHEN is_rare THEN 5 ELSE 15 END;
  
  IF units = 0 THEN
    RETURN 'out_of_stock';
  ELSIF units <= critical_threshold THEN
    RETURN 'critical';
  ELSIF units <= low_threshold THEN
    RETURN 'low';
  ELSE
    RETURN 'available';
  END IF;
END;
$$;

-- Trigger to auto-update status when units change
CREATE OR REPLACE FUNCTION public.update_blood_stock_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.status := calculate_blood_stock_status(NEW.units_available, NEW.blood_group);
  NEW.last_updated := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_blood_stock_status
BEFORE INSERT OR UPDATE ON public.blood_stock
FOR EACH ROW
EXECUTE FUNCTION public.update_blood_stock_status();

-- Trigger to log stock changes to history
CREATE OR REPLACE FUNCTION public.log_blood_stock_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.units_available != NEW.units_available THEN
    INSERT INTO blood_stock_history (
      blood_stock_id,
      hospital_id,
      blood_group,
      previous_units,
      new_units,
      change_type,
      change_reason
    ) VALUES (
      NEW.id,
      NEW.hospital_id,
      NEW.blood_group,
      OLD.units_available,
      NEW.units_available,
      CASE 
        WHEN NEW.units_available > OLD.units_available THEN 'add'
        WHEN NEW.units_available < OLD.units_available THEN 'remove'
        ELSE 'adjust'
      END,
      NEW.notes
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO blood_stock_history (
      blood_stock_id,
      hospital_id,
      blood_group,
      previous_units,
      new_units,
      change_type,
      change_reason
    ) VALUES (
      NEW.id,
      NEW.hospital_id,
      NEW.blood_group,
      0,
      NEW.units_available,
      'add',
      'Initial stock entry'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_log_blood_stock_change
AFTER INSERT OR UPDATE ON public.blood_stock
FOR EACH ROW
EXECUTE FUNCTION public.log_blood_stock_change();

-- Enable realtime for blood_stock
ALTER PUBLICATION supabase_realtime ADD TABLE blood_stock;

-- Create updated_at trigger for hospitals
CREATE TRIGGER update_hospitals_updated_at
BEFORE UPDATE ON public.hospitals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();