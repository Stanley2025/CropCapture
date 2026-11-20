const fs = require('fs');

const RAW_DATA = {
  Bomi: ['Dowein', 'Klay', 'Senjeh', 'Suehn Mecca', 'Tehr'],
  Bong: [
    'Boinsen',
    'Fuamah',
    'Jorquelleh',
    'Kokoyah',
    'Kpaai',
    'Panta-Kpa',
    'Salala',
    'Sanayea',
    'Suakoko',
    'Tukpahblee',
    'Yeallequelleh',
    'Zota',
  ],
  Gbarpolu: ['Belleh', 'Bopolu', 'Bokomu', 'Gbarma', 'Kongba'],
  'Grand Bassa': [
    'Commonwealth',
    'District #1',
    'District #2',
    'District #3',
    'District #4',
    'Nekreen',
    'St. John River',
  ],
  'Grand Cape Mount': ['Commonwealth', 'Garwula', 'Gola Konneh', 'Porkpa', 'Tewor'],
  'Grand Gedeh': ['Gbarzon', 'Konobo', 'Tchien'],
  'Grand Kru': [
    'Barclayville',
    'Bleebo',
    'Bolloh',
    'Buah',
    'Dorbor',
    'Dweh',
    'Felo-Jekwi',
    'Fenetoe',
    'Forpoh',
    'Garraway',
    'Gee',
    'Grand Cess Wedabo',
    'Upper Jloh',
    'Lower Jloh',
    'Kpi',
    'Nrokwia-Wesldow',
    'Penicess',
    'Trenbo',
    'Wlogba',
  ],
  Lofa: ['Foya', 'Kolahun', 'Salayea', 'Vahun', 'Voinjama', 'Quardu Gboni', 'Zorzor'],
  Margibi: ['Firestone', 'Gibi', 'Kakata', 'Mambah-Kaba'],
  Maryland: ['Barrobo', 'Pleebo/Sodeken'],
  Montserrado: ['Careysburg', 'Commonwealth', 'Greater Monrovia', 'St. Paul River', 'Todee'],
  Nimba: [
    'Boe & Quilla',
    'Buu-Yao',
    'Doe',
    'Garr Bain',
    'Gbehlageh',
    'Gbi & Doru',
    'Gbor',
    'Kparblee',
    'Leewehpea-Mahn',
    'Meinpea-Mahn',
    'Sanniquellie-Mahn',
    'Twan River',
    'Wee-Gbehy-Mahn',
    'Yarmein',
    'Yarpea Mahn',
    'Yarwein Mehnsonnoh',
    'Zoe-Gbao',
  ],
  'River Gee': [
    'Chedepo',
    'Gbeapo',
    'Glaro',
    'Karforh',
    'Nanee',
    'Nyenawliken',
    'Nyenebo',
    'Potupo',
    'Sarbo',
    'Tuobo',
    'Webbo',
  ],
  Rivercess: [
    'Bearwor',
    'Central RiverCess',
    'Doedain',
    'Fen River',
    'Jo River',
    'Norwein',
    'Sam Gbalor',
    'Zartlahn',
  ],
  Sinoe: [
    'Bodae',
    'Bokon',
    'Butaw',
    'Dugbe River',
    'Greenville',
    'Jaedae',
    'Jaedepo',
    'Juarzon',
    'Kpayan',
    'Kulu Shaw Boe',
    'Plahn Nyarn',
    'Pynes Town',
    'Sanquin District 1',
    'Sanquin District 2',
    'Sanquin District 3',
    'Seekon',
    'Wedjah',
  ],
};

const COUNTY_CODES = {
  Bomi: 'BM',
  Bong: 'BG',
  Gbarpolu: 'GP',
  'Grand Bassa': 'GB',
  'Grand Cape Mount': 'CM',
  'Grand Gedeh': 'GG',
  'Grand Kru': 'GK',
  Lofa: 'LF',
  Margibi: 'MG',
  Maryland: 'MY',
  Montserrado: 'MO',
  Nimba: 'NM',
  Rivercess: 'RC',
  'River Gee': 'RG',
  Sinoe: 'SI',
};

// Sort counties alphabetically
const sortedCountyNames = Object.keys(RAW_DATA).sort((a, b) => a.localeCompare(b));

const counties = [];
const districts = [];

let countyIndex = 1;
let districtIndex = 1;

for (const cName of sortedCountyNames) {
  const cId = `c0000000-0000-0000-0000-${String(countyIndex).padStart(12, '0')}`;
  const code = COUNTY_CODES[cName] || cName.substring(0, 2).toUpperCase();
  counties.push({
    id: cId,
    name: cName,
    code,
  });

  const distNames = RAW_DATA[cName];
  for (const dName of distNames) {
    const dId = `d0000000-0000-0000-0000-${String(districtIndex).padStart(12, '0')}`;
    districts.push({
      id: dId,
      county_id: cId,
      name: dName,
    });
    districtIndex++;
  }
  countyIndex++;
}

console.log(`Generated ${counties.length} counties and ${districts.length} districts.`);

// Generate TypeScript module content
function generateTsModule() {
  return `export interface County {
  id: string;
  name: string;
  code: string;
}

export interface District {
  id: string;
  county_id: string;
  name: string;
}

export const COUNTIES: County[] = ${JSON.stringify(counties, null, 2)};

export const DISTRICTS: District[] = ${JSON.stringify(districts, null, 2)};

export function getCounties(): County[] {
  return COUNTIES;
}

export function getDistrictsByCounty(countyIdentifier: string): District[] {
  if (!countyIdentifier) return [];
  const normalized = countyIdentifier.trim().toLowerCase();
  const matchingCounty = COUNTIES.find(
    (c) => c.id.toLowerCase() === normalized || c.name.toLowerCase() === normalized || c.code.toLowerCase() === normalized
  );
  if (!matchingCounty) return [];
  return DISTRICTS.filter((d) => d.county_id === matchingCounty.id);
}

export function getCountyByName(name: string): County | undefined {
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase();
  return COUNTIES.find((c) => c.name.toLowerCase() === normalized);
}

export function getDistrictByName(countyIdentifier: string, districtName: string): District | undefined {
  if (!districtName) return undefined;
  const countyDistricts = getDistrictsByCounty(countyIdentifier);
  const normalized = districtName.trim().toLowerCase();
  return countyDistricts.find((d) => d.name.toLowerCase() === normalized);
}

export function getAllDistricts(): District[] {
  return DISTRICTS;
}
`;
}

// Generate SQL migration content
function generateSqlMigration() {
  let sql = `-- Migration: 20261120_counties_and_districts.sql
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
`;

  const countyValues = counties
    .map((c) => `  ('${c.id}', '${c.name.replace(/'/g, "''")}', '${c.code}')`)
    .join(',\n');
  sql += countyValues + '\nON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;\n\n';

  sql += '-- 7. SEED DISTRICTS\nINSERT INTO public.districts (id, county_id, name) VALUES\n';
  const districtValues = districts
    .map((d) => `  ('${d.id}', '${d.county_id}', '${d.name.replace(/'/g, "''")}')`)
    .join(',\n');
  sql += districtValues + '\nON CONFLICT (id) DO UPDATE SET county_id = EXCLUDED.county_id, name = EXCLUDED.name;\n\n';

  sql += `-- 8. BACKFILL EXISTING FARMS TO MATCH COUNTY_ID AND DISTRICT_ID
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
`;

  return sql;
}

fs.writeFileSync('src/constants/liberiaGeographicData.ts', generateTsModule());
fs.writeFileSync('admin/src/lib/liberiaGeographicData.ts', generateTsModule());
fs.writeFileSync('supabase/migrations/20261120_counties_and_districts.sql', generateSqlMigration());
fs.writeFileSync('supabase/seed_counties_and_districts.sql', generateSqlMigration());
console.log('Files generated successfully.');
