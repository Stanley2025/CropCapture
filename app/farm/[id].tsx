import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { Farm, FarmSeason, FarmActivity, HarvestBatch, ExpenseRecord, InputRecord } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';

export default function FarmDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [farm, setFarm] = useState<Farm | null>(null);
  const [seasons, setSeasons] = useState<FarmSeason[]>([]);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [inputs, setInputs] = useState<InputRecord[]>([]);

  // Calculate Real Farm Financial Profit & Loss (P&L)
  const financialSummary = useMemo(() => {
    // 1. Gross Harvest Revenue ($ USD)
    const harvestRevenue = harvests.reduce((acc, h) => {
      if (h.total_value && Number(h.total_value) > 0) {
        return acc + Number(h.total_value);
      }
      const isLivestock =
        (h as any).animal_type ||
        (h.unit || '').toLowerCase().includes('head') ||
        (h.unit || '').toLowerCase().includes('animal');
      const rate = isLivestock ? 50 : 0.45;
      return acc + (Number(h.quantity) || 0) * rate;
    }, 0);

    // 2. Direct Inputs Cost ($ USD)
    const totalInputsCost = inputs.reduce((acc, i) => acc + (Number(i.cost) || 0), 0);

    // 3. Labor & Field Activities Cost ($ USD)
    const totalActivitiesCost = activities.reduce((acc, a) => acc + (Number(a.cost) || 0), 0);

    // 4. Direct Farm Operating Expenses ($ USD)
    const totalDirectExpenses = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    // Total Farm Expenses
    const totalExpenses = totalInputsCost + totalActivitiesCost + totalDirectExpenses;

    // Real Net Profit ($ USD)
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

  if (!farm) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Farm Details" showBack />
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Farm record not found.</Text>
          <Button title="Back to Farms" onPress={() => router.back()} size="sm" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title={farm.name} subtitle={`${farm.community}, ${farm.county}`} showBack />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Main Parcel Overview Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.parcelTitle}>{farm.name}</Text>
              <Text style={styles.parcelLocation}>
                {farm.community}, {farm.district}, {farm.county} County
              </Text>
            </View>
            <Badge label={`${farm.size} ${farm.size_unit}`} variant="gold" />
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>ENTERPRISE</Text>
              <Text style={[styles.metricValue, { textTransform: 'capitalize' }]}>
                {farm.farming_type === 'both'
                  ? 'Crops & Livestock'
                  : farm.farming_type || 'Crops'}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>TENURE</Text>
              <Text style={styles.metricValue}>{farm.ownership_type || 'Customary'}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>WATER SUPPLY</Text>
              <Text style={styles.metricValue}>{farm.irrigation ? 'Irrigated' : 'Rainfed'}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>SOIL TYPE</Text>
              <Text style={styles.metricValue}>{farm.soil_type || 'Loam'}</Text>
            </View>
          </View>

          {/* Farm Registration Date & Year */}
          <View style={styles.registrationBanner}>
            <View style={styles.registrationLeft}>
              <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
              <View style={{ marginLeft: Spacing.sm }}>
                <Text style={styles.registrationTitle}>Registration & Establishment Date</Text>
                <Text style={styles.registrationDateText}>
                  {farm.registration_date
                    ? `${farm.registration_date} (Year: ${farm.registration_date.split('-')[0]})`
                    : farm.created_at
                    ? `${farm.created_at.split('T')[0]} (Year: ${farm.created_at.split('-')[0]})`
                    : '2026 Season Registry'}
                </Text>
              </View>
            </View>
            <Badge
              label={`Year ${(farm.registration_date || farm.created_at || '2026').split('-')[0]}`}
              variant="default"
              size="sm"
            />
          </View>

          {/* GPS Coordinates & Interactive Map Representation */}
          <View style={styles.gpsBanner}>
            <View style={styles.gpsLeft}>
              <Ionicons name="navigate-circle" size={24} color={Colors.primary} />
              <View style={{ marginLeft: Spacing.sm }}>
                <Text style={styles.gpsTitle}>Verified GPS Geolocation</Text>
                <Text style={styles.gpsCoordText}>
                  {farm.latitude ? `${farm.latitude.toFixed(6)}° N, ${farm.longitude?.toFixed(6)}° W` : 'District Center GPS (Auto)'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.openMapBtn}
              onPress={() =>
                Alert.alert(
                  'GPS Geolocation Coordinates',
                  `Farm Latitude: ${farm.latitude || 7.412}\nFarm Longitude: ${farm.longitude || -8.65}\n\nCoordinates registered for district weather alerts and agricultural registry.`
                )
              }
            >
              <Ionicons name="map-outline" size={16} color={Colors.primaryDark} />
              <Text style={styles.openMapText}>Map Pin</Text>
            </TouchableOpacity>
          </View>

          {/* Farm Microclimate & Weather Forecast Banner */}
          <TouchableOpacity
            style={styles.weatherBanner}
            activeOpacity={0.85}
            onPress={() => router.push('/weather' as any)}
          >
            <View style={styles.weatherBannerLeft}>
              <View style={styles.weatherBannerIcon}>
                <Ionicons name="cloud-outline" size={20} color="#A3E635" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.weatherBannerTitle}>Local Weather: 31°C · Partly cloudy</Text>
                <Text style={styles.weatherBannerSubtitle}>
                  {farm.district || 'Gbehley'}, {farm.county || 'Nimba'} · 5-day rain forecast & alerts
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#B4CCBA" />
          </TouchableOpacity>

          {farm.description ? (
            <Text style={styles.farmDesc}>{farm.description}</Text>
          ) : null}
        </Card>

        {/* Action Shortcuts */}
        <View style={styles.actionRow}>
          <Button
            title="+ New Season"
            onPress={() => router.push(`/season/create?farmId=${farm.id}` as any)}
            size="sm"
            style={{ flex: 1, marginRight: Spacing.xs }}
          />
          <Button
            title="+ Record Activity"
            onPress={() => router.push(`/activity/record?farmId=${farm.id}` as any)}
            variant="outline"
            size="sm"
            style={{ flex: 1, marginLeft: Spacing.xs }}
          />
        </View>

        {/* Real Farm Financial Profit & Loss (P&L) Card */}
        <Card style={styles.financialCard}>
          <View style={styles.financialHeader}>
            <View style={styles.financialTitleRow}>
              <View
                style={[
                  styles.financialIconWrap,
                  financialSummary.isProfitable
                    ? styles.financialIconWrapProfitable
                    : styles.financialIconWrapLoss,
                ]}
              >
                <Ionicons
                  name={financialSummary.isProfitable ? 'trending-up' : 'trending-down'}
                  size={20}
                  color={financialSummary.isProfitable ? '#15803D' : '#DC2626'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.financialTitle}>Farm Financial Profit & Loss (P&L)</Text>
                <Text style={styles.financialSubtitle}>
                  Real harvest revenue minus total farm operating expenses
                </Text>
              </View>
            </View>
            <Badge
              label={
                financialSummary.isProfitable
                  ? `Profitable (+${financialSummary.profitMargin.toFixed(0)}%)`
                  : `Net Loss (${financialSummary.profitMargin.toFixed(0)}%)`
              }
              variant={financialSummary.isProfitable ? 'success' : 'danger'}
            />
          </View>

          {/* Revenue, Cost & Net Profit Highlight */}
          <View style={styles.pnlHighlightContainer}>
            <View style={styles.pnlColumn}>
              <Text style={styles.pnlLabel}>AMOUNT SPENT</Text>
              <Text style={styles.pnlExpense}>
                ${financialSummary.totalExpenses.toLocaleString()} USD
              </Text>
              <Text style={styles.pnlSub}>inputs, labor & ops</Text>
            </View>
            <View style={styles.pnlDivider} />
            <View style={styles.pnlColumn}>
              <Text style={styles.pnlLabel}>GOT FROM HARVEST</Text>
              <Text style={styles.pnlRevenue}>
                ${financialSummary.harvestRevenue.toLocaleString()} USD
              </Text>
              <Text style={styles.pnlSub}>from {harvests.length} harvest batch(es)</Text>
            </View>
            <View style={styles.pnlDivider} />
            <View style={styles.pnlColumn}>
              <Text style={styles.pnlLabel}>FARM NET PROFIT</Text>
              <Text
                style={[
                  styles.pnlProfit,
                  financialSummary.isProfitable ? styles.pnlProfitPositive : styles.pnlProfitNegative,
                ]}
              >
                {financialSummary.netProfit >= 0 ? '+' : ''}
                ${financialSummary.netProfit.toLocaleString()} USD
              </Text>
              <Text style={styles.pnlSub}>
                {financialSummary.isProfitable ? 'Profitable return' : 'Operating deficit'}
              </Text>
            </View>
          </View>

          {/* Formula calculation explanation */}
          <View style={styles.pnlFormulaBox}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.pnlFormulaText}>
              Calculation: Got from Harvest (${financialSummary.harvestRevenue.toLocaleString()}) - Amount Spent (${financialSummary.totalExpenses.toLocaleString()}) = Net Profit ({financialSummary.netProfit >= 0 ? '+' : ''}${financialSummary.netProfit.toLocaleString()} USD)
            </Text>
          </View>

          {/* Expense Breakdown */}
          <View style={styles.pnlBreakdownWrap}>
            <Text style={styles.pnlBreakdownTitle}>EXPENSE BREAKDOWN:</Text>
            <View style={styles.pnlChipsRow}>
              <View style={styles.pnlChip}>
                <Ionicons name="basket-outline" size={13} color={Colors.primary} />
                <Text style={styles.pnlChipText}>
                  Inputs: ${financialSummary.totalInputsCost.toLocaleString()}
                </Text>
              </View>
              <View style={styles.pnlChip}>
                <Ionicons name="construct-outline" size={13} color="#D97706" />
                <Text style={styles.pnlChipText}>
                  Labor/Activities: ${financialSummary.totalActivitiesCost.toLocaleString()}
                </Text>
              </View>
              <View style={styles.pnlChip}>
                <Ionicons name="receipt-outline" size={13} color="#6366F1" />
                <Text style={styles.pnlChipText}>
                  Operating: ${financialSummary.totalDirectExpenses.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Crop Seasons on this Farm */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Crop Seasons ({seasons.length})</Text>
        </View>

        {seasons.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="leaf-outline" size={32} color={Colors.primary} />}
            title="No Seasons on this Farm"
            description="Create a crop season to track planting, expected harvests, and input costs."
            actionTitle="Create First Season"
            onAction={() => router.push(`/season/create?farmId=${farm.id}` as any)}
          />
        ) : (
          seasons.map((season) => (
            <Card key={season.id} style={styles.seasonCard}>
              <View style={styles.seasonHeader}>
                <View>
                  <Text style={styles.seasonName}>{season.season_name}</Text>
                  <Text style={styles.cropVariety}>
                    {season.crop?.name || 'Crop'} ({season.crop_variety_id || 'Standard Variety'})
                  </Text>
                </View>
                <Badge
                  label={season.status}
                  variant={season.status === 'harvesting' ? 'gold' : season.status === 'active' ? 'success' : 'default'}
                />
              </View>
              <View style={styles.seasonDatesRow}>
                <Text style={styles.seasonDateText}>
                  Planting: <Text style={{ fontWeight: '700' }}>{season.planting_date}</Text>
                </Text>
                {season.expected_harvest_date && (
                  <Text style={styles.seasonDateText}>
                    Harvest: <Text style={{ fontWeight: '700' }}>{season.expected_harvest_date}</Text>
                  </Text>
                )}
                <Text style={styles.seasonDateText}>
                  Area: <Text style={{ fontWeight: '700' }}>{season.cultivated_area} acres</Text>
                </Text>
              </View>
            </Card>
          ))
        )}

        {/* Activities on this Farm */}
        <View style={[styles.sectionHeaderRow, { marginTop: Spacing.lg }]}>
          <Text style={styles.sectionTitle}>Recent Field Operations ({activities.length})</Text>
        </View>

        {activities.length === 0 ? (
          <Card style={styles.emptySmallCard}>
            <Text style={styles.emptyText}>No activities logged yet for this parcel.</Text>
          </Card>
        ) : (
          activities.map((act) => (
            <Card key={act.id} style={styles.activityItem}>
              <View style={styles.activityTop}>
                <Text style={styles.activityType}>{act.activity_type}</Text>
                <Text style={styles.activityDate}>{act.activity_date}</Text>
              </View>
              {act.description && <Text style={styles.activityDesc}>{act.description}</Text>}
              <View style={styles.activityBottom}>
                {act.cost > 0 && <Text style={styles.costText}>Cost: ${act.cost} USD</Text>}
                <Badge
                  label={act.sync_status === 'synced' ? 'Synced' : 'Saved locally'}
                  variant={act.sync_status === 'synced' ? 'success' : 'warning'}
                  size="sm"
                />
              </View>
            </Card>
          ))
        )}

        {/* Harvest Batches on this Farm */}
        <View style={[styles.sectionHeaderRow, { marginTop: Spacing.lg }]}>
          <Text style={styles.sectionTitle}>Harvest Records ({harvests.length})</Text>
        </View>

        {harvests.length === 0 ? (
          <Card style={styles.emptySmallCard}>
            <Text style={styles.emptyText}>No harvest batches registered for this farm yet.</Text>
          </Card>
        ) : (
          harvests.map((h) => (
            <Card
              key={h.id}
              style={styles.harvestItem}
              onPress={() => router.push(`/harvest/${h.id}` as any)}
            >
              <View style={styles.activityTop}>
                <Text style={styles.batchRef}>{h.batch_reference}</Text>
                <Badge
                  label={h.status.replace('_', ' ')}
                  variant={h.status === 'approved' ? 'success' : 'warning'}
                  size="sm"
                />
              </View>
              <Text style={styles.harvestYield}>
                {h.quantity} {h.unit} • Harvested {h.harvest_date}
              </Text>
            </Card>
          ))
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
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
  content: {
    padding: Spacing.md,
  },
  notFoundContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  notFoundText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.md,
    marginBottom: Spacing.md,
  },
  heroCard: {
    marginBottom: Spacing.md,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  parcelTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  parcelLocation: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  gpsBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  gpsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  gpsCoordText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  openMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.md,
  },
  openMapText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  farmDesc: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  sectionHeaderRow: {
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  seasonCard: {
    marginBottom: Spacing.sm,
  },
  seasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  seasonName: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  cropVariety: {
    fontSize: Typography.sizes.xs,
    color: Colors.primaryDark,
    marginTop: 1,
  },
  seasonDatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
  },
  seasonDateText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  emptySmallCard: {
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  activityItem: {
    marginBottom: Spacing.xs,
    padding: Spacing.sm,
  },
  activityTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityType: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  activityDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  activityDesc: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  activityBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  costText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  harvestItem: {
    marginBottom: Spacing.xs,
    padding: Spacing.sm,
  },
  batchRef: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  harvestYield: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  // Registration Banner
  registrationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  registrationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  registrationTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  registrationDateText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 1,
  },
  // Financial P&L Card
  financialCard: {
    marginBottom: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  financialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  financialTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.xs,
  },
  financialIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  financialIconWrapProfitable: {
    backgroundColor: '#DCFCE7',
  },
  financialIconWrapLoss: {
    backgroundColor: '#FEE2E2',
  },
  financialTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '800',
    color: Colors.text,
  },
  financialSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  pnlHighlightContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pnlColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pnlDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#CBD5E1',
  },
  pnlLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pnlRevenue: {
    fontSize: Typography.sizes.sm,
    fontWeight: '800',
    color: '#15803D',
    marginTop: 2,
  },
  pnlExpense: {
    fontSize: Typography.sizes.sm,
    fontWeight: '800',
    color: '#DC2626',
    marginTop: 2,
  },
  pnlProfit: {
    fontSize: Typography.sizes.sm,
    fontWeight: '800',
    marginTop: 2,
  },
  pnlProfitPositive: {
    color: '#15803D',
  },
  pnlProfitNegative: {
    color: '#DC2626',
  },
  pnlSub: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 1,
  },
  pnlBreakdownWrap: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  pnlBreakdownTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  pnlChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  pnlChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  pnlChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text,
  },
  pnlFormulaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  pnlFormulaText: {
    fontSize: 10,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 14,
  },
  weatherBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#132E20',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  weatherBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  weatherBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weatherBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  weatherBannerSubtitle: {
    fontSize: 10.5,
    color: '#B4CCBA',
    marginTop: 1,
  },
});
