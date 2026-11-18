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

export default function InspectorDashboardScreen() {
  const router = useRouter();
  const [batches, setBatches] = useState<HarvestBatch[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [refreshing, setRefreshing] = useState(false);

  const loadBatches = useCallback(async () => {
    try {
      const data = await localDb.getHarvests();
      setBatches(data);
    } catch (e) {
      console.error('Error loading inspector batches:', e);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBatches();
    setRefreshing(false);
  };

  const filteredBatches = batches.filter((b) => {
    if (selectedFilter === 'pending') {
      return b.status === 'submitted' || b.status === 'pending_inspection' || b.status === 'under_inspection';
    }
    if (selectedFilter === 'completed') {
      return b.status === 'approved' || b.status === 'rejected' || b.status === 'inspected';
    }
    return true;
  });

  const renderItem = ({ item }: { item: HarvestBatch }) => {
    const isPending =
      item.status === 'submitted' || item.status === 'pending_inspection' || item.status === 'under_inspection';

    return (
      <Card
        style={styles.batchCard}
        onPress={() => router.push(`/inspector/inspect/${item.id}` as any)}
      >
        <View style={styles.topRow}>
          <View style={styles.batchInfo}>
            <Text style={styles.batchRef}>{item.batch_reference}</Text>
            <Text style={styles.cropInfo}>
              {item.crop?.name || 'Produce'} — {item.crop_variety_id || 'Standard Variety'}
            </Text>
          </View>
          <Badge
            label={item.status.replace('_', ' ')}
            variant={item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'}
          />
        </View>

        <View style={styles.specsRow}>
          <View style={styles.specBox}>
            <Text style={styles.specLabel}>HARVEST YIELD</Text>
            <Text style={styles.specValue}>
              {item.quantity.toLocaleString()} {item.unit}
            </Text>
          </View>
          <View style={styles.specBox}>
            <Text style={styles.specLabel}>SUBMISSION DATE</Text>
            <Text style={styles.specValue}>{item.harvest_date}</Text>
          </View>
          <View style={styles.specBox}>
            <Text style={styles.specLabel}>STORAGE DEPOT</Text>
            <Text style={styles.specValue} numberOfLines={1}>
              {item.storage_location ? item.storage_location.split(',')[0] : 'Farm Store'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.securityText}>Token: {item.qr_token.substring(0, 16)}...</Text>
          <Button
            title={isPending ? 'Conduct Inspection' : 'Review Results'}
            size="sm"
            variant={isPending ? 'primary' : 'outline'}
            onPress={() => router.push(`/inspector/inspect/${item.id}` as any)}
          />
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Quality Inspector"
        subtitle="National Standards & Certification Queue"
        showBack
      />
      <OfflineBanner />

      <View style={styles.container}>
        <View style={styles.filterBar}>
          <TouchableOpacity
            style={[styles.filterTab, selectedFilter === 'pending' && styles.filterTabActive]}
            onPress={() => setSelectedFilter('pending')}
          >
            <Text
              style={[styles.filterTabText, selectedFilter === 'pending' && styles.filterTabTextActive]}
            >
              Inspection Queue ({batches.filter((b) => b.status === 'submitted' || b.status === 'pending_inspection').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, selectedFilter === 'completed' && styles.filterTabActive]}
            onPress={() => setSelectedFilter('completed')}
          >
            <Text
              style={[styles.filterTabText, selectedFilter === 'completed' && styles.filterTabTextActive]}
            >
              Completed ({batches.filter((b) => b.status === 'approved' || b.status === 'rejected').length})
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredBatches}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="shield-checkmark-outline" size={32} color={Colors.primary} />}
              title="No Batches in Queue"
              description="All submitted harvest batches have been inspected or no batches match this filter."
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
  filterBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterTab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomColor: Colors.primary,
  },
  filterTabText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  batchCard: {
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
  cropInfo: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  specsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  specBox: {
    flex: 1,
  },
  specLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  specValue: {
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
  securityText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
});
