-- ============================================================================
-- Migration: 20261127_harvest_audit_trail.sql
-- Description: The public buyer page always shows the latest data, so a change to a harvest must leave a
--   trace. These triggers write to audit_logs when the weight, unit, date or status of a harvest changes,
--   and when a photo is added or removed. (Removal of a photo by an administrator is also written by the
--   admin portal, with the reason.) Nothing is deleted from audit_logs here. Safe to run more than once.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_harvest_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
       OLD.quantity IS DISTINCT FROM NEW.quantity
    OR OLD.unit IS DISTINCT FROM NEW.unit
    OR OLD.harvest_date IS DISTINCT FROM NEW.harvest_date
    OR OLD.status IS DISTINCT FROM NEW.status
  ) THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'harvest_changed', 'harvest_batch', NEW.id, jsonb_build_object(
      'before', jsonb_build_object('quantity', OLD.quantity, 'unit', OLD.unit, 'harvest_date', OLD.harvest_date, 'status', OLD.status::text),
      'after',  jsonb_build_object('quantity', NEW.quantity, 'unit', NEW.unit, 'harvest_date', NEW.harvest_date, 'status', NEW.status::text)
    ));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_harvest_change ON public.harvest_batches;
CREATE TRIGGER trg_log_harvest_change
  AFTER UPDATE ON public.harvest_batches
  FOR EACH ROW EXECUTE FUNCTION public.log_harvest_change();

CREATE OR REPLACE FUNCTION public.log_harvest_photo_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'harvest_photo_added', 'harvest_photo', NEW.id,
            jsonb_build_object('harvest_id', NEW.harvest_id, 'farm_id', NEW.farm_id, 'tag', NEW.tag));
  ELSIF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'harvest_photo_removed', 'harvest_photo', NEW.id,
            jsonb_build_object('harvest_id', NEW.harvest_id, 'farm_id', NEW.farm_id, 'tag', NEW.tag));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_harvest_photo_change ON public.harvest_photos;
CREATE TRIGGER trg_log_harvest_photo_change
  AFTER INSERT OR UPDATE ON public.harvest_photos
  FOR EACH ROW EXECUTE FUNCTION public.log_harvest_photo_change();
