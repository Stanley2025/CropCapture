/**
 * Weather Service for CropCapture
 * 
 * Manages weather forecast fetching with district-level caching (every 3-6 hours),
 * offline persistence via AsyncStorage, alert evaluations, and Orange Liberia SMS delivery.
 * Resilient: NEVER crashes if the weather API fails.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { IWeatherProvider, WeatherQueryOptions } from './weatherProvider.interface';
import { OpenMeteoProvider } from './openMeteoProvider';
import {
  WeatherForecast,
  WeatherAlert,
  AlertSettings,
  DEFAULT_ALERT_SETTINGS,
  AlertDeliveryLog,
} from '../../types/weather';
import { WeatherAlertEngine, AlertEvaluationContext } from './weatherAlertEngine';
import { getDistrictCoordinates } from '../../constants/liberiaCoordinates';

const STORAGE_KEYS = {
  WEATHER_FORECAST_PREFIX: '@cropcapture_weather_forecast_',
  WEATHER_ALERTS: '@cropcapture_weather_alerts',
  ALERT_SETTINGS: '@cropcapture_alert_settings',
  DELIVERY_LOGS: '@cropcapture_weather_delivery_logs',
};

// 4 Hours Cache Expiry (in milliseconds)
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

export class WeatherService {
  private provider: IWeatherProvider;

  constructor(provider: IWeatherProvider = new OpenMeteoProvider()) {
    this.provider = provider;
  }

  /**
   * Allows hot-swapping weather provider at runtime (e.g. for testing or commercial keys).
   */
  public setProvider(provider: IWeatherProvider): void {
    this.provider = provider;
  }

  public getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Fetches district weather forecast with caching and offline resilience.
   * If online and cache is stale: fetches from provider and updates cache.
   * If offline or API fails: returns last cached forecast, never throwing an unhandled error.
   */
  public async getDistrictForecast(
    districtId: string,
    districtName: string,
    countyName: string,
    customCoords?: { latitude?: number | null; longitude?: number | null }
  ): Promise<WeatherForecast | null> {
    const cacheKey = `${STORAGE_KEYS.WEATHER_FORECAST_PREFIX}${districtId || 'default'}`;
    const resolvedCoords =
      customCoords?.latitude && customCoords?.longitude
        ? { latitude: customCoords.latitude, longitude: customCoords.longitude }
        : getDistrictCoordinates(districtName, countyName);

    // 1. Try reading local cached forecast first
    let cachedForecast: WeatherForecast | null = null;
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (raw) {
        cachedForecast = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Error reading cached weather forecast:', e);
    }

    // 2. Determine if cache is fresh (< 4 hours)
    const now = Date.now();
    const isFresh =
      cachedForecast &&
      cachedForecast.updated_at &&
      now - new Date(cachedForecast.updated_at).getTime() < CACHE_TTL_MS;

    if (isFresh && cachedForecast) {
      return { ...cachedForecast, is_cached: true };
    }

    // 3. Attempt live fetch from Weather Provider
    try {
      const queryOptions: WeatherQueryOptions = {
        districtId,
        districtName,
        countyName,
        latitude: resolvedCoords.latitude,
        longitude: resolvedCoords.longitude,
      };

      const freshForecast = await this.provider.fetchForecast(queryOptions);

      // Persist to local cache
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(freshForecast));
      } catch (saveErr) {
        console.warn('Failed to cache weather forecast:', saveErr);
      }

      return freshForecast;
    } catch (apiError) {
      console.warn('Weather API fetch failed, falling back to cached or baseline data:', apiError);

      // Return stale cache if available
      if (cachedForecast) {
        return {
          ...cachedForecast,
          is_cached: true,
          source: `${cachedForecast.source} (Offline Cache)`,
        };
      }

      // Nothing saved and no connection: there is no forecast. Never show made-up numbers.
      return null;
    }
  }

  /**
   * The forecast for where this farmer farms: their farm's place, otherwise the place on their profile.
   * Returns null when no place is known yet, or when there is neither a connection nor a saved forecast.
   */
  public async getForecastFor(
    farm?: { district?: string | null; county?: string | null; district_id?: string | null; latitude?: number | null; longitude?: number | null } | null,
    person?: { district?: string | null; county?: string | null } | null
  ): Promise<WeatherForecast | null> {
    const district = (farm?.district || person?.district || '').trim();
    const county = (farm?.county || person?.county || '').trim();
    const hasCoords = Boolean(farm?.latitude && farm?.longitude);
    if (!district && !county && !hasCoords) return null;
    const districtId = farm?.district_id || `${county}_${district}`.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return this.getDistrictForecast(districtId, district, county, farm ? { latitude: farm.latitude, longitude: farm.longitude } : undefined);
  }

  // =========================================================================
  // WEATHER ALERTS PERSISTENCE & EVALUATION
  // =========================================================================

  /**
   * Retrieves all weather alerts stored on the device.
   */
  public async getAlerts(farmerId?: string): Promise<WeatherAlert[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.WEATHER_ALERTS);
      if (raw) {
        let alerts: WeatherAlert[] = JSON.parse(raw);
        if (farmerId) {
          alerts = alerts.filter((a) => !a.farmer_id || a.farmer_id === farmerId);
        }
        return alerts;
      }
    } catch (e) {
      console.warn('Failed to load alerts from storage:', e);
    }

    return [];
  }

  /**
   * Marks an alert as read / acknowledged ("Got it" action).
   */
  public async markAlertAsRead(alertId: string): Promise<WeatherAlert[]> {
    const alerts = await this.getAlerts();
    const updated = alerts.map((a) => (a.id === alertId ? { ...a, is_read: true } : a));
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.WEATHER_ALERTS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save read alert status:', e);
    }
    return updated;
  }

  /**
   * Computes unread alerts count for the header bell badge.
   */
  public async getUnreadAlertCount(farmerId?: string): Promise<number> {
    const alerts = await this.getAlerts(farmerId);
    return alerts.filter((a) => !a.is_read).length;
  }

  // =========================================================================
  // ALERT SETTINGS PERSISTENCE
  // =========================================================================

  public async getAlertSettings(farmerId?: string): Promise<AlertSettings> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.ALERT_SETTINGS);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to load alert settings:', e);
    }
    return { ...DEFAULT_ALERT_SETTINGS };
  }

  public async saveAlertSettings(settings: AlertSettings, farmerId?: string): Promise<AlertSettings> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ALERT_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to persist alert settings:', e);
    }
    return settings;
  }

  // =========================================================================
  // ALERT DELIVERY AUDIT LOGS (ADMIN VISIBILITY)
  // =========================================================================

  public async getDeliveryLogs(): Promise<AlertDeliveryLog[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.DELIVERY_LOGS);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {}
    return [];
  }

  public async appendDeliveryLogs(newLogs: AlertDeliveryLog[]): Promise<void> {
    if (!newLogs || newLogs.length === 0) return;
    const existing = await this.getDeliveryLogs();
    const combined = [...newLogs, ...existing].slice(0, 200); // keep last 200 logs
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DELIVERY_LOGS, JSON.stringify(combined));
    } catch (e) {}
  }
}

export const weatherService = new WeatherService();
