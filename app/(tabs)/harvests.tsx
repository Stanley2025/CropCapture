import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { HarvestBatch } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';

export default function HarvestsScreen() {
  const router = useRouter();
  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const loadHarvests = useCallback(async () => {
    try {
      const data = await localDb.getHarvests();
      setHarvests(data);
    } catch (e) {
      console.error('Failed to load harvests:', e);
    }
  }, []);

  useEffect(() => {
    loadHarvests();
  }, [loadHarvests]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHarvests();
    setRefreshing(false);
  };

  const filteredHarvests = harvests.filter((h) => {
    if (selectedFilter === 'approved') return h.status === 'approved';
    if (selectedFilter === 'pending')
      return h.status === 'submitted' || h.status === 'pending_inspection' || h.status === 'under_inspection';
    return true;
  });

  const totalYield = filteredHarvests.reduce((acc, h) => acc + (Number(h.quantity) || 0), 0);

  const renderItem = ({ item }: { item: HarvestBatch }) => {
    const isApproved = item.status === 'approved';
    const isRejected = item.status === 'rejected';

    return (
      <Card
        style={styles.harvestCard}
        onPress={() => router.push(`/harvest/${item.id}` as any)}
      >
        <View style={styles.topRow}>
          <View style={styles.batchInfo}>
            <Text style={styles.batchRef}>{item.batch_reference}</Text>
            <Text style={styles.cropName}>
              {item.crop?.name || 'Crop'} ({item.crop_variety_id || 'Standard Variety'})
            </Text>
          </View>
          <Badge
            label={item.status.replace('_', ' ')}
            variant={isApproved ? 'success' : isRejected ? 'danger' : 'warning'}
          />
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>QUANTITY</Text>
            <Text style={styles.metaVal}>
              {item.quantity.toLocaleString()} {item.unit}
            </Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>HARVEST DATE</Text>
            <Text style={styles.metaVal}>{item.harvest_date}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>STORAGE</Text>
            <Text style={styles.metaVal} numberOfLines={1}>
              {item.storage_location ? item.storage_location.split(',')[0] : 'Farm Store'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.qrShortcut}
            onPress={() => router.push(`/traceability/${item.qr_token}` as any)}
          >
            <Ionicons name="qr-code-outline" size={16} color={Colors.primary} />
            <Text style={styles.qrShortcutText}>Public QR Passport</Text>
          </TouchableOpacity>

          <View style={styles.viewRow}>
            <Text style={styles.viewText}>Inspect Batch</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Harvest Batches" subtitle="Yield records, grading & QR traceability" />
      <OfflineBanner />

      <View style={styles.container}>
        <View style={styles.headerBar}>
          <View style={styles.filterPills}>
            <TouchableOpacity
              style={[styles.filterPill, selectedFilter === 'all' && styles.filterPillActive]}
              onPress={() => setSelectedFilter('all')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedFilter === 'all' && styles.filterPillTextActive,
                ]}
              >
                All ({harvests.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterPill, selectedFilter === 'approved' && styles.filterPillActive]}
              onPress={() => setSelectedFilter('approved')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedFilter === 'approved' && styles.filterPillTextActive,
                ]}
              >
                Approved
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterPill, selectedFilter === 'pending' && styles.filterPillActive]}
              onPress={() => setSelectedFilter('pending')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedFilter === 'pending' && styles.filterPillTextActive,
                ]}
              >
                Pending
              </Text>
            </TouchableOpacity>
          </View>

          <Button
            title="+ Register"
            size="sm"
            onPress={() => router.push('/harvest/register' as any)}
          />
        </View>

        {totalYield > 0 && (
          <View style={styles.summaryBar}>
            <Text style={styles.summaryText}>
              Cumulative Harvest: <Text style={{ fontWeight: '700' }}>{totalYield.toLocaleString()} kg</Text>
            </Text>
          </View>
        )}

        <FlatList
          data={filteredHarvests}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="basket-outline" size={32} color={Colors.primary} />}
              title="No Harvest Batches Found"
              description="Register your harvested produce to generate an authentic batch ID and queue a quality inspection."
              actionTitle="Register New Harvest"
              onAction={() => router.push('/harvest/register' as any)}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterPills: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  summaryBar: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
  },
  summaryText: {
    fontSize: Typography.sizes.xs,
    color: Colors.primaryDark,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  harvestCard: {
    marginBottom: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  batchInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  batchRef: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  cropName: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  metaBlock: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  metaVal: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  qrShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  qrShortcutText: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewText: {
    fontSize: Typography.sizes.xs,
    color: Colors.primary,
    fontWeight: '700',
  },
});
