/**
 * Weather Alert Thresholds and Rules Engine Configuration for Liberia.
 * 
 * Edit this single file to tune thresholds, cooldown periods, and alert templates.
 */

export interface WeatherAlertRulesConfig {
  heavy_rain: {
    enabled: boolean;
    precipitation_prob_threshold: number; // Percentage (e.g. 70%)
    expected_rain_mm_threshold: number; // Millimeters in 24-48h (e.g. 25mm)
    timeframe_hours: number;
    cooldown_hours: number; // Do not resend same alert within this timeframe
    default_title: string;
    action_advice: string;
  };
  strong_wind: {
    enabled: boolean;
    wind_speed_kmh_threshold: number; // km/h (e.g. 35 km/h)
    wind_gusts_kmh_threshold: number; // km/h (e.g. 50 km/h)
    cooldown_hours: number;
    default_title: string;
    action_advice: string;
  };
  dry_spell: {
    enabled: boolean;
    consecutive_dry_days_threshold: number; // 7 days
    daily_rain_mm_max: number; // < 2.5mm considered no meaningful rain
    active_months: number[]; // 1-12 (Liberia main growing season: Apr-Oct = [4, 5, 6, 7, 8, 9, 10])
    cooldown_hours: number;
    default_title: string;
    action_advice: string;
  };
  harvest_advice: {
    enabled: boolean;
    min_drying_days: number; // Consecutive good drying days (e.g. 2 or 3)
    drying_day_max_rain_chance: number; // Max rain chance for drying day (e.g. 30%)
    drying_day_max_rain_mm: number; // Max rainfall for drying day (e.g. 2.0 mm)
    impending_rain_chance: number; // High rain chance following the drying window (e.g. 60%)
    cooldown_hours: number;
    default_title: string;
    action_advice: string;
  };
}

export const WEATHER_ALERT_RULES: WeatherAlertRulesConfig = {
  // 1. HEAVY RAIN
  // Threshold: >= 70% rain probability AND >= 25 mm expected rainfall in 24-48h.
  // Rationale: Liberia experiences frequent showers; 25 mm+ in 24h causes soil erosion,
  // waterlogged cassava beds, fertilizer runoff, and destroys sun-drying cocoa/rice.
  heavy_rain: {
    enabled: true,
    precipitation_prob_threshold: 70, // >= 70%
    expected_rain_mm_threshold: 25.0, // >= 25 mm
    timeframe_hours: 48,
    cooldown_hours: 24, // 24-hour cooldown
    default_title: 'Heavy rain expected tomorrow afternoon',
    action_advice: 'Harvest and dry your rice today. Cover stored paddy and clear drains around your plots.',
  },

  // 2. STRONG WIND
  // Threshold: Sustained wind >= 35 km/h OR gusts >= 50 km/h.
  // Rationale: Tropical line squalls lodge mature cassava/rice, break cocoa limbs,
  // and rip tarpaulins and shelter roofs.
  strong_wind: {
    enabled: true,
    wind_speed_kmh_threshold: 35.0, // >= 35 km/h
    wind_gusts_kmh_threshold: 50.0, // >= 50 km/h
    cooldown_hours: 24,
    default_title: 'Strong wind expected',
    action_advice: 'Secure drying mats and tall crops. Check animal shelters and tie down loose roofing.',
  },

  // 3. DRY SPELL
  // Threshold: 7 consecutive days with < 2.5 mm rainfall during growing season.
  // Rationale: Rainfed rice and young cocoa saplings develop acute water deficit
  // without rainfall for a week.
  dry_spell: {
    enabled: true,
    consecutive_dry_days_threshold: 7, // 7 days
    daily_rain_mm_max: 2.5, // < 2.5 mm
    active_months: [4, 5, 6, 7, 8, 9, 10], // April through October
    cooldown_hours: 48,
    default_title: 'Dry spell: no rain expected for 7 days',
    action_advice: 'Water young seedlings in the morning. Mulch around crops to retain soil moisture.',
  },

  // 4. HARVEST-DAY ADVICE
  // Threshold: 2-3 consecutive dry days (< 30% rain chance, < 2 mm) followed by rain (>= 60%).
  // Rationale: Cocoa and paddy rice require consecutive days of sun to reach export moisture
  // (cocoa <= 7.5%, paddy <= 14%) without molding.
  harvest_advice: {
    enabled: true,
    min_drying_days: 2,
    drying_day_max_rain_chance: 30, // <= 30%
    drying_day_max_rain_mm: 2.0, // <= 2.0 mm
    impending_rain_chance: 60, // >= 60% rain following
    cooldown_hours: 24,
    default_title: 'Good day to dry your rice and cocoa',
    action_advice: 'Rain is expected in 2 days. Harvest and dry your crop today, and cover stored paddy.',
  },
};
