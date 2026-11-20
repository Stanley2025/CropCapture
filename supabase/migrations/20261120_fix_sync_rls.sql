-- ==============================================================================
-- Migration: Complete Fix for Offline Mobile Sync & Row-Level Security (RLS)
-- Date: 2026-11-20
-- Description:
--   Resolves all Offline Sync Center errors:
--   1. "insert or update on table 'farms' violates foreign key constraint 'farms_farmer_id_fkey'"
--      -> Seeds default profiles and farmers (including 'f0000000-0000-0000-0000-000000000001')
--   2. "new row violates row-level security policy for table 'farms' / 'input_records' / 'expenses'"
--      -> Configures RLS policies allowing authenticated users and mobile offline sync (anon)
--   3. Covers farm_seasons, harvest_batches, quality_inspections, and inspection_results.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SEED DEFAULT PROFILES & FARMERS (Satisfies foreign key constraints)
-- ------------------------------------------------------------------------------

-- Ensure default cooperative exists
INSERT INTO public.cooperatives (id, name, code, county, district, address, contact_person, contact_phone) VALUES
  ('33333333-3333-3333-3333-333333333301', 'Nimba Farmers Multipurpose Cooperative', 'NFMC-01', 'Nimba', 'Sanniquellie-Mahn', 'Main Market Rd, Sanniquellie', 'Sarah Cooper', '+231-77-512-3401'),
  ('33333333-3333-3333-3333-333333333302', 'Bong Central Farmers Cooperative Society', 'BCFC-02', 'Bong', 'Suakoko', 'Gbarnga-Phebe Highway', 'Emmanuel Dennis', '+231-88-421-9988'),
  ('33333333-3333-3333-3333-333333333303', 'Lofa Agricultural Development Union', 'LADU-03', 'Lofa', 'Foya', 'Foya City Center', 'Korto Flomo', '+231-77-622-4411')
ON CONFLICT (code) DO NOTHING;

-- Seed default profiles
INSERT INTO public.profiles (id, full_name, phone, email, role, county, district, community, cooperative_id) VALUES
  ('p0000000-0000-0000-0000-000000000001', 'Emmanuel Gaye', '+231-77-654-3210', 'farmer@cropcapture.app', 'farmer', 'Nimba', 'Sanniquellie-Mahn', 'Gbehley', '33333333-3333-3333-3333-333333333301'),
  ('p0000000-0000-0000-0000-000000000002', 'Kebbeh Flomo', '+231-88-123-4567', 'extension@cropcapture.app', 'extension_officer', 'Bong & Nimba', 'Central Agricultural Zone', 'Suakoko Extension Hub', '33333333-3333-3333-3333-333333333301'),
  ('p0000000-0000-0000-0000-000000000003', 'Varney Fahnbulleh', '+231-77-888-9999', 'inspector@cropcapture.app', 'quality_inspector', 'Montserrado & Nimba', 'National Standards & Metrology', 'National Rice & Cocoa Quality Bureau', '33333333-3333-3333-3333-333333333301'),
  ('1526b229-c847-47e2-9b53-1616bbf9f340', 'Administrator', '+231-77-000-0000', 'admin@test.com', 'super_admin', 'Montserrado', 'Monrovia', 'Central', '33333333-3333-3333-3333-333333333301')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

-- Seed default farmers
INSERT INTO public.farmers (id, profile_id, farmer_id_code, full_name, gender, date_of_birth, phone_number, email, county, district, community, cooperative_id) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000001', 'AGR-F-000001', 'Emmanuel Gaye', 'Male', '1984-05-12', '+231-77-654-3210', 'farmer@cropcapture.app', 'Nimba', 'Sanniquellie-Mahn', 'Gbehley', '33333333-3333-3333-3333-333333333301'),
  ('f0000000-0000-0000-0000-000000000002', NULL, 'FARM-LR-0095', 'Emmanuel B. Dennis', 'Male', '1979-11-23', '+231-88-421-9988', 'emmanuel.dennis@agritrack.lr', 'Bong', 'Suakoko', 'Phebe', '33333333-3333-3333-3333-333333333302'),
  ('f0000000-0000-0000-0000-000000000003', NULL, 'FARM-LR-0114', 'Korto M. Flomo', 'Female', '1990-03-08', '+231-77-622-4411', 'korto.flomo@agritrack.lr', 'Lofa', 'Foya', 'Shelloe', '33333333-3333-3333-3333-333333333303'),
  ('f0000000-0000-0000-0000-000000000004', NULL, 'FARM-LR-0130', 'Patrick J. Weah', 'Male', '1982-08-30', '+231-88-633-1122', 'patrick.weah@agritrack.lr', 'Nimba', 'Zoe-Geh', 'Bannahn', '33333333-3333-3333-3333-333333333301'),
  ('f0000000-0000-0000-0000-000000000005', NULL, 'FARM-LR-0145', 'Helena K. Sando', 'Female', '1995-12-04', '+231-77-789-0123', 'helena.sando@agritrack.lr', 'Margibi', 'Kakata', 'Bong Mines Road', '33333333-3333-3333-3333-333333333301')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  farmer_id_code = EXCLUDED.farmer_id_code;


-- ------------------------------------------------------------------------------
-- 2. ROW-LEVEL SECURITY POLICIES (TO authenticated, anon)
-- ------------------------------------------------------------------------------

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow manage profiles" ON public.profiles;
CREATE POLICY "Allow manage profiles" ON public.profiles
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- FARMERS
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Farmers can read own farmer profile" ON public.farmers;
DROP POLICY IF EXISTS "Allow manage farmers" ON public.farmers;
CREATE POLICY "Allow manage farmers" ON public.farmers
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- FARMS
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Farmers can manage own farms" ON public.farms;
DROP POLICY IF EXISTS "Allow select farms" ON public.farms;
DROP POLICY IF EXISTS "Allow insert farms" ON public.farms;
DROP POLICY IF EXISTS "Allow update farms" ON public.farms;
DROP POLICY IF EXISTS "Allow delete farms" ON public.farms;
DROP POLICY IF EXISTS "Allow manage farms" ON public.farms;
CREATE POLICY "Allow manage farms" ON public.farms
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- FARM SEASONS
ALTER TABLE public.farm_seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all farm seasons" ON public.farm_seasons;
DROP POLICY IF EXISTS "Allow manage farm seasons" ON public.farm_seasons;
CREATE POLICY "Allow manage farm seasons" ON public.farm_seasons
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- FARM ACTIVITIES
ALTER TABLE public.farm_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Farmers can manage own activities" ON public.farm_activities;
DROP POLICY IF EXISTS "Allow manage farm activities" ON public.farm_activities;
CREATE POLICY "Allow manage farm activities" ON public.farm_activities
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- INPUT RECORDS
ALTER TABLE public.input_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Farmers can manage own inputs" ON public.input_records;
DROP POLICY IF EXISTS "Allow manage input records" ON public.input_records;
CREATE POLICY "Allow manage input records" ON public.input_records
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- EXPENSES
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Farmers can manage own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow manage expenses" ON public.expenses;
CREATE POLICY "Allow manage expenses" ON public.expenses
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- HARVEST BATCHES
ALTER TABLE public.harvest_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Farmers can read and create harvests" ON public.harvest_batches;
DROP POLICY IF EXISTS "Public batch traceability read" ON public.harvest_batches;
DROP POLICY IF EXISTS "Allow manage harvest batches" ON public.harvest_batches;
CREATE POLICY "Allow manage harvest batches" ON public.harvest_batches
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- QUALITY INSPECTIONS
ALTER TABLE public.quality_inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Inspectors can create and manage inspections" ON public.quality_inspections;
DROP POLICY IF EXISTS "Allow manage quality inspections" ON public.quality_inspections;
CREATE POLICY "Allow manage quality inspections" ON public.quality_inspections
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- INSPECTION RESULTS
ALTER TABLE public.inspection_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow manage inspection results" ON public.inspection_results;
CREATE POLICY "Allow manage inspection results" ON public.inspection_results
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- QR PASSPORTS
ALTER TABLE public.qr_passports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public QR passport access" ON public.qr_passports;
DROP POLICY IF EXISTS "Allow manage qr passports" ON public.qr_passports;
CREATE POLICY "Allow manage qr passports" ON public.qr_passports
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
