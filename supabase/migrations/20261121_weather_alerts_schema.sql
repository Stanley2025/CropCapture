-- =========================================================================
-- MIGRATION: WEATHER ALERTS & ORANGE LIBERIA SMS CACHING ENGINE
-- =========================================================================

-- 1. DISTRICT WEATHER CACHE (Shared across all farmers in a district)
CREATE TABLE IF NOT EXISTS public.district_weather_cache (
    district_id UUID PRIMARY KEY REFERENCES public.districts(id) ON DELETE CASCADE,
    latitude NUMERIC(10, 6) NOT NULL,
    longitude NUMERIC(10, 6) NOT NULL,
    forecast_json JSONB NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weather_cache_expires ON public.district_weather_cache(expires_at);

-- 2. WEATHER ALERTS (Per farm / farmer)
CREATE TABLE IF NOT EXISTS public.weather_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE,
    district_id UUID REFERENCES public.districts(id),
    farmer_id UUID REFERENCES public.farmers(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'heavy_rain', 'strong_wind', 'dry_spell', 'harvest_advice'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_advice TEXT NOT NULL,
    severity VARCHAR(30) DEFAULT 'warning',
    is_read BOOLEAN NOT NULL DEFAULT false,
    sms_sent BOOLEAN NOT NULL DEFAULT false,
    push_sent BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_alerts_farmer ON public.weather_alerts(farmer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weather_alerts_unread ON public.weather_alerts(farmer_id, is_read);
CREATE INDEX IF NOT EXISTS idx_weather_alerts_cooldown ON public.weather_alerts(farm_id, alert_type, created_at DESC);

-- 3. FARMER ALERT PREFERENCES
CREATE TABLE IF NOT EXISTS public.farmer_alert_preferences (
    farmer_id UUID PRIMARY KEY REFERENCES public.farmers(id) ON DELETE CASCADE,
    heavy_rain_enabled BOOLEAN NOT NULL DEFAULT true,
    strong_wind_enabled BOOLEAN NOT NULL DEFAULT true,
    dry_spell_enabled BOOLEAN NOT NULL DEFAULT true,
    harvest_advice_enabled BOOLEAN NOT NULL DEFAULT true,
    sms_enabled BOOLEAN NOT NULL DEFAULT true,
    phone_number VARCHAR(30),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ALERT DELIVERY AUDIT LOGS (Visible in Admin Dashboard)
CREATE TABLE IF NOT EXISTS public.alert_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES public.weather_alerts(id) ON DELETE SET NULL,
    delivery_channel VARCHAR(30) NOT NULL, -- 'in_app', 'sms', 'push'
    provider VARCHAR(50) NOT NULL DEFAULT 'Orange Liberia',
    recipient_phone VARCHAR(30),
    message_body TEXT NOT NULL,
    character_count INT NOT NULL,
    status VARCHAR(30) NOT NULL, -- 'delivered', 'simulated', 'failed', 'pending'
    provider_response TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_logs_sent_at ON public.alert_delivery_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_logs_status ON public.alert_delivery_logs(status);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.district_weather_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Read public weather cache
CREATE POLICY "Allow authenticated read weather cache" 
ON public.district_weather_cache FOR SELECT TO authenticated USING (true);

-- Farmers manage their own alerts
CREATE POLICY "Farmers can read their own alerts" 
ON public.weather_alerts FOR SELECT TO authenticated 
USING (farmer_id = auth.uid() OR auth.uid() IN (SELECT profile_id FROM public.farmers WHERE id = weather_alerts.farmer_id));

CREATE POLICY "Farmers can update read status" 
ON public.weather_alerts FOR UPDATE TO authenticated 
USING (farmer_id = auth.uid() OR auth.uid() IN (SELECT profile_id FROM public.farmers WHERE id = weather_alerts.farmer_id));

-- Admin and staff can read all logs
CREATE POLICY "Admin read all alert logs" 
ON public.alert_delivery_logs FOR SELECT TO authenticated USING (true);
