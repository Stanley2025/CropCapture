-- ============================================================================
-- Migration: 20261126_harvest_photos_traceability.sql
-- Description: Harvest photos with a public buyer page.
--   1. harvest_batches.public_code: random, unguessable code used in the buyer link /b/{public_code}.
--   2. harvest_photos: tag, size, upload status, at most 4 photos per harvest (enforced here).
--   3. harvest-photos bucket is PRIVATE, jpeg only, 1 MB per file. No public URLs.
--   4. get_buyer_page(): the ONLY way the public page reads data. It returns an allowlist of fields
--      and can be called by the server role only (not by the anon key).
--   5. buyer_reports: "Report a problem" messages from the public page, for admin review.
-- Safe to run more than once. It replaces the first photo migration (20261125), which made the bucket public.
-- ============================================================================

-- 1. Public code ---------------------------------------------------------------------------
ALTER TABLE public.harvest_batches ADD COLUMN IF NOT EXISTS public_code TEXT;

-- Existing harvests get a code. Only this one column is written; no other column of a harvest changes.
UPDATE public.harvest_batches
SET public_code = substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, 20)
WHERE public_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_harvest_batches_public_code ON public.harvest_batches(public_code);

-- 2. Photos --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.harvest_photos (
  id UUID PRIMARY KEY,
  harvest_id UUID NOT NULL REFERENCES public.harvest_batches(id) ON DELETE CASCADE,
  farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.harvest_photos
  ADD COLUMN IF NOT EXISTS public_url TEXT,
  ADD COLUMN IF NOT EXISTS tag TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS taken_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS width INTEGER,
  ADD COLUMN IF NOT EXISTS height INTEGER,
  ADD COLUMN IF NOT EXISTS size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS upload_status TEXT NOT NULL DEFAULT 'uploaded';

-- No permanent public address is kept for a photo.
UPDATE public.harvest_photos SET public_url = NULL WHERE public_url IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'harvest_photos_tag_check') THEN
    ALTER TABLE public.harvest_photos ADD CONSTRAINT harvest_photos_tag_check
      CHECK (tag IN ('bags', 'grain', 'heap', 'field', 'other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'harvest_photos_status_check') THEN
    ALTER TABLE public.harvest_photos ADD CONSTRAINT harvest_photos_status_check
      CHECK (upload_status IN ('pending', 'uploading', 'uploaded', 'failed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'harvest_photos_size_check') THEN
    ALTER TABLE public.harvest_photos ADD CONSTRAINT harvest_photos_size_check
      CHECK (size_bytes IS NULL OR (size_bytes > 0 AND size_bytes <= 1048576));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_harvest_photos_harvest ON public.harvest_photos(harvest_id) WHERE deleted_at IS NULL;

-- At most 4 photos per harvest. The lock makes two devices that sync at the same moment take turns,
-- so the 5th photo is refused even then.
CREATE OR REPLACE FUNCTION public.enforce_harvest_photo_limit() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.harvest_id::text));
    IF (SELECT count(*) FROM public.harvest_photos p
        WHERE p.harvest_id = NEW.harvest_id AND p.deleted_at IS NULL AND p.id <> NEW.id) >= 4 THEN
      RAISE EXCEPTION 'harvest_photo_limit: a harvest can have at most 4 photos'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_harvest_photo_limit ON public.harvest_photos;
CREATE TRIGGER trg_harvest_photo_limit
  BEFORE INSERT OR UPDATE OF deleted_at, harvest_id ON public.harvest_photos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_harvest_photo_limit();

ALTER TABLE public.harvest_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow manage harvest photos" ON public.harvest_photos;
CREATE POLICY "Allow manage harvest photos" ON public.harvest_photos
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- 3. Private storage bucket ------------------------------------------------------------------
-- Path: {farm_id}/{harvest_id}/{photo_id}.jpg inside the harvest-photos bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('harvest-photos', 'harvest-photos', false, 1048576, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = 1048576, allowed_mime_types = ARRAY['image/jpeg'];

DROP POLICY IF EXISTS "Allow manage harvest photo files" ON storage.objects;
DROP POLICY IF EXISTS "Upload harvest photo files" ON storage.objects;
DROP POLICY IF EXISTS "Owner reads harvest photo files" ON storage.objects;
DROP POLICY IF EXISTS "Owner removes harvest photo files" ON storage.objects;

-- The phone uploads with the app key (the app has no Supabase sign-in yet). Writing is allowed only into
-- this bucket and only to a path of the exact shape {uuid}/{uuid}/{uuid}.jpg. Nobody can read, list or
-- replace a file with the app key; buyers get a short-lived signed link from the server instead.
CREATE POLICY "Upload harvest photo files" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'harvest-photos'
    AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  );

-- A signed-in farmer can read and remove the files of their own farms.
CREATE POLICY "Owner reads harvest photo files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'harvest-photos'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT f.id FROM public.farms f
      WHERE f.farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid())
    )
  );
CREATE POLICY "Owner removes harvest photo files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'harvest-photos'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT f.id FROM public.farms f
      WHERE f.farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid())
    )
  );

-- 4. The buyer page: an allowlist, readable by the server role only ----------------------------------
CREATE OR REPLACE FUNCTION public.get_buyer_page(p_code TEXT) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  h RECORD;
  words TEXT[];
  farmer_label TEXT;
  result JSONB;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[A-Za-z0-9_-]{12,64}$' THEN
    RETURN NULL;
  END IF;

  SELECT b.id, b.batch_reference, b.quantity, b.unit, b.harvest_date, b.status::text AS status,
         b.farm_id, b.season_id, b.farmer_id, c.name AS crop_name, v.name AS variety_name,
         f.county AS farm_county, f.district AS farm_district
    INTO h
    FROM public.harvest_batches b
    JOIN public.crops c ON c.id = b.crop_id
    JOIN public.farms f ON f.id = b.farm_id
    LEFT JOIN public.crop_varieties v ON v.id = b.crop_variety_id
   WHERE b.public_code = p_code
     AND COALESCE(to_jsonb(b) ->> 'deleted_at', '') = '';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- first name and the initial of the last name, nothing more
  SELECT regexp_split_to_array(trim(full_name), '\s+') INTO words FROM public.farmers WHERE id = h.farmer_id;
  IF words IS NULL OR array_length(words, 1) IS NULL THEN
    farmer_label := NULL;
  ELSIF array_length(words, 1) = 1 THEN
    farmer_label := words[1];
  ELSE
    farmer_label := words[1] || ' ' || upper(left(words[array_length(words, 1)], 1)) || '.';
  END IF;

  result := jsonb_build_object(
    'harvest_id', h.id,
    'batch_id', h.batch_reference,
    'crop', h.crop_name,
    'variety', h.variety_name,
    'quantity', h.quantity,
    'unit', h.unit,
    'harvest_date', h.harvest_date,
    'approved', (h.status = 'approved'),
    'district', h.farm_district,
    'county', h.farm_county,
    'farmer', farmer_label,
    'photos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'path', p.storage_path, 'tag', p.tag) ORDER BY p.created_at, p.id)
        FROM public.harvest_photos p
       WHERE p.harvest_id = h.id AND p.deleted_at IS NULL AND p.upload_status = 'uploaded'
    ), '[]'::jsonb),
    'activities', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('type', a.activity_type, 'date', a.activity_date) ORDER BY a.activity_date, a.id)
        FROM public.farm_activities a
       WHERE a.farm_id = h.farm_id
         AND COALESCE(to_jsonb(a) ->> 'deleted_at', '') = ''
         AND a.activity_date <= h.harvest_date
         AND a.activity_date >= h.harvest_date - 365
         AND (h.season_id IS NULL OR a.season_id IS NULL OR a.season_id = h.season_id)
    ), '[]'::jsonb)
  );
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.get_buyer_page(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_buyer_page(TEXT) TO service_role;

-- The old scan address /verify/{qr_token} keeps working: the server looks the new code up from it.
CREATE OR REPLACE FUNCTION public.public_code_for_token(p_token TEXT) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public_code FROM public.harvest_batches WHERE qr_token = p_token AND public_code IS NOT NULL LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.public_code_for_token(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_code_for_token(TEXT) TO service_role;

-- 5. "Report a problem" --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buyer_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_id UUID REFERENCES public.harvest_batches(id) ON DELETE SET NULL,
  public_code TEXT NOT NULL,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 3 AND 1000),
  contact TEXT CHECK (contact IS NULL OR char_length(contact) <= 200),   -- optional, given by the buyer
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
-- Row level security on and no policy: only the server role (which skips policies) can read or write it.
ALTER TABLE public.buyer_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_buyer_reports_status ON public.buyer_reports(status, created_at DESC);
