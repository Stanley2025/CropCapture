'use strict';
/**
 * Weather the farmer saw on the day of an activity.
 *
 * Three optional fields on the activity record, all chosen or measured by the farmer:
 *   weather_sky  sunny | cloudy | rain | heavy_rain
 *   rain_mm      0 to 500 (what they measured, if they have a rain gauge)
 *   day_feel     cool | warm | hot
 * Records saved before these fields existed have none of them; they read as null and are
 * never filled in for the farmer.
 */

const SKY_OPTIONS = Object.freeze(['sunny', 'cloudy', 'rain', 'heavy_rain']);
const DAY_FEEL_OPTIONS = Object.freeze(['cool', 'warm', 'hot']);
const RAIN_MM_MIN = 0;
const RAIN_MM_MAX = 500;

const SKY_LABEL = Object.freeze({ sunny: 'Sunny', cloudy: 'Cloudy', rain: 'Rain', heavy_rain: 'Heavy rain' });
const FEEL_LABEL = Object.freeze({ cool: 'Cool', warm: 'Warm', hot: 'Hot' });

/**
 * Read-side tolerance for old records: the three fields are present and null when missing.
 * Nothing is written back, so existing rows are not altered.
 */
function normalizeActivity(activity) {
  if (!activity || typeof activity !== 'object') return activity;
  const sky = SKY_OPTIONS.includes(activity.weather_sky) ? activity.weather_sky : null;
  const feel = DAY_FEEL_OPTIONS.includes(activity.day_feel) ? activity.day_feel : null;
  const rain = activity.rain_mm === null || activity.rain_mm === undefined || activity.rain_mm === '' ? null : Number(activity.rain_mm);
  return { ...activity, weather_sky: sky, rain_mm: Number.isFinite(rain) ? rain : null, day_feel: feel };
}

/**
 * Check what the farmer entered. Empty is always fine (weather is optional). A rain amount that is
 * entered must be a number from 0 to 500.
 * @returns {{ ok: boolean, values: {weather_sky, rain_mm, day_feel}, errors: {rain_mm?: string} }}
 */
function validateWeather({ sky = null, rainMm = '', dayFeel = null } = {}) {
  const errors = {};
  let rain = null;
  const raw = String(rainMm === null || rainMm === undefined ? '' : rainMm).trim().replace(',', '.');
  if (raw !== '') {
    const n = Number(raw);
    if (!/^\d+(\.\d+)?$/.test(raw) || !Number.isFinite(n)) errors.rain_mm = 'rainNotNumber';
    else if (n < RAIN_MM_MIN || n > RAIN_MM_MAX) errors.rain_mm = 'rainOutOfRange';
    else rain = Math.round(n * 10) / 10;
  }
  return {
    ok: Object.keys(errors).length === 0,
    values: {
      weather_sky: SKY_OPTIONS.includes(sky) ? sky : null,
      rain_mm: rain,
      day_feel: DAY_FEEL_OPTIONS.includes(dayFeel) ? dayFeel : null,
    },
    errors,
  };
}

/** Short text for a list row, e.g. "Rain · 12 mm" or "Sunny · Hot"; null when nothing was recorded. */
function weatherLabel(activity) {
  const a = normalizeActivity(activity);
  if (!a) return null;
  const parts = [];
  if (a.weather_sky) parts.push(SKY_LABEL[a.weather_sky]);
  if (a.rain_mm !== null) parts.push(`${a.rain_mm} mm`);
  if (a.day_feel) parts.push(FEEL_LABEL[a.day_feel]);
  return parts.length ? parts.join(' · ') : null;
}

/** A day counts as rainy when the sky is rain or heavy rain, or the measured rain is above 0. */
function isRainy(activity) {
  const a = normalizeActivity(activity);
  if (!a) return false;
  return a.weather_sky === 'rain' || a.weather_sky === 'heavy_rain' || (a.rain_mm !== null && a.rain_mm > 0);
}

/** True when the farmer recorded any weather on this activity. */
function hasWeather(activity) {
  const a = normalizeActivity(activity);
  return Boolean(a && (a.weather_sky || a.rain_mm !== null || a.day_feel));
}

module.exports = {
  SKY_OPTIONS,
  DAY_FEEL_OPTIONS,
  RAIN_MM_MIN,
  RAIN_MM_MAX,
  SKY_LABEL,
  FEEL_LABEL,
  normalizeActivity,
  validateWeather,
  weatherLabel,
  isRainy,
  hasWeather,
};
