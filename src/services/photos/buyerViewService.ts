/**
 * What a buyer sees when they open a harvest's QR passport: the product photos, the harvest facts and what
 * was done on the farm. It is read from the server (so it works on the buyer's own phone) and falls back
 * to this phone's own data for the farmer previewing their own passport, or when there is no connection.
 *
 * Only safe columns are requested from the server: costs, workers, notes, the farmer's id and the
 * farm's exact position are never downloaded for a buyer.
 */
import { localDb } from '../storage/localDatabase';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { describeError } from '../../shared/columnFallback';
import { findCropById } from '../../shared/farmRecords';
import { buildBuyerView, BuyerView, ACTIVITY_WINDOW_DAYS } from '../../shared/harvestPhotos';

export interface BuyerData {
  harvest: any;
  inspection: { final_grade?: string | null; decision_status?: string | null } | null;
  view: BuyerView;
  /** "server" = what a buyer sees; "phone" = this phone's own copy (farmer preview or no connection) */
  source: 'server' | 'phone';
}

/** A select that survives a column the database does not have yet. */
async function safeSelect<T = any>(columns: string[], run: (cols: string) => PromiseLike<{ data: any; error: any }>): Promise<T | null> {
  let cols = [...columns];
  for (let i = 0; i < 6; i++) {
    const { data, error } = await run(cols.join(','));
    if (!error) return data as T;
    const info = describeError(error.message);
    if (!info || !cols.includes(info.column)) return null;
    cols = cols.filter((c) => c !== info.column);
  }
  return null;
}

async function fromServer(token: string): Promise<BuyerData | null> {
  const harvestCols = ['id', 'farm_id', 'season_id', 'crop_id', 'crop_variety_id', 'batch_reference', 'quantity', 'unit', 'harvest_date', 'status'];
  let harvest: any = await safeSelect(harvestCols, (c) => supabase.from('harvest_batches').select(c).eq('qr_token', token).maybeSingle());
  if (!harvest) harvest = await safeSelect(harvestCols, (c) => supabase.from('harvest_batches').select(c).eq('batch_reference', token).maybeSingle());
  if (!harvest) return null;

  const farm = await safeSelect(['id', 'name', 'county'], (c) => supabase.from('farms').select(c).eq('id', harvest.farm_id).maybeSingle());
  const photos =
    (await safeSelect<any[]>(['id', 'public_url', 'created_at', 'deleted_at'], (c) =>
      supabase.from('harvest_photos').select(c).eq('harvest_id', harvest.id).is('deleted_at', null).order('created_at', { ascending: true })
    )) || [];

  const end = String(harvest.harvest_date || '').slice(0, 10);
  const start = end ? new Date(Date.parse(`${end}T12:00:00Z`) - ACTIVITY_WINDOW_DAYS * 86400000).toISOString().slice(0, 10) : '';
  const activities = end
    ? (await safeSelect<any[]>(['id', 'farm_id', 'season_id', 'activity_type', 'activity_date', 'weather_sky', 'rain_mm', 'day_feel'], (c) =>
        supabase.from('farm_activities').select(c).eq('farm_id', harvest.farm_id).gte('activity_date', start).lte('activity_date', end).order('activity_date', { ascending: true }).limit(300)
      )) || []
    : [];
  const inspection = await safeSelect<any>(['final_grade', 'decision_status'], (c) => supabase.from('quality_inspections').select(c).eq('batch_id', harvest.id).limit(1).maybeSingle());

  const crop = findCropById(harvest.crop_id);
  const view = buildBuyerView({ harvest, farm, crop, photos, activities });
  return view ? { harvest: { ...harvest, crop: crop ? { name: crop.name } : undefined }, inspection, view, source: 'server' } : null;
}

async function fromPhone(token: string): Promise<BuyerData | null> {
  const [harvests, inspections] = await Promise.all([localDb.getHarvests(), localDb.getInspections()]);
  const harvest = harvests.find((h) => h.qr_token === token || h.id === token || h.batch_reference === token);
  if (!harvest) return null;
  const farm = (await localDb.getFarms()).find((f) => f.id === harvest.farm_id) || null;
  // On the farmer's own phone a picture can be shown from the file here, before it has been uploaded.
  const photos = (await localDb.getHarvestPhotos(harvest.id)).map((p) => ({ ...p, public_url: p.public_url || p.local_uri || null }));
  const activities = await localDb.getActivities(undefined, [harvest.farm_id]);
  const view = buildBuyerView({ harvest, farm, crop: findCropById(harvest.crop_id) || harvest.crop, photos, activities });
  return view ? { harvest, inspection: inspections.find((i) => i.batch_id === harvest.id) || null, view, source: 'phone' } : null;
}

export async function loadBuyerData(token: string, offline = false): Promise<BuyerData | null> {
  if (!offline && isSupabaseConfigured()) {
    try {
      const server = await fromServer(token);
      if (server) return server;
    } catch (e) {
      console.warn('Passport could not be read from the server, using this phone:', (e as Error).message);
    }
  }
  return fromPhone(token);
}
