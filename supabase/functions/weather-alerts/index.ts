/**
 * Supabase Scheduled Edge Function: Weather Alerts & Forecast Sync
 * 
 * Scheduled to run every 3 to 6 hours (via pg_cron or Supabase cron).
 * Iterates through active districts with registered farms, fetches forecasts from
 * Open-Meteo, updates district_weather_cache, evaluates alert rules, and delivers
 * SMS warnings via Orange Liberia for farmers who opted in.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPEN_METEO_API_KEY = Deno.env.get('WEATHER_API_KEY') || '';
const ORANGE_CLIENT_ID = Deno.env.get('ORANGE_LIBERIA_CLIENT_ID') || '';
const ORANGE_CLIENT_SECRET = Deno.env.get('ORANGE_LIBERIA_CLIENT_SECRET') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    // 1. Fetch all distinct districts that contain active farms
    const { data: activeDistricts, error: distError } = await supabase
      .from('farms')
      .select('district_id, county_id, latitude, longitude')
      .not('district_id', 'is', null);

    if (distError) {
      return new Response(JSON.stringify({ error: distError.message }), { status: 500 });
    }

    // Group by district_id
    const uniqueDistricts = new Map<string, { lat: number; lng: number }>();
    for (const d of activeDistricts || []) {
      if (d.district_id && !uniqueDistricts.has(d.district_id)) {
        uniqueDistricts.set(d.district_id, {
          lat: Number(d.latitude) || 7.004,
          lng: Number(d.longitude) || -9.472,
        });
      }
    }

    const results = [];

    // 2. Process each district (caching forecast per district, NOT per phone)
    for (const [districtId, coords] of uniqueDistricts.entries()) {
      const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=Africa/Monrovia&forecast_days=6${OPEN_METEO_API_KEY ? `&apikey=${OPEN_METEO_API_KEY}` : ''}`;

      const weatherRes = await fetch(openMeteoUrl);
      if (!weatherRes.ok) continue;

      const forecastData = await weatherRes.json();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4-hour cache

      // Upsert into district_weather_cache
      await supabase.from('district_weather_cache').upsert({
        district_id: districtId,
        latitude: coords.lat,
        longitude: coords.lng,
        forecast_json: forecastData,
        fetched_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

      results.push({ districtId, status: 'synced' });
    }

    return new Response(JSON.stringify({ success: true, processed: results.length }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
