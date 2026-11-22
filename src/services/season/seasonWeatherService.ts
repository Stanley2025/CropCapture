/**
 * Quiet per-season weather recording.
 *
 * There is no weather screen, forecast, alert or advice here. When a season record is opened
 * (or after a sync) this works out the weather for that season's window, stores a SUMMARY on
 * the phone (synced like any other record) and sends the daily rows to the server only.
 *
 * The rules (window, thresholds, summary, rounding of GPS) live in src/shared/seasonWeather.js.
 */
import { localDb } from '../storage/localDatabase';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  weatherWindow,
  fetchDailyWeather,
  buildSeasonWeather,
  needsRefresh,
  dailyRowsFor,
  SeasonWeather,
} from '../../shared/seasonWeather';

const inFlight = new Map<string, Promise<SeasonWeather | null>>();

/** The stored weather summary for a season, if any (never touches the network). */
export async function getSeasonWeather(seasonId: string): Promise<SeasonWeather | null> {
  const rows = await localDb.getSeasonRecords<SeasonWeather>('weather', seasonId);
  return rows[0] || null;
}

async function record(seasonId: string, force: boolean, offline: boolean): Promise<SeasonWeather | null> {
  const existing = await getSeasonWeather(seasonId);
  const season = (await localDb.getSeasons()).find((s) => s.id === seasonId);
  if (!season || season.cycle_type === 'livestock' || String(season.crop_id).startsWith('livestock-')) return existing;

  const farm = (await localDb.getFarms()).find((f) => f.id === season.farm_id);
  if (!farm || farm.latitude == null || farm.longitude == null) return existing; // needs the farm's GPS point

  const window = weatherWindow({
    season,
    activities: await localDb.getActivities(undefined, [season.farm_id]),
    harvests: await localDb.getHarvests(undefined, [season.farm_id]),
  });
  if (!window || !window.hasData) return existing; // not planted yet, or too recent for the archive
  if (!force && !needsRefresh(existing, window)) return existing;
  if (offline) return existing; // the app's offline mode (or no connection): keep what we have

  try {
    const daily = await fetchDailyWeather({
      latitude: Number(farm.latitude),
      longitude: Number(farm.longitude),
      start: window.start,
      end: window.dataEnd,
    });
    const summary = buildSeasonWeather({
      season,
      window,
      daily,
      latitude: Number(farm.latitude),
      longitude: Number(farm.longitude),
    });
    await localDb.saveSeasonRecord('weather', summary, true);

    // Daily rows are kept on the server only (best effort; the phone never stores them).
    if (isSupabaseConfigured()) {
      const rows = dailyRowsFor(season.id, daily, window);
      supabase
        .from('season_weather_daily')
        .upsert(rows, { onConflict: 'season_id,date' })
        .then(({ error }) => error && console.warn('Daily weather rows not stored:', error.message));
    }
    return summary;
  } catch (e) {
    // Offline, or the archive is unavailable: keep what we have and try again next time.
    console.warn('Season weather not updated:', (e as Error).message);
    return existing;
  }
}

/** Record (or refresh) the weather for one season. Safe to call often. */
export function ensureSeasonWeather(
  seasonId: string,
  { force = false, offline = false }: { force?: boolean; offline?: boolean } = {}
): Promise<SeasonWeather | null> {
  const running = inFlight.get(seasonId);
  if (running) return running;
  const job = record(seasonId, force, offline).finally(() => inFlight.delete(seasonId));
  inFlight.set(seasonId, job);
  return job;
}

/** Quietly bring every crop season's weather up to date (used after a sync). */
export async function refreshAllSeasonWeather(offline = false): Promise<void> {
  const seasons = await localDb.getSeasons();
  for (const s of seasons) {
    if (s.cycle_type === 'livestock' || String(s.crop_id).startsWith('livestock-')) continue;
    await ensureSeasonWeather(s.id, { offline });
  }
}
