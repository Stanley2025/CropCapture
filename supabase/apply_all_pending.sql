-- ============================================================================
-- ONE-PASTE SCRIPT: everything the mobile app, the USSD channel and the admin dashboard
-- need that the live database may still be missing.
--
-- Run it ONCE in the Supabase SQL editor (Dashboard -> SQL Editor -> paste -> Run).
-- It is safe to run again: every statement is idempotent (IF NOT EXISTS / ON CONFLICT).
-- You do NOT need to run the individual files it is made from.
--
-- Made from, in order:
--   (added here)                                  farms.registration_date
--   20261120_farm_enterprise_and_clean_data.sql   farms.farming_type
--   20261120_farm_livestock_details.sql           farms.livestock_details
--   20261120_counties_and_districts.sql           counties + districts, farms.county_id / district_id
--   20261120_farmer_status.sql                    farmers.status
--   20261121_record_source.sql                    source column (app / ussd / seed)
--   20261123_app_sync_columns.sql                 columns the app syncs: expenses, harvests, seasons ...
--   20261124_activity_weather_and_farm_plans.sql  weather on activities, farm_plans table, year indexes
-- (20261122_season_record_and_weather.sql is separate; run it too if you have not already.)
-- ============================================================================

ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS registration_date DATE;


-- ---------------------------------------------------------------------------
-- 20261120_farm_enterprise_and_clean_data.sql
-- ---------------------------------------------------------------------------
-- Migration: Add farming_type (enterprise) to farms table and ensure clean real-data schema
-- Description: Supports enterprise categories ('crops', 'livestock', 'both') for registered farms

ALTER TABLE public.farms 
  ADD COLUMN IF NOT EXISTS farming_type TEXT DEFAULT 'crops';

COMMENT ON COLUMN public.farms.farming_type IS 'Enterprise category: crops, livestock, or both';


-- ---------------------------------------------------------------------------
-- 20261120_farm_livestock_details.sql
-- ---------------------------------------------------------------------------
-- Migration: 20261120_farm_livestock_details.sql
-- Description: Add livestock_details JSONB column to public.farms to support livestock animal types, production purposes, management, housing, grazing, water sources, and feeding systems.

ALTER TABLE public.farms 
  ADD COLUMN IF NOT EXISTS livestock_details JSONB DEFAULT NULL;

COMMENT ON COLUMN public.farms.livestock_details IS 'Structured livestock information including animal_type (Goats, Pigs, Sheep, Chickens, Cow), breed, head_count, production_purpose (Meat, Egg, Milk, Breeding), management_system (Free-range, Semi-intensive, Intensive), housing, grazing, water_source, and feeding_system.';


-- ---------------------------------------------------------------------------
-- 20261120_counties_and_districts.sql
-- ---------------------------------------------------------------------------
-- Migration: 20261120_counties_and_districts.sql
-- Description: Create counties and districts lookup tables, add foreign keys to farms, seed data and backfill existing farms.

-- 1. COUNTIES TABLE
CREATE TABLE IF NOT EXISTS public.counties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. DISTRICTS TABLE
CREATE TABLE IF NOT EXISTS public.districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county_id UUID NOT NULL REFERENCES public.counties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (county_id, name)
);

-- 3. ADD FOREIGN KEYS TO FARMS
ALTER TABLE public.farms 
  ADD COLUMN IF NOT EXISTS county_id UUID REFERENCES public.counties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL;

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_counties_name ON public.counties(name);
CREATE INDEX IF NOT EXISTS idx_districts_county ON public.districts(county_id);
CREATE INDEX IF NOT EXISTS idx_districts_name ON public.districts(name);
CREATE INDEX IF NOT EXISTS idx_farms_county_id ON public.farms(county_id);
CREATE INDEX IF NOT EXISTS idx_farms_district_id ON public.farms(district_id);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.counties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'counties' AND policyname = 'Public and authenticated can read counties'
  ) THEN
    CREATE POLICY "Public and authenticated can read counties"
      ON public.counties FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'districts' AND policyname = 'Public and authenticated can read districts'
  ) THEN
    CREATE POLICY "Public and authenticated can read districts"
      ON public.districts FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- 6. SEED COUNTIES
INSERT INTO public.counties (id, name, code) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Bomi', 'BM'),
  ('c0000000-0000-0000-0000-000000000002', 'Bong', 'BG'),
  ('c0000000-0000-0000-0000-000000000003', 'Gbarpolu', 'GP'),
  ('c0000000-0000-0000-0000-000000000004', 'Grand Bassa', 'GB'),
  ('c0000000-0000-0000-0000-000000000005', 'Grand Cape Mount', 'CM'),
  ('c0000000-0000-0000-0000-000000000006', 'Grand Gedeh', 'GG'),
  ('c0000000-0000-0000-0000-000000000007', 'Grand Kru', 'GK'),
  ('c0000000-0000-0000-0000-000000000008', 'Lofa', 'LF'),
  ('c0000000-0000-0000-0000-000000000009', 'Margibi', 'MG'),
  ('c0000000-0000-0000-0000-000000000010', 'Maryland', 'MY'),
  ('c0000000-0000-0000-0000-000000000011', 'Montserrado', 'MO'),
  ('c0000000-0000-0000-0000-000000000012', 'Nimba', 'NM'),
  ('c0000000-0000-0000-0000-000000000013', 'River Gee', 'RG'),
  ('c0000000-0000-0000-0000-000000000014', 'Rivercess', 'RC'),
  ('c0000000-0000-0000-0000-000000000015', 'Sinoe', 'SI')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;

-- 7. SEED DISTRICTS
INSERT INTO public.districts (id, county_id, name) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Dowein'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Klay'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Senjeh'),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'Suehn Mecca'),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'Tehr'),
  ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 'Boinsen'),
  ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000002', 'Fuamah'),
  ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000002', 'Jorquelleh'),
  ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000002', 'Kokoyah'),
  ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000002', 'Kpaai'),
  ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000002', 'Panta-Kpa'),
  ('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000002', 'Salala'),
  ('d0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000002', 'Sanayea'),
  ('d0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000002', 'Suakoko'),
  ('d0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000002', 'Tukpahblee'),
  ('d0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000002', 'Yeallequelleh'),
  ('d0000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000002', 'Zota'),
  ('d0000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000003', 'Belleh'),
  ('d0000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000003', 'Bopolu'),
  ('d0000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000003', 'Bokomu'),
  ('d0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000003', 'Gbarma'),
  ('d0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000003', 'Kongba'),
  ('d0000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-000000000004', 'Commonwealth'),
  ('d0000000-0000-0000-0000-000000000024', 'c0000000-0000-0000-0000-000000000004', 'District #1'),
  ('d0000000-0000-0000-0000-000000000025', 'c0000000-0000-0000-0000-000000000004', 'District #2'),
  ('d0000000-0000-0000-0000-000000000026', 'c0000000-0000-0000-0000-000000000004', 'District #3'),
  ('d0000000-0000-0000-0000-000000000027', 'c0000000-0000-0000-0000-000000000004', 'District #4'),
  ('d0000000-0000-0000-0000-000000000028', 'c0000000-0000-0000-0000-000000000004', 'Nekreen'),
  ('d0000000-0000-0000-0000-000000000029', 'c0000000-0000-0000-0000-000000000004', 'St. John River'),
  ('d0000000-0000-0000-0000-000000000030', 'c0000000-0000-0000-0000-000000000005', 'Commonwealth'),
  ('d0000000-0000-0000-0000-000000000031', 'c0000000-0000-0000-0000-000000000005', 'Garwula'),
  ('d0000000-0000-0000-0000-000000000032', 'c0000000-0000-0000-0000-000000000005', 'Gola Konneh'),
  ('d0000000-0000-0000-0000-000000000033', 'c0000000-0000-0000-0000-000000000005', 'Porkpa'),
  ('d0000000-0000-0000-0000-000000000034', 'c0000000-0000-0000-0000-000000000005', 'Tewor'),
  ('d0000000-0000-0000-0000-000000000035', 'c0000000-0000-0000-0000-000000000006', 'Gbarzon'),
  ('d0000000-0000-0000-0000-000000000036', 'c0000000-0000-0000-0000-000000000006', 'Konobo'),
  ('d0000000-0000-0000-0000-000000000037', 'c0000000-0000-0000-0000-000000000006', 'Tchien'),
  ('d0000000-0000-0000-0000-000000000038', 'c0000000-0000-0000-0000-000000000007', 'Barclayville'),
  ('d0000000-0000-0000-0000-000000000039', 'c0000000-0000-0000-0000-000000000007', 'Bleebo'),
  ('d0000000-0000-0000-0000-000000000040', 'c0000000-0000-0000-0000-000000000007', 'Bolloh'),
  ('d0000000-0000-0000-0000-000000000041', 'c0000000-0000-0000-0000-000000000007', 'Buah'),
  ('d0000000-0000-0000-0000-000000000042', 'c0000000-0000-0000-0000-000000000007', 'Dorbor'),
  ('d0000000-0000-0000-0000-000000000043', 'c0000000-0000-0000-0000-000000000007', 'Dweh'),
  ('d0000000-0000-0000-0000-000000000044', 'c0000000-0000-0000-0000-000000000007', 'Felo-Jekwi'),
  ('d0000000-0000-0000-0000-000000000045', 'c0000000-0000-0000-0000-000000000007', 'Fenetoe'),
  ('d0000000-0000-0000-0000-000000000046', 'c0000000-0000-0000-0000-000000000007', 'Forpoh'),
  ('d0000000-0000-0000-0000-000000000047', 'c0000000-0000-0000-0000-000000000007', 'Garraway'),
  ('d0000000-0000-0000-0000-000000000048', 'c0000000-0000-0000-0000-000000000007', 'Gee'),
  ('d0000000-0000-0000-0000-000000000049', 'c0000000-0000-0000-0000-000000000007', 'Grand Cess Wedabo'),
  ('d0000000-0000-0000-0000-000000000050', 'c0000000-0000-0000-0000-000000000007', 'Upper Jloh'),
  ('d0000000-0000-0000-0000-000000000051', 'c0000000-0000-0000-0000-000000000007', 'Lower Jloh'),
  ('d0000000-0000-0000-0000-000000000052', 'c0000000-0000-0000-0000-000000000007', 'Kpi'),
  ('d0000000-0000-0000-0000-000000000053', 'c0000000-0000-0000-0000-000000000007', 'Nrokwia-Wesldow'),
  ('d0000000-0000-0000-0000-000000000054', 'c0000000-0000-0000-0000-000000000007', 'Penicess'),
  ('d0000000-0000-0000-0000-000000000055', 'c0000000-0000-0000-0000-000000000007', 'Trenbo'),
  ('d0000000-0000-0000-0000-000000000056', 'c0000000-0000-0000-0000-000000000007', 'Wlogba'),
  ('d0000000-0000-0000-0000-000000000057', 'c0000000-0000-0000-0000-000000000008', 'Foya'),
  ('d0000000-0000-0000-0000-000000000058', 'c0000000-0000-0000-0000-000000000008', 'Kolahun'),
  ('d0000000-0000-0000-0000-000000000059', 'c0000000-0000-0000-0000-000000000008', 'Salayea'),
  ('d0000000-0000-0000-0000-000000000060', 'c0000000-0000-0000-0000-000000000008', 'Vahun'),
  ('d0000000-0000-0000-0000-000000000061', 'c0000000-0000-0000-0000-000000000008', 'Voinjama'),
  ('d0000000-0000-0000-0000-000000000062', 'c0000000-0000-0000-0000-000000000008', 'Quardu Gboni'),
  ('d0000000-0000-0000-0000-000000000063', 'c0000000-0000-0000-0000-000000000008', 'Zorzor'),
  ('d0000000-0000-0000-0000-000000000064', 'c0000000-0000-0000-0000-000000000009', 'Firestone'),
  ('d0000000-0000-0000-0000-000000000065', 'c0000000-0000-0000-0000-000000000009', 'Gibi'),
  ('d0000000-0000-0000-0000-000000000066', 'c0000000-0000-0000-0000-000000000009', 'Kakata'),
  ('d0000000-0000-0000-0000-000000000067', 'c0000000-0000-0000-0000-000000000009', 'Mambah-Kaba'),
  ('d0000000-0000-0000-0000-000000000068', 'c0000000-0000-0000-0000-000000000010', 'Barrobo'),
  ('d0000000-0000-0000-0000-000000000069', 'c0000000-0000-0000-0000-000000000010', 'Pleebo/Sodeken'),
  ('d0000000-0000-0000-0000-000000000070', 'c0000000-0000-0000-0000-000000000011', 'Careysburg'),
  ('d0000000-0000-0000-0000-000000000071', 'c0000000-0000-0000-0000-000000000011', 'Commonwealth'),
  ('d0000000-0000-0000-0000-000000000072', 'c0000000-0000-0000-0000-000000000011', 'Greater Monrovia'),
  ('d0000000-0000-0000-0000-000000000073', 'c0000000-0000-0000-0000-000000000011', 'St. Paul River'),
  ('d0000000-0000-0000-0000-000000000074', 'c0000000-0000-0000-0000-000000000011', 'Todee'),
  ('d0000000-0000-0000-0000-000000000075', 'c0000000-0000-0000-0000-000000000012', 'Boe & Quilla'),
  ('d0000000-0000-0000-0000-000000000076', 'c0000000-0000-0000-0000-000000000012', 'Buu-Yao'),
  ('d0000000-0000-0000-0000-000000000077', 'c0000000-0000-0000-0000-000000000012', 'Doe'),
  ('d0000000-0000-0000-0000-000000000078', 'c0000000-0000-0000-0000-000000000012', 'Garr Bain'),
  ('d0000000-0000-0000-0000-000000000079', 'c0000000-0000-0000-0000-000000000012', 'Gbehlageh'),
  ('d0000000-0000-0000-0000-000000000080', 'c0000000-0000-0000-0000-000000000012', 'Gbi & Doru'),
  ('d0000000-0000-0000-0000-000000000081', 'c0000000-0000-0000-0000-000000000012', 'Gbor'),
  ('d0000000-0000-0000-0000-000000000082', 'c0000000-0000-0000-0000-000000000012', 'Kparblee'),
  ('d0000000-0000-0000-0000-000000000083', 'c0000000-0000-0000-0000-000000000012', 'Leewehpea-Mahn'),
  ('d0000000-0000-0000-0000-000000000084', 'c0000000-0000-0000-0000-000000000012', 'Meinpea-Mahn'),
  ('d0000000-0000-0000-0000-000000000085', 'c0000000-0000-0000-0000-000000000012', 'Sanniquellie-Mahn'),
  ('d0000000-0000-0000-0000-000000000086', 'c0000000-0000-0000-0000-000000000012', 'Twan River'),
  ('d0000000-0000-0000-0000-000000000087', 'c0000000-0000-0000-0000-000000000012', 'Wee-Gbehy-Mahn'),
  ('d0000000-0000-0000-0000-000000000088', 'c0000000-0000-0000-0000-000000000012', 'Yarmein'),
  ('d0000000-0000-0000-0000-000000000089', 'c0000000-0000-0000-0000-000000000012', 'Yarpea Mahn'),
  ('d0000000-0000-0000-0000-000000000090', 'c0000000-0000-0000-0000-000000000012', 'Yarwein Mehnsonnoh'),
  ('d0000000-0000-0000-0000-000000000091', 'c0000000-0000-0000-0000-000000000012', 'Zoe-Gbao'),
  ('d0000000-0000-0000-0000-000000000092', 'c0000000-0000-0000-0000-000000000013', 'Chedepo'),
  ('d0000000-0000-0000-0000-000000000093', 'c0000000-0000-0000-0000-000000000013', 'Gbeapo'),
  ('d0000000-0000-0000-0000-000000000094', 'c0000000-0000-0000-0000-000000000013', 'Glaro'),
  ('d0000000-0000-0000-0000-000000000095', 'c0000000-0000-0000-0000-000000000013', 'Karforh'),
  ('d0000000-0000-0000-0000-000000000096', 'c0000000-0000-0000-0000-000000000013', 'Nanee'),
  ('d0000000-0000-0000-0000-000000000097', 'c0000000-0000-0000-0000-000000000013', 'Nyenawliken'),
  ('d0000000-0000-0000-0000-000000000098', 'c0000000-0000-0000-0000-000000000013', 'Nyenebo'),
  ('d0000000-0000-0000-0000-000000000099', 'c0000000-0000-0000-0000-000000000013', 'Potupo'),
  ('d0000000-0000-0000-0000-000000000100', 'c0000000-0000-0000-0000-000000000013', 'Sarbo'),
  ('d0000000-0000-0000-0000-000000000101', 'c0000000-0000-0000-0000-000000000013', 'Tuobo'),
  ('d0000000-0000-0000-0000-000000000102', 'c0000000-0000-0000-0000-000000000013', 'Webbo'),
  ('d0000000-0000-0000-0000-000000000103', 'c0000000-0000-0000-0000-000000000014', 'Bearwor'),
  ('d0000000-0000-0000-0000-000000000104', 'c0000000-0000-0000-0000-000000000014', 'Central RiverCess'),
  ('d0000000-0000-0000-0000-000000000105', 'c0000000-0000-0000-0000-000000000014', 'Doedain'),
  ('d0000000-0000-0000-0000-000000000106', 'c0000000-0000-0000-0000-000000000014', 'Fen River'),
  ('d0000000-0000-0000-0000-000000000107', 'c0000000-0000-0000-0000-000000000014', 'Jo River'),
  ('d0000000-0000-0000-0000-000000000108', 'c0000000-0000-0000-0000-000000000014', 'Norwein'),
  ('d0000000-0000-0000-0000-000000000109', 'c0000000-0000-0000-0000-000000000014', 'Sam Gbalor'),
  ('d0000000-0000-0000-0000-000000000110', 'c0000000-0000-0000-0000-000000000014', 'Zartlahn'),
  ('d0000000-0000-0000-0000-000000000111', 'c0000000-0000-0000-0000-000000000015', 'Bodae'),
  ('d0000000-0000-0000-0000-000000000112', 'c0000000-0000-0000-0000-000000000015', 'Bokon'),
  ('d0000000-0000-0000-0000-000000000113', 'c0000000-0000-0000-0000-000000000015', 'Butaw'),
  ('d0000000-0000-0000-0000-000000000114', 'c0000000-0000-0000-0000-000000000015', 'Dugbe River'),
  ('d0000000-0000-0000-0000-000000000115', 'c0000000-0000-0000-0000-000000000015', 'Greenville'),
  ('d0000000-0000-0000-0000-000000000116', 'c0000000-0000-0000-0000-000000000015', 'Jaedae'),
  ('d0000000-0000-0000-0000-000000000117', 'c0000000-0000-0000-0000-000000000015', 'Jaedepo'),
  ('d0000000-0000-0000-0000-000000000118', 'c0000000-0000-0000-0000-000000000015', 'Juarzon'),
  ('d0000000-0000-0000-0000-000000000119', 'c0000000-0000-0000-0000-000000000015', 'Kpayan'),
  ('d0000000-0000-0000-0000-000000000120', 'c0000000-0000-0000-0000-000000000015', 'Kulu Shaw Boe'),
  ('d0000000-0000-0000-0000-000000000121', 'c0000000-0000-0000-0000-000000000015', 'Plahn Nyarn'),
  ('d0000000-0000-0000-0000-000000000122', 'c0000000-0000-0000-0000-000000000015', 'Pynes Town'),
  ('d0000000-0000-0000-0000-000000000123', 'c0000000-0000-0000-0000-000000000015', 'Sanquin District 1'),
  ('d0000000-0000-0000-0000-000000000124', 'c0000000-0000-0000-0000-000000000015', 'Sanquin District 2'),
  ('d0000000-0000-0000-0000-000000000125', 'c0000000-0000-0000-0000-000000000015', 'Sanquin District 3'),
  ('d0000000-0000-0000-0000-000000000126', 'c0000000-0000-0000-0000-000000000015', 'Seekon'),
  ('d0000000-0000-0000-0000-000000000127', 'c0000000-0000-0000-0000-000000000015', 'Wedjah')
ON CONFLICT (id) DO UPDATE SET county_id = EXCLUDED.county_id, name = EXCLUDED.name;

-- 8. BACKFILL EXISTING FARMS TO MATCH COUNTY_ID AND DISTRICT_ID
-- Match county by exact/case-insensitive name
UPDATE public.farms f
SET county_id = c.id
FROM public.counties c
WHERE f.county_id IS NULL
  AND LOWER(TRIM(f.county)) = LOWER(TRIM(c.name));

-- Match district by exact/case-insensitive name within that county
UPDATE public.farms f
SET district_id = d.id
FROM public.districts d
WHERE f.district_id IS NULL
  AND f.county_id = d.county_id
  AND LOWER(TRIM(f.district)) = LOWER(TRIM(d.name));

-- Fallback match for districts where user typed "X Central District" or similar
UPDATE public.farms f
SET district_id = d.id
FROM public.districts d
WHERE f.district_id IS NULL
  AND f.county_id = d.county_id
  AND (
    LOWER(TRIM(f.district)) LIKE '%' || LOWER(TRIM(d.name)) || '%'
    OR LOWER(TRIM(d.name)) LIKE '%' || LOWER(TRIM(f.district)) || '%'
  );

-- 9. VIEW FOR UNMATCHED FARMS (FOR MANUAL AUDIT & REVIEW)
CREATE OR REPLACE VIEW public.unmatched_farms_review AS
SELECT 
  f.id AS farm_id,
  f.name AS farm_name,
  f.farmer_id,
  f.county AS raw_county,
  f.district AS raw_district,
  f.community,
  f.county_id,
  f.district_id,
  CASE 
    WHEN f.county_id IS NULL THEN 'Missing County Match'
    WHEN f.district_id IS NULL THEN 'Missing District Match'
    ELSE 'Matched'
  END AS match_status
FROM public.farms f
WHERE f.county_id IS NULL OR f.district_id IS NULL;


-- ---------------------------------------------------------------------------
-- 20261120_farmer_status.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- Migration: 20261120_farmer_status.sql
-- Description: Adds account status to farmers table for administrator moderation
-- ============================================================================

ALTER TABLE public.farmers 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_farmers_status 
  ON public.farmers(status);


-- ---------------------------------------------------------------------------
-- 20261121_record_source.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- Migration: 20261121_record_source.sql
-- Description: Track which channel created a record: 'app' (mobile app, default),
--              'ussd' (feature-phone USSD channel) or 'seed' (demo seed script).
--              The USSD server works without this migration (it falls back to a
--              "Recorded via USSD" text marker), but the column makes it explicit.
-- ============================================================================

ALTER TABLE public.farmers         ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';
ALTER TABLE public.farms           ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';
ALTER TABLE public.farm_seasons    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';
ALTER TABLE public.harvest_batches ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';
ALTER TABLE public.expenses        ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';

COMMENT ON COLUMN public.harvest_batches.source IS 'Channel that created the record: app | ussd | seed';
COMMENT ON COLUMN public.expenses.source IS 'Channel that created the record: app | ussd | seed';

CREATE INDEX IF NOT EXISTS idx_harvest_batches_created_at ON public.harvest_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON public.expenses(created_at DESC);


-- ---------------------------------------------------------------------------
-- 20261123_app_sync_columns.sql
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- 20261124_activity_weather_and_farm_plans.sql
-- ---------------------------------------------------------------------------
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
