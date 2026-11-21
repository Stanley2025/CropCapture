export type WeatherSky = 'sunny' | 'cloudy' | 'rain' | 'heavy_rain';
export type DayFeel = 'cool' | 'warm' | 'hot';
export const SKY_OPTIONS: readonly WeatherSky[];
export const DAY_FEEL_OPTIONS: readonly DayFeel[];
export const RAIN_MM_MIN: number;
export const RAIN_MM_MAX: number;
export const SKY_LABEL: Readonly<Record<WeatherSky, string>>;
export const FEEL_LABEL: Readonly<Record<DayFeel, string>>;
export function normalizeActivity<T extends object>(activity: T): T & { weather_sky: WeatherSky | null; rain_mm: number | null; day_feel: DayFeel | null };
export function validateWeather(input?: { sky?: string | null; rainMm?: string | number | null; dayFeel?: string | null }): {
  ok: boolean;
  values: { weather_sky: WeatherSky | null; rain_mm: number | null; day_feel: DayFeel | null };
  errors: { rain_mm?: 'rainNotNumber' | 'rainOutOfRange' };
};
export function weatherLabel(activity: any): string | null;
export function isRainy(activity: any): boolean;
export function hasWeather(activity: any): boolean;
