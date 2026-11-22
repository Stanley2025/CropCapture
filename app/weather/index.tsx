import { SunIcon } from '../../src/components/activity/SunIcon';
import { SkyIcon } from '../../src/components/activity/SkyIcon';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Bell,
  Cloud,
  CloudRain,
  Sun,
  Leaf,
  Wind,
  Droplets,
} from 'lucide-react-native';
import {
  Colors,
  FontFamily,
  Spacing,
  Typography,
  Shadows,
} from '../../src/constants/theme';
import { weatherService } from '../../src/services/weather/weatherService';
import { WeatherForecast } from '../../src/types/weather';
import { useAppStore } from '../../src/store/useAppStore';
import { localDb } from '../../src/services/storage/localDatabase';
import { Farm } from '../../src/types/database';

export default function WeatherScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentFarmer } = useAppStore();

  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);

  const loadWeatherData = useCallback(async () => {
    try {
      const farms = await localDb.getFarms();
      const myFarms = currentFarmer?.id
        ? farms.filter((f) => f.farmer_id === currentFarmer.id)
        : farms;
      const farm = myFarms[0] || null;
      setSelectedFarm(farm);

      // Where this farmer farms. No place yet, or no connection and nothing saved: no forecast (never a made-up one).
      setForecast(await weatherService.getForecastFor(farm, currentFarmer));

      const count = await weatherService.getUnreadAlertCount(currentFarmer?.id);
      setUnreadCount(count);
    } catch (err) {
      console.warn('Failed to load weather forecast:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentFarmer]);

  useEffect(() => {
    loadWeatherData();
  }, [loadWeatherData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadWeatherData();
  };

  const locationText = [selectedFarm?.district || currentFarmer?.district, selectedFarm?.county || currentFarmer?.county].filter(Boolean).join(', ');
  const hasPlace = Boolean(locationText) || Boolean(selectedFarm?.latitude);

  // Next 5 days, exactly as the provider returned them
  const fiveDayList = (forecast?.daily || []).slice(0, 5).map((d) => ({
    day: d.day,
    rainPct: `${Math.round(d.rain_chance_pct)}% rain`,
    maxTemp: `${Math.round(d.temp_max_c)}°`,
    minTemp: `${Math.round(d.temp_min_c)}°`,
    icon: d.rain_chance_pct >= 50 ? 'rain' : d.weather_code <= 1 ? 'sun' : 'cloud',
  }));
  const todayText = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: Math.max(insets.top, 16) + 10, paddingBottom: 60 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            activeOpacity={0.8}
          >
            <ChevronLeft size={22} color={Colors.text} strokeWidth={2.4} />
          </TouchableOpacity>

          <View style={styles.headerCenterCol}>
            <Text style={styles.headerTitle}>Weather</Text>
            <Text style={styles.headerSub}>{locationText}</Text>
          </View>

          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push('/weather/alerts' as any)}
            accessibilityRole="button"
            accessibilityLabel="Weather alerts"
            activeOpacity={0.8}
          >
            <Bell size={20} color={Colors.text} strokeWidth={2.2} />
            {unreadCount > 0 && <View style={styles.bellDot} />}
          </TouchableOpacity>
        </View>

        {!forecast ? (
          <View style={styles.mainWeatherCard}>
            <Text style={styles.weatherConditionText}>
              {loading ? 'Loading the weather...' : hasPlace ? 'The weather is not available right now. Connect to the internet and pull down to refresh.' : 'Add a farm with its place to see the weather for your area.'}
            </Text>
          </View>
        ) : null}

        {/* Big Dark Green Current Weather Card */}
        {forecast ? (
        <View style={styles.mainWeatherCard}>
          <View style={styles.weatherCardTopRow}>
            <Text style={styles.weatherDateText}>{`${todayText} • ${forecast.season}`}</Text>
            <Text style={styles.weatherUpdatedText}>{`${forecast.updated_time_display}${forecast.is_cached ? ' (saved)' : ''}`}</Text>
          </View>

          <View style={styles.weatherTempRow}>
            <Cloud size={46} color="#A5D65A" strokeWidth={2.2} />
            <View style={{ marginLeft: 16 }}>
              <Text style={styles.weatherDegreeText}>
                {`${Math.round(forecast.current.temp_c)}°`}
              </Text>
              <Text style={styles.weatherConditionText}>{forecast.current.condition}</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>
                {`${Math.round(forecast.current.rain_chance_pct)}%`}
              </Text>
              <Text style={styles.metricLabel}>Rain today</Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>
                {`${Math.round(forecast.current.wind_kmh)} km/h`}
              </Text>
              <Text style={styles.metricLabel}>Wind</Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>
                {`${Math.round(forecast.current.humidity_pct)}%`}
              </Text>
              <Text style={styles.metricLabel}>Humidity</Text>
            </View>
          </View>
        </View>
        ) : null}

        {forecast && forecast.advisory ? (
          <View style={styles.adviceCard}>
            <View style={styles.adviceIconBubble}>
              <Leaf size={20} color="#A5D65A" strokeWidth={2.4} />
            </View>
            <View style={styles.adviceTextCol}>
              <Text style={styles.adviceTitle}>{forecast.advisory.title}</Text>
              <Text style={styles.adviceBody}>{forecast.advisory.message}</Text>
            </View>
          </View>
        ) : null}

        {/* Next 5 Days Forecast Section */}
        {forecast ? (
        <View style={styles.fiveDaysSection}>
          <Text style={styles.sectionTitle}>Next 5 days</Text>

          <View style={styles.fiveDaysCard}>
            {fiveDayList.map((item, idx) => {
              const isLast = idx === fiveDayList.length - 1;
              const dayStr = item.day;
              const rainStr = item.rainPct;
              const maxT = item.maxTemp;
              const minT = item.minTemp;
              const iconKey = item.icon;

              return (
                <View
                  key={idx}
                  style={[styles.forecastRow, !isLast && styles.forecastRowDivider]}
                >
                  <Text style={styles.forecastDay}>{dayStr}</Text>

                  <View style={styles.forecastIconAndRain}>
                    {iconKey === 'sun' ? (
                      <SunIcon size={22} />
                    ) : iconKey === 'rain' ? (
                      <SkyIcon sky="rain" size={24} />
                    ) : (
                      <Cloud size={20} color={Colors.textMuted} strokeWidth={2.2} />
                    )}
                    <Text style={styles.forecastRainText}>{rainStr}</Text>
                  </View>

                  <View style={styles.forecastTemps}>
                    <Text style={styles.forecastMaxTemp}>{maxT}</Text>
                    <Text style={styles.forecastMinTemp}>{minT}</Text>
                  </View>
                </View>
              );
            })}

            <Text style={styles.sampleForecastFooter}>{`Source: ${forecast.source}`}</Text>
          </View>
        </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E4F4DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenterCol: {
    flex: 1,
    paddingLeft: 12,
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E4F4DF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F97316',
    borderWidth: 1.5,
    borderColor: '#E4F4DF',
  },
  mainWeatherCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
    ...Shadows.card,
  },
  weatherCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  weatherDateText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: '#DDF0D8',
  },
  weatherUpdatedText: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.xs,
    color: '#A5D65A',
  },
  weatherTempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  weatherDegreeText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 44,
    color: '#FFFFFF',
    lineHeight: 48,
    letterSpacing: -1,
  },
  weatherConditionText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.sm,
    color: '#DDF0D8',
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  metricItem: {
    flex: 1,
  },
  metricValue: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.xs,
    color: '#DDF0D8',
    marginTop: 2,
  },
  adviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.tintSoft,
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  adviceIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adviceTextCol: {
    flex: 1,
  },
  adviceTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: Colors.text,
    marginBottom: 3,
  },
  adviceBody: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  fiveDaysSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    color: Colors.text,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  fiveDaysCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    ...Shadows.card,
  },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  forecastRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  forecastDay: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: Colors.text,
    width: 50,
  },
  forecastIconAndRain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingLeft: 10,
  },
  forecastRainText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  forecastTemps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  forecastMaxTemp: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  forecastMinTemp: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  sampleForecastFooter: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 4,
  },
});
