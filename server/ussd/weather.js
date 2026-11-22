'use strict';
/**
 * 3-day county forecast for the USSD channel, from Open-Meteo.
 * - County -> coordinates map comes from the shared module (same as the app).
 * - 15-minute in-memory cache per county; stale cache is served if the API fails.
 */
const { findCounty } = require('../../src/shared/farmRecords');

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL_MS = 15 * 60 * 1000;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** WMO weather code -> short plain-English label. */
function describeWeatherCode(code) {
  const c = Number(code);
  if (c === 0) return 'Sunny';
  if (c <= 2) return 'Some sun';
  if (c === 3) return 'Cloudy';
  if (c === 45 || c === 48) return 'Fog';
  if (c >= 51 && c <= 57) return 'Drizzle';
  if (c >= 61 && c <= 67) return 'Rain';
  if (c >= 80 && c <= 82) return 'Showers';
  if (c >= 95) return 'Storms';
  return 'Mixed';
}

function createWeatherService({ fetchImpl = globalThis.fetch, now = () => Date.now(), ttlMs = CACHE_TTL_MS, baseUrl = OPEN_METEO_URL, timeoutMs = 4000 } = {}) {
  const cache = new Map();

  /** @returns {Promise<Array<{date,day,label,tMin,tMax,rainChance}>|null>} null when unavailable */
  async function getForecast(countyName) {
    const county = findCounty(countyName);
    if (!county) return null;

    const hit = cache.get(county.name);
    if (hit && now() - hit.at < ttlMs) return hit.days;

    const params = new URLSearchParams({
      latitude: String(county.latitude),
      longitude: String(county.longitude),
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: '3',
    });

    try {
      const opts = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(timeoutMs) } : {};
      const res = await fetchImpl(`${baseUrl}?${params}`, opts);
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      const json = await res.json();
      const d = json && json.daily;
      if (!d || !Array.isArray(d.time) || d.time.length === 0) throw new Error('Open-Meteo: no daily data');

      const days = d.time.slice(0, 3).map((date, i) => ({
        date,
        day: DAY_NAMES[new Date(`${date}T12:00:00Z`).getUTCDay()],
        label: describeWeatherCode(d.weather_code && d.weather_code[i]),
        tMin: Math.round(Number(d.temperature_2m_min && d.temperature_2m_min[i])),
        tMax: Math.round(Number(d.temperature_2m_max && d.temperature_2m_max[i])),
        rainChance: d.precipitation_probability_max ? Math.round(Number(d.precipitation_probability_max[i]) || 0) : null,
      }));
      cache.set(county.name, { at: now(), days });
      return days;
    } catch (err) {
      console.warn(`[weather] ${county.name}: ${err.message}`);
      return hit ? hit.days : null; // stale is better than nothing
    }
  }

  return { getForecast, _cache: cache };
}

module.exports = { createWeatherService, describeWeatherCode, OPEN_METEO_URL, CACHE_TTL_MS };
