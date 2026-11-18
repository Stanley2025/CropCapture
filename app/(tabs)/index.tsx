import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/useAppStore';
import { localDb } from '../../src/services/storage/localDatabase';
import { Farm, FarmActivity, FarmSeason, HarvestBatch } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { StatCard } from '../../src/components/StatCard';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { EmptyState } from '../../src/components/EmptyState';
import { RoleSwitcherModal } from '../../src/components/RoleSwitcherModal';

export default function HomeScreen() {
  const router = useRouter();
  const {
    currentFarmer,
    currentRole,
    isOfflineMode,
    syncStatus,
    pendingSyncCount,
    refreshPendingSyncCount,
  } = useAppStore();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [seasons, setSeasons] = useState<FarmSeason[]>([]);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [f, s, a, h] = await Promise.all([
        localDb.getFarms(),
        localDb.getSeasons(),
        localDb.getActivities(),
        localDb.getHarvests(),
      ]);
      setFarms(f);
      setSeasons(s);
      setActivities(a);
      setHarvests(h);
      await refreshPendingSyncCount();
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    }
  }, [refreshPendingSyncCount]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Compute live statistics from actual local storage records
  const totalFarms = farms.length;
  const totalCultivatedArea = seasons.reduce((acc, s) => acc + (Number(s.cultivated_area) || 0), 0);
  const activeSeasonsCount = seasons.filter((s) => s.status === 'active' || s.status === 'harvesting').length;
  const totalHarvestWeight = harvests.reduce((acc, h) => acc + (Number(h.quantity) || 0), 0);
  const pendingInspectionsCount = harvests.filter(
    (h) => h.status === 'submitted' || h.status === 'pending_inspection' || h.status === 'under_inspection'
  ).length;

  const activeSeasonName = seasons.find((s) => s.status === 'active' || s.status === 'harvesting')?.season_name || '2026 Main Season';

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        rightAction={
          <TouchableOpacity
            style={styles.roleBtn}
            onPress={() => setRoleModalVisible(true)}
            accessibilityLabel="Switch active user role"
          >
            <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
            <Text style={styles.roleBtnText}>Role</Text>
          </TouchableOpacity>
        }
      />
      <OfflineBanner />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* Personalized Welcome Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.greetingText}>Welcome back,</Text>
              <Text style={styles.farmerName}>{currentFarmer.full_name}</Text>
            </View>
            <View style={styles.idChip}>
              <Text style={styles.idChipText}>{currentFarmer.farmer_id_code}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color={Colors.primaryLight} />
              <Text style={styles.metaText}>
                {currentFarmer.community}, {currentFarmer.county}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={Colors.primaryLight} />
              <Text style={styles.metaText}>{activeSeasonName}</Text>
            </View>
          </View>

          {/* Quick Role Navigation Pill if in non-farmer mode */}
          {currentRole !== 'farmer' && (
            <TouchableOpacity
              style={styles.nonFarmerBanner}
              onPress={() => {
                if (currentRole === 'quality_inspector') router.push('/inspector' as any);
                else if (currentRole === 'extension_officer') router.push('/extension' as any);
                else setRoleModalVisible(true);
              }}
            >
              <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
              <Text style={styles.nonFarmerText}>
                Active Persona: {currentRole.replace('_', ' ').toUpperCase()} — Tap to open role workspace
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Live Metrics Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Farm Production Overview</Text>
          <Text style={styles.sectionSubtitle}>Verified records from your devices</Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            label="Registered Farms"
            value={totalFarms}
            subtitle={totalFarms > 0 ? 'Active parcels' : 'No parcels'}
            icon={<Ionicons name="map" size={18} color={Colors.primary} />}
            onPress={() => router.push('/farms' as any)}
          />
          <StatCard
            label="Cultivated Area"
            value={totalCultivatedArea.toFixed(1)}
            unit="Acres"
            subtitle={`${activeSeasonsCount} active seasons`}
            icon={<Ionicons name="layers" size={18} color="#0284C7" />}
            color="#0284C7"
          />
          <StatCard
            label="Total Harvest"
            value={totalHarvestWeight.toLocaleString()}
            unit="kg"
            subtitle={`${harvests.length} total batches`}
            icon={<Ionicons name="basket" size={18} color={Colors.harvestGold} />}
            color={Colors.harvestGold}
            onPress={() => router.push('/harvests' as any)}
          />
          <StatCard
            label="Pending Inspection"
            value={pendingInspectionsCount}
            subtitle={pendingInspectionsCount > 0 ? 'Awaiting officer' : 'All inspected'}
            icon={<Ionicons name="shield-outline" size={18} color={pendingInspectionsCount > 0 ? Colors.warning : Colors.accent} />}
            color={pendingInspectionsCount > 0 ? Colors.warning : Colors.accent}
            onPress={() => router.push('/harvests' as any)}
          />
        </View>

        {/* Quick Action Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Text style={styles.sectionSubtitle}>Log farm operations directly</Text>
        </View>

        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/farm/register' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="add-circle" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.actionBtnText}>Register Farm</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/activity/record' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#E0E7FF' }]}>
              <Ionicons name="create" size={24} color="#4338CA" />
            </View>
            <Text style={styles.actionBtnText}>Record Activity</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/harvest/register' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="leaf" size={24} color="#B45309" />
            </View>
            <Text style={styles.actionBtnText}>Register Harvest</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/inputs-expenses' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="cash" size={24} color="#B91C1C" />
            </View>
            <Text style={styles.actionBtnText}>Inputs & Costs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/reports' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="bar-chart" size={24} color="#0369A1" />
            </View>
            <Text style={styles.actionBtnText}>Production Reports</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/sync-center' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#F1F5F9' }]}>
              <Ionicons name="cloud-done" size={24} color="#475569" />
            </View>
            <Text style={styles.actionBtnText}>Sync Center</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Farm Activities */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Recent Farm Activities</Text>
            <Text style={styles.sectionSubtitle}>Field practices and operations</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/activities' as any)}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>

        {activities.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="calendar-outline" size={32} color={Colors.primary} />}
            title="No Farm Activities Recorded"
            description="Start logging land preparation, planting, fertilizer application, and weeding."
            actionTitle="Record First Activity"
            onAction={() => router.push('/activity/record' as any)}
          />
        ) : (
          activities.slice(0, 3).map((act) => (
            <Card key={act.id} style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <View style={styles.activityTitleRow}>
                  <View style={styles.activityIcon}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                  </View>
                  <Text style={styles.activityType}>{act.activity_type}</Text>
                </View>
                <Badge
                  label={act.sync_status === 'synced' ? 'Synced' : 'Saved locally'}
                  variant={act.sync_status === 'synced' ? 'success' : 'warning'}
                  size="sm"
                />
              </View>
              {act.description && <Text style={styles.activityDesc}>{act.description}</Text>}
              <View style={styles.activityFooter}>
                <Text style={styles.activityDate}>
                  <Ionicons name="time-outline" size={12} color={Colors.textMuted} /> {act.activity_date}
                </Text>
                {act.cost > 0 && <Text style={styles.activityCost}>${act.cost} USD</Text>}
              </View>
            </Card>
          ))
        )}

        {/* Recent Harvests & Traceability */}
        <View style={[styles.sectionHeaderRow, { marginTop: Spacing.lg }]}>
          <View>
            <Text style={styles.sectionTitle}>Recent Harvest Batches</Text>
            <Text style={styles.sectionSubtitle}>Unique batch identifiers & quality status</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/harvests' as any)}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>

        {harvests.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="basket-outline" size={32} color={Colors.primary} />}
            title="No Harvests Registered"
            description="Register your crop yield to receive a unique batch reference number and quality inspection."
            actionTitle="Register Harvest"
            onAction={() => router.push('/harvest/register' as any)}
          />
        ) : (
          harvests.slice(0, 2).map((h) => (
            <Card
              key={h.id}
              style={styles.harvestCard}
              onPress={() => router.push(`/harvest/${h.id}` as any)}
            >
              <View style={styles.harvestHeader}>
                <View>
                  <Text style={styles.batchRef}>{h.batch_reference}</Text>
                  <Text style={styles.cropName}>
                    {h.crop?.name || 'Crop'} — {h.crop_variety_id || 'Standard Variety'}
                  </Text>
                </View>
                <Badge
                  label={h.status.replace('_', ' ')}
                  variant={h.status === 'approved' ? 'success' : h.status === 'rejected' ? 'danger' : 'warning'}
                />
              </View>
              <View style={styles.harvestDetailsRow}>
                <View style={styles.harvestStat}>
                  <Text style={styles.statLabel}>Harvest Yield</Text>
                  <Text style={styles.statVal}>
                    {h.quantity} {h.unit}
                  </Text>
                </View>
                <View style={styles.harvestStat}>
                  <Text style={styles.statLabel}>Harvest Date</Text>
                  <Text style={styles.statVal}>{h.harvest_date}</Text>
                </View>
                <TouchableOpacity
                  style={styles.qrBadge}
                  onPress={() => router.push(`/traceability/${h.qr_token}` as any)}
                >
                  <Ionicons name="qr-code" size={16} color={Colors.primaryDark} />
                  <Text style={styles.qrBadgeText}>QR Passport</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      <RoleSwitcherModal visible={roleModalVisible} onClose={() => setRoleModalVisible(false)} />
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
  contentContainer: {
    padding: Spacing.md,
  },
  heroCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingText: {
    fontSize: Typography.sizes.xs,
    color: Colors.primaryLight,
    fontWeight: '500',
  },
  farmerName: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: '#FFFFFF',
    marginTop: 2,
  },
  idChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  idChipText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: Spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: Colors.primaryLight,
    fontSize: Typography.sizes.xs,
  },
  nonFarmerBanner: {
    marginTop: Spacing.md,
    backgroundColor: '#047857',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  nonFarmerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  roleBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeader: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  seeAllText: {
    fontSize: Typography.sizes.xs,
    color: Colors.primary,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.xs,
    marginBottom: Spacing.md,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    width: '31%',
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  activityCard: {
    marginBottom: Spacing.sm,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  activityIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityType: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  activityDesc: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
    lineHeight: 18,
  },
  activityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
  },
  activityDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  activityCost: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  harvestCard: {
    marginBottom: Spacing.sm,
  },
  harvestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  batchRef: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  cropName: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  harvestDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  harvestStat: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 1,
  },
  qrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.md,
  },
  qrBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
});
