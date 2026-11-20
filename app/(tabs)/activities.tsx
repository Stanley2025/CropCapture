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
import { useAppStore } from '../../src/store/useAppStore';

interface CategoryFilter {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const CATEGORIES: CategoryFilter[] = [
  { key: 'All', label: 'All', icon: 'grid-outline' },
  { key: 'Land preparation', label: 'Land prep', icon: 'construct-outline' },
  { key: 'Planting', label: 'Planting', icon: 'leaf-outline' },
  { key: 'Fertilizer application', label: 'Fertilizer', icon: 'flask-outline' },
  { key: 'Weeding', label: 'Weeding', icon: 'cut-outline' },
  { key: 'Pest management', label: 'Pest control', icon: 'shield-outline' },
  { key: 'Irrigation', label: 'Irrigation', icon: 'water-outline' },
  { key: 'Field inspection', label: 'Inspection', icon: 'checkmark-circle-outline' },
];

const getActivityTheme = (type: string) => {
  const lower = (type || '').toLowerCase();
  if (lower.includes('plant')) return { icon: 'leaf-outline' as const, bg: '#DCFCE7', color: '#15803D' };
  if (lower.includes('fertiliz')) return { icon: 'flask-outline' as const, bg: '#FEF3C7', color: '#B45309' };
  if (lower.includes('weed')) return { icon: 'cut-outline' as const, bg: '#E0E7FF', color: '#4338CA' };
  if (lower.includes('land') || lower.includes('prep')) return { icon: 'construct-outline' as const, bg: '#F1F5F9', color: '#334155' };
  if (lower.includes('pest') || lower.includes('disease')) return { icon: 'shield-outline' as const, bg: '#FEE2E2', color: '#B91C1C' };
  if (lower.includes('inspect')) return { icon: 'checkmark-circle-outline' as const, bg: '#E0F2FE', color: '#0369A1' };
  if (lower.includes('irrigat')) return { icon: 'water-outline' as const, bg: '#CCFBF1', color: '#0F766E' };
  return { icon: 'calendar-outline' as const, bg: '#F3F4F6', color: '#4B5563' };
};

export default function ActivitiesScreen() {
  const router = useRouter();
  const { currentRole, currentFarmer } = useAppStore();
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadActivities = useCallback(async () => {
    try {
      let [acts, fms] = await Promise.all([
        localDb.getActivities(),
        localDb.getFarms(),
      ]);

      if (currentRole === 'farmer' && currentFarmer?.id) {
        fms = fms.filter((f) => f.farmer_id === currentFarmer.id);
        const myFarmIds = new Set(fms.map((f) => f.id));
        acts = acts.filter(
          (a) => a.farmer_id === currentFarmer.id || myFarmIds.has(a.farm_id)
        );
      }

      setActivities(acts);
      setFarms(fms);
    } catch (e) {
      console.error('Error loading activities:', e);
    }
  }, [currentRole, currentFarmer?.id]);

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

  const getCategoryCount = (key: string) => {
    if (key === 'All') return activities.length;
    return activities.filter((a) => a.activity_type.toLowerCase() === key.toLowerCase()).length;
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

  const renderItem = ({ item }: { item: FarmActivity }) => {
    const theme = getActivityTheme(item.activity_type);
    return (
      <Card style={styles.activityCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <View style={[styles.iconCircle, { backgroundColor: theme.bg }]}>
              <Ionicons name={theme.icon} size={18} color={theme.color} />
            </View>
            <View style={{ flex: 1, marginRight: Spacing.xs }}>
              <Text style={styles.activityTitle}>{item.activity_type}</Text>
              <Text style={styles.farmLabel}>
                {getFarmName(item.farm_id)}
                {item.season_id ? ' • Main Season' : ''}
              </Text>
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
            <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.detailText}>{item.activity_date}</Text>
          </View>

          {item.quantity ? (
            <View style={styles.detailItem}>
              <Ionicons name="cube-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.detailText}>
                {item.quantity} {item.unit || ''}
              </Text>
            </View>
          ) : null}

          {item.labor_count ? (
            <View style={styles.detailItem}>
              <Ionicons name="people-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.detailText}>{item.labor_count} workers</Text>
            </View>
          ) : null}

          {Number(item.cost) > 0 && (
            <View style={styles.costBadge}>
              <Ionicons name="cash-outline" size={12} color="#15803D" />
              <Text style={styles.costText}>${item.cost} USD</Text>
            </View>
          )}
        </View>
      </Card>
    );
  };

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
          {currentRole === 'extension_officer' ? (
            <Button
              title="+ Log Visit"
              size="sm"
              onPress={() => router.push('/extension/visit' as any)}
            />
          ) : (
            <Button
              title="+ Record"
              size="sm"
              onPress={() =>
                router.push({
                  pathname: '/activity/record',
                  params: selectedCategory !== 'All' ? { initialType: selectedCategory } : {},
                } as any)
              }
            />
          )}
        </View>

        {/* Clean Filter Chips Bar */}
        <View style={styles.filterWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterContentContainer}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory.toLowerCase() === cat.key.toLowerCase();
              const count = getCategoryCount(cat.key);
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.filterChip, isSelected && styles.filterChipActive]}
                  onPress={() => setSelectedCategory(cat.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={cat.icon}
                    size={13}
                    color={isSelected ? '#FFFFFF' : '#475569'}
                    style={styles.filterChipIcon}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                  <View
                    style={[
                      styles.filterCountBadge,
                      isSelected && styles.filterCountBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterCountText,
                        isSelected && styles.filterCountTextActive,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Summary Counter Bar */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryLeft}>
            <Ionicons name="document-text-outline" size={14} color="#64748B" />
            <Text style={styles.summaryCount}>
              {filteredActivities.length}{' '}
              {filteredActivities.length === 1 ? 'Operation recorded' : 'Operations recorded'}
              {selectedCategory !== 'All' ? ` • ${selectedCategory}` : ''}
            </Text>
          </View>
          {totalCost > 0 && (
            <View style={styles.costTotalPill}>
              <Ionicons name="cash-outline" size={12} color="#15803D" />
              <Text style={styles.summaryTotal}>${totalCost.toLocaleString()} USD</Text>
            </View>
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
              icon={<Ionicons name="calendar-outline" size={36} color={Colors.primary} />}
              title={
                selectedCategory === 'All'
                  ? 'No Activities Found'
                  : `No ${selectedCategory} Records`
              }
              description={
                selectedCategory === 'All'
                  ? 'Record your agronomic operations to track labor, costs, and crop history.'
                  : `No ${selectedCategory.toLowerCase()} activities recorded yet. Tap below to log this operation.`
              }
              actionTitle={`+ Record ${selectedCategory === 'All' ? 'Activity' : selectedCategory}`}
              onAction={() =>
                router.push({
                  pathname: '/activity/record',
                  params: selectedCategory !== 'All' ? { initialType: selectedCategory } : {},
                } as any)
              }
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
    alignItems: 'center',
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
  filterWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    height: 52,
    justifyContent: 'center',
  },
  filterScroll: {
    flexGrow: 0,
    height: 52,
  },
  filterContentContainer: {
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#1C3822',
    borderColor: '#1C3822',
    shadowColor: '#1C3822',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  filterChipIcon: {
    marginRight: 5,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterCountBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  filterCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  filterCountTextActive: {
    color: '#FFFFFF',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  costTotalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  summaryTotal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  activityCard: {
    marginBottom: Spacing.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
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
    marginTop: 2,
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
    borderTopColor: '#F1F5F9',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  costText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
});
