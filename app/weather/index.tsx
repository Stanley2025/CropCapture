import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { weatherService } from '../../src/services/weather/weatherService';
import { WeatherForecast } from '../../src/types/weather';
import { useAppStore } from '../../src/store/useAppStore';
import { localDb } from '../../src/services/storage/localDatabase';
import { Farm } from '../../src/types/database';

export default function WeatherScreen() {
  const router = useRouter();
  const { currentFarmer } = useAppStore();

  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);

  const loadWeatherData = useCallback(async () => {
    try {
      // 1. Determine active farm location (or fallback to Nimba / Gbehley)
      const farms = await localDb.getFarms();
      const myFarms = currentFarmer?.id
        ? farms.filter((f) => f.farmer_id === currentFarmer.id)
        : farms;
      const farm = myFarms[0] || null;
      setSelectedFarm(farm);

      const districtName = farm?.district || currentFarmer?.district || 'Gbehley';
      const countyName = farm?.county || currentFarmer?.county || 'Nimba';
      const districtId = farm?.district_id || 'd_nimba_gbehley';

      // 2. Fetch forecast (with offline fallback and cache)
      const data = await weatherService.getDistrictForecast(
        districtId,
        districtName,
        countyName,
        farm ? { latitude: farm.latitude, longitude: farm.longitude } : undefined
      );
      setForecast(data);

      // 3. Load unread alert count for the top bell
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

  const renderWeatherIcon = (code: number, size = 20, color = '#48634F') => {
    if (code === 0) return <Ionicons name="sunny-outline" size={size} color="#EAB308" />;
    if (code === 1 || code === 2) return <Ionicons name="cloud-outline" size={size} color={color} />;
    if (code >= 51 && code <= 65) return <Ionicons name="rainy-outline" size={size} color="#0284C7" />;
    if (code >= 80 && code <= 82) return <Ionicons name="rainy-outline" size={size} color="#0284C7" />;
    if (code >= 95) return <Ionicons name="thunderstorm-outline" size={size} color="#854D0E" />;
    return <Ionicons name="cloud-outline" size={size} color={color} />;
  };

  const getFormattedDateHeading = () => {
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = now.getDate();
    const monthName = now.toLocaleDateString('en-US', { month: 'short' });
    const season = forecast?.season || 'Dry season';
    return `${dayName} ${dayNum} ${monthName} · ${season}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER BAR */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color="#1F3826" />
        </TouchableOpacity>

        <View style={styles.titleColumn}>
          <Text style={styles.headerTitle}>Weather</Text>
          <Text style={styles.headerSubtitle}>
            {forecast?.district_name || 'Gbehley'}, {forecast?.county_name || 'Nimba'}
          </Text>
        </View>

        {/* Bell with Unread Badge */}
        <TouchableOpacity
          style={styles.bellButton}
          onPress={() => router.push('/weather/alerts' as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={20} color="#1F3826" />
          {unreadCount > 0 ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#163323']} />}
      >
        {loading && !forecast ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#163323" />
            <Text style={styles.loaderText}>Loading local district forecast...</Text>
          </View>
        ) : (
          <>
            {/* ========================================================= */}
            {/* 1. MAIN CURRENT WEATHER CARD (DARK FOREST GREEN) */}
            {/* ========================================================= */}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <Text style={styles.heroDateSeason}>{getFormattedDateHeading()}</Text>
                <Text style={styles.heroUpdated}>{forecast?.updated_time_display || 'Updated 10:00'}</Text>
              </View>

              {/* Main Weather Display */}
              <View style={styles.heroMainRow}>
                <View style={styles.heroIconWrapper}>
                  <Ionicons name="cloud-outline" size={48} color="#A3E635" />
                </View>
                <View style={styles.heroTempCol}>
                  <Text style={styles.heroTempText}>{forecast?.current.temp_c ?? 31}°</Text>
                  <Text style={styles.heroConditionText}>{forecast?.current.condition ?? 'Partly cloudy'}</Text>
                </View>
              </View>

              {/* 3-Column Stats Row */}
              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <Text style={styles.statValue}>{forecast?.current.rain_chance_pct ?? 20}%</Text>
                  <Text style={styles.statLabel}>Rain today</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCol}>
                  <Text style={styles.statValue}>{forecast?.current.wind_kmh ?? 8} km/h</Text>
                  <Text style={styles.statLabel}>Wind</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCol}>
                  <Text style={styles.statValue}>{forecast?.current.humidity_pct ?? 74}%</Text>
                  <Text style={styles.statLabel}>Humidity</Text>
                </View>
              </View>
            </View>

            {/* ========================================================= */}
            {/* 2. ADVISORY CALLOUT CARD (SAGE / PASTEL GREEN) */}
            {/* ========================================================= */}
            <TouchableOpacity
              style={styles.advisoryCard}
              activeOpacity={0.85}
              onPress={() => router.push('/weather/alerts' as any)}
            >
              <View style={styles.advisoryIconCircle}>
                <Ionicons name="leaf" size={18} color="#A3E635" />
              </View>
              <View style={styles.advisoryContent}>
                <Text style={styles.advisoryTitle}>
                  {forecast?.advisory.title || 'Good day to dry your rice'}
                </Text>
                <Text style={styles.advisoryBody}>
                  {forecast?.advisory.message ||
                    'Rain is expected tomorrow afternoon. Harvest and dry your crop today, and cover stored paddy.'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* ========================================================= */}
            {/* 3. NEXT 5 DAYS FORECAST SECTION */}
            {/* ========================================================= */}
            <Text style={styles.sectionHeading}>Next 5 days</Text>

            <View style={styles.forecastCard}>
              {(forecast?.daily || []).map((item, index) => {
                const isLast = index === (forecast?.daily?.length || 0) - 1;
                return (
                  <View key={item.day + index}>
                    <View style={styles.dayRow}>
                      <Text style={styles.dayLabel}>{item.day}</Text>
                      <View style={styles.dayIconCol}>
                        {renderWeatherIcon(item.weather_code, 20)}
                      </View>
                      <Text style={styles.dayRainPct}>{item.rain_chance_pct}% rain</Text>
                      <View style={styles.dayTempCol}>
                        <Text style={styles.dayMaxTemp}>{item.temp_max_c}°</Text>
                        <Text style={styles.dayMinTemp}>{item.temp_min_c}°</Text>
                      </View>
                    </View>
                    {!isLast ? <View style={styles.rowDivider} /> : null}
                  </View>
                );
              })}
            </View>

            {/* Sub-note */}
            <Text style={styles.footerNote}>
              Sample forecast shown for design. Real data comes from your weather provider.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F5EE',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F4F5EE',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8ECE3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleColumn: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#14291B',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#556D5C',
    fontWeight: '500',
    marginTop: 1,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8ECE3',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E07A2A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  loaderContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#556D5C',
    fontWeight: '500',
  },

  /* 1. Hero Card */
  heroCard: {
    backgroundColor: '#132E20',
    borderRadius: 20,
    padding: 20,
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroDateSeason: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B4CCBA',
  },
  heroUpdated: {
    fontSize: 12,
    color: '#8CA693',
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroIconWrapper: {
    marginRight: 16,
  },
  heroTempCol: {
    justifyContent: 'center',
  },
  heroTempText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 52,
  },
  heroConditionText: {
    fontSize: 15,
    color: '#CDE0D2',
    fontWeight: '500',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    paddingTop: 16,
  },
  statCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 8,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: '#8CA693',
    marginTop: 2,
  },

  /* 2. Advisory Card */
  advisoryCard: {
    backgroundColor: '#E7F2D3',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#D4E8B8',
  },
  advisoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#163323',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  advisoryContent: {
    flex: 1,
  },
  advisoryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15331E',
    marginBottom: 4,
  },
  advisoryBody: {
    fontSize: 13,
    color: '#2A4832',
    lineHeight: 18,
  },

  /* 3. Next 5 Days */
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#152A1C',
    marginTop: 22,
    marginBottom: 10,
  },
  forecastCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E7DE',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dayLabel: {
    width: 60,
    fontSize: 14,
    fontWeight: '700',
    color: '#1C3322',
  },
  dayIconCol: {
    width: 32,
    alignItems: 'center',
  },
  dayRainPct: {
    flex: 1,
    fontSize: 13,
    color: '#556D5C',
    marginLeft: 10,
  },
  dayTempCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayMaxTemp: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A3320',
  },
  dayMinTemp: {
    fontSize: 14,
    color: '#7F9384',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#EDF1E8',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 11,
    color: '#7A8E7F',
    marginTop: 14,
    lineHeight: 16,
    paddingHorizontal: 20,
  },
});
