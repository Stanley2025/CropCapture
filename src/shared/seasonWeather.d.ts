// Types for ./seasonWeather.js (shared by the Expo app and node tests).

export interface WeatherThresholds {
  readonly RAINY_DAY_MM: number;
  readonly HEAVY_RAIN_DAY_MM: number;
  readonly RAINS_START_DAYS: number;
  readonly RAINS_START_MM: number;
  readonly DAYS_BEFORE_PLANTING: number;
  readonly FIRST_RAIN_DAYS: number;
  readonly FIRST_DRY_SPELL_DAYS: number;
  readonly COORD_DECIMALS: number;
  readonly ARCHIVE_LAG_DAYS: number;
  readonly REFRESH_HOURS: number;
}
export const WEATHER_THRESHOLDS: WeatherThresholds;
export const ARCHIVE_URL: string;
export const STILL_RUNNING: string;

export interface DailyWeather {
  date: string;
  rain: number | null;
  tmax: number | null;
  tmin: number | null;
}
export interface WeatherWindow {
  planting: string;
  start: string;
  end: string;
  dataEnd: string;
  running: boolean;
  partial: boolean;
  hasData: boolean;
}
export interface MonthlyRain {
  rain_mm: number;
  rainy_days: number;
  days: number;
}
export interface WeatherSummary {
  days_expected: number;
  days_with_data: number;
  total_rain_mm: number;
  rainy_days: number;
  longest_dry_spell_days: number;
  avg_tmax_c: number | null;
  avg_tmin_c: number | null;
  rain_first_30d_mm: number | null;
  first30_complete: boolean;
  longest_dry_spell_first_60d_days: number | null;
  first60_complete: boolean;
  rains_start_date: string | null;
  rains_start_days_from_planting: number | null;
  heavy_rain_days: number;
  monthly: Record<string, MonthlyRain>;
}
export interface SeasonWeather extends WeatherSummary {
  id: string;
  season_id: string;
  planting_date: string;
  window_start: string;
  window_end: string;
  data_through: string;
  running: boolean;
  partial: boolean;
  latitude: number;
  longitude: number;
  source: string;
  computed_at: string;
  updated_at: string;
}

export function addDays(iso: string, n: number): string;
export function daysBetween(a: string, b: string): number;
export function todayOf(now?: Date): string;
export function roundCoord(value: number, decimals?: number): number;
export function plantingDateOf(season: any, activities?: any[]): string | null;
export function seasonEndOf(season: any, harvests?: any[], now?: Date): { end: string; hasHarvest: boolean };
export function weatherWindow(input: { season: any; activities?: any[]; harvests?: any[]; now?: Date }): WeatherWindow | null;
export function buildArchiveUrl(input: { latitude: number; longitude: number; start: string; end: string; baseUrl?: string }): string;
export function parseArchiveResponse(json: any): DailyWeather[];
export function fetchDailyWeather(input: {
  fetchImpl?: typeof fetch;
  latitude: number;
  longitude: number;
  start: string;
  end: string;
  timeoutMs?: number;
}): Promise<DailyWeather[]>;
export function summarizeWeather(daily: DailyWeather[], window: { planting: string; start: string; dataEnd: string }, thresholds?: WeatherThresholds): WeatherSummary;
export function buildSeasonWeather(input: {
  season: any;
  window: WeatherWindow;
  daily: DailyWeather[];
  latitude: number;
  longitude: number;
  now?: Date;
  idFactory?: () => string;
}): SeasonWeather;
export function needsRefresh(existing: SeasonWeather | null | undefined, window: WeatherWindow, now?: Date): boolean;
export function dailyRowsFor(
  seasonId: string,
  daily: DailyWeather[],
  window: { start: string; dataEnd: string }
): Array<{ season_id: string; date: string; rain_mm: number | null; tmax_c: number | null; tmin_c: number | null }>;

export interface ComparisonItem {
  id: string;
  name: string;
  crop_id: string;
  crop_name?: string;
  planting_date?: string;
  weather: SeasonWeather | null;
}
export interface ComparisonRow {
  id: string;
  name: string;
  planting_date: string;
  running: boolean;
  partial: boolean;
  days_after_planting_covered: number;
  rain_first_30d_mm: number | null;
  first30_complete: boolean;
  longest_dry_spell_first_60d_days: number | null;
  first60_complete: boolean;
  rains_start_days_from_planting: number | null;
  rains_start_date: string | null;
  total_rain_mm: number;
  rainy_days: number;
  heavy_rain_days: number;
  window_days: number;
}
export type ComparisonResult =
  | { ok: false; reason: 'need_two' | 'different_crops' | 'no_weather'; message: string; missing?: string[] }
  | {
      ok: true;
      crop_id: string;
      rows: ComparisonRow[];
      notes: string[];
      mixedCompleteness: boolean;
      fair: { first30: boolean; first60: boolean; totals: boolean };
      commonDaysAfterPlanting: number;
    };
export function compareSeasons(items: ComparisonItem[]): ComparisonResult;
