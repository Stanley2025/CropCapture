/**
 * Weather & Weather Alert Types for CropCapture Liberia
 */

export type SeasonType = 'Dry season' | 'Rainy season';

export type WeatherAlertType =
  | 'heavy_rain'
  | 'strong_wind'
  | 'dry_spell'
  | 'harvest_advice';

export interface CurrentWeather {
  temp_c: number;
  condition: string; // e.g. "Partly cloudy", "Moderate rain", "Sunny"
  rain_chance_pct: number;
  wind_kmh: number;
  humidity_pct: number;
  weather_code: number;
}

export interface WeatherAdvisory {
  id?: string;
  title: string; // e.g. "Good day to dry your rice"
  message: string; // e.g. "Rain is expected tomorrow afternoon. Harvest and dry your crop today, and cover stored paddy."
  severity: 'info' | 'warning' | 'alert';
  action_type: 'drying' | 'drainage' | 'staking' | 'irrigation' | 'general';
}

export interface DailyForecast {
  day: string; // "Today", "Sun", "Mon", "Tue", "Wed"
  date: string; // "YYYY-MM-DD"
  rain_chance_pct: number;
  temp_max_c: number;
  temp_min_c: number;
  condition: string;
  weather_code: number;
  expected_rain_mm?: number;
  wind_speed_kmh?: number;
}

export interface WeatherForecast {
  district_id: string;
  district_name: string;
  county_name: string;
  latitude: number;
  longitude: number;
  season: SeasonType;
  current: CurrentWeather;
  advisory: WeatherAdvisory;
  daily: DailyForecast[];
  updated_at: string; // ISO string
  updated_time_display: string; // e.g. "Updated 10:00"
  source: string; // e.g. "Open-Meteo API (Cached)"
  is_cached?: boolean;
}

export interface WeatherAlert {
  id: string;
  farm_id?: string;
  farm_name?: string;
  district_id: string;
  district_name: string;
  county_name: string;
  farmer_id?: string;
  alert_type: WeatherAlertType;
  title: string; // e.g. "Heavy rain tomorrow afternoon"
  message: string;
  action_advice: string; // Short action in plain English
  severity: 'warning' | 'critical' | 'info';
  is_read: boolean;
  created_at: string;
  timestamp_display: string; // e.g. "Today, 09:30" or "Mon"
  sms_sent: boolean;
  sms_message?: string;
}

export interface AlertSettings {
  heavy_rain: boolean;
  strong_wind: boolean;
  dry_spell: boolean;
  harvest_advice: boolean;
  sms_enabled: boolean;
  phone_number?: string;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  heavy_rain: true,
  strong_wind: true,
  dry_spell: true,
  harvest_advice: true,
  sms_enabled: true,
  phone_number: '+231-77-000-0000',
};

export interface AlertDeliveryLog {
  id: string;
  alert_id: string;
  delivery_channel: 'in_app' | 'sms' | 'push';
  provider: string; // 'Orange Liberia'
  recipient_phone?: string;
  message_body: string;
  character_count: number;
  status: 'delivered' | 'simulated' | 'pending' | 'failed';
  provider_response?: string;
  sent_at: string;
}
