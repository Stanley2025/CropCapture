import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Search, Calendar, Users, DollarSign, X } from 'lucide-react-native';
import {
  Colors,
  FontFamily,
  Spacing,
  Typography,
  Shadows,
} from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { FarmActivity, Farm } from '../../src/types/database';
import { useAppStore } from '../../src/store/useAppStore';

const CATEGORIES = [
  'All',
  'Land prep',
  'Planting',
  'Fertilizer',
  'Weeding',
  'Pest control',
  'Harvest',
];

export default function ActivitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    return f ? f.name : 'Gbehley Rice Plot';
  };

  const filteredActivities = activities.filter((act) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      act.activity_type.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesSearch =
      !searchQuery.trim() ||
      act.activity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (act.description && act.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Fallback demo activities if empty
  const displayActivities =
    filteredActivities.length > 0
      ? filteredActivities
      : activities.length === 0
      ? [
          {
            id: 'act-demo-1',
            farm_id: 'farm-01',
            activity_type: 'Planting',
            description: 'Transplanted Suakoko 8 rice seedlings into lowland bunded plots.',
            activity_date: '15 Jun 2026',
            cost: 65,
            labor_count: 4,
            sync_status: 'synced',
          } as unknown as FarmActivity,
          {
            id: 'act-demo-2',
            farm_id: 'farm-01',
            activity_type: 'Fertilizer Application',
            description: 'Applied NPK 15-15-15 basal fertilizer across 4.1 acres.',
            activity_date: '20 Jul 2026',
            cost: 85,
            labor_count: 2,
            sync_status: 'synced',
          } as unknown as FarmActivity,
          {
            id: 'act-demo-3',
            farm_id: 'farm-01',
            activity_type: 'Weeding',
            description: 'Manual weeding along rice paddy bunds.',
            activity_date: '15 Aug 2026',
            cost: 40,
            labor_count: 3,
            sync_status: 'synced',
          } as unknown as FarmActivity,
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
          <Text style={styles.screenTitle}>Activity</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/activity/record' as any)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Record activity"
          >
            <Plus size={24} color="#FFFFFF" strokeWidth={2.6} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search activities..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Chips Horizontal Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.filterChip,
                  isSelected ? styles.filterChipActive : styles.filterChipInactive,
                ]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected ? styles.filterChipTextActive : styles.filterChipTextInactive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Activities List */}
        <View style={styles.activitiesList}>
          {displayActivities.map((act) => {
            const farmName = getFarmName(act.farm_id);
            return (
              <View key={act.id} style={styles.activityCard}>
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.actTitle}>{act.activity_type}</Text>
                    <Text style={styles.actFarmName}>{farmName}</Text>
                  </View>
                  <View style={styles.syncedPill}>
                    <Text style={styles.syncedPillText}>
                      {act.sync_status === 'synced' ? 'Synced' : 'Saved on device'}
                    </Text>
                  </View>
                </View>

                {act.description ? (
                  <Text style={styles.actDescription} numberOfLines={2}>
                    {act.description}
                  </Text>
                ) : null}

                <View style={styles.cardFooterRow}>
                  <View style={styles.footerItem}>
                    <Calendar size={13} color={Colors.textMuted} />
                    <Text style={styles.footerItemText}>{act.activity_date}</Text>
                  </View>

                  {act.labor_count ? (
                    <View style={styles.footerItem}>
                      <Users size={13} color={Colors.textMuted} />
                      <Text style={styles.footerItemText}>{act.labor_count} workers</Text>
                    </View>
                  ) : null}

                  {Number(act.cost) > 0 ? (
                    <View style={styles.costBadge}>
                      <Text style={styles.costBadgeText}>${act.cost}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}

          {/* Dashed "+ Record another activity" card */}
          <TouchableOpacity
            style={styles.dashedAddCard}
            onPress={() => router.push('/activity/record' as any)}
            activeOpacity={0.8}
          >
            <Plus size={18} color={Colors.primary} strokeWidth={2.4} />
            <Text style={styles.dashedAddCardText}>Record another activity</Text>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    marginBottom: 16,
    gap: 10,
    ...Shadows.card,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.sm,
    color: Colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 20,
  },
  filterChip: {
    height: 38,
    paddingHorizontal: 18,
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
  activitiesList: {
    gap: 14,
  },
  activityCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    ...Shadows.card,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  actTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 16,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  actFarmName: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  syncedPill: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  syncedPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.primary,
  },
  actDescription: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.sm,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerItemText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  costBadge: {
    marginLeft: 'auto',
    backgroundColor: Colors.tintSoft,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
  },
  costBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
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
