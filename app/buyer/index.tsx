import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/useAppStore';
import { getViewedHarvests, ViewedHarvest } from '../../src/services/photos/buyerViewService';
import { t } from '../../src/i18n/en';

/**
 * Home of the buyer role. A buyer does not manage farms: they scan the QR code on a harvest (or type its
 * code) and see the farmer's photos, the facts and what was done on the farm.
 */
export default function BuyerHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAppStore();
  const [code, setCode] = useState('');
  const [viewed, setViewed] = useState<ViewedHarvest[]>([]);

  useFocusEffect(
    useCallback(() => {
      getViewedHarvests().then(setViewed);
    }, [])
  );

  const open = (value: string) => {
    const v = value.trim();
    if (!v) {
      Alert.alert(t('buyerEnterCodeTitle'), t('buyerEnterCodeBody'));
      return;
    }
    router.push(`/traceability/${encodeURIComponent(v)}` as any);
  };

  const signOut = async () => {
    await logout();
    router.replace('/login' as any);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 6 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('buyerHomeTitle')}</Text>
          <Text style={styles.headerSub}>{t('buyerHomeSub')}</Text>
        </View>
        <TouchableOpacity style={styles.signOut} onPress={signOut} accessibilityRole="button" accessibilityLabel={t('buyerSignOut')}>
          <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.scanBtn} onPress={() => router.push('/qr-scanner' as any)} accessibilityRole="button" accessibilityLabel={t('buyerScan')}>
          <Ionicons name="qr-code-outline" size={30} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.scanTitle}>{t('buyerScan')}</Text>
            <Text style={styles.scanSub}>{t('buyerScanSub')}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('buyerHaveCode')}</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder={t('buyerCodePlaceholder')}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => open(code)}
            accessibilityLabel={t('buyerHaveCode')}
          />
          <TouchableOpacity style={styles.openBtn} onPress={() => open(code)} accessibilityRole="button">
            <Text style={styles.openText}>{t('buyerOpen')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>{t('buyerRecent')}</Text>
        {viewed.length === 0 ? (
          <Text style={styles.muted}>{t('buyerRecentNone')}</Text>
        ) : (
          viewed.map((v) => (
            <TouchableOpacity key={v.value} style={styles.recent} onPress={() => open(v.value)} accessibilityRole="button" accessibilityLabel={`${v.crop || ''} ${v.batchId || ''}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle}>{[v.crop, v.batchId].filter(Boolean).join(' · ') || v.value}</Text>
                <Text style={styles.recentSub}>{[v.place, v.viewedAt.slice(0, 10)].filter(Boolean).join(' · ')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingBottom: 20, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 13, color: '#FFFFFF', opacity: 0.9, marginTop: 2 },
  signOut: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scanBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.primaryDark, borderRadius: Radius.card, padding: Spacing.lg, minHeight: 80 },
  scanTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  scanSub: { fontSize: 13, color: '#FFFFFF', opacity: 0.9, marginTop: 2 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginTop: Spacing.lg },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  input: { minHeight: 48, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, marginTop: 10, color: Colors.text, backgroundColor: Colors.card },
  openBtn: { minHeight: 48, borderRadius: 999, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  openText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  section: { fontSize: 17, fontWeight: '800', color: Colors.text, marginTop: Spacing.xl, marginBottom: 6 },
  muted: { fontSize: 14, color: Colors.textMuted },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  recentTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  recentSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});
