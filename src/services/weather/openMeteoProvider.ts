/**
 * Open-Meteo Weather Provider Implementation
 * 
 * Free non-commercial global coverage including Liberia with no phone-side key needed.
 * Supports optional API key for commercial deployments via server environment variables.
 */

import { IWeatherProvider, WeatherQueryOptions } from './weatherProvider.interface';
import { WeatherForecast, DailyForecast, WeatherAdvisory, SeasonType } from '../../types/weather';

export class OpenMeteoProvider implements IWeatherProvider {
  public readonly name = 'Open-Meteo';
  private baseUrl: string;

  constructor(baseUrl = 'https://api.open-meteo.com/v1/forecast') {
    this.baseUrl = baseUrl;
  }

  public async fetchForecast(options: WeatherQueryOptions): Promise<WeatherForecast> {
    const { districtId, districtName, countyName, latitude, longitude, apiKey } = options;

    const params = new URLSearchParams({
      latitude: latitude.toFixed(4),
      longitude: longitude.toFixed(4),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
      hourly: 'precipitation_probability,precipitation,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
      timezone: 'Africa/Monrovia',
      forecast_days: '6',
    });

    if (apiKey) {
      params.append('apikey', apiKey);
    }

    const url = `${this.baseUrl}?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapToWeatherForecast(data, districtId, districtName, countyName, latitude, longitude);
  }

  private mapToWeatherForecast(
    raw: any,
    districtId: string,
    districtName: string,
    countyName: string,
    latitude: number,
    longitude: number
  ): WeatherForecast {
    const now = new Date();
    const current = raw.current || {};
    const daily = raw.daily || {};

    const tempC = Math.round(current.temperature_2m ?? 31);
    const humidityPct = Math.round(current.relative_humidity_2m ?? 74);
    const windKmh = Math.round(current.wind_speed_10m ?? 8);
    const weatherCode = current.weather_code ?? 2;
    const condition = this.getConditionName(weatherCode);

    // Liberia Seasons: Mid-November to Mid-April is Dry Season; Mid-April to Mid-November is Rainy Season
    const month = now.getMonth() + 1; // 1-12
    const dayOfMonth = now.getDate();
    let season: SeasonType = 'Rainy season';
    if (month > 11 || (month === 11 && dayOfMonth >= 15) || month < 4 || (month === 4 && dayOfMonth <= 15)) {
      season = 'Dry season';
    }

    // Daily next 5 days mapping
    const dailyList: DailyForecast[] = [];
    const dates: string[] = daily.time || [];
    const maxTemps: number[] = daily.temperature_2m_max || [];
    const minTemps: number[] = daily.temperature_2m_min || [];
    const rainChances: number[] = daily.precipitation_probability_max || [];
    const weatherCodes: number[] = daily.weather_code || [];
    const rainSums: number[] = daily.precipitation_sum || [];
    const windMaxes: number[] = daily.wind_speed_10m_max || [];

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < Math.min(dates.length, 5); i++) {
      const d = new Date(dates[i]);
      const dayName = i === 0 ? 'Today' : dayLabels[d.getDay()];
      const wCode = weatherCodes[i] ?? 1;

      dailyList.push({
        day: dayName,
        date: dates[i],
        rain_chance_pct: Math.round(rainChances[i] ?? 20),
        temp_max_c: Math.round(maxTemps[i] ?? 31),
        temp_min_c: Math.round(minTemps[i] ?? 24),
        condition: this.getConditionName(wCode),
        weather_code: wCode,
        expected_rain_mm: Number(rainSums[i] ?? 0),
        wind_speed_kmh: Number(windMaxes[i] ?? 10),
      });
    }

    // Determine Today's Rain Chance
    const todayRainChance = dailyList[0]?.rain_chance_pct ?? 20;

    // Advisory logic matching rural Liberian agriculture
    const tomorrowRainChance = dailyList[1]?.rain_chance_pct ?? 40;
    const tomorrowRainMm = dailyList[1]?.expected_rain_mm ?? 5;

    let advisory: WeatherAdvisory = {
      title: 'Good day to dry your rice and cocoa',
      message: 'Dry weather expected today. Turn drying cocoa beans and paddy rice in the sun.',
      severity: 'info',
      action_type: 'drying',
    };

    if (tomorrowRainChance >= 60 || tomorrowRainMm >= 20) {
      advisory = {
        title: 'Good day to dry your rice',
        message: 'Rain is expected tomorrow afternoon. Harvest and dry your crop today, and cover stored paddy.',
        severity: 'warning',
        action_type: 'drying',
      };
    } else if (dailyList.slice(0, 4).every((d) => d.rain_chance_pct < 20)) {
      advisory = {
        title: 'Low rain expected for 4 days',
        message: 'Water young seedlings in the morning. Mulch vegetable beds to keep soil moisture.',
        severity: 'info',
        action_type: 'irrigation',
      };
    }

    // Format updated time (e.g. "Updated 10:00")
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return {
      district_id: districtId,
      district_name: districtName,
      county_name: countyName,
      latitude,
      longitude,
      season,
      current: {
        temp_c: tempC,
        condition,
        rain_chance_pct: todayRainChance,
        wind_kmh: windKmh,
        humidity_pct: humidityPct,
        weather_code: weatherCode,
      },
      advisory,
      daily: dailyList,
      updated_at: now.toISOString(),
      updated_time_display: `Updated ${hours}:${minutes}`,
      source: 'Open-Meteo API',
    };
  }

  private getConditionName(code: number): string {
    switch (code) {
      case 0:
        return 'Clear sky';
      case 1:
        return 'Mainly sunny';
      case 2:
        return 'Partly cloudy';
      case 3:
        return 'Overcast';
      case 45:
      case 48:
        return 'Foggy';
      case 51:
      case 53:
      case 55:
        return 'Light drizzle';
      case 61:
        return 'Light rain';
      case 63:
        return 'Moderate rain';
      case 65:
        return 'Heavy rain expected';
      case 80:
      case 81:
      case 82:
        return 'Rain showers';
      case 95:
      case 96:
      case 99:
        return 'Thunderstorm expected';
      default:
        return 'Partly cloudy';
    }
  }
}
