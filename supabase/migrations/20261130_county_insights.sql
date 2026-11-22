-- ============================================================================
-- Migration: 20261130_county_insights.sql
-- Description: Numbers for the admin "Counties" section: farmers, farms and harvest per county, with the
--   gender split. Everything is counted in the database (never in the browser).
--
--   admin_county_insights(year, crop, approved_only)        one row per county + "Unassigned county" + national totals
--   admin_county_detail(county, year, crop, approved_only)  districts and top crops of one county
--
-- Who can call them: only a signed-in user whose profile role is super_admin or agricultural_admin. The
-- check is inside the functions (is_insights_admin), so the service key is not needed and is never sent to
-- a browser. They return counts and totals only: no names, phones, IDs or locations of a person.
--
-- What is left out: sample records (source = 'seed'), harvests that were deleted (deleted_at) and harvests
-- that were replaced by a newer edit (is_latest = false). Safe to run more than once.
-- ============================================================================

-- Indexes for the queries below -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_farms_farmer_id ON public.farms(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farms_county_id ON public.farms(county_id);
CREATE INDEX IF NOT EXISTS idx_harvest_batches_farm_date ON public.harvest_batches(farm_id, harvest_date);
CREATE INDEX IF NOT EXISTS idx_harvest_batches_crop ON public.harvest_batches(crop_id);
CREATE INDEX IF NOT EXISTS idx_harvest_batches_farm_live ON public.harvest_batches(farm_id, harvest_date) WHERE deleted_at IS NULL;

-- Small helpers ---------------------------------------------------------------------------------------
-- A county name reduced to letters only, so "Nimba", " nimba " and "Nimba County" are the same county.
-- Nothing else is guessed: a name that still does not match goes to "Unassigned county".
CREATE OR REPLACE FUNCTION public.county_key(t TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(regexp_replace(lower(btrim(coalesce(t, ''))), '\s+county$', ''), '[^a-z]', '', 'g');
$$;

-- Gender exactly as recorded: male, female, anything else (or nothing) is "unrecorded". Never guessed.
CREATE OR REPLACE FUNCTION public.gender_key(g TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(btrim(coalesce(g, ''))) WHEN 'male' THEN 'male' WHEN 'female' THEN 'female' ELSE 'unrecorded' END;
$$;

-- THE ONE PLACE where a harvest is turned into kilograms.
--   1. the weight the app already worked out (quantity_kg), when there is one;
--   2. otherwise by the unit: kg, g, lb, tonne (1 tonne = 1000 kg);
--   3. otherwise quantity x kg_per_unit, when the farmer's record has one;
--   4. otherwise NULL: the weight cannot be known (for example "bags" or "heads" with no weight).
-- A NULL is counted and reported on the page; it is never added in as if it were 0 or a guessed weight.
CREATE OR REPLACE FUNCTION public.harvest_weight_kg(quantity NUMERIC, unit TEXT, quantity_kg NUMERIC, kg_per_unit NUMERIC)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN quantity_kg IS NOT NULL THEN quantity_kg
    WHEN quantity IS NULL THEN NULL
    WHEN lower(btrim(coalesce(unit, ''))) IN ('kg', 'kgs', 'kilogram', 'kilograms') THEN quantity
    WHEN lower(btrim(coalesce(unit, ''))) IN ('g', 'gram', 'grams') THEN quantity / 1000
    WHEN lower(btrim(coalesce(unit, ''))) IN ('lb', 'lbs', 'pound', 'pounds') THEN quantity * 0.45359237
    WHEN lower(btrim(coalesce(unit, ''))) IN ('t', 'ton', 'tons', 'tonne', 'tonnes', 'mt') THEN quantity * 1000
    WHEN kg_per_unit IS NOT NULL THEN quantity * kg_per_unit
    ELSE NULL
  END;
$$;

-- May this user see the Counties section?
CREATE OR REPLACE FUNCTION public.is_insights_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role::text IN ('super_admin', 'agricultural_admin')
  );
$$;

-- The two functions below use the same four building blocks (written out in each, so each query is planned as
-- one statement and every block is read once):
--   ctys   the counties, with a comparable name
--   fm     farms: the county (the farm's own county_id, else its county text matched by name), the district,
--          and the gender of the farmer who owns the farm. Sample farms and sample farmers are left out.
--   fc     farmers: ONE row per farmer, with one county: the county on the farmer's record when it matches a
--          county, otherwise the county of their first farm, otherwise none (Unassigned). A farmer with
--          several farms is counted once.
--   hv     harvests that count (not deleted, not replaced, not sample, after the filters) with their kg

-- 1. One row per county ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_county_insights(
  p_year INTEGER DEFAULT NULL,
  p_crop UUID DEFAULT NULL,
  p_approved_only BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_insights_admin() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  WITH
  ctys AS MATERIALIZED (
    SELECT c.id, c.name, public.county_key(c.name) AS k FROM public.counties c
  ),
  ckeys AS MATERIALIZED (
    -- one county per comparable name, so matching by name can never repeat a farm or a farmer
    SELECT DISTINCT ON (k) id, k FROM ctys WHERE k <> '' ORDER BY k, name
  ),
  fm AS MATERIALIZED (
    SELECT x.id, x.farmer_id, x.gender, COALESCE(c1.id, c2.id) AS county_id, x.district, x.created_at
    FROM (
      SELECT f.id, f.farmer_id, public.gender_key(fr.gender) AS gender, f.county_id,
             NULLIF(public.county_key(f.county), '') AS ck,
             COALESCE(d.name, NULLIF(btrim(f.district), '')) AS district, f.created_at
      FROM public.farms f
      JOIN public.farmers fr ON fr.id = f.farmer_id AND COALESCE(fr.source, '') <> 'seed'
      LEFT JOIN public.districts d ON d.id = f.district_id
      WHERE COALESCE(f.source, '') <> 'seed'
    ) x
    LEFT JOIN ctys c1 ON c1.id = x.county_id
    LEFT JOIN ckeys c2 ON c1.id IS NULL AND c2.k = x.ck
  ),
  fc AS MATERIALIZED (
    SELECT fr.id, public.gender_key(fr.gender) AS gender, COALESCE(c.id, ff.county_id) AS county_id
    FROM (SELECT f.id, f.gender, NULLIF(public.county_key(f.county), '') AS ck
          FROM public.farmers f WHERE COALESCE(f.source, '') <> 'seed') fr
    LEFT JOIN ckeys c ON c.k = fr.ck
    LEFT JOIN (SELECT DISTINCT ON (m.farmer_id) m.farmer_id, m.county_id
               FROM fm m WHERE m.county_id IS NOT NULL ORDER BY m.farmer_id, m.created_at, m.id) ff ON ff.farmer_id = fr.id
  ),
  hv AS MATERIALIZED (
    -- one pass over the harvests: each farm's harvests added up, so the big table is never joined row by row
    SELECT w.farm_id, count(*) AS n, count(*) FILTER (WHERE w.kg IS NULL) AS no_weight, sum(w.kg) AS kg
    FROM (
      SELECT h.farm_id, public.harvest_weight_kg(h.quantity, h.unit, h.quantity_kg, h.kg_per_unit) AS kg
      FROM public.harvest_batches h
      WHERE h.deleted_at IS NULL
        AND COALESCE(h.is_latest, TRUE)
        AND COALESCE(h.source, '') <> 'seed'
        AND (p_year IS NULL OR (h.harvest_date >= make_date(p_year, 1, 1) AND h.harvest_date < make_date(p_year + 1, 1, 1)))
        AND (p_crop IS NULL OR h.crop_id = p_crop)
        AND (NOT p_approved_only OR h.status::text = 'approved')
    ) w
    GROUP BY w.farm_id
  ),
  all_counties AS (
    SELECT c.id, c.name, 1 AS ord FROM public.counties c
    UNION ALL
    SELECT NULL::UUID, 'Unassigned county', 2
  ),
  fa AS (
    SELECT county_id, count(*) AS farmers,
           count(*) FILTER (WHERE gender = 'male') AS male,
           count(*) FILTER (WHERE gender = 'female') AS female,
           count(*) FILTER (WHERE gender = 'unrecorded') AS unrecorded
    FROM fc GROUP BY county_id
  ),
  ma AS (
    SELECT county_id, count(*) AS farms,
           count(*) FILTER (WHERE gender = 'male') AS male,
           count(*) FILTER (WHERE gender = 'female') AS female,
           count(*) FILTER (WHERE gender = 'unrecorded') AS unrecorded
    FROM fm GROUP BY county_id
  ),
  ha AS (
    SELECT m.county_id,
           sum(v.n) AS harvests,
           sum(v.no_weight) AS no_weight,
           COALESCE(sum(v.kg), 0) AS kg,
           COALESCE(sum(v.kg) FILTER (WHERE m.gender = 'male'), 0) AS male,
           COALESCE(sum(v.kg) FILTER (WHERE m.gender = 'female'), 0) AS female,
           COALESCE(sum(v.kg) FILTER (WHERE m.gender = 'unrecorded'), 0) AS unrecorded
    FROM fm m JOIN hv v ON v.farm_id = m.id
    GROUP BY m.county_id
  ),
  county_rows AS (
    SELECT r.id, r.name, r.ord,
           COALESCE(fa.farmers, 0) AS farmers, COALESCE(fa.male, 0) AS farmers_male, COALESCE(fa.female, 0) AS farmers_female, COALESCE(fa.unrecorded, 0) AS farmers_unrecorded,
           COALESCE(ma.farms, 0) AS farms, COALESCE(ma.male, 0) AS farms_male, COALESCE(ma.female, 0) AS farms_female, COALESCE(ma.unrecorded, 0) AS farms_unrecorded,
           COALESCE(ha.harvests, 0) AS harvests, COALESCE(ha.no_weight, 0) AS harvests_no_weight,
           COALESCE(ha.kg, 0) AS kg, COALESCE(ha.male, 0) AS kg_male, COALESCE(ha.female, 0) AS kg_female, COALESCE(ha.unrecorded, 0) AS kg_unrecorded
    FROM all_counties r
    LEFT JOIN fa ON fa.county_id IS NOT DISTINCT FROM r.id
    LEFT JOIN ma ON ma.county_id IS NOT DISTINCT FROM r.id
    LEFT JOIN ha ON ha.county_id IS NOT DISTINCT FROM r.id
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'filters', jsonb_build_object('year', p_year, 'crop', p_crop, 'approved_only', p_approved_only),
    'counties', (SELECT jsonb_agg(jsonb_build_object(
        'county_id', id, 'county', name, 'is_unassigned', id IS NULL,
        'farmers', farmers, 'farmers_male', farmers_male, 'farmers_female', farmers_female, 'farmers_unrecorded', farmers_unrecorded,
        'farms', farms, 'farms_male', farms_male, 'farms_female', farms_female, 'farms_unrecorded', farms_unrecorded,
        'harvests', harvests, 'harvests_no_weight', harvests_no_weight,
        'harvest_kg', round(kg, 2), 'harvest_kg_male', round(kg_male, 2), 'harvest_kg_female', round(kg_female, 2), 'harvest_kg_unrecorded', round(kg_unrecorded, 2)
      ) ORDER BY ord, name) FROM county_rows),
    'national', (SELECT jsonb_build_object(
        'farmers', sum(farmers), 'farmers_male', sum(farmers_male), 'farmers_female', sum(farmers_female), 'farmers_unrecorded', sum(farmers_unrecorded),
        'farms', sum(farms), 'farms_male', sum(farms_male), 'farms_female', sum(farms_female), 'farms_unrecorded', sum(farms_unrecorded),
        'harvests', sum(harvests), 'harvests_no_weight', sum(harvests_no_weight), 'harvest_kg', round(sum(kg), 2)
      ) FROM county_rows),
    'excluded', jsonb_build_object(
        'sample_farmers', (SELECT count(*) FROM public.farmers WHERE COALESCE(source, '') = 'seed'),
        'sample_farms', (SELECT count(*) FROM public.farms WHERE COALESCE(source, '') = 'seed'),
        'sample_harvests', (SELECT count(*) FROM public.harvest_batches WHERE COALESCE(source, '') = 'seed'),
        'deleted_harvests', (SELECT count(*) FROM public.harvest_batches WHERE deleted_at IS NOT NULL),
        'replaced_harvests', (SELECT count(*) FROM public.harvest_batches WHERE is_latest IS FALSE)
    )
  ) INTO result;

  RETURN result;
END $$;

-- 2. One county in detail: districts and top crops --------------------------------------------------------------
-- A district with fewer than 5 farmers shows no gender split (small_group = true), so a person cannot be
-- picked out. p_county NULL means the "Unassigned county" group.
CREATE OR REPLACE FUNCTION public.admin_county_detail(
  p_county UUID,
  p_year INTEGER DEFAULT NULL,
  p_crop UUID DEFAULT NULL,
  p_approved_only BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_insights_admin() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  WITH
  ctys AS MATERIALIZED (
    SELECT c.id, c.name, public.county_key(c.name) AS k FROM public.counties c
  ),
  ckeys AS MATERIALIZED (
    -- one county per comparable name, so matching by name can never repeat a farm or a farmer
    SELECT DISTINCT ON (k) id, k FROM ctys WHERE k <> '' ORDER BY k, name
  ),
  fm AS MATERIALIZED (
    SELECT x.id, x.farmer_id, x.gender, COALESCE(x.district, 'Not recorded') AS district
    FROM (
      SELECT f.id, f.farmer_id, public.gender_key(fr.gender) AS gender, f.county_id,
             NULLIF(public.county_key(f.county), '') AS ck,
             COALESCE(d.name, NULLIF(btrim(f.district), '')) AS district
      FROM public.farms f
      JOIN public.farmers fr ON fr.id = f.farmer_id AND COALESCE(fr.source, '') <> 'seed'
      LEFT JOIN public.districts d ON d.id = f.district_id
      WHERE COALESCE(f.source, '') <> 'seed'
    ) x
    LEFT JOIN ctys c1 ON c1.id = x.county_id
    LEFT JOIN ckeys c2 ON c1.id IS NULL AND c2.k = x.ck
    WHERE COALESCE(c1.id, c2.id) IS NOT DISTINCT FROM p_county
  ),
  hv AS MATERIALIZED (
    SELECT w.farm_id, w.crop_id, count(*) AS n, count(*) FILTER (WHERE w.kg IS NULL) AS no_weight, sum(w.kg) AS kg
    FROM (
      SELECT h.farm_id, h.crop_id, public.harvest_weight_kg(h.quantity, h.unit, h.quantity_kg, h.kg_per_unit) AS kg
      FROM public.harvest_batches h
      WHERE h.deleted_at IS NULL
        AND COALESCE(h.is_latest, TRUE)
        AND COALESCE(h.source, '') <> 'seed'
        AND (p_year IS NULL OR (h.harvest_date >= make_date(p_year, 1, 1) AND h.harvest_date < make_date(p_year + 1, 1, 1)))
        AND (p_crop IS NULL OR h.crop_id = p_crop)
        AND (NOT p_approved_only OR h.status::text = 'approved')
    ) w
    GROUP BY w.farm_id, w.crop_id
  ),
  hvd AS (
    SELECT m.district, v.crop_id, v.no_weight, v.kg FROM hv v JOIN fm m ON m.id = v.farm_id
  ),
  dist AS (
    SELECT m.district,
           count(DISTINCT m.farmer_id) AS farmers,
           count(DISTINCT m.farmer_id) FILTER (WHERE m.gender = 'male') AS male,
           count(DISTINCT m.farmer_id) FILTER (WHERE m.gender = 'female') AS female,
           count(DISTINCT m.farmer_id) FILTER (WHERE m.gender = 'unrecorded') AS unrecorded,
           count(*) AS farms
    FROM fm m GROUP BY m.district
  ),
  dist_kg AS (
    SELECT v.district, COALESCE(sum(v.kg), 0) AS kg, COALESCE(sum(v.no_weight), 0) AS no_weight
    FROM hvd v GROUP BY v.district
  ),
  crops_here AS (
    SELECT COALESCE(c.name, 'Not recorded') AS crop, COALESCE(sum(v.kg), 0) AS kg
    FROM hvd v LEFT JOIN public.crops c ON c.id = v.crop_id
    GROUP BY COALESCE(c.name, 'Not recorded')
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'county', COALESCE((SELECT name FROM public.counties WHERE id = p_county), 'Unassigned county'),
    'districts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'district', d.district,
        'farmers', d.farmers,
        'farms', d.farms,
        'harvest_kg', round(COALESCE(k.kg, 0), 2),
        'harvests_no_weight', COALESCE(k.no_weight, 0),
        'small_group', d.farmers < 5,
        'farmers_male', CASE WHEN d.farmers < 5 THEN NULL ELSE d.male END,
        'farmers_female', CASE WHEN d.farmers < 5 THEN NULL ELSE d.female END,
        'farmers_unrecorded', CASE WHEN d.farmers < 5 THEN NULL ELSE d.unrecorded END
      ) ORDER BY COALESCE(k.kg, 0) DESC, d.district) FROM dist d LEFT JOIN dist_kg k ON k.district = d.district), '[]'::jsonb),
    'top_crops', COALESCE((SELECT jsonb_agg(jsonb_build_object('crop', crop, 'harvest_kg', round(kg, 2)) ORDER BY kg DESC, crop)
                           FROM (SELECT * FROM crops_here ORDER BY kg DESC, crop LIMIT 5) t), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.admin_county_insights(INTEGER, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_county_detail(UUID, INTEGER, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_insights_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_county_insights(INTEGER, UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_county_detail(UUID, INTEGER, UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_insights_admin() TO authenticated, service_role;

-- The first version of this migration made three internal helper functions. They are replaced by the queries
-- above; remove them if an earlier run created them.
DROP FUNCTION IF EXISTS public.insights_farm_base();
DROP FUNCTION IF EXISTS public.insights_farmer_county();
DROP FUNCTION IF EXISTS public.insights_harvest_base(INTEGER, UUID, BOOLEAN);
