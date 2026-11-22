import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/useAppStore';
import { loadBuyerData, rememberViewedHarvest, BuyerData } from '../../src/services/photos/buyerViewService';
import { BuyerPage } from '../../src/components/buyer/BuyerPage';
import { t } from '../../src/i18n/en';

/**
 * The buyer's page inside the app: opened by scanning a harvest's QR code, and by the farmer's
 * "See what buyers see" button (with preview=1, which uses this phone's copy so it works offline).
 */
export default function BuyerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, preview } = useLocalSearchParams<{ token: string; preview?: string }>();
  const { isOfflineMode } = useAppStore();
  const [data, setData] = useState<BuyerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    loadBuyerData(token, { offline: isOfflineMode, preferPhone: preview === '1' })
      .then((d) => {
        setData(d);
        if (d && preview !== '1') rememberViewedHarvest(token, d.view);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token, preview, isOfflineMode]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 6 }]}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('buyerTitle')}</Text>
        <View style={styles.back} />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : !data ? (
        <View style={styles.center}>
          <Text style={styles.notFound}>{t('buyerNotFound')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 40 }}>
          <BuyerPage view={data.view} ownCopy={data.source === 'phone'} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: 16, color: Colors.textMuted },
});
