-- ============================================================================
-- Migration: 20261121_record_source.sql
-- Description: Track which channel created a record: 'app' (mobile app, default),
--              'ussd' (feature-phone USSD channel) or 'seed' (demo seed script).
--              The USSD server works without this migration (it falls back to a
--              "Recorded via USSD" text marker), but the column makes it explicit.
-- ============================================================================

ALTER TABLE public.farmers         ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';
ALTER TABLE public.farms           ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';
ALTER TABLE public.farm_seasons    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';
ALTER TABLE public.harvest_batches ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';
ALTER TABLE public.expenses        ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';

COMMENT ON COLUMN public.harvest_batches.source IS 'Channel that created the record: app | ussd | seed';
COMMENT ON COLUMN public.expenses.source IS 'Channel that created the record: app | ussd | seed';

CREATE INDEX IF NOT EXISTS idx_harvest_batches_created_at ON public.harvest_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON public.expenses(created_at DESC);
