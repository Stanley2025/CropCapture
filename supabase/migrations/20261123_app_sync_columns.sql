-- ============================================================================
-- Migration: 20261123_app_sync_columns.sql
-- Description: Columns the mobile app writes when it syncs, which no earlier migration
--              created. Without them the app's uploads were rejected ("Could not find the
--              'x' column"), so new app records never reached the admin dashboard.
--              Safe to run more than once (IF NOT EXISTS).
-- ============================================================================

-- Every synced row carries updated_at (SyncEngine stamps it on every upload)
ALTER TABLE public.input_records
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Expenses: updated_at plus the append-only revision fields
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_record_id UUID,
  ADD COLUMN IF NOT EXISTS is_latest BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS server_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Harvests: sale value, offline / verification flags, revision fields
ALTER TABLE public.harvest_batches
  ADD COLUMN IF NOT EXISTS total_value NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS is_offline_pending BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_server_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS server_signature TEXT,
  ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_record_id UUID,
  ADD COLUMN IF NOT EXISTS is_latest BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS server_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Seasons: crop or livestock cycle
ALTER TABLE public.farm_seasons
  ADD COLUMN IF NOT EXISTS cycle_type TEXT NOT NULL DEFAULT 'crops',
  ADD COLUMN IF NOT EXISTS livestock_type TEXT,
  ADD COLUMN IF NOT EXISTS head_count INTEGER,
  ADD COLUMN IF NOT EXISTS production_purpose JSONB,
  ADD COLUMN IF NOT EXISTS management_system TEXT;
