-- ============================================================================
-- Migration: 20261129_ussd_farmer_pins.sql
-- Description: PINs for farmers who use USSD. A farmer creates an account by USSD (name, date of birth,
--   gender, county, town and a 4-digit PIN) and then enters the PIN each time they dial.
--   The PIN is never stored as digits: only a salted hash, in THIS table, which the apps cannot read
--   (row level security is on and there is no policy). Only the USSD server, using the service key, uses it.
--   After 3 wrong PINs the account is locked for 30 minutes. Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.farmer_pins (
  farmer_id UUID PRIMARY KEY REFERENCES public.farmers(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  set_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.farmer_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.farmer_pins FROM anon, authenticated;
