-- Create table to persist Telegram SMS broadcast sessions
CREATE TABLE public.telegram_broadcast_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL UNIQUE,
  groups text[] NOT NULL DEFAULT '{}'::text[],
  step text NOT NULL DEFAULT 'select',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security and block direct access from anon/user roles
ALTER TABLE public.telegram_broadcast_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to telegram broadcast sessions"
ON public.telegram_broadcast_sessions
FOR ALL
USING (false)
WITH CHECK (false);