-- ============================================================================
-- Migration: 20261128_amount_currency.sql
-- Description: A harvest's sale value and an activity's cost can be recorded in US dollars (USD, the
--   default) or Liberian dollars (LRD). Existing rows stay USD. The two currencies are never added
--   together. Safe to run more than once.
-- ============================================================================

ALTER TABLE public.harvest_batches ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE public.farm_activities ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'harvest_batches_currency_check') THEN
    ALTER TABLE public.harvest_batches ADD CONSTRAINT harvest_batches_currency_check CHECK (currency IN ('USD', 'LRD'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_activities_currency_check') THEN
    ALTER TABLE public.farm_activities ADD CONSTRAINT farm_activities_currency_check CHECK (currency IN ('USD', 'LRD'));
  END IF;
END $$;
