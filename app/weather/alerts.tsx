import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { weatherService } from '../../src/services/weather/weatherService';
import { WeatherAlert, AlertSettings } from '../../src/types/weather';
import { useAppStore } from '../../src/store/useAppStore';

export default function WeatherAlertsScreen() {
  const router = useRouter();
  const { currentFarmer } = useAppStore();

  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [settings, setSettings] = useState<AlertSettings>({
    heavy_rain: true,
    strong_wind: true,
    dry_spell: true,
    harvest_advice: true,
    sms_enabled: true,
    phone_number: currentFarmer?.phone_number || '+231-77-000-0000',
  });
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  const loadAlertsAndSettings = useCallback(async () => {
    try {
      const storedAlerts = await weatherService.getAlerts(currentFarmer?.id);
      setAlerts(storedAlerts);

      const storedSettings = await weatherService.getAlertSettings(currentFarmer?.id);
      setSettings(storedSettings);
    } catch (e) {
      console.warn('Failed to load weather alerts:', e);
    }
  }, [currentFarmer]);

  useEffect(() => {
    loadAlertsAndSettings();
  }, [loadAlertsAndSettings]);

  const handleGotIt = async (alertId: string) => {
    // Mark alert as acknowledged locally and in persistent storage
    setAcknowledgedIds((prev) => new Set(prev).add(alertId));
    try {
      const updated = await weatherService.markAlertAsRead(alertId);
      setAlerts(updated);
    } catch (e) {
      console.warn('Failed to acknowledge alert:', e);
    }
  };

  const handleToggleSetting = async (key: keyof AlertSettings) => {
    const updated: AlertSettings = {
      ...settings,
      [key]: !settings[key],
    };
    setSettings(updated);
    await weatherService.saveAlertSettings(updated, currentFarmer?.id);
  };

  // Separate active unread alerts from earlier read alerts
  const newAlerts = alerts.filter((a) => !a.is_read && !acknowledgedIds.has(a.id));
  const earlierAlerts = alerts.filter((a) => a.is_read || acknowledgedIds.has(a.id));

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

        <Text style={styles.headerTitle}>Weather alerts</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* ========================================================= */}
        {/* 1. ACTIVE / NEW ALERTS (LIGHT BLUE BANNER CARDS) */}
        {/* ========================================================= */}
        {newAlerts.map((item) => (
          <View key={item.id} style={styles.newAlertCard}>
            {/* Top Row: New Pill + Timestamp */}
            <View style={styles.newAlertHeader}>
              <View style={styles.newBadgePill}>
                <Text style={styles.newBadgeText}>New</Text>
              </View>
              <Text style={styles.newAlertTimestamp}>
                {item.timestamp_display || 'Today, 09:30'}
              </Text>
            </View>

            {/* Icon + Title */}
            <View style={styles.newAlertTitleRow}>
              <Ionicons
                name={
                  item.alert_type === 'strong_wind'
                    ? 'paper-plane-outline'
                    : item.alert_type === 'dry_spell'
                    ? 'sunny-outline'
                    : 'rainy-outline'
                }
                size={22}
                color="#0284C7"
                style={{ marginRight: 8, marginTop: 1 }}
              />
              <Text style={styles.newAlertTitle}>{item.title}</Text>
            </View>

            {/* Action Advice Body */}
            <Text style={styles.newAlertBody}>
              {item.district_name || 'Gbehley'}, {item.county_name || 'Nimba'}. {item.action_advice}
            </Text>

            {/* "Got it" Button */}
            <TouchableOpacity
              style={styles.gotItButton}
              activeOpacity={0.8}
              onPress={() => handleGotIt(item.id)}
            >
              <Text style={styles.gotItButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* ========================================================= */}
        {/* 2. EARLIER ALERTS SECTION */}
        {/* ========================================================= */}
        <Text style={styles.earlierSectionLabel}>Earlier</Text>

        <View style={styles.earlierCard}>
          {earlierAlerts.length === 0 ? (
            <View style={styles.emptyEarlier}>
              <Text style={styles.emptyEarlierText}>No earlier alerts.</Text>
            </View>
          ) : (
            earlierAlerts.map((item, index) => {
              const isLast = index === earlierAlerts.length - 1;
              return (
                <View key={item.id}>
                  <View style={styles.earlierItem}>
                    <View style={styles.earlierTopRow}>
                      <Text style={styles.earlierTitle}>{item.title}</Text>
                      <Text style={styles.earlierDate}>{item.timestamp_display}</Text>
                    </View>
                    <Text style={styles.earlierSubtitle}>{item.action_advice}</Text>
                  </View>
                  {!isLast ? <View style={styles.earlierDivider} /> : null}
                </View>
              );
            })
          )}
        </View>

        {/* ========================================================= */}
        {/* 3. ALERT SETTINGS SECTION */}
        {/* ========================================================= */}
        <Text style={styles.settingsHeading}>Alert settings</Text>
        <Text style={styles.settingsSubheading}>
          Choose which warnings you want for your farms.
        </Text>

        <View style={styles.settingsCard}>
          {/* Setting 1: Heavy rain */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>Heavy rain</Text>
              <Text style={styles.settingSubtitle}>Warn me the day before heavy rain.</Text>
            </View>
            <Switch
              value={settings.heavy_rain}
              onValueChange={() => handleToggleSetting('heavy_rain')}
              trackColor={{ false: '#D1D5DB', true: '#1F472B' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingDivider} />

          {/* Setting 2: Strong wind */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>Strong wind</Text>
              <Text style={styles.settingSubtitle}>Warn me before strong wind.</Text>
            </View>
            <Switch
              value={settings.strong_wind}
              onValueChange={() => handleToggleSetting('strong_wind')}
              trackColor={{ false: '#D1D5DB', true: '#1F472B' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingDivider} />

          {/* Setting 3: Dry spell */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>Dry spell</Text>
              <Text style={styles.settingSubtitle}>Tell me when no rain is expected for 7 days.</Text>
            </View>
            <Switch
              value={settings.dry_spell}
              onValueChange={() => handleToggleSetting('dry_spell')}
              trackColor={{ false: '#D1D5DB', true: '#1F472B' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingDivider} />

          {/* Setting 4: Harvest-day advice */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>Harvest-day advice</Text>
              <Text style={styles.settingSubtitle}>Best days to harvest and dry my crop.</Text>
            </View>
            <Switch
              value={settings.harvest_advice}
              onValueChange={() => handleToggleSetting('harvest_advice')}
              trackColor={{ false: '#D1D5DB', true: '#1F472B' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingDivider} />

          {/* Setting 5: Also send by SMS (Orange Liberia) */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>Also send by SMS</Text>
              <Text style={styles.settingSubtitle}>
                Get free text messages on your phone (Orange Liberia / Lonestar).
              </Text>
            </View>
            <Switch
              value={settings.sms_enabled}
              onValueChange={() => handleToggleSetting('sms_enabled')}
              trackColor={{ false: '#D1D5DB', true: '#1F472B' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#14291B',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 36,
  },

  /* 1. New Alert Card (Light Blue) */
  newAlertCard: {
    backgroundColor: '#DDEBF7',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C6DDF2',
  },
  newAlertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  newBadgePill: {
    backgroundColor: '#14375A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  newAlertTimestamp: {
    fontSize: 12,
    color: '#4A6984',
    fontWeight: '500',
  },
  newAlertTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  newAlertTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#103554',
    lineHeight: 22,
  },
  newAlertBody: {
    fontSize: 13.5,
    color: '#23496B',
    lineHeight: 19,
    marginBottom: 16,
  },
  gotItButton: {
    backgroundColor: '#14375A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotItButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  /* 2. Earlier Section */
  earlierSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7E9083',
    marginBottom: 8,
    marginTop: 4,
  },
  earlierCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E7DE',
    marginBottom: 20,
  },
  emptyEarlier: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyEarlierText: {
    fontSize: 13,
    color: '#8CA091',
  },
  earlierItem: {
    paddingVertical: 12,
  },
  earlierTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  earlierTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C3322',
  },
  earlierDate: {
    fontSize: 12,
    color: '#7E9083',
    fontWeight: '500',
  },
  earlierSubtitle: {
    fontSize: 13,
    color: '#566C5C',
    lineHeight: 18,
  },
  earlierDivider: {
    height: 1,
    backgroundColor: '#EDF1E8',
  },

  /* 3. Alert Settings */
  settingsHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#152A1C',
    marginBottom: 2,
  },
  settingsSubheading: {
    fontSize: 13,
    color: '#5B7061',
    marginBottom: 12,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E7DE',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  settingTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C3322',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#5B7061',
    lineHeight: 16,
  },
  settingDivider: {
    height: 1,
    backgroundColor: '#EDF1E8',
  },
});
