import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Calendar, QrCode } from 'lucide-react-native';
import {
  Colors,
  FontFamily,
  Spacing,
  Typography,
  Shadows,
} from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { HarvestBatch } from '../../src/types/database';
import { useAppStore } from '../../src/store/useAppStore';

const FILTERS = ['All', 'Approved', 'Pending'];

export default function HarvestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentRole, currentFarmer } = useAppStore();

  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const loadHarvests = useCallback(async () => {
    try {
      let data = await localDb.getHarvests();
      if (currentRole === 'farmer' && currentFarmer?.id) {
        data = data.filter((h) => h.farmer_id === currentFarmer.id);
      }
      setHarvests(data);
    } catch (e) {
      console.error('Failed to load harvests:', e);
    }
  }, [currentRole, currentFarmer?.id]);

  useEffect(() => {
    loadHarvests();
  }, [loadHarvests]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHarvests();
    setRefreshing(false);
  };

  const filteredHarvests = harvests.filter((h) => {
    if (selectedFilter === 'Approved') return h.status === 'approved';
    if (selectedFilter === 'Pending')
      return (
        h.status === 'submitted' ||
        h.status === 'pending_inspection' ||
        h.status === 'under_inspection'
      );
    return true;
  });

  // Fallback demo harvests if empty
  const displayHarvests =
    filteredHarvests.length > 0
      ? filteredHarvests
      : harvests.length === 0
      ? [
          {
            id: 'batch-demo-1',
            farm_id: 'farm-01',
            farmer_id: 'farmer-01',
            batch_reference: 'AGR-2026-RICE-000001',
            qr_token: 'AGR-SEC-77491-VERIFIED',
            crop: { name: 'Rice', category: 'Cereals' },
            crop_variety_id: 'Suakoko 8',
            quantity: 2450,
            unit: 'kg',
            harvest_date: '2026-10-22',
            status: 'approved',
            is_server_verified: true,
          } as unknown as HarvestBatch,
        ]
      : [];

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: Math.max(insets.top, 16) + 12, paddingBottom: 110 },
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
        {/* Header Row: Title + Circular Green "+" Button */}
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>Harvests</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/harvest/register' as any)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Register harvest"
          >
            <Plus size={24} color="#FFFFFF" strokeWidth={2.6} />
          </TouchableOpacity>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const isSelected = selectedFilter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterChip,
                  isSelected ? styles.filterChipActive : styles.filterChipInactive,
                ]}
                onPress={() => setSelectedFilter(f)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected ? styles.filterChipTextActive : styles.filterChipTextInactive,
                  ]}
                >
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Harvest Cards List */}
        <View style={styles.harvestList}>
          {displayHarvests.map((batch) => {
            const cropName = batch.crop?.name || 'Rice';
            const variety = batch.crop_variety_id || 'Suakoko 8';
            const isApproved = batch.status === 'approved';
            const qtyStr = `${Number(batch.quantity).toLocaleString()} ${batch.unit || 'kg'}`;

            return (
              <TouchableOpacity
                key={batch.id}
                style={styles.harvestCard}
                onPress={() => router.push(`/harvest/${batch.id}` as any)}
                activeOpacity={0.88}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.batchTitle}>
                      {cropName} • {variety}
                    </Text>
                    <Text style={styles.batchRef}>{batch.batch_reference}</Text>
                  </View>
                  <View style={isApproved ? styles.approvedPill : styles.pendingPill}>
                    <Text style={isApproved ? styles.approvedPillText : styles.pendingPillText}>
                      {isApproved ? 'Approved' : 'Pending verification'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.footerCol}>
                    <Text style={styles.footerLabel}>Yield</Text>
                    <Text style={styles.footerValue}>{qtyStr}</Text>
                  </View>

                  <View style={styles.footerCol}>
                    <Text style={styles.footerLabel}>Harvested</Text>
                    <Text style={styles.footerValue}>{batch.harvest_date}</Text>
                  </View>

                  <View style={styles.qrIndicator}>
                    <QrCode size={18} color={Colors.primary} strokeWidth={2.2} />
                    <Text style={styles.qrIndicatorText}>Passport</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Dashed "+ Register another harvest" card */}
          <TouchableOpacity
            style={styles.dashedAddCard}
            onPress={() => router.push('/harvest/register' as any)}
            activeOpacity={0.8}
          >
            <Plus size={18} color={Colors.primary} strokeWidth={2.4} />
            <Text style={styles.dashedAddCardText}>Register another harvest</Text>
          </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  screenTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 28,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  filterChip: {
    height: 38,
    paddingHorizontal: 20,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipInactive: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipText: {
    fontSize: Typography.sizes.sm,
  },
  filterChipTextActive: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  filterChipTextInactive: {
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  harvestList: {
    gap: 16,
  },
  harvestCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  batchTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  batchRef: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  approvedPill: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  approvedPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.primary,
  },
  pendingPill: {
    backgroundColor: Colors.amberBg,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.amberText,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerCol: {
    justifyContent: 'center',
  },
  footerLabel: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  footerValue: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  qrIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.tintSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  qrIndicatorText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.primary,
  },
  dashedAddCard: {
    height: 56,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#84B080',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  dashedAddCardText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
  },
});
