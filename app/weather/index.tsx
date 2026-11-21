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
  const [unreadCount, setUnreadCount] = useState<number>(1);
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

      const districtName = farm?.district || currentFarmer?.district || 'Gbehley';
      const countyName = farm?.county || currentFarmer?.county || 'Nimba';
      const districtId = farm?.district_id || 'd_nimba_gbehley';

      const data = await weatherService.getDistrictForecast(
        districtId,
        districtName,
        countyName,
        farm ? { latitude: farm.latitude, longitude: farm.longitude } : undefined
      );
      setForecast(data);

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

  const locationText = selectedFarm
    ? `${selectedFarm.district || 'Gbehley'}, ${selectedFarm.county || 'Nimba'}`
    : `${currentFarmer?.district || 'Gbehley'}, ${currentFarmer?.county || 'Nimba'}`;

  // 5-day forecast items
  const fiveDayList = forecast?.daily?.slice(0, 5) || [
    { day: 'Today', icon: 'cloud', rainPct: '20% rain', maxTemp: '31°', minTemp: '24°' },
    { day: 'Sun', icon: 'rain', rainPct: '70% rain', maxTemp: '29°', minTemp: '23°' },
    { day: 'Mon', icon: 'rain', rainPct: '60% rain', maxTemp: '28°', minTemp: '23°' },
    { day: 'Tue', icon: 'cloud', rainPct: '30% rain', maxTemp: '30°', minTemp: '23°' },
    { day: 'Wed', icon: 'sun', rainPct: '10% rain', maxTemp: '32°', minTemp: '24°' },
  ];

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

        {/* Big Dark Green Current Weather Card */}
        <View style={styles.mainWeatherCard}>
          <View style={styles.weatherCardTopRow}>
            <Text style={styles.weatherDateText}>Sat 21 Nov • Dry season</Text>
            <Text style={styles.weatherUpdatedText}>Updated 10:00</Text>
          </View>

          <View style={styles.weatherTempRow}>
            <Cloud size={46} color="#A5D65A" strokeWidth={2.2} />
            <View style={{ marginLeft: 16 }}>
              <Text style={styles.weatherDegreeText}>
                {forecast ? `${Math.round(forecast.current.temperature_2m)}°` : '31°'}
              </Text>
              <Text style={styles.weatherConditionText}>Partly cloudy</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>
                {forecast ? `${forecast.current.precipitation_probability || 20}%` : '20%'}
              </Text>
              <Text style={styles.metricLabel}>Rain today</Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>
                {forecast ? `${Math.round(forecast.current.wind_speed_10m)} km/h` : '8 km/h'}
              </Text>
              <Text style={styles.metricLabel}>Wind</Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>
                {forecast ? `${forecast.current.relative_humidity_2m}%` : '74%'}
              </Text>
              <Text style={styles.metricLabel}>Humidity</Text>
            </View>
          </View>
        </View>

        {/* Soft Green Farming Advice Card */}
        <View style={styles.adviceCard}>
          <View style={styles.adviceIconBubble}>
            <Leaf size={20} color="#A5D65A" strokeWidth={2.4} />
          </View>
          <View style={styles.adviceTextCol}>
            <Text style={styles.adviceTitle}>Good day to dry your rice</Text>
            <Text style={styles.adviceBody}>
              Rain is expected tomorrow afternoon. Harvest and dry your crop today, and cover stored paddy.
            </Text>
          </View>
        </View>

        {/* Next 5 Days Forecast Section */}
        <View style={styles.fiveDaysSection}>
          <Text style={styles.sectionTitle}>Next 5 days</Text>

          <View style={styles.fiveDaysCard}>
            {fiveDayList.map((item, idx) => {
              const isLast = idx === fiveDayList.length - 1;
              const dayStr = (item as any).day || (item as any).date || 'Day';
              const rainStr = (item as any).rainPct || `${(item as any).precipitation_probability_max || 20}% rain`;
              const maxT = (item as any).maxTemp || `${Math.round((item as any).temperature_2m_max || 30)}°`;
              const minT = (item as any).minTemp || `${Math.round((item as any).temperature_2m_min || 23)}°`;
              const iconKey = (item as any).icon || ((item as any).precipitation_probability_max > 50 ? 'rain' : 'cloud');

              return (
                <View
                  key={idx}
                  style={[styles.forecastRow, !isLast && styles.forecastRowDivider]}
                >
                  <Text style={styles.forecastDay}>{dayStr}</Text>

                  <View style={styles.forecastIconAndRain}>
                    {iconKey === 'sun' ? (
                      <Sun size={20} color="#F2A93B" strokeWidth={2.2} />
                    ) : iconKey === 'rain' ? (
                      <CloudRain size={20} color="#0284C7" strokeWidth={2.2} />
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

            <Text style={styles.sampleForecastFooter}>
              Sample forecast shown for design. Real data comes from your weather provider.
            </Text>
          </View>
        </View>
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
