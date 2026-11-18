-- AgriTrack Liberia Database Migration
-- PostgreSQL / Supabase Schema for Agricultural Records, Production & Quality Traceability

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS & TYPES
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'super_admin',
    'agricultural_admin',
    'farmer',
    'cooperative_manager',
    'extension_officer',
    'quality_inspector',
    'public_viewer'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE season_status AS ENUM ('planned', 'active', 'harvesting', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE harvest_status AS ENUM (
    'draft',
    'submitted',
    'pending_inspection',
    'under_inspection',
    'inspected',
    'approved',
    'rejected',
    'requires_reinspection'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE quality_grade AS ENUM ('grade_a', 'grade_b', 'grade_c', 'rejected', 'pending_review');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE sync_status_type AS ENUM ('saved_on_device', 'waiting_to_sync', 'synchronizing', 'synced', 'sync_failed', 'conflict');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES & ROLES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role user_role NOT NULL DEFAULT 'farmer',
  county TEXT,
  district TEXT,
  community TEXT,
  avatar_url TEXT,
  cooperative_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. COOPERATIVES
CREATE TABLE IF NOT EXISTS public.cooperatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  county TEXT NOT NULL,
  district TEXT,
  address TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. FARMERS
CREATE TABLE IF NOT EXISTS public.farmers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  farmer_id_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT,
  date_of_birth DATE,
  phone_number TEXT NOT NULL,
  email TEXT,
  county TEXT NOT NULL,
  district TEXT NOT NULL,
  community TEXT NOT NULL,
  cooperative_id UUID REFERENCES public.cooperatives(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. COOPERATIVE MEMBERS
CREATE TABLE IF NOT EXISTS public.cooperative_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (cooperative_id, farmer_id)
);

-- 7. FARMS
CREATE TABLE IF NOT EXISTS public.farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  county TEXT NOT NULL,
  district TEXT NOT NULL,
  community TEXT NOT NULL,
  size NUMERIC(10, 2) NOT NULL,
  size_unit TEXT NOT NULL DEFAULT 'acres',
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6),
  ownership_type TEXT DEFAULT 'owner',
  irrigation BOOLEAN DEFAULT FALSE,
  soil_type TEXT,
  photo_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. CROPS & VARIETIES
CREATE TABLE IF NOT EXISTS public.crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  default_unit TEXT NOT NULL DEFAULT 'kg',
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.crop_varieties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  maturity_days INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(crop_id, name)
);

-- 9. FARM SEASONS
CREATE TABLE IF NOT EXISTS public.farm_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE RESTRICT,
  crop_variety_id UUID REFERENCES public.crop_varieties(id) ON DELETE SET NULL,
  season_name TEXT NOT NULL,
  planting_date DATE NOT NULL,
  expected_harvest_date DATE,
  cultivated_area NUMERIC(10, 2) NOT NULL,
  seed_quantity NUMERIC(10, 2),
  status season_status NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. FARM ACTIVITIES
CREATE TABLE IF NOT EXISTS public.farm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  season_id UUID REFERENCES public.farm_seasons(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  quantity NUMERIC(10, 2),
  unit TEXT,
  cost NUMERIC(12, 2) DEFAULT 0,
  labor_count INTEGER DEFAULT 1,
  photo_url TEXT,
  recorded_by UUID REFERENCES public.profiles(id),
  sync_status sync_status_type DEFAULT 'synced',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. INPUT RECORDS
CREATE TABLE IF NOT EXISTS public.input_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  season_id UUID REFERENCES public.farm_seasons(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL,
  unit TEXT NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier TEXT,
  cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  season_id UUID REFERENCES public.farm_seasons(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. HARVEST BATCHES
CREATE TABLE IF NOT EXISTS public.harvest_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_reference TEXT UNIQUE NOT NULL,
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  season_id UUID REFERENCES public.farm_seasons(id) ON DELETE SET NULL,
  crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE RESTRICT,
  crop_variety_id UUID REFERENCES public.crop_varieties(id) ON DELETE SET NULL,
  harvest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity NUMERIC(12, 2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  storage_location TEXT,
  photo_url TEXT,
  observations TEXT,
  status harvest_status NOT NULL DEFAULT 'submitted',
  qr_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 14. HARVEST STATUS HISTORY
CREATE TABLE IF NOT EXISTS public.harvest_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_id UUID NOT NULL REFERENCES public.harvest_batches(id) ON DELETE CASCADE,
  status harvest_status NOT NULL,
  notes TEXT,
  changed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 15. QUALITY TEMPLATES & PARAMETERS
CREATE TABLE IF NOT EXISTS public.quality_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.quality_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.quality_templates(id) ON DELETE CASCADE,
  parameter_name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  data_type TEXT NOT NULL DEFAULT 'number', -- 'number', 'boolean', 'select', 'text'
  is_required BOOLEAN DEFAULT TRUE,
  min_value NUMERIC(10, 2),
  max_value NUMERIC(10, 2),
  target_value TEXT,
  weight NUMERIC(5, 2) DEFAULT 1.0,
  evaluation_rules JSONB DEFAULT '{}'::jsonb
);

-- 16. QUALITY INSPECTIONS
CREATE TABLE IF NOT EXISTS public.quality_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.harvest_batches(id) ON DELETE CASCADE,
  inspector_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  template_id UUID NOT NULL REFERENCES public.quality_templates(id) ON DELETE RESTRICT,
  inspection_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  final_grade quality_grade NOT NULL DEFAULT 'pending_review',
  decision_status TEXT NOT NULL DEFAULT 'pending', -- 'approved', 'rejected', 'requires_reinspection'
  observations TEXT,
  report_url TEXT,
  sync_status sync_status_type DEFAULT 'synced',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(batch_id)
);

CREATE TABLE IF NOT EXISTS public.inspection_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.quality_inspections(id) ON DELETE CASCADE,
  parameter_id UUID NOT NULL REFERENCES public.quality_parameters(id) ON DELETE CASCADE,
  measured_value TEXT NOT NULL,
  notes TEXT,
  passes BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.inspection_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.quality_inspections(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 17. QR PASSPORTS (TRACEABILITY)
CREATE TABLE IF NOT EXISTS public.qr_passports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.harvest_batches(id) ON DELETE CASCADE,
  qr_token TEXT UNIQUE NOT NULL,
  public_url TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ,
  is_revoked BOOLEAN DEFAULT FALSE
);

-- 18. EXTENSION ASSIGNMENTS & VISITS
CREATE TABLE IF NOT EXISTS public.extension_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  farm_id UUID REFERENCES public.farms(id) ON DELETE SET NULL,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.extension_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6),
  observations TEXT NOT NULL,
  pest_disease_reports TEXT,
  recommendations TEXT,
  follow_up_date DATE,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.extension_visits(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 19. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'harvest', 'inspection', 'visit', 'recommendation', 'system'
  related_entity_type TEXT,
  related_entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 20. AUDIT & SYNC LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 21. INDEXES FOR HIGH PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_farmers_profile ON public.farmers(profile_id);
CREATE INDEX IF NOT EXISTS idx_farms_farmer ON public.farms(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farm_seasons_farm ON public.farm_seasons(farm_id);
CREATE INDEX IF NOT EXISTS idx_farm_activities_farm ON public.farm_activities(farm_id);
CREATE INDEX IF NOT EXISTS idx_farm_activities_season ON public.farm_activities(season_id);
CREATE INDEX IF NOT EXISTS idx_harvest_batches_farmer ON public.harvest_batches(farmer_id);
CREATE INDEX IF NOT EXISTS idx_harvest_batches_batch_ref ON public.harvest_batches(batch_reference);
CREATE INDEX IF NOT EXISTS idx_harvest_batches_qr_token ON public.harvest_batches(qr_token);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_batch ON public.quality_inspections(batch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

-- 22. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperative_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.input_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harvest_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harvest_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_passports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Crops and Varieties are readable by everyone authenticated
CREATE POLICY "Crops are viewable by authenticated users" ON public.crops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Crop varieties are viewable by authenticated users" ON public.crop_varieties FOR SELECT TO authenticated USING (true);

-- Public QR verification can view approved harvest batches and passports
CREATE POLICY "Public QR passport access" ON public.qr_passports FOR SELECT TO anon, authenticated USING (is_revoked = false);
CREATE POLICY "Public batch traceability read" ON public.harvest_batches FOR SELECT TO anon, authenticated USING (status = 'approved');

-- Profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Farmers can manage their own farms
CREATE POLICY "Farmers can read own farmer profile" ON public.farmers FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'agricultural_admin', 'extension_officer')));

CREATE POLICY "Farmers can manage own farms" ON public.farms FOR ALL TO authenticated
  USING (farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'agricultural_admin', 'extension_officer')));

-- Activities, Inputs, Expenses
CREATE POLICY "Farmers can manage own activities" ON public.farm_activities FOR ALL TO authenticated
  USING (farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'agricultural_admin', 'extension_officer')));

CREATE POLICY "Farmers can manage own inputs" ON public.input_records FOR ALL TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid())));

CREATE POLICY "Farmers can manage own expenses" ON public.expenses FOR ALL TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid())));

-- Harvests: Farmers can create & read their harvests; inspectors & admins can read and update status
CREATE POLICY "Farmers can read and create harvests" ON public.harvest_batches FOR ALL TO authenticated
  USING (
    farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('quality_inspector', 'super_admin', 'agricultural_admin', 'extension_officer'))
  );

-- Quality Inspections: Quality Inspectors and Admins can create and edit inspections
CREATE POLICY "Inspectors can create and manage inspections" ON public.quality_inspections FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('quality_inspector', 'super_admin', 'agricultural_admin'))
    OR batch_id IN (SELECT id FROM public.harvest_batches WHERE farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid()))
  );
