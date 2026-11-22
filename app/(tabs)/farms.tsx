import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import {
  Colors,
  FontFamily,
  Spacing,
  Typography,
  Shadows,
} from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { getScope } from '../../src/services/access/visibility';
import { Farm, HarvestBatch, ExpenseRecord, InputRecord } from '../../src/types/database';
import { FieldIllustration } from '../../src/components/FieldIllustration';
import { useAppStore } from '../../src/store/useAppStore';

export default function FarmsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentRole, currentFarmer, currentUserProfile } = useAppStore();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [allHarvests, setAllHarvests] = useState<HarvestBatch[]>([]);
  const [allExpenses, setAllExpenses] = useState<ExpenseRecord[]>([]);
  const [allInputs, setAllInputs] = useState<InputRecord[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [refreshing, setRefreshing] = useState(false);

  const loadFarms = useCallback(async () => {
    try {
      const [data, harvests, expenses, inputs] = await Promise.all([
        localDb.getFarms(),
        localDb.getHarvests(),
        localDb.getExpenses(),
        localDb.getInputs(),
      ]);
      const scope = await getScope(currentRole, currentUserProfile?.id, currentFarmer?.id);
      setFarms(data.filter(scope.farm));
      setAllHarvests(harvests.filter(scope.row));
      setAllExpenses(expenses.filter(scope.row));
      setAllInputs(inputs.filter(scope.row));
    } catch (e) {
      console.error('Error loading farms:', e);
    }
  }, [currentRole, currentFarmer?.id, currentUserProfile?.id]);

  // This screen stays open while another is shown on top of it (for example after registering a
  // second harvest), so read the saved records again every time it comes back into view.
  useFocusEffect(
    useCallback(() => {
      loadFarms();
    }, [loadFarms])
  );

  useEffect(() => {
    loadFarms();
  }, [loadFarms]);

  const onRefresh = async () => {
    setRefreshing(true);
    await useAppStore.getState().pullRemoteChanges();
    await loadFarms();
    setRefreshing(false);
  };

  // Derive unique filter options based on data (always include All, Rice, Cassava)
  const filterOptions = useMemo(() => {
    const set = new Set(['All', 'Rice', 'Cassava']);
    farms.forEach((f) => {
      const c = (f as any).crop_type || f.farming_type;
      if (c && typeof c === 'string') {
        const titleCase = c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
        set.add(titleCase);
      }
    });
    return Array.from(set);
  }, [farms]);

  // Filtered farm list
  const filteredFarms = useMemo(() => {
    if (selectedFilter === 'All') return farms;
    return farms.filter((f) => {
      const crop = ((f as any).crop_type || f.farming_type || '').toLowerCase();
      const name = (f.name || (f as any).farm_name || '').toLowerCase();
      const filterLower = selectedFilter.toLowerCase();
      return crop.includes(filterLower) || name.includes(filterLower);
    });
  }, [farms, selectedFilter]);

  // Only the farmer's own farms are listed (never invented ones).
  const displayFarms = filteredFarms;

  return (
    <View style={styles.container}>
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
        {/* Top Header Row: "My farms" Title + Circular Green "+" Button */}
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>My farms</Text>
          <TouchableOpacity
            style={styles.addFarmButton}
            onPress={() => router.push('/farm/register' as any)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Register another farm"
          >
            <Plus size={24} color="#FFFFFF" strokeWidth={2.6} />
          </TouchableOpacity>
        </View>

        {/* Filter Chips Horizontal Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filterOptions.map((filter) => {
            const isSelected = selectedFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  isSelected ? styles.filterChipActive : styles.filterChipInactive,
                ]}
                onPress={() => setSelectedFilter(filter)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected
                      ? styles.filterChipTextActive
                      : styles.filterChipTextInactive,
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Farm Cards Vertical List */}
        <View style={styles.farmsList}>
          {displayFarms.length === 0 ? (
            <View style={{ backgroundColor: Colors.card, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 18 }}>
              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700' }}>No farms yet</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 14, marginTop: 4 }}>
                Register your first farm to start recording activities, harvests and costs.
              </Text>
              <TouchableOpacity style={{ alignSelf: 'flex-start', marginTop: 12, paddingVertical: 9, paddingHorizontal: 18, borderRadius: 999, backgroundColor: Colors.primary }} activeOpacity={0.85} onPress={() => router.push('/farm/register' as any)}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Add your farm</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {displayFarms.map((farm) => {
            const cropRaw =
              ((farm as any).crop_type || farm.farming_type || 'rice').toLowerCase();
            const cropType = cropRaw.includes('cass')
              ? 'cassava'
              : cropRaw.includes('cocoa')
              ? 'cocoa'
              : 'rice';
            const cropDisplay = cropType.charAt(0).toUpperCase() + cropType.slice(1);
            const variety = (farm as any).variety ? ` • ${(farm as any).variety}` : '';
            const sizeVal = farm.size || (farm as any).total_area || (farm as any).size_hectares || '4.1';
            const sizeUnit = farm.size_unit || 'acres';
            const locationStr =
              farm.community && farm.county
                ? `${farm.community}, ${farm.county}`
                : farm.district && farm.county
                ? `${farm.district}, ${farm.county}`
                : 'Gbehley, Nimba';

            return (
              <TouchableOpacity
                key={farm.id}
                style={styles.farmCard}
                onPress={() => router.push(`/farm/${farm.id}` as any)}
                activeOpacity={0.88}
              >
                {/* Left 72x72 squircle with FieldIllustration */}
                <View style={styles.thumbnailSquircle}>
                  <FieldIllustration height={72} cropType={cropType} />
                </View>

                {/* Right farm details column */}
                <View style={styles.farmDetailsCol}>
                  <Text style={styles.farmName} numberOfLines={1}>
                    {farm.name || (farm as any).farm_name || 'My Farm Plot'}
                  </Text>
                  <Text style={styles.farmMetaLine} numberOfLines={1}>
                    {cropDisplay}{variety} • {sizeVal} {sizeUnit}
                  </Text>
                  <Text style={styles.farmLocationLine} numberOfLines={1}>
                    {locationStr}
                  </Text>
                  <View style={styles.seasonActivePill}>
                    <Text style={styles.seasonActivePillText}>Season active</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Dashed Border Card: "+ Register another farm" */}
          <TouchableOpacity
            style={styles.registerDashedCard}
            onPress={() => router.push('/farm/register' as any)}
            activeOpacity={0.8}
          >
            <Plus size={18} color={Colors.primary} strokeWidth={2.4} />
            <Text style={styles.registerDashedCardText}>
              Register another farm
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    marginBottom: Spacing.lg,
  },
  screenTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 28,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  addFarmButton: {
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
    paddingBottom: Spacing.xl,
  },
  filterChip: {
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 20,
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
    letterSpacing: 0.1,
  },
  filterChipTextActive: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  filterChipTextInactive: {
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  farmsList: {
    gap: 16,
  },
  farmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 16,
    ...Shadows.card,
  },
  thumbnailSquircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.tintSoft,
  },
  farmDetailsCol: {
    flex: 1,
    justifyContent: 'center',
  },
  farmName: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.sizes.md, // 17
    color: Colors.text,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  farmMetaLine: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs, // 13
    color: Colors.textMuted,
    lineHeight: 18,
  },
  farmLocationLine: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 6,
  },
  seasonActivePill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.tint,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  seasonActivePillText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.primary,
  },
  registerDashedCard: {
    height: 56,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#84B080',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  registerDashedCardText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
  },
});
