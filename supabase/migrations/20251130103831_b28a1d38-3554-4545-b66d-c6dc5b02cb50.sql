-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL UNIQUE,
  blood_group text NOT NULL,
  district text NOT NULL,
  address text,
  is_available boolean DEFAULT true,
  last_donation_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create blood_requests table
CREATE TABLE public.blood_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name text NOT NULL,
  blood_group text NOT NULL,
  units_needed integer NOT NULL,
  hospital_name text NOT NULL,
  hospital_address text NOT NULL,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  urgency text NOT NULL CHECK (urgency IN ('urgent', 'normal')),
  notes text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create donation_history table
CREATE TABLE public.donation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  blood_request_id uuid REFERENCES public.blood_requests(id) ON DELETE SET NULL,
  donation_date date NOT NULL,
  hospital_name text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create otp_verifications table
CREATE TABLE public.otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  otp text NOT NULL,
  verified boolean DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "User roles are viewable by admins"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage user roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for blood_requests
CREATE POLICY "Blood requests are viewable by everyone"
  ON public.blood_requests FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create blood requests"
  ON public.blood_requests FOR INSERT
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Users can update their own requests"
  ON public.blood_requests FOR UPDATE
  USING (auth.uid() = requested_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete blood requests"
  ON public.blood_requests FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for donation_history
CREATE POLICY "Donation history viewable by donor and admins"
  ON public.donation_history FOR SELECT
  USING (auth.uid() = donor_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can add their own donation history"
  ON public.donation_history FOR INSERT
  WITH CHECK (auth.uid() = donor_id);

CREATE POLICY "Admins can manage all donation history"
  ON public.donation_history FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for otp_verifications (public function access only)
CREATE POLICY "OTP verifications managed by service role"
  ON public.otp_verifications FOR ALL
  USING (false);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blood_requests_updated_at
  BEFORE UPDATE ON public.blood_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- Trigger to assign default role on user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();