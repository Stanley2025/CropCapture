import React, { useState, useEffect, useCallback } from 'react';
import { ActivityWeatherLine } from '../../src/components/activity/ActivityWeatherLine';
import { KeyboardAwareScrollView } from '../../src/components/KeyboardAwareScrollView';
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
import { getScope } from '../../src/services/access/visibility';
import { FarmActivity, Farm, FarmSeason } from '../../src/types/database';
import { useAppStore } from '../../src/store/useAppStore';
import { matchesCategory as activityMatchesCategory } from '../../src/shared/activityTypes';

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
  const { currentRole, currentFarmer, currentUserProfile } = useAppStore();

  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [seasons, setSeasons] = useState<FarmSeason[]>([]);
  // null = the newest season (the one just activated); 'all' = every season
  const [seasonChoice, setSeasonChoice] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadActivities = useCallback(async () => {
    try {
      let [acts, fms, allSeasons] = await Promise.all([
        localDb.getActivities(),
        localDb.getFarms(),
        localDb.getSeasons(),
      ]);

      const scope = await getScope(currentRole, currentUserProfile?.id, currentFarmer?.id);
      fms = fms.filter(scope.farm);
      acts = acts.filter(scope.row);
      setSeasons(allSeasons.filter(scope.row));

      setActivities(acts);
      setFarms(fms);
    } catch (e) {
      console.error('Error loading activities:', e);
    }
  }, [currentRole, currentFarmer?.id, currentUserProfile?.id]);

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
    return f ? f.name : 'Farm';
  };

  // The log starts with the newest season, so a newly activated season begins with an empty log.
  // Older seasons are one tap away.
  const seasonsNewestFirst = [...seasons].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const validChoice = seasonChoice === 'all' || seasonsNewestFirst.some((x) => x.id === seasonChoice) ? seasonChoice : null;
  const seasonId = validChoice ?? (seasonsNewestFirst[0]?.id || 'all');
  const seasonActivities = seasonId === 'all' ? activities : activities.filter((a) => a.season_id === seasonId);

  const filteredActivities = seasonActivities.filter((act) => {
    const matchesCategory = activityMatchesCategory(act.activity_type, selectedCategory);
    const matchesSearch =
      !searchQuery.trim() ||
      act.activity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (act.description && act.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Only the farmer's own activities are listed (never invented ones).
  const displayActivities = filteredActivities;

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
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

        {/* Season: newest first */}
        {seasonsNewestFirst.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {[...seasonsNewestFirst.map((x) => ({ id: x.id, label: `${x.season_name}${farms.length > 1 ? ` · ${getFarmName(x.farm_id)}` : ''}` })), { id: 'all', label: 'All seasons' }].map((opt) => {
              const on = seasonId === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.filterChip, on ? styles.filterChipActive : styles.filterChipInactive]}
                  onPress={() => setSeasonChoice(opt.id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.filterChipText, on ? styles.filterChipTextActive : styles.filterChipTextInactive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

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
          {displayActivities.length === 0 ? (
            <View style={{ backgroundColor: Colors.card, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 18 }}>
              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700' }}>No activities yet</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 14, marginTop: 4 }}>
                Activities you record on your farms will appear here.
              </Text>
              <TouchableOpacity style={{ alignSelf: 'flex-start', marginTop: 12, paddingVertical: 9, paddingHorizontal: 18, borderRadius: 999, backgroundColor: Colors.primary }} activeOpacity={0.85} onPress={() => router.push('/activity/record' as any)}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Record an activity</Text>
              </TouchableOpacity>
            </View>
          ) : null}
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

                <ActivityWeatherLine activity={act} />

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
      </KeyboardAwareScrollView>
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
