-- Migration: 20261120_farm_livestock_details.sql
-- Description: Add livestock_details JSONB column to public.farms to support livestock animal types, production purposes, management, housing, grazing, water sources, and feeding systems.

ALTER TABLE public.farms 
  ADD COLUMN IF NOT EXISTS livestock_details JSONB DEFAULT NULL;

COMMENT ON COLUMN public.farms.livestock_details IS 'Structured livestock information including animal_type (Goats, Pigs, Sheep, Chickens, Cow), breed, head_count, production_purpose (Meat, Egg, Milk, Breeding), management_system (Free-range, Semi-intensive, Intensive), housing, grazing, water_source, and feeding_system.';
