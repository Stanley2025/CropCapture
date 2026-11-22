-- ============================================================================
-- Migration: 20261122_season_record_and_weather.sql
-- Description: Fills the gaps in the season record (field, planting, labour, problems,
--              where the harvest went, sales, storage, season-end reflection) and records
--              weather per season. Only what the existing tables lack is added:
--                farm_seasons       already has crop, variety, area, seed quantity
--                farm_activities    already has labour count and costs
--                harvest_batches    already has date, quantity, unit, value
--                expenses / input_records already have costs
--              Safe to run more than once (IF NOT EXISTS / DROP POLICY IF EXISTS).
--
--   Weather is recorded quietly per season: a SUMMARY row per season (synced to phones) and
--   DAILY rows (server side only, never synced down). There is no forecast and no alert.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Harvest quantity in kg (local units such as cups and tins are converted on the phone;
-- the quantity as the farmer said it stays in quantity / unit).
-- ---------------------------------------------------------------------------
ALTER TABLE public.harvest_batches
  ADD COLUMN IF NOT EXISTS quantity_kg NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS kg_per_unit NUMERIC(10, 4);

-- ---------------------------------------------------------------------------
-- 1. One row per season: field, planting, storage, home-food price, reflection
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.season_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL UNIQUE REFERENCES public.farm_seasons(id) ON DELETE CASCADE,
  -- Field
  field_type TEXT CHECK (field_type IN ('upland', 'lowland_swamp')),
  previous_crop_id TEXT,
  previous_crop_name TEXT,
  fallow_months INTEGER CHECK (fallow_months >= 0),
  land_preparation JSONB NOT NULL DEFAULT '[]'::jsonb, -- brushed, felled, burned, ploughed
  variety_label TEXT,                                  -- e.g. "Saved seed" when not in the variety list
  -- Planting (the quantity as the farmer said it, the factor used, and the kg)
  seed_source TEXT CHECK (seed_source IN ('saved', 'bought', 'shared', 'project')),
  seed_qty_local NUMERIC(12, 2),
  seed_unit_local TEXT,
  seed_kg_per_unit NUMERIC(10, 4),
  seed_kg NUMERIC(12, 2),
  intercropped BOOLEAN,
  -- Storage
  storage_method TEXT CHECK (storage_method IN ('bags', 'barn', 'drum', 'open', 'other')),
  storage_months NUMERIC(6, 1) CHECK (storage_months > 0),
  storage_loss_kg NUMERIC(12, 2) CHECK (storage_loss_kg >= 0),
  -- The farmer's own price estimate for food kept at home (kept apart from cash profit)
  home_price_per_kg NUMERIC(12, 2) CHECK (home_price_per_kg >= 0),
  home_price_currency TEXT CHECK (home_price_currency IN ('LRD', 'USD')),
  -- Season-end reflection: "What would you do differently?"
  reflection_choice TEXT CHECK (reflection_choice IN ('plant_earlier', 'weed_more', 'more_seed', 'change_variety', 'other')),
  reflection_audio_path TEXT,                          -- object path in the season-audio bucket
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 2. Labour: family, hired, or communal group (kuu); days and cost
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.season_labor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.farm_seasons(id) ON DELETE CASCADE,
  labor_type TEXT NOT NULL CHECK (labor_type IN ('family', 'hired', 'communal')),
  days NUMERIC(8, 2) NOT NULL CHECK (days > 0),
  cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('LRD', 'USD')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 3. Problems, dated, with small / medium / big severity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.season_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.farm_seasons(id) ON DELETE CASCADE,
  problem_type TEXT NOT NULL CHECK (problem_type IN
    ('birds', 'rats', 'insects', 'disease', 'weeds', 'flood', 'drought', 'windstorm', 'fire', 'animals', 'theft')),
  severity TEXT NOT NULL DEFAULT 'small' CHECK (severity IN ('small', 'medium', 'big')),
  problem_date DATE NOT NULL DEFAULT CURRENT_DATE,
  detail TEXT,                                         -- e.g. "Cassava mosaic", "Black pod"
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 4. Where the harvest went: sold / eaten at home / kept as seed / lost.
--    A "sold" row also carries the sale (price per unit, month, buyer or market, transport).
--    Currency is stored per row.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.season_disposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.farm_seasons(id) ON DELETE CASCADE,
  harvest_id UUID REFERENCES public.harvest_batches(id) ON DELETE SET NULL,
  destination TEXT NOT NULL CHECK (destination IN ('sold', 'eaten', 'seed', 'lost')),
  qty_local NUMERIC(12, 2) NOT NULL CHECK (qty_local > 0),
  unit_local TEXT NOT NULL,
  kg_per_unit NUMERIC(10, 4),
  qty_kg NUMERIC(12, 2),
  loss_reason TEXT CHECK (loss_reason IN ('rot', 'rats', 'wet', 'other')),
  price_per_unit NUMERIC(12, 2) CHECK (price_per_unit >= 0),
  sale_currency TEXT CHECK (sale_currency IN ('LRD', 'USD')),
  sold_month TEXT CHECK (sold_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  buyer_market TEXT,
  transport_cost NUMERIC(12, 2) CHECK (transport_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 5. Weather summary per season (synced to phones). No forecast, no alerts.
--    Window: 30 days before planting to season end. Thresholds live in
--    src/shared/seasonWeather.js (WEATHER_THRESHOLDS).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.season_weather (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL UNIQUE REFERENCES public.farm_seasons(id) ON DELETE CASCADE,
  planting_date DATE NOT NULL,
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  data_through DATE NOT NULL,                          -- the archive trails real time by a few days
  running BOOLEAN NOT NULL DEFAULT FALSE,              -- season still running
  partial BOOLEAN NOT NULL DEFAULT FALSE,
  days_expected INTEGER NOT NULL,
  days_with_data INTEGER NOT NULL,
  total_rain_mm NUMERIC(8, 1) NOT NULL,
  rainy_days INTEGER NOT NULL,
  longest_dry_spell_days INTEGER NOT NULL,
  avg_tmax_c NUMERIC(4, 1),
  avg_tmin_c NUMERIC(4, 1),
  rain_first_30d_mm NUMERIC(8, 1),
  first30_complete BOOLEAN NOT NULL DEFAULT FALSE,
  longest_dry_spell_first_60d_days INTEGER,
  first60_complete BOOLEAN NOT NULL DEFAULT FALSE,
  rains_start_date DATE,
  rains_start_days_from_planting INTEGER,
  heavy_rain_days INTEGER NOT NULL DEFAULT 0,
  monthly JSONB NOT NULL DEFAULT '{}'::jsonb,          -- {"2026-05": {"rain_mm": 74, "rainy_days": 3, "days": 31}}
  latitude NUMERIC(6, 2),                              -- rounded to 2 decimals (about 1 km)
  longitude NUMERIC(6, 2),
  source TEXT NOT NULL DEFAULT 'open-meteo-archive',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at TIMESTAMPTZ
);

-- Daily rows stay on the server (phones only receive the summary above).
CREATE TABLE IF NOT EXISTS public.season_weather_daily (
  season_id UUID NOT NULL REFERENCES public.farm_seasons(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  rain_mm NUMERIC(6, 1),
  tmax_c NUMERIC(4, 1),
  tmin_c NUMERIC(4, 1),
  PRIMARY KEY (season_id, date)
);

CREATE INDEX IF NOT EXISTS idx_season_labor_season ON public.season_labor(season_id);
CREATE INDEX IF NOT EXISTS idx_season_problems_season ON public.season_problems(season_id);
CREATE INDEX IF NOT EXISTS idx_season_disposals_season ON public.season_disposals(season_id);

-- ---------------------------------------------------------------------------
-- Row level security: same open policy the other synced tables use (see
-- 20261120_fix_sync_rls.sql). Tighten before production.
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_labor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_disposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_weather ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_weather_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow manage season details" ON public.season_details;
CREATE POLICY "Allow manage season details" ON public.season_details FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow manage season labor" ON public.season_labor;
CREATE POLICY "Allow manage season labor" ON public.season_labor FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow manage season problems" ON public.season_problems;
CREATE POLICY "Allow manage season problems" ON public.season_problems FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow manage season disposals" ON public.season_disposals;
CREATE POLICY "Allow manage season disposals" ON public.season_disposals FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow manage season weather" ON public.season_weather;
CREATE POLICY "Allow manage season weather" ON public.season_weather FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow manage season weather daily" ON public.season_weather_daily;
CREATE POLICY "Allow manage season weather daily" ON public.season_weather_daily FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Private bucket for the audio of the season-end reflection
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('season-audio', 'season-audio', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow manage season audio" ON storage.objects;
CREATE POLICY "Allow manage season audio" ON storage.objects
  FOR ALL TO authenticated, anon
  USING (bucket_id = 'season-audio') WITH CHECK (bucket_id = 'season-audio');
