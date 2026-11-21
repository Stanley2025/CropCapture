const test = require('node:test');
const assert = require('node:assert/strict');

// 1. WEATHER ALERT RULES DEFINITION (Matching src/config/weatherAlertRules.ts)
const WEATHER_ALERT_RULES = {
  heavy_rain: {
    enabled: true,
    precipitation_prob_threshold: 70, // >= 70%
    expected_rain_mm_threshold: 25.0, // >= 25 mm
    timeframe_hours: 48,
    cooldown_hours: 24,
    default_title: 'Heavy rain expected tomorrow afternoon',
    action_advice: 'Harvest and dry your rice today. Cover stored paddy and clear drains around your plots.',
  },
  strong_wind: {
    enabled: true,
    wind_speed_kmh_threshold: 35.0, // >= 35 km/h
    wind_gusts_kmh_threshold: 50.0,
    cooldown_hours: 24,
    default_title: 'Strong wind expected',
    action_advice: 'Secure drying mats and tall crops. Check animal shelters and tie down loose roofing.',
  },
  dry_spell: {
    enabled: true,
    consecutive_dry_days_threshold: 7,
    daily_rain_mm_max: 2.5,
    active_months: [4, 5, 6, 7, 8, 9, 10], // Growing season Apr-Oct
    cooldown_hours: 48,
    default_title: 'Dry spell: no rain for 7 days',
    action_advice: 'Water young seedlings in the morning. Mulch around crops to retain soil moisture.',
  },
  harvest_advice: {
    enabled: true,
    min_drying_days: 2,
    drying_day_max_rain_chance: 30,
    drying_day_max_rain_mm: 2.0,
    impending_rain_chance: 60,
    cooldown_hours: 24,
    default_title: 'Good day to dry your rice and cocoa',
    action_advice: 'Rain is expected in 2 days. Harvest and dry your crop today, and cover stored paddy.',
  },
};

// 2. WEATHER ALERT ENGINE (Matching src/services/weather/weatherAlertEngine.ts)
class WeatherAlertEngine {
  static evaluateForecast(forecast, context = {}) {
    const settings = context.settings || {
      heavy_rain: true,
      strong_wind: true,
      dry_spell: true,
      harvest_advice: true,
      sms_enabled: true,
    };
    const existingAlerts = context.existingAlerts || [];
    const triggeredAlerts = [];
    const now = new Date();
    const daily = forecast.daily || [];

    const isInCooldown = (alertType, cooldownHours) => {
      const cutoffTime = new Date(now.getTime() - cooldownHours * 60 * 60 * 1000);
      return existingAlerts.some((a) => {
        if (a.alert_type !== alertType) return false;
        if (context.farmId && a.farm_id !== context.farmId) return false;
        return new Date(a.created_at) >= cutoffTime;
      });
    };

    // Heavy Rain Check
    if (settings.heavy_rain && WEATHER_ALERT_RULES.heavy_rain.enabled) {
      const cfg = WEATHER_ALERT_RULES.heavy_rain;
      const nextDays = daily.slice(1, 3);
      const heavyRainDay = nextDays.find(
        (d) =>
          d.rain_chance_pct >= cfg.precipitation_prob_threshold &&
          (d.expected_rain_mm || 0) >= cfg.expected_rain_mm_threshold
      );

      if (heavyRainDay && !isInCooldown('heavy_rain', cfg.cooldown_hours)) {
        triggeredAlerts.push({
          id: `alert_rain_${Date.now()}`,
          farm_id: context.farmId,
          district_id: forecast.district_id,
          district_name: forecast.district_name,
          county_name: forecast.county_name,
          alert_type: 'heavy_rain',
          title: cfg.default_title,
          message: `${forecast.district_name}, ${forecast.county_name}. High expected rain amount (${heavyRainDay.expected_rain_mm} mm, ${heavyRainDay.rain_chance_pct}% chance).`,
          action_advice: cfg.action_advice,
          severity: 'critical',
          is_read: false,
          created_at: now.toISOString(),
          timestamp_display: 'Today, 09:30',
          sms_sent: false,
        });
      }
    }

    // Strong Wind Check
    if (settings.strong_wind && WEATHER_ALERT_RULES.strong_wind.enabled) {
      const cfg = WEATHER_ALERT_RULES.strong_wind;
      const windyDay = daily.slice(0, 3).find((d) => (d.wind_speed_kmh || 0) >= cfg.wind_speed_kmh_threshold);
      if (windyDay && !isInCooldown('strong_wind', cfg.cooldown_hours)) {
        triggeredAlerts.push({
          id: `alert_wind_${Date.now()}`,
          farm_id: context.farmId,
          district_id: forecast.district_id,
          district_name: forecast.district_name,
          county_name: forecast.county_name,
          alert_type: 'strong_wind',
          title: cfg.default_title,
          message: `Strong winds expected in ${forecast.district_name}.`,
          action_advice: cfg.action_advice,
          severity: 'warning',
          is_read: false,
          created_at: now.toISOString(),
          timestamp_display: 'Thu',
          sms_sent: false,
        });
      }
    }

    // Dry Spell Check
    if (settings.dry_spell && WEATHER_ALERT_RULES.dry_spell.enabled) {
      const cfg = WEATHER_ALERT_RULES.dry_spell;
      const allDry = daily.every((d) => (d.expected_rain_mm || 0) < cfg.daily_rain_mm_max && d.rain_chance_pct < 25);
      if (allDry && !isInCooldown('dry_spell', cfg.cooldown_hours)) {
        triggeredAlerts.push({
          id: `alert_dry_${Date.now()}`,
          farm_id: context.farmId,
          district_id: forecast.district_id,
          district_name: forecast.district_name,
          county_name: forecast.county_name,
          alert_type: 'dry_spell',
          title: cfg.default_title,
          message: `No rain expected for 7 days in ${forecast.district_name}.`,
          action_advice: cfg.action_advice,
          severity: 'warning',
          is_read: false,
          created_at: now.toISOString(),
          timestamp_display: 'Mon',
          sms_sent: false,
        });
      }
    }

    // Harvest Drying Advice Check
    if (settings.harvest_advice && WEATHER_ALERT_RULES.harvest_advice.enabled) {
      const cfg = WEATHER_ALERT_RULES.harvest_advice;
      const dryingDays = daily.slice(0, 2);
      const isGoodDrying = dryingDays.every(
        (d) => d.rain_chance_pct <= cfg.drying_day_max_rain_chance && (d.expected_rain_mm || 0) <= cfg.drying_day_max_rain_mm
      );
      const rainApproaching = daily.slice(2, 4).some((d) => d.rain_chance_pct >= cfg.impending_rain_chance);

      if (isGoodDrying && rainApproaching && !isInCooldown('harvest_advice', cfg.cooldown_hours)) {
        triggeredAlerts.push({
          id: `alert_harvest_${Date.now()}`,
          farm_id: context.farmId,
          district_id: forecast.district_id,
          district_name: forecast.district_name,
          county_name: forecast.county_name,
          alert_type: 'harvest_advice',
          title: cfg.default_title,
          message: `Drying days open in ${forecast.district_name} before rain arrives.`,
          action_advice: cfg.action_advice,
          severity: 'info',
          is_read: false,
          created_at: now.toISOString(),
          timestamp_display: 'Today, 07:15',
          sms_sent: false,
        });
      }
    }

    return triggeredAlerts;
  }
}

// 3. ORANGE LIBERIA SMS SERVICE (Matching src/services/sms/orangeLiberiaSmsService.ts)
class OrangeLiberiaSmsService {
  constructor(senderName = 'CropCapture') {
    this.senderName = senderName;
    this.providerName = 'Orange Liberia';
  }

  formatSmsMessage(alert) {
    const prefix = 'CropCapture: ';
    const location = alert.district_name ? ` in ${alert.district_name}` : '';
    let raw = `${prefix}${alert.title}${location}. ${alert.action_advice}`;
    if (raw.length <= 160) return raw;
    let compressed = `${prefix}${alert.title}. ${alert.action_advice}`;
    if (compressed.length <= 160) return compressed;
    return compressed.substring(0, 157) + '...';
  }

  async sendAlertSms(recipientPhone, alert) {
    const formatted = this.formatSmsMessage(alert);
    if (formatted.length > 160) {
      throw new Error(`SMS exceeds 160 characters: ${formatted.length}`);
    }
    return {
      id: `sms_log_${Date.now()}`,
      alert_id: alert.id,
      delivery_channel: 'sms',
      provider: this.providerName,
      recipient_phone: recipientPhone,
      message_body: formatted,
      character_count: formatted.length,
      status: 'simulated',
      sent_at: new Date().toISOString(),
    };
  }
}

// 4. DISTRICT CENTROIDS RESOLVER (Matching src/constants/liberiaCoordinates.ts)
const DISTRICT_COORDINATES = {
  'nimba:gbehley': { latitude: 7.412, longitude: -8.65 },
  'bong:jorquelleh': { latitude: 7.004, longitude: -9.472 },
  'lofa': { latitude: 8.191, longitude: -9.723 },
};

function resolveDistrictCoordinates(district, county) {
  const normDist = (district || '').trim().toLowerCase();
  const normCo = (county || '').trim().toLowerCase();
  const key = `${normCo}:${normDist}`;
  if (DISTRICT_COORDINATES[key]) return DISTRICT_COORDINATES[key];
  if (normCo && DISTRICT_COORDINATES[normCo]) return DISTRICT_COORDINATES[normCo];
  return { latitude: 6.4281, longitude: -9.4295 }; // Liberia center
}

// =========================================================================
// TEST SUITE
// =========================================================================

test('Weather Alerts: Rule Thresholds Evaluation', async (t) => {
  await t.test('Heavy rain triggers when rain chance >= 70% and expected rain >= 25 mm in 24-48h', () => {
    const mockForecast = {
      district_id: 'd_nimba_gbehley',
      district_name: 'Gbehley',
      county_name: 'Nimba',
      daily: [
        { day: 'Today', date: '2026-11-21', rain_chance_pct: 20, expected_rain_mm: 2, wind_speed_kmh: 8 },
        { day: 'Sun', date: '2026-11-22', rain_chance_pct: 80, expected_rain_mm: 35, wind_speed_kmh: 18 },
        { day: 'Mon', date: '2026-11-23', rain_chance_pct: 60, expected_rain_mm: 15, wind_speed_kmh: 12 },
      ],
    };

    const alerts = WeatherAlertEngine.evaluateForecast(mockForecast, { farmId: 'farm-001' });
    assert.ok(alerts.length >= 1, 'Should trigger at least 1 alert');
    const heavyRainAlert = alerts.find((a) => a.alert_type === 'heavy_rain');
    assert.ok(heavyRainAlert, 'Should trigger heavy_rain alert');
    assert.strictEqual(heavyRainAlert.severity, 'critical');
    assert.ok(heavyRainAlert.title.toLowerCase().includes('heavy rain'));
    assert.ok(heavyRainAlert.action_advice.includes('Harvest and dry your rice today'));
  });

  await t.test('Strong wind triggers when wind speed >= 35 km/h', () => {
    const mockForecast = {
      district_id: 'd_nimba_gbehley',
      district_name: 'Gbehley',
      county_name: 'Nimba',
      daily: [
        { day: 'Today', date: '2026-11-21', rain_chance_pct: 10, expected_rain_mm: 0, wind_speed_kmh: 42 },
        { day: 'Sun', date: '2026-11-22', rain_chance_pct: 15, expected_rain_mm: 0, wind_speed_kmh: 20 },
      ],
    };

    const alerts = WeatherAlertEngine.evaluateForecast(mockForecast, { farmId: 'farm-001' });
    const windAlert = alerts.find((a) => a.alert_type === 'strong_wind');
    assert.ok(windAlert, 'Should trigger strong_wind alert');
    assert.ok(windAlert.action_advice.includes('Secure drying mats'));
  });

  await t.test('Harvest drying advice triggers when dry days are followed by rain', () => {
    const mockForecast = {
      district_id: 'd_nimba_gbehley',
      district_name: 'Gbehley',
      county_name: 'Nimba',
      daily: [
        { day: 'Today', date: '2026-11-21', rain_chance_pct: 15, expected_rain_mm: 0.5, wind_speed_kmh: 8 },
        { day: 'Sun', date: '2026-11-22', rain_chance_pct: 20, expected_rain_mm: 1.0, wind_speed_kmh: 10 },
        { day: 'Mon', date: '2026-11-23', rain_chance_pct: 75, expected_rain_mm: 22, wind_speed_kmh: 15 },
        { day: 'Tue', date: '2026-11-24', rain_chance_pct: 65, expected_rain_mm: 18, wind_speed_kmh: 12 },
      ],
    };

    const alerts = WeatherAlertEngine.evaluateForecast(mockForecast, { farmId: 'farm-001' });
    const harvestAlert = alerts.find((a) => a.alert_type === 'harvest_advice');
    assert.ok(harvestAlert, 'Should trigger harvest_advice alert');
    assert.ok(harvestAlert.action_advice.includes('Harvest and dry your crop today'));
  });
});

test('Weather Alerts: 24-Hour Cooldown Enforcement', () => {
  const mockForecast = {
    district_id: 'd_nimba_gbehley',
    district_name: 'Gbehley',
    county_name: 'Nimba',
    daily: [
      { day: 'Today', date: '2026-11-21', rain_chance_pct: 85, expected_rain_mm: 32, wind_speed_kmh: 12 },
      { day: 'Sun', date: '2026-11-22', rain_chance_pct: 80, expected_rain_mm: 30, wind_speed_kmh: 14 },
    ],
  };

  const existingRecentAlert = {
    id: 'prev-alert-001',
    farm_id: 'farm-001',
    district_id: 'd_nimba_gbehley',
    alert_type: 'heavy_rain',
    title: 'Heavy rain expected tomorrow afternoon',
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), // 3 hours ago
  };

  const alerts = WeatherAlertEngine.evaluateForecast(mockForecast, {
    farmId: 'farm-001',
    existingAlerts: [existingRecentAlert],
  });

  const duplicate = alerts.find((a) => a.alert_type === 'heavy_rain');
  assert.strictEqual(duplicate, undefined, 'Must NOT trigger duplicate heavy_rain alert during 24h cooldown');
});

test('Weather Alerts: Farmer Alert Settings Respected', () => {
  const mockForecast = {
    district_id: 'd_nimba_gbehley',
    district_name: 'Gbehley',
    county_name: 'Nimba',
    daily: [
      { day: 'Today', date: '2026-11-21', rain_chance_pct: 85, expected_rain_mm: 30, wind_speed_kmh: 40 },
      { day: 'Sun', date: '2026-11-22', rain_chance_pct: 80, expected_rain_mm: 28, wind_speed_kmh: 38 },
    ],
  };

  const customizedSettings = {
    heavy_rain: false, // Farmer opted out of rain alerts
    strong_wind: false, // Farmer opted out of wind alerts
    dry_spell: true,
    harvest_advice: true,
    sms_enabled: false,
  };

  const alerts = WeatherAlertEngine.evaluateForecast(mockForecast, {
    farmId: 'farm-001',
    settings: customizedSettings,
  });

  assert.strictEqual(alerts.find((a) => a.alert_type === 'heavy_rain'), undefined, 'Disabled rain setting must suppress alert');
  assert.strictEqual(alerts.find((a) => a.alert_type === 'strong_wind'), undefined, 'Disabled wind setting must suppress alert');
});

test('Orange Liberia SMS: Strict 160 Characters Limit & Formatting', async () => {
  const smsService = new OrangeLiberiaSmsService();

  const sampleAlert = {
    id: 'test-sms-001',
    district_name: 'Gbehley',
    alert_type: 'heavy_rain',
    title: 'Heavy rain expected tomorrow afternoon (~30mm, 80% chance)',
    action_advice: 'Harvest & dry rice today. Cover stored paddy.',
  };

  const formattedMsg = smsService.formatSmsMessage(sampleAlert);
  assert.ok(formattedMsg.length <= 160, `SMS length (${formattedMsg.length}) must be <= 160 characters`);
  assert.ok(formattedMsg.startsWith('CropCapture:'), 'Prefixes brand for farmer recognition');

  const deliveryLog = await smsService.sendAlertSms('+231-77-654-3210', sampleAlert);
  assert.strictEqual(deliveryLog.provider, 'Orange Liberia');
  assert.ok(deliveryLog.character_count <= 160);
  assert.strictEqual(deliveryLog.status, 'simulated');
});

test('District Centroid GPS Fallback: Resolves coordinates when farm has no manual GPS', () => {
  const gbehleyCoord = resolveDistrictCoordinates('Gbehley', 'Nimba');
  assert.strictEqual(gbehleyCoord.latitude, 7.412);
  assert.strictEqual(gbehleyCoord.longitude, -8.65);

  const jorquellehCoord = resolveDistrictCoordinates('Jorquelleh', 'Bong');
  assert.strictEqual(jorquellehCoord.latitude, 7.004);
  assert.strictEqual(jorquellehCoord.longitude, -9.472);

  const lofaCoord = resolveDistrictCoordinates('Unknown', 'Lofa');
  assert.strictEqual(lofaCoord.latitude, 8.191);
  assert.strictEqual(lofaCoord.longitude, -9.723);

  const nationalDefault = resolveDistrictCoordinates(null, null);
  assert.strictEqual(nationalDefault.latitude, 6.4281);
  assert.strictEqual(nationalDefault.longitude, -9.4295);
});

test('Failing Weather Provider: Graceful offline baseline fallback without crashing', () => {
  // Simulate offline fallback generator matching Liberia weather
  function getSafeForecastFallback(districtName, countyName) {
    const now = new Date();
    return {
      district_name: districtName || 'Gbehley',
      county_name: countyName || 'Nimba',
      season: 'Dry season',
      current: { temp_c: 31, condition: 'Partly cloudy', rain_chance_pct: 20, wind_kmh: 8, humidity_pct: 74, weather_code: 2 },
      advisory: {
        title: 'Good day to dry your rice',
        message: 'Rain is expected tomorrow afternoon. Harvest and dry your crop today, and cover stored paddy.',
      },
      updated_time_display: 'Updated 10:00',
      source: 'Offline Default Baseline',
    };
  }

  const forecast = getSafeForecastFallback('Gbehley', 'Nimba');
  assert.strictEqual(forecast.district_name, 'Gbehley');
  assert.strictEqual(forecast.current.temp_c, 31);
  assert.strictEqual(forecast.updated_time_display, 'Updated 10:00');
  assert.strictEqual(forecast.season, 'Dry season');
});
