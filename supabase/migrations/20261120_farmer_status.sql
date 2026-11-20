-- ============================================================================
-- Migration: 20261120_farmer_status.sql
-- Description: Adds account status to farmers table for administrator moderation
-- ============================================================================

ALTER TABLE public.farmers 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_farmers_status 
  ON public.farmers(status);
