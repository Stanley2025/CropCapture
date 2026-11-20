-- Migration: Add farming_type (enterprise) to farms table and ensure clean real-data schema
-- Description: Supports enterprise categories ('crops', 'livestock', 'both') for registered farms

ALTER TABLE public.farms 
  ADD COLUMN IF NOT EXISTS farming_type TEXT DEFAULT 'crops';

COMMENT ON COLUMN public.farms.farming_type IS 'Enterprise category: crops, livestock, or both';
