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
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
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
import { findCropById } from '../../src/shared/farmRecords';
import { profitAndLoss } from '../../src/shared/farmFinance';
import { ProfitLossCard } from '../../src/components/ProfitLossCard';
import { formatMoney } from '../../src/shared/money';
import { t } from '../../src/i18n/en';
import { Ionicons } from '@expo/vector-icons';
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

  // Real farm profit and loss, in US dollars and (separately) Liberian dollars
  const financialSummary = useMemo(() => {
    const pl = profitAndLoss({ harvests, expenses, inputs, activities, farmIds: [id as string] });
    const profitMargin = pl.usd.moneyIn > 0 ? (pl.usd.result / pl.usd.moneyIn) * 100 : 0;
    return {
      harvestRevenue: pl.usd.moneyIn,
      totalExpenses: pl.usd.moneyOut,
      netProfit: pl.usd.result,
      profitMargin,
      isProfitable: pl.usd.isProfit,
      lrd: pl.lrd,
      pl,
    };
  }, [harvests, inputs, activities, expenses, id]);

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

  // This screen stays open while another is shown on top of it (for example after registering a
  // second harvest), so read the saved records again every time it comes back into view.
  useFocusEffect(
    useCallback(() => {
      loadFarmData();
    }, [loadFarmData])
  );

  useEffect(() => {
    loadFarmData();
  }, [loadFarmData]);

  // While the farm loads there is nothing to show yet; never invent a farm.
  const activeFarm: Farm =
    farm ||
    ({
      id: id || '',
      name: '',
      size: 0,
      size_unit: 'acres',
    } as unknown as Farm);

  const seasonCropName = seasons[0] ? (findCropById(seasons[0].crop_id)?.name || '') : '';
  const cropRaw = (seasonCropName || (activeFarm as any).crop_type || '').toLowerCase();
  const cropType = cropRaw.includes('cass') ? 'cassava' : cropRaw.includes('cocoa') ? 'cocoa' : 'rice'; // picture only
  const farmTypeLabel =
    activeFarm.farming_type === 'livestock' ? 'Livestock' : activeFarm.farming_type === 'both' ? 'Crops & livestock' : 'Crops';
  const cropDisplay = seasonCropName || farmTypeLabel;
  const varietyDisplay = seasons[0]?.crop_variety_id || '';
  const locationStr = [activeFarm.community, activeFarm.county].filter((x) => x && String(x).trim()).join(', ');

  // Metrics: only what has really been recorded
  const areaDisplay = `${activeFarm.size || 0} ${activeFarm.size_unit === 'hectares' ? 'ha' : 'ac'}`;
  const costDisplay = `$${financialSummary.totalExpenses}`;
  const totalHarvestQty = harvests.reduce((acc, h) => acc + (Number(h.quantity) || 0), 0);
  const harvestDisplay = `${totalHarvestQty.toLocaleString()} kg`;

  // Season timeline: the farm's own activities (none yet is fine)
  const activeSeason = seasons[0] || null;

  const timelineSteps = activities.slice(0, 4).map((a) => ({
    id: a.id,
    title: a.activity_type,
    dateCost: `${a.activity_date || 'Active'} • $${a.cost || 0}`,
  }));

  const latestBatchId = harvests[0]?.id || null;

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
              {[cropDisplay, varietyDisplay, locationStr].filter(Boolean).join(' • ')}
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

          {/* Decisions from the past: last year's record, and the plan for next season */}
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>{t('decideHeading')}</Text>
            <TouchableOpacity
              style={styles.decisionBtn}
              onPress={() => router.push(`/farm-record/${activeFarm.id}` as any)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('openFarmRecord')}
            >
              <Ionicons name="time-outline" size={22} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{t('openFarmRecord')}</Text>
                <Text style={styles.stepDateCost}>{t('openFarmRecordSub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.decisionBtn}
              onPress={() => router.push(`/farm-plan/${activeFarm.id}` as any)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('openPlanNext', { year: new Date().getFullYear() + 1 })}
            >
              <Ionicons name="trending-up-outline" size={22} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{t('openPlanNext', { year: new Date().getFullYear() + 1 })}</Text>
                <Text style={styles.stepDateCost}>{t('planSub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Every harvest recorded on this farm, newest first, each with its own photos */}
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>{`Harvests (${harvests.length})`}</Text>
            {harvests.length === 0 ? (
              <Text style={styles.emptyTimeline}>No harvest recorded on this farm yet.</Text>
            ) : (
              [...harvests]
                .sort((a, b) => String(b.harvest_date).localeCompare(String(a.harvest_date)) || String(b.created_at).localeCompare(String(a.created_at)))
                .map((h) => (
                  <View key={h.id} style={styles.harvestRow}>
                    <TouchableOpacity
                      style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
                      onPress={() => router.push(`/harvest/${h.id}` as any)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Harvest ${h.batch_reference}`}
                    >
                      <Text style={styles.stepTitle}>{`${Number(h.quantity).toLocaleString()} ${h.unit || 'kg'}`}</Text>
                      <Text style={styles.stepDateCost}>{`${String(h.harvest_date).slice(0, 10)} • ${h.batch_reference}`}</Text>
                      <Text style={styles.harvestStatus}>{h.status === 'approved' ? 'Approved' : 'Awaiting approval'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.photoBtn}
                      onPress={() => router.push(`/harvest-photos/${h.id}` as any)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={t('addPhotosBtn')}
                    >
                      <Ionicons name="camera-outline" size={20} color={Colors.primary} />
                      <Text style={styles.photoBtnText}>{t('harvestPhotosBtn')}</Text>
                    </TouchableOpacity>
                  </View>
                ))
            )}
          </View>

          {/* Season Timeline Card */}
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>
              {activeSeason ? activeSeason.season_name : 'No season yet'}
            </Text>

            {timelineSteps.length === 0 ? (
              <Text style={styles.emptyTimeline}>
                Nothing recorded on this farm yet. Tap "Record activity" to add your first one.
              </Text>
            ) : null}

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

            {seasons[0] ? (
              <TouchableOpacity
                style={styles.seasonRecordLink}
                onPress={() => router.push(`/season/${seasons[0].id}` as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.seasonRecordLinkText}>Open season record</Text>
              </TouchableOpacity>
            ) : null}
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
            {financialSummary.lrd.hasData ? (
              <Text style={styles.pnlSub}>
                {`${financialSummary.lrd.isProfit ? 'Profit' : 'Loss'}: ${formatMoney(Math.abs(financialSummary.lrd.result), 'LRD')} • Revenue: ${formatMoney(financialSummary.lrd.moneyIn, 'LRD')} • Total Expenses: ${formatMoney(financialSummary.lrd.moneyOut, 'LRD')}`}
              </Text>
            ) : null}
          </View>

          <ProfitLossCard pl={financialSummary.pl} title="Where the money came from and went" farmNames={{ [activeFarm.id]: activeFarm.name }} />
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar with Two Action Buttons */}
      <View
        style={[
          styles.bottomStickyBar,
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        {latestBatchId ? (
          <TouchableOpacity
            style={styles.btnOutline}
            onPress={() => router.push(`/harvest/${latestBatchId}` as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.btnOutlineText}>View passport</Text>
          </TouchableOpacity>
        ) : null}

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
  emptyTimeline: { color: Colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  seasonRecordLink: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  seasonRecordLinkText: {
    color: Colors.primary,
    fontFamily: FontFamily.bold,
    fontSize: 14,
  },
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
  harvestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  harvestStatus: { fontSize: 12, fontWeight: '700', color: Colors.primaryDark, marginTop: 2 },
  photoBtn: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: Colors.primary, paddingHorizontal: 10 },
  photoBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  decisionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
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
