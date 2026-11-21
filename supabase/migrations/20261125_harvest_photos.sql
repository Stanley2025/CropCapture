-- ============================================================================
-- Migration: 20261125_harvest_photos.sql
-- Description: Photos of the harvested product, taken by the farmer so a buyer can see them
--              on the harvest's QR passport. The pictures live in a storage bucket; this table
--              holds one row per picture. Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.harvest_photos (
  id UUID PRIMARY KEY,                                   -- made on the phone
  harvest_id UUID NOT NULL REFERENCES public.harvest_batches(id) ON DELETE CASCADE,
  farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,                            -- <harvest_id>/<photo id>.jpg in the harvest-photos bucket
  public_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at TIMESTAMPTZ                                 -- tombstone: a removed photo syncs as a delete
);

CREATE INDEX IF NOT EXISTS idx_harvest_photos_harvest ON public.harvest_photos(harvest_id) WHERE deleted_at IS NULL;

ALTER TABLE public.harvest_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow manage harvest photos" ON public.harvest_photos;
CREATE POLICY "Allow manage harvest photos" ON public.harvest_photos
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Public bucket: a buyer who scans the QR code can see the pictures without signing in.
-- Picture names are random ids, so the address of a photo cannot be guessed.
INSERT INTO storage.buckets (id, name, public)
VALUES ('harvest-photos', 'harvest-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow manage harvest photo files" ON storage.objects;
CREATE POLICY "Allow manage harvest photo files" ON storage.objects
  FOR ALL TO authenticated, anon
  USING (bucket_id = 'harvest-photos') WITH CHECK (bucket_id = 'harvest-photos');
