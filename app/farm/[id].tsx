import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Pencil,
  Check,
  MapPin,
  TrendingUp,
  TrendingDown,
  Layers,
  Plus,
} from 'lucide-react-native';
import {
  Colors,
  FontFamily,
  Spacing,
  Typography,
  Shadows,
} from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import {
  Farm,
  FarmSeason,
  FarmActivity,
  HarvestBatch,
  ExpenseRecord,
  InputRecord,
} from '../../src/types/database';
import { FieldIllustration } from '../../src/components/FieldIllustration';
import { estimateHarvestRevenue } from '../../src/shared/farmRecords';
import { Button } from '../../src/components/Button';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function FarmDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [farm, setFarm] = useState<Farm | null>(null);
  const [seasons, setSeasons] = useState<FarmSeason[]>([]);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [inputs, setInputs] = useState<InputRecord[]>([]);

  // Calculate Real Farm Financial Profit & Loss (P&L)
  const financialSummary = useMemo(() => {
    const harvestRevenue = estimateHarvestRevenue(harvests);

    const totalInputsCost = inputs.reduce((acc, i) => acc + (Number(i.cost) || 0), 0);
    const totalActivitiesCost = activities.reduce((acc, a) => acc + (Number(a.cost) || 0), 0);
    const totalDirectExpenses = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const totalExpenses = totalInputsCost + totalActivitiesCost + totalDirectExpenses;
    const netProfit = harvestRevenue - totalExpenses;
    const profitMargin = harvestRevenue > 0 ? (netProfit / harvestRevenue) * 100 : 0;

    return {
      harvestRevenue,
      totalInputsCost,
      totalActivitiesCost,
      totalDirectExpenses,
      totalExpenses,
      netProfit,
      profitMargin,
      isProfitable: netProfit >= 0,
    };
  }, [harvests, inputs, activities, expenses]);

  const loadFarmData = useCallback(async () => {
    if (!id) return;
    try {
      const allFarms = await localDb.getFarms();
      const current = allFarms.find((f) => f.id === id);
      setFarm(current || null);

      const [allSeasons, allActivities, allHarvests, allExpenses, allInputs] =
        await Promise.all([
          localDb.getSeasons(),
          localDb.getActivities(),
          localDb.getHarvests(),
          localDb.getExpenses(),
          localDb.getInputs(),
        ]);

      setSeasons(allSeasons.filter((s) => s.farm_id === id));
      setActivities(allActivities.filter((a) => a.farm_id === id));
      setHarvests(allHarvests.filter((h) => h.farm_id === id));
      setExpenses(allExpenses.filter((e) => e.farm_id === id));
      setInputs(allInputs.filter((i) => i.farm_id === id));
    } catch (e) {
      console.error('Failed to load farm details:', e);
    }
  }, [id]);

  useEffect(() => {
    loadFarmData();
  }, [loadFarmData]);

  // Fallback demo data if id is not in localDb
  const activeFarm: Farm =
    farm ||
    ({
      id: id || 'demo-farm-01',
      name: 'Gbehley Rice Plot',
      crop_type: 'rice',
      size: 4.1,
      size_unit: 'ac',
      community: 'Gbehley',
      district: 'Nimba',
      county: 'Nimba',
      registration_date: '2026-06-15',
    } as unknown as Farm);

  const cropRaw = ((activeFarm as any).crop_type || activeFarm.farming_type || 'rice').toLowerCase();
  const cropType = cropRaw.includes('cass')
    ? 'cassava'
    : cropRaw.includes('cocoa')
    ? 'cocoa'
    : 'rice';
  const cropDisplay = cropType.charAt(0).toUpperCase() + cropType.slice(1);
  const varietyDisplay = (activeFarm as any).variety || (cropType === 'rice' ? 'Suakoko 8' : 'CARICASS 2');
  const locationStr = `${activeFarm.community || 'Gbehley'}, ${activeFarm.county || 'Nimba'}`;

  // Metrics
  const areaDisplay = `${activeFarm.size || 4.1} ac`;
  const costDisplay = `$${financialSummary.totalExpenses > 0 ? financialSummary.totalExpenses : 190}`;
  const totalHarvestQty = harvests.reduce((acc, h) => acc + (Number(h.quantity) || 0), 0);
  const harvestDisplay = `${totalHarvestQty > 0 ? totalHarvestQty.toLocaleString() : '2,450'} kg`;

  // Season Timeline
  const activeSeason = seasons[0] || {
    id: 'season-demo-01',
    season_name: '2026 Main Swamp Rice Season',
  };

  const timelineSteps = activities.length > 0
    ? activities.slice(0, 4).map((a) => ({
        id: a.id,
        title: a.activity_type,
        dateCost: `${a.activity_date || 'Active'} • $${a.cost || 45}`,
      }))
    : [
        { id: '1', title: 'Planting', dateCost: '15 Jun • $65' },
        { id: '2', title: 'Fertilizer', dateCost: '20 Jul • $85' },
        { id: '3', title: 'Weeding', dateCost: '15 Aug • $40' },
        { id: '4', title: 'Harvest', dateCost: '22 Oct • 2,450 kg' },
      ];

  const latestBatchId = harvests[0]?.id || 'demo-batch-rice';

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Hero: Full-Width Field Illustration + Floating Header Controls */}
        <View style={styles.heroContainer}>
          <FieldIllustration height={210} cropType={cropType} />
          <View style={[styles.floatingHeaderRow, { top: Math.max(insets.top, 16) + 6 }]}>
            <TouchableOpacity
              style={styles.floatingCircleBtn}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              activeOpacity={0.8}
            >
              <ChevronLeft size={22} color={Colors.text} strokeWidth={2.4} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.floatingCircleBtn}
              onPress={() =>
                Alert.alert(
                  'Edit Farm Parcel',
                  `Edit ${activeFarm.name} details or GPS coordinates.`
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Edit farm"
              activeOpacity={0.8}
            >
              <Pencil size={18} color={Colors.text} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Overlapping Main White Card */}
        <View style={styles.contentWrapper}>
          <View style={styles.mainParcelCard}>
            <Text style={styles.parcelTitle}>{activeFarm.name}</Text>
            <Text style={styles.parcelSubtitle}>
              {cropDisplay} • {varietyDisplay} • {locationStr}
            </Text>

            {/* 3 Metric Stat Boxes */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Area</Text>
                <Text style={styles.metricValue}>{areaDisplay}</Text>
              </View>

              <TouchableOpacity
                style={styles.metricBox}
                activeOpacity={0.7}
                onPress={() => router.push('/inputs-expenses' as any)}
                accessibilityRole="button"
                accessibilityLabel="View Inputs and Costs"
              >
                <Text style={styles.metricLabel}>Costs</Text>
                <Text style={styles.metricValue}>{costDisplay}</Text>
              </TouchableOpacity>

              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Harvest</Text>
                <Text style={styles.metricValue}>{harvestDisplay}</Text>
              </View>
            </View>
          </View>

          {/* Season Timeline Card */}
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>
              {activeSeason.season_name || '2026 Main Swamp Rice Season'}
            </Text>

            <View style={styles.timelineStepsContainer}>
              {timelineSteps.map((step, idx) => {
                const isLast = idx === timelineSteps.length - 1;
                return (
                  <View key={step.id} style={styles.timelineRow}>
                    {/* Left: Circle checkmark and connecting line */}
                    <View style={styles.timelineLeftCol}>
                      <View style={styles.checkCircle}>
                        <Check size={14} color="#FFFFFF" strokeWidth={3} />
                      </View>
                      {!isLast && <View style={styles.connectingLine} />}
                    </View>

                    {/* Right: Step label and details */}
                    <View style={styles.timelineRightCol}>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      <Text style={styles.stepDateCost}>{step.dateCost}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* P&L Financial Detail Card */}
          <View style={styles.pnlCard}>
            <View style={styles.pnlHeader}>
              <View style={styles.pnlTitleRow}>
                {financialSummary.isProfitable ? (
                  <TrendingUp size={16} color={Colors.primary} strokeWidth={2.4} />
                ) : (
                  <TrendingDown size={16} color={Colors.danger} strokeWidth={2.4} />
                )}
                <Text style={styles.pnlTitle}>Parcel Financial Performance</Text>
              </View>
              <Text
                style={[
                  styles.pnlProfitValue,
                  { color: financialSummary.isProfitable ? Colors.primary : Colors.danger },
                ]}
              >
                {financialSummary.netProfit >= 0 ? '+' : ''}${financialSummary.netProfit.toFixed(0)} USD
              </Text>
            </View>
            <Text style={styles.pnlSub}>
              Revenue: ${financialSummary.harvestRevenue.toFixed(0)} • Total Expenses: ${financialSummary.totalExpenses.toFixed(0)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar with Two Action Buttons */}
      <View
        style={[
          styles.bottomStickyBar,
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        <TouchableOpacity
          style={styles.btnOutline}
          onPress={() => router.push(`/harvest/${latestBatchId}` as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.btnOutlineText}>View passport</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push(`/activity/record?farmId=${activeFarm.id}` as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Record activity</Text>
        </TouchableOpacity>
      </View>
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
  heroContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    overflow: 'hidden',
    backgroundColor: Colors.tintSoft,
  },
  floatingHeaderRow: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  floatingCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  contentWrapper: {
    paddingHorizontal: Spacing.xl,
    marginTop: -28,
  },
  mainParcelCard: {
    backgroundColor: Colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    marginBottom: 16,
    ...Shadows.card,
  },
  parcelTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 24,
    color: Colors.text,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  parcelSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    marginBottom: 18,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricBox: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  metricLabel: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  metricValue: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  timelineCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    marginBottom: 16,
    ...Shadows.card,
  },
  timelineTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 17,
    color: Colors.text,
    marginBottom: 18,
    letterSpacing: -0.2,
  },
  timelineStepsContainer: {
    paddingLeft: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 52,
  },
  timelineLeftCol: {
    alignItems: 'center',
    width: 28,
    marginRight: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectingLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#C9DBC4',
    marginVertical: 4,
  },
  timelineRightCol: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 2,
    paddingBottom: 16,
  },
  stepTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: Colors.text,
  },
  stepDateCost: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  pnlCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
    ...Shadows.card,
  },
  pnlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  pnlTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pnlTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.sizes.sm,
    color: Colors.text,
  },
  pnlProfitValue: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.sizes.sm,
    fontVariant: ['tabular-nums'],
  },
  pnlSub: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  bottomStickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingTop: 12,
    gap: 12,
  },
  btnOutline: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: Colors.primary,
  },
  btnPrimary: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  btnPrimaryText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
