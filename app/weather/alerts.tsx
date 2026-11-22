import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, CloudRain } from 'lucide-react-native';
import {
  Colors,
  FontFamily,
  Spacing,
  Typography,
  Shadows,
} from '../../src/constants/theme';
import { weatherService } from '../../src/services/weather/weatherService';
import { WeatherAlert, AlertSettings } from '../../src/types/weather';
import { useAppStore } from '../../src/store/useAppStore';

export default function WeatherAlertsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  // Active / new alerts vs earlier
  const newAlerts = alerts.filter((a) => !a.is_read && !acknowledgedIds.has(a.id));
  const earlierAlerts = alerts.filter((a) => a.is_read || acknowledgedIds.has(a.id));

  // Only alerts that were really raised; never a sample alert
  const activeAlertsList = newAlerts;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: Math.max(insets.top, 16) + 10, paddingBottom: 60 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            activeOpacity={0.8}
          >
            <ChevronLeft size={22} color={Colors.text} strokeWidth={2.4} />
          </TouchableOpacity>

          <Text style={styles.screenTitle}>Weather alerts</Text>
        </View>

        {/* 1. Active / New Alerts (Sky Blue Card) */}
        {activeAlertsList.length === 0 && earlierAlerts.length === 0 ? (
          <Text style={{ fontSize: 15, color: Colors.textMuted, marginVertical: 24 }}>No weather alerts yet. Alerts appear here when the weather for your farm needs your attention.</Text>
        ) : null}
        {activeAlertsList.map((item) => (
          <View key={item.id} style={styles.newAlertCard}>
            <View style={styles.newAlertTopRow}>
              <View style={styles.newBadgePill}>
                <Text style={styles.newBadgeText}>New</Text>
              </View>
              <Text style={styles.newAlertTimestamp}>
                {item.timestamp_display || (item.created_at ? new Date(item.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')}
              </Text>
            </View>

            <View style={styles.newAlertTitleRow}>
              <CloudRain size={22} color="#0F3D64" strokeWidth={2.4} />
              <Text style={styles.newAlertTitle}>{item.title}</Text>
            </View>

            <Text style={styles.newAlertBody}>{item.message}</Text>

            <TouchableOpacity
              style={styles.gotItButton}
              onPress={() => handleGotIt(item.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.gotItButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* 2. Earlier Alerts */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>Earlier</Text>

          <View style={styles.earlierCard}>
            <View style={styles.earlierRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.earlierRowTitle}>Dry spell: no rain for 7 days</Text>
                <Text style={styles.earlierRowBody}>Water young seedlings in the morning.</Text>
              </View>
              <Text style={styles.earlierDayText}>Mon</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.earlierRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.earlierRowTitle}>Strong wind expected</Text>
                <Text style={styles.earlierRowBody}>Secure drying mats and tall crops.</Text>
              </View>
              <Text style={styles.earlierDayText}>Thu</Text>
            </View>
          </View>
        </View>

        {/* 3. Alert Settings */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>Alert settings</Text>
          <Text style={styles.sectionHeaderSub}>
            Choose which warnings you want for your farms.
          </Text>

          <View style={styles.settingsCard}>
            {/* Setting 1: Heavy rain */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingTitle}>Heavy rain</Text>
                <Text style={styles.settingSub}>Warn me the day before heavy rain.</Text>
              </View>
              <Switch
                value={settings.heavy_rain}
                onValueChange={() => handleToggleSetting('heavy_rain')}
                trackColor={{ false: '#C9DBC4', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            {/* Setting 2: Strong wind */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingTitle}>Strong wind</Text>
                <Text style={styles.settingSub}>Warn me before strong wind.</Text>
              </View>
              <Switch
                value={settings.strong_wind}
                onValueChange={() => handleToggleSetting('strong_wind')}
                trackColor={{ false: '#C9DBC4', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            {/* Setting 3: Dry spell */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingTitle}>Dry spell</Text>
                <Text style={styles.settingSub}>Tell me when no rain is expected for 7 days.</Text>
              </View>
              <Switch
                value={settings.dry_spell}
                onValueChange={() => handleToggleSetting('dry_spell')}
                trackColor={{ false: '#C9DBC4', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            {/* Setting 4: Harvest-day advice */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingTitle}>Harvest-day advice</Text>
                <Text style={styles.settingSub}>Best days to harvest and dry my crop.</Text>
              </View>
              <Switch
                value={settings.harvest_advice}
                onValueChange={() => handleToggleSetting('harvest_advice')}
                trackColor={{ false: '#C9DBC4', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            {/* Setting 5: Also send by SMS */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingTitle}>Also send by SMS</Text>
                <Text style={styles.settingSub}>Send SMS for low-connectivity offline zones.</Text>
              </View>
              <Switch
                value={settings.sms_enabled}
                onValueChange={() => handleToggleSetting('sms_enabled')}
                trackColor={{ false: '#C9DBC4', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
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
    gap: 14,
    marginBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E4F4DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 24,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  newAlertCard: {
    backgroundColor: '#DFF0FA',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    ...Shadows.card,
  },
  newAlertTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  newBadgePill: {
    backgroundColor: '#0F3D64',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  newBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  newAlertTimestamp: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: '#0F3D64',
    opacity: 0.8,
  },
  newAlertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  newAlertTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 17,
    color: '#0F3D64',
    flex: 1,
    letterSpacing: -0.2,
  },
  newAlertBody: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.sm,
    color: '#0F3D64',
    lineHeight: 20,
    marginBottom: 18,
  },
  gotItButton: {
    backgroundColor: '#0F3D64',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotItButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeaderTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    color: Colors.text,
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  sectionHeaderSub: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginBottom: 14,
  },
  earlierCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    paddingVertical: 6,
    ...Shadows.card,
  },
  earlierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  earlierRowTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: Colors.text,
    marginBottom: 2,
  },
  earlierRowBody: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  earlierDayText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  settingsCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    paddingVertical: 6,
    ...Shadows.card,
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
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: Colors.text,
    marginBottom: 2,
  },
  settingSub: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
});
