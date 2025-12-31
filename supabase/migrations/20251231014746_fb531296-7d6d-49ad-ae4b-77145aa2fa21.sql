-- Create merchant_accounts table
CREATE TABLE public.merchant_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  partner_id UUID REFERENCES public.reward_catalog(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_accounts ENABLE ROW LEVEL SECURITY;

-- Only admins can view merchant accounts
CREATE POLICY "Admins can view merchant accounts"
ON public.merchant_accounts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert merchant accounts
CREATE POLICY "Admins can insert merchant accounts"
ON public.merchant_accounts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update merchant accounts
CREATE POLICY "Admins can update merchant accounts"
ON public.merchant_accounts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete merchant accounts
CREATE POLICY "Admins can delete merchant accounts"
ON public.merchant_accounts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add merchant_id and verified_by_merchant_id to redemption_history
ALTER TABLE public.redemption_history ADD COLUMN IF NOT EXISTS verified_by_merchant_id UUID REFERENCES public.merchant_accounts(id) ON DELETE SET NULL;

-- Create updated_at trigger
CREATE TRIGGER update_merchant_accounts_updated_at
BEFORE UPDATE ON public.merchant_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();