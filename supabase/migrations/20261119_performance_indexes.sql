-- ============================================================================
-- AgriTrack / CropCapture High-Performance Database Indexes
-- Migration: 20261119_performance_indexes.sql
-- Optimizes queries for Admin Dashboard, Operational Lists, Analytics & RLS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES & RLS PERFORMANCE INDEXES
-- Critical: Every RLS policy evaluates `profiles.id = auth.uid() AND role IN (...)`
-- A composite index on (id, role) turns sequential scans during RLS checks into index-only scans.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_id_role 
  ON public.profiles(id, role);

CREATE INDEX IF NOT EXISTS idx_profiles_role 
  ON public.profiles(role);

CREATE INDEX IF NOT EXISTS idx_profiles_email 
  ON public.profiles(email);

CREATE INDEX IF NOT EXISTS idx_profiles_created_at_desc 
  ON public.profiles(created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. FARMERS TABLE INDEXES
-- Optimizes sorting by registration date, county filtering, and cooperative joins
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_farmers_created_at_desc 
  ON public.farmers(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_farmers_coop_created 
  ON public.farmers(cooperative_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_farmers_county_created 
  ON public.farmers(county, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_farmers_id_code 
  ON public.farmers(farmer_id_code);

CREATE INDEX IF NOT EXISTS idx_farmers_phone 
  ON public.farmers(phone_number);

-- ----------------------------------------------------------------------------
-- 3. FARMS TABLE INDEXES
-- Optimizes acreage aggregation, geographic mapping, and farmer lookups
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_farms_created_at_desc 
  ON public.farms(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_farms_farmer_created 
  ON public.farms(farmer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_farms_county 
  ON public.farms(county);

CREATE INDEX IF NOT EXISTS idx_farms_size 
  ON public.farms(size);

-- ----------------------------------------------------------------------------
-- 4. HARVEST BATCHES TABLE INDEXES
-- Optimizes status filtering, date range timeline, crop volume sums, and batch lookups
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_harvest_batches_created_at_desc 
  ON public.harvest_batches(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_harvest_batches_status_created 
  ON public.harvest_batches(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_harvest_batches_crop_qty 
  ON public.harvest_batches(crop_id, quantity);

CREATE INDEX IF NOT EXISTS idx_harvest_batches_harvest_date 
  ON public.harvest_batches(harvest_date DESC);

CREATE INDEX IF NOT EXISTS idx_harvest_batches_farm_created 
  ON public.harvest_batches(farm_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_harvest_batches_season 
  ON public.harvest_batches(season_id);

CREATE INDEX IF NOT EXISTS idx_harvest_batches_crop_status 
  ON public.harvest_batches(crop_id, status);

-- ----------------------------------------------------------------------------
-- 5. QUALITY INSPECTIONS TABLE INDEXES
-- Optimizes quality dashboard donut chart, pending inspection lists, and inspector feeds
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_quality_inspections_created_at_desc 
  ON public.quality_inspections(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quality_inspections_decision_status 
  ON public.quality_inspections(decision_status);

CREATE INDEX IF NOT EXISTS idx_quality_inspections_final_grade 
  ON public.quality_inspections(final_grade);

CREATE INDEX IF NOT EXISTS idx_quality_inspections_batch_decision 
  ON public.quality_inspections(batch_id, decision_status);

CREATE INDEX IF NOT EXISTS idx_quality_inspections_inspector_date 
  ON public.quality_inspections(inspector_id, inspection_date DESC);

-- ----------------------------------------------------------------------------
-- 6. COOPERATIVES TABLE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cooperatives_created_at_desc 
  ON public.cooperatives(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cooperatives_name 
  ON public.cooperatives(name);

CREATE INDEX IF NOT EXISTS idx_cooperatives_county 
  ON public.cooperatives(county);

-- ----------------------------------------------------------------------------
-- 7. FARM SEASONS & ACTIVITIES INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_farm_seasons_created_at_desc 
  ON public.farm_seasons(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_farm_seasons_status 
  ON public.farm_seasons(status);

CREATE INDEX IF NOT EXISTS idx_farm_seasons_crop_status 
  ON public.farm_seasons(crop_id, status);

CREATE INDEX IF NOT EXISTS idx_farm_activities_activity_date_desc 
  ON public.farm_activities(activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_farm_activities_farmer_date 
  ON public.farm_activities(farmer_id, activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_farm_activities_type 
  ON public.farm_activities(activity_type);

-- ----------------------------------------------------------------------------
-- 8. AUDIT LOGS & NOTIFICATIONS INDEXES
-- Prevents audit log queries from stalling dashboard or security pages
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc 
  ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created 
  ON public.audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity 
  ON public.audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read 
  ON public.notifications(user_id, is_read);

-- ----------------------------------------------------------------------------
-- 9. INPUTS & EXPENSES INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_input_records_farm_date 
  ON public.input_records(farm_id, purchase_date DESC);

CREATE INDEX IF NOT EXISTS idx_input_records_created_at_desc 
  ON public.input_records(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_farm_date 
  ON public.expenses(farm_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_created_at_desc 
  ON public.expenses(created_at DESC);

-- ----------------------------------------------------------------------------
-- 10. EXTENSION ASSIGNMENTS & VISITS INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_extension_visits_officer_date 
  ON public.extension_visits(officer_id, visit_date DESC);

CREATE INDEX IF NOT EXISTS idx_extension_visits_farmer 
  ON public.extension_visits(farmer_id);

CREATE INDEX IF NOT EXISTS idx_extension_assignments_officer 
  ON public.extension_assignments(officer_id);

-- Analyze tables to immediately update PostgreSQL query planner statistics
ANALYZE public.profiles;
ANALYZE public.farmers;
ANALYZE public.farms;
ANALYZE public.harvest_batches;
ANALYZE public.quality_inspections;
ANALYZE public.cooperatives;
ANALYZE public.farm_seasons;
ANALYZE public.farm_activities;
ANALYZE public.audit_logs;
ANALYZE public.notifications;
