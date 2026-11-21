/**
 * Weather Alert Engine for CropCapture Liberia
 * 
 * Evaluates weather forecasts against configurable thresholds, respects farmer alert settings,
 * enforces cooldown to prevent duplicate alerts, and routes warnings to in-app & Orange Liberia SMS.
 */

import {
  WeatherForecast,
  WeatherAlert,
  AlertSettings,
  DEFAULT_ALERT_SETTINGS,
  AlertDeliveryLog,
} from '../../types/weather';
import { WEATHER_ALERT_RULES } from '../../config/weatherAlertRules';
import { orangeSmsService } from '../sms/orangeLiberiaSmsService';

export interface AlertEvaluationContext {
  farmId?: string;
  farmName?: string;
  farmerId?: string;
  farmerPhone?: string;
  hasCropsNearHarvest?: boolean;
  settings?: AlertSettings;
  existingAlerts?: WeatherAlert[];
}

export class WeatherAlertEngine {
  /**
   * Evaluates a district's weather forecast and returns newly triggered alerts.
   */
  public static evaluateForecast(
    forecast: WeatherForecast,
    context: AlertEvaluationContext = {}
  ): WeatherAlert[] {
    const settings = context.settings || DEFAULT_ALERT_SETTINGS;
    const existingAlerts = context.existingAlerts || [];
    const triggeredAlerts: WeatherAlert[] = [];
    const now = new Date();

    const daily = forecast.daily || [];
    if (daily.length < 2) return [];

    // Helper: Checks if alert type is in cooldown for this farm/district
    const isInCooldown = (alertType: string, cooldownHours: number): boolean => {
      const cutoffTime = new Date(now.getTime() - cooldownHours * 60 * 60 * 1000);
      return existingAlerts.some((a) => {
        if (a.alert_type !== alertType) return false;
        if (context.farmId && a.farm_id !== context.farmId) return false;
        const alertTime = new Date(a.created_at);
        return alertTime >= cutoffTime;
      });
    };

    // -------------------------------------------------------------
    // RULE 1: HEAVY RAIN
    // -------------------------------------------------------------
    if (settings.heavy_rain && WEATHER_ALERT_RULES.heavy_rain.enabled) {
      const cfg = WEATHER_ALERT_RULES.heavy_rain;
      // Check next 24 to 48 hours (Tomorrow / Day 1 and Day 2)
      const nextDays = daily.slice(1, 3);
      const heavyRainDay = nextDays.find(
        (d) =>
          d.rain_chance_pct >= cfg.precipitation_prob_threshold &&
          (d.expected_rain_mm || 0) >= cfg.expected_rain_mm_threshold
      );

      if (heavyRainDay && !isInCooldown('heavy_rain', cfg.cooldown_hours)) {
        const rainAmount = Math.round(heavyRainDay.expected_rain_mm || cfg.expected_rain_mm_threshold);
        const dayLabel = heavyRainDay.day === 'Tomorrow' || heavyRainDay.day === 'Sun' ? 'tomorrow afternoon' : `on ${heavyRainDay.day}`;

        triggeredAlerts.push({
          id: `alert_rain_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          farm_id: context.farmId,
          farm_name: context.farmName,
          district_id: forecast.district_id,
          district_name: forecast.district_name,
          county_name: forecast.county_name,
          farmer_id: context.farmerId,
          alert_type: 'heavy_rain',
          title: `Heavy rain expected ${dayLabel}`,
          message: `${forecast.district_name}, ${forecast.county_name}. High chance of heavy rain (~${rainAmount} mm, ${heavyRainDay.rain_chance_pct}% chance).`,
          action_advice: cfg.action_advice,
          severity: 'critical',
          is_read: false,
          created_at: now.toISOString(),
          timestamp_display: 'Today, ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sms_sent: false,
        });
      }
    }

    // -------------------------------------------------------------
    // RULE 2: STRONG WIND
    // -------------------------------------------------------------
    if (settings.strong_wind && WEATHER_ALERT_RULES.strong_wind.enabled) {
      const cfg = WEATHER_ALERT_RULES.strong_wind;
      const windyDay = daily.slice(0, 3).find(
        (d) => (d.wind_speed_kmh || 0) >= cfg.wind_speed_kmh_threshold
      );

      if (windyDay && !isInCooldown('strong_wind', cfg.cooldown_hours)) {
        const windKmh = Math.round(windyDay.wind_speed_kmh || cfg.wind_speed_kmh_threshold);
        triggeredAlerts.push({
          id: `alert_wind_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          farm_id: context.farmId,
          farm_name: context.farmName,
          district_id: forecast.district_id,
          district_name: forecast.district_name,
          county_name: forecast.county_name,
          farmer_id: context.farmerId,
          alert_type: 'strong_wind',
          title: cfg.default_title,
          message: `Strong winds (~${windKmh} km/h) expected in ${forecast.district_name}.`,
          action_advice: cfg.action_advice,
          severity: 'warning',
          is_read: false,
          created_at: now.toISOString(),
          timestamp_display: 'Today, ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sms_sent: false,
        });
      }
    }

    // -------------------------------------------------------------
    // RULE 3: DRY SPELL (Growing season only)
    // -------------------------------------------------------------
    if (settings.dry_spell && WEATHER_ALERT_RULES.dry_spell.enabled) {
      const cfg = WEATHER_ALERT_RULES.dry_spell;
      const currentMonth = now.getMonth() + 1; // 1-12
      const isGrowingSeason = cfg.active_months.includes(currentMonth);

      if (isGrowingSeason) {
        // Evaluate consecutive dry days (< 2.5mm rain)
        const allDry = daily.every((d) => (d.expected_rain_mm || 0) < cfg.daily_rain_mm_max && d.rain_chance_pct < 25);
        if (allDry && !isInCooldown('dry_spell', cfg.cooldown_hours)) {
          triggeredAlerts.push({
            id: `alert_dry_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            farm_id: context.farmId,
            farm_name: context.farmName,
            district_id: forecast.district_id,
            district_name: forecast.district_name,
            county_name: forecast.county_name,
            farmer_id: context.farmerId,
            alert_type: 'dry_spell',
            title: cfg.default_title,
            message: `No meaningful rain expected for 7 days in ${forecast.district_name}, ${forecast.county_name}.`,
            action_advice: cfg.action_advice,
            severity: 'warning',
            is_read: false,
            created_at: now.toISOString(),
            timestamp_display: 'Today, ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sms_sent: false,
          });
        }
      }
    }

    // -------------------------------------------------------------
    // RULE 4: HARVEST-DAY ADVICE
    // -------------------------------------------------------------
    if (settings.harvest_advice && WEATHER_ALERT_RULES.harvest_advice.enabled) {
      const cfg = WEATHER_ALERT_RULES.harvest_advice;
      // Good drying window: today & tomorrow low rain, followed by higher rain probability
      const dryingDays = daily.slice(0, 2);
      const isGoodDrying = dryingDays.every(
        (d) => d.rain_chance_pct <= cfg.drying_day_max_rain_chance && (d.expected_rain_mm || 0) <= cfg.drying_day_max_rain_mm
      );
      const rainApproaching = daily.slice(2, 4).some((d) => d.rain_chance_pct >= cfg.impending_rain_chance);

      if (isGoodDrying && rainApproaching && !isInCooldown('harvest_advice', cfg.cooldown_hours)) {
        triggeredAlerts.push({
          id: `alert_harvest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          farm_id: context.farmId,
          farm_name: context.farmName,
          district_id: forecast.district_id,
          district_name: forecast.district_name,
          county_name: forecast.county_name,
          farmer_id: context.farmerId,
          alert_type: 'harvest_advice',
          title: cfg.default_title,
          message: `Drying window open for the next 2 days in ${forecast.district_name}. Rain expected afterwards.`,
          action_advice: cfg.action_advice,
          severity: 'info',
          is_read: false,
          created_at: now.toISOString(),
          timestamp_display: 'Today, ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sms_sent: false,
        });
      }
    }

    return triggeredAlerts;
  }

  /**
   * Dispatches alerts to Orange Liberia SMS if enabled by farmer settings.
   */
  public static async dispatchAlerts(
    alerts: WeatherAlert[],
    context: AlertEvaluationContext
  ): Promise<{ alerts: WeatherAlert[]; deliveryLogs: AlertDeliveryLog[] }> {
    const settings = context.settings || DEFAULT_ALERT_SETTINGS;
    const deliveryLogs: AlertDeliveryLog[] = [];
    const updatedAlerts = [...alerts];

    if (settings.sms_enabled && context.farmerPhone) {
      for (const alert of updatedAlerts) {
        try {
          const log = await orangeSmsService.sendAlertSms(context.farmerPhone, alert);
          alert.sms_sent = true;
          alert.sms_message = log.message_body;
          deliveryLogs.push(log);
        } catch (err: any) {
          console.error('Failed to dispatch Orange SMS alert:', err);
        }
      }
    }

    return { alerts: updatedAlerts, deliveryLogs };
  }
}
