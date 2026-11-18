import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { FarmActivity, Farm } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';

const CATEGORIES = [
  'All',
  'Land preparation',
  'Planting',
  'Fertilizer application',
  'Weeding',
  'Pest management',
  'Irrigation',
  'Field inspection',
];

export default function ActivitiesScreen() {
  const router = useRouter();
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadActivities = useCallback(async () => {
    try {
      const [acts, fms] = await Promise.all([
        localDb.getActivities(),
        localDb.getFarms(),
      ]);
      setActivities(acts);
      setFarms(fms);
    } catch (e) {
      console.error('Error loading activities:', e);
    }
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  };

  const getFarmName = (farmId: string) => {
    const f = farms.find((farm) => farm.id === farmId);
    return f ? f.name : 'Registered Parcel';
  };

  const filteredActivities = activities.filter((act) => {
    const matchesCategory =
      selectedCategory === 'All' || act.activity_type.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      !searchQuery.trim() ||
      act.activity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (act.description && act.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const totalCost = filteredActivities.reduce((acc, a) => acc + (Number(a.cost) || 0), 0);

  const renderItem = ({ item }: { item: FarmActivity }) => (
    <Card style={styles.activityCard}>
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="construct-outline" size={16} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.activityTitle}>{item.activity_type}</Text>
            <Text style={styles.farmLabel}>{getFarmName(item.farm_id)}</Text>
          </View>
        </View>
        <Badge
          label={item.sync_status === 'synced' ? 'Synced' : 'Saved on Device'}
          variant={item.sync_status === 'synced' ? 'success' : 'warning'}
          size="sm"
        />
      </View>

      {item.description ? (
        <Text style={styles.description}>{item.description}</Text>
      ) : null}

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.detailText}>{item.activity_date}</Text>
        </View>

        {item.quantity ? (
          <View style={styles.detailItem}>
            <Ionicons name="cube-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.detailText}>
              {item.quantity} {item.unit || ''}
            </Text>
          </View>
        ) : null}

        {item.labor_count ? (
          <View style={styles.detailItem}>
            <Ionicons name="people-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.detailText}>{item.labor_count} workers</Text>
          </View>
        ) : null}

        {item.cost > 0 && (
          <View style={styles.costBadge}>
            <Text style={styles.costText}>${item.cost} USD</Text>
          </View>
        )}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Farm Activities" subtitle="Operations, labor & field management" />
      <OfflineBanner />

      <View style={styles.container}>
        {/* Search and Action Bar */}
        <View style={styles.topActions}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.textMuted} style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search activity records..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <Button
            title="+ Record"
            size="sm"
            onPress={() => router.push('/activity/record' as any)}
          />
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategory === cat && styles.filterChipTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Summary Counter Bar */}
        <View style={styles.summaryBar}>
          <Text style={styles.summaryCount}>
            {filteredActivities.length} {filteredActivities.length === 1 ? 'Record' : 'Records'}
          </Text>
          {totalCost > 0 && (
            <Text style={styles.summaryTotal}>Total Cost: ${totalCost.toLocaleString()} USD</Text>
          )}
        </View>

        <FlatList
          data={filteredActivities}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="calendar-outline" size={32} color={Colors.primary} />}
              title="No Activities Found"
              description="Record your agronomic operations to track labor, costs, and crop history."
              actionTitle="Record Farm Activity"
              onAction={() => router.push('/activity/record' as any)}
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
  topActions: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.text,
    paddingVertical: 8,
  },
  filterScroll: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterChip: {
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    marginRight: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surfaceAlt,
  },
  summaryCount: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  summaryTotal: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  activityCard: {
    marginBottom: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  activityTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  farmLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  description: {
    fontSize: Typography.sizes.xs,
    color: Colors.text,
    lineHeight: 18,
    marginVertical: Spacing.xs,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  costBadge: {
    marginLeft: 'auto',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  costText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
});
