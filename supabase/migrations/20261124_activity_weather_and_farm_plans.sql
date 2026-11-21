-- ============================================================================
-- Migration: 20261124_activity_weather_and_farm_plans.sql
-- Description:
--   1. Weather the farmer saw on the day of an activity (all three columns are optional).
--      Existing activity rows are NOT changed: the new columns are simply null for them.
--   2. farm_plans: one plan per farm per year, written by the farmer.
--   3. Composite indexes so the year-by-year queries stay fast with several years of data.
--   Safe to run more than once.
-- ============================================================================

-- 1. Weather on the activity record ------------------------------------------------
ALTER TABLE public.farm_activities
  ADD COLUMN IF NOT EXISTS weather_sky TEXT,
  ADD COLUMN IF NOT EXISTS rain_mm NUMERIC(5, 1),
  ADD COLUMN IF NOT EXISTS day_feel TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_activities_weather_sky_check') THEN
    ALTER TABLE public.farm_activities
      ADD CONSTRAINT farm_activities_weather_sky_check
      CHECK (weather_sky IS NULL OR weather_sky IN ('sunny', 'cloudy', 'rain', 'heavy_rain'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_activities_rain_mm_check') THEN
    ALTER TABLE public.farm_activities
      ADD CONSTRAINT farm_activities_rain_mm_check
      CHECK (rain_mm IS NULL OR (rain_mm >= 0 AND rain_mm <= 500));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_activities_day_feel_check') THEN
    ALTER TABLE public.farm_activities
      ADD CONSTRAINT farm_activities_day_feel_check
      CHECK (day_feel IS NULL OR day_feel IN ('cool', 'warm', 'hot'));
  END IF;
END $$;

COMMENT ON COLUMN public.farm_activities.weather_sky IS 'Sky on the day, chosen by the farmer: sunny, cloudy, rain, heavy_rain';
COMMENT ON COLUMN public.farm_activities.rain_mm IS 'Rain the farmer measured that day, 0 to 500 mm (optional)';
COMMENT ON COLUMN public.farm_activities.day_feel IS 'How the day felt, chosen by the farmer: cool, warm, hot';

-- 2. The farmer's plan for a year -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.farm_plans (
  id UUID PRIMARY KEY,                                   -- made on the phone (one per farm per year)
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  plan_year INTEGER NOT NULL CHECK (plan_year BETWEEN 2000 AND 2100),
  crop TEXT,                                             -- the farmer's own choice, free text
  planting_date DATE,
  change_note TEXT,                                      -- "Change from last year", the farmer's own words
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at TIMESTAMPTZ,                                -- tombstone: a deleted plan syncs as a delete
  UNIQUE (farm_id, plan_year)
);

ALTER TABLE public.farm_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow manage farm plans" ON public.farm_plans;
CREATE POLICY "Allow manage farm plans" ON public.farm_plans
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- 3. Indexes (only added when missing) ---------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_farm_activities_farm_date
  ON public.farm_activities(farm_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_harvest_batches_farm_date
  ON public.harvest_batches(farm_id, harvest_date);
CREATE INDEX IF NOT EXISTS idx_farm_plans_farm_year
  ON public.farm_plans(farm_id, plan_year);
