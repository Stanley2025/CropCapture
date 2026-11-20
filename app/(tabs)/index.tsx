import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { useAppStore, PERSONAS } from '../../src/store/useAppStore';
import { localDb } from '../../src/services/storage/localDatabase';
import { Farm, FarmActivity, FarmSeason, HarvestBatch } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { StatCard } from '../../src/components/StatCard';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { EmptyState } from '../../src/components/EmptyState';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const {
    currentFarmer,
    currentUserProfile,
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

  const loadData = useCallback(async () => {
    try {
      let [f, s, a, h] = await Promise.all([
        localDb.getFarms(),
        localDb.getSeasons(),
        localDb.getActivities(),
        localDb.getHarvests(),
      ]);

      if (currentRole === 'farmer' && currentFarmer?.id) {
        f = f.filter((farm) => farm.farmer_id === currentFarmer.id);
        const myFarmIds = new Set(f.map((farm) => farm.id));
        s = s.filter((season) => myFarmIds.has(season.farm_id));
        a = a.filter((act) => act.farmer_id === currentFarmer.id || myFarmIds.has(act.farm_id));
        h = h.filter((harv) => harv.farmer_id === currentFarmer.id || myFarmIds.has(harv.farm_id));
      }

      setFarms(f);
      setSeasons(s);
      setActivities(a);
      setHarvests(h);
      await refreshPendingSyncCount();
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    }
  }, [refreshPendingSyncCount, currentRole, currentFarmer?.id]);

  useEffect(() => {
    loadData();
  }, [loadData, currentRole, currentFarmer?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Metrics computation
  const totalFarms = farms.length;
  const totalCultivatedArea = seasons.reduce((acc, s) => acc + (Number(s.cultivated_area) || 0), 0);
  const activeSeasonsCount = seasons.filter((s) => s.status === 'active' || s.status === 'harvesting').length;
  const totalHarvestWeight = harvests.reduce((acc, h) => acc + (Number(h.quantity) || 0), 0);
  const pendingInspectionsCount = harvests.filter(
    (h) => h.status === 'submitted' || h.status === 'pending_inspection' || h.status === 'under_inspection'
  ).length;
  const approvedCount = harvests.filter((h) => h.status === 'approved').length;
  const rejectedCount = harvests.filter((h) => h.status === 'rejected').length;

  const activeSeasonName = seasons.find((s) => s.status === 'active')?.season_name || '2026 Main Cropping Season';

  // Role display metadata
  const personaInfo = PERSONAS[currentRole] || PERSONAS.farmer;
  const photoUri = currentUserProfile.avatar_url || currentFarmer.photo_url;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header showBack={false} />
      <OfflineBanner />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* ========================================================= */}
        {/* HERO SECTION - ROLE AWARE */}
        {/* ========================================================= */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.heroAvatar} />
            ) : null}
            <View style={{ flex: 1, paddingRight: Spacing.sm }}>
              <Text style={styles.greetingText}>
                {currentRole === 'farmer'
                  ? 'Welcome back,'
                  : currentRole === 'extension_officer'
                  ? 'Extension Officer Command,'
                  : currentRole === 'quality_inspector'
                  ? 'National Quality Bureau,'
                  : 'Cooperative Union Command,'}
              </Text>
              <Text style={styles.userName} numberOfLines={1}>
                {currentUserProfile.full_name || currentFarmer.full_name}
              </Text>
            </View>

            <View style={[styles.idChip, { backgroundColor: `${Colors.primaryLight}30` }]}>
              <Text style={styles.idChipText}>
                {currentRole === 'farmer'
                  ? currentFarmer.farmer_id_code
                  : currentRole === 'extension_officer'
                  ? 'EXT-LR-0042'
                  : currentRole === 'quality_inspector'
                  ? 'INSP-LR-0019'
                  : 'COOP-MGR-003'}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color={Colors.primaryLight} />
              <Text style={styles.metaText} numberOfLines={1}>
                {currentUserProfile.community || currentFarmer.community},{' '}
                {currentUserProfile.county || currentFarmer.county}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="shield-checkmark-outline" size={14} color={Colors.primaryLight} />
              <Text style={styles.metaText}>{personaInfo.title}</Text>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* ROLE 1: FARMER VIEW */}
        {/* ========================================================= */}
        {currentRole === 'farmer' && (
          <>
            {/* Live Metrics Grid */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>My Farm Production Overview</Text>
                <Text style={styles.sectionSubtitle}>Verified records for your registered parcels</Text>
              </View>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full }}
                onPress={() => router.push('/reports' as any)}
              >
                <Ionicons name="calendar" size={12} color={Colors.primaryDark} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primaryDark }}>
                  Past Years
                </Text>
              </TouchableOpacity>
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

            {/* Farmer Quick Actions */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Farmer Operations</Text>
              <Text style={styles.sectionSubtitle}>Record and manage field activities</Text>
            </View>

            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/farm/register' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="add-circle" size={22} color={Colors.primary} />
                </View>
                <Text style={styles.actionBtnText}>Register Farm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/season/create' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#FEF9C3' }]}>
                  <Ionicons name="calendar" size={22} color="#CA8A04" />
                </View>
                <Text style={styles.actionBtnText}>New Season</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/activity/record' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#E0E7FF' }]}>
                  <Ionicons name="create" size={22} color="#4338CA" />
                </View>
                <Text style={styles.actionBtnText}>Record Activity</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/harvest/register' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="leaf" size={22} color="#B45309" />
                </View>
                <Text style={styles.actionBtnText}>Register Harvest</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/inputs-expenses' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="cash" size={22} color="#B91C1C" />
                </View>
                <Text style={styles.actionBtnText}>Inputs & Costs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/reports' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="bar-chart" size={22} color="#0369A1" />
                </View>
                <Text style={styles.actionBtnText}>Reports & Analytics</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/sync-center' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="cloud-done" size={22} color="#475569" />
                </View>
                <Text style={styles.actionBtnText}>Sync Center</Text>
              </TouchableOpacity>
            </View>

            {/* Recent Farm Activities */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Recent Field Activities</Text>
                <Text style={styles.sectionSubtitle}>Your logged operations & observations</Text>
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
                    <Badge label={act.sync_status?.toUpperCase() || 'SAVED'} variant="success" size="sm" />
                  </View>
                  <Text style={styles.activityDesc} numberOfLines={2}>{act.description}</Text>
                  <Text style={styles.activityDate}>
                    <Ionicons name="time-outline" size={12} color={Colors.textMuted} /> {act.activity_date}
                  </Text>
                </Card>
              ))
            )}
          </>
        )}

        {/* ========================================================= */}
        {/* ROLE 2: EXTENSION OFFICER VIEW */}
        {/* ========================================================= */}
        {currentRole === 'extension_officer' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Extension Field Supervision</Text>
              <Text style={styles.sectionSubtitle}>Supervising Bong & Nimba Agricultural District</Text>
            </View>

            <View style={styles.statsGrid}>
              <StatCard
                label="Supervised Parcels"
                value={totalFarms}
                subtitle="Assigned farms"
                icon={<Ionicons name="map" size={18} color="#0284C7" />}
                color="#0284C7"
                onPress={() => router.push('/farms' as any)}
              />
              <StatCard
                label="Active Field Visits"
                value={4}
                subtitle="Completed this month"
                icon={<Ionicons name="checkmark-done" size={18} color={Colors.primary} />}
                color={Colors.primary}
                onPress={() => router.push('/extension' as any)}
              />
              <StatCard
                label="Pending Follow-Ups"
                value={2}
                subtitle="Upcoming visits"
                icon={<Ionicons name="calendar" size={18} color="#D97706" />}
                color="#D97706"
                onPress={() => router.push('/extension' as any)}
              />
              <StatCard
                label="Pest Diagnostics"
                value={3}
                subtitle="RYMV & Gall Midge"
                icon={<Ionicons name="bug-outline" size={18} color="#DC2626" />}
                color="#DC2626"
                onPress={() => router.push('/extension' as any)}
              />
            </View>

            {/* Extension Officer Actions */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Advisory & Diagnostic Actions</Text>
              <Text style={styles.sectionSubtitle}>Log on-field visits with GPS coordinates</Text>
            </View>

            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/extension/visit' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="compass" size={22} color="#0284C7" />
                </View>
                <Text style={styles.actionBtnText}>Log GPS Field Visit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/extension' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="bug" size={22} color="#DC2626" />
                </View>
                <Text style={styles.actionBtnText}>Pest Diagnostics</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/farms' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="map" size={22} color={Colors.primary} />
                </View>
                <Text style={styles.actionBtnText}>Assigned Parcels</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/qr-scanner' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="qr-code" size={22} color="#D97706" />
                </View>
                <Text style={styles.actionBtnText}>Scan Farm QR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/reports' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="document-text" size={22} color="#7C3AED" />
                </View>
                <Text style={styles.actionBtnText}>Advisory Reports</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/sync-center' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="cloud-upload" size={22} color="#475569" />
                </View>
                <Text style={styles.actionBtnText}>Offline Field Sync</Text>
              </TouchableOpacity>
            </View>

            {/* Extension Field Visits List */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>District Field Visits</Text>
                <Text style={styles.sectionSubtitle}>Recent technical advisories</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/extension' as any)}>
                <Text style={styles.seeAllText}>Open Hub</Text>
              </TouchableOpacity>
            </View>

            <Card style={styles.visitCard}>
              <View style={styles.visitHeader}>
                <View>
                  <Text style={styles.visitFarmer}>Farmer: Emmanuel Gaye</Text>
                  <Text style={styles.visitFarm}>Gbehley Swamp Farm • Nimba</Text>
                </View>
                <Badge label="COMPLETED" variant="success" size="sm" />
              </View>
              <Text style={styles.visitTopic}>Panicle Blast & Drainage Inspection</Text>
              <Text style={styles.visitRec}>
                Recommendation: Maintain shallow water depth to oxygenate swamp root zones.
              </Text>
              <View style={styles.visitFooter}>
                <Text style={styles.visitDateText}>Date: 2026-10-18</Text>
                <Text style={styles.visitGpsText}>GPS: 7.2915° N, 8.7124° W</Text>
              </View>
            </Card>

            <Card style={styles.visitCard}>
              <View style={styles.visitHeader}>
                <View>
                  <Text style={styles.visitFarmer}>Farmer: Emmanuel Gaye</Text>
                  <Text style={styles.visitFarm}>Zolowee Upland Valley</Text>
                </View>
                <Badge label="SCHEDULED" variant="warning" size="sm" />
              </View>
              <Text style={styles.visitTopic}>Pre-harvest Cassava Tuber Sampling</Text>
              <Text style={styles.visitRec}>
                Recommendation: Apply CARI root crop extension protocols for root rot prevention.
              </Text>
              <View style={styles.visitFooter}>
                <Text style={styles.visitDateText}>Follow-up: 2026-11-25</Text>
                <TouchableOpacity onPress={() => router.push('/extension/visit' as any)}>
                  <Text style={styles.actionLinkText}>Update Log →</Text>
                </TouchableOpacity>
              </View>
            </Card>
          </>
        )}

        {/* ========================================================= */}
        {/* ROLE 3: QUALITY INSPECTOR VIEW */}
        {/* ========================================================= */}
        {currentRole === 'quality_inspector' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Quality Bureau Verification Queue</Text>
              <Text style={styles.sectionSubtitle}>Liberia Standards & Metrology Inspection Queue</Text>
            </View>

            <View style={styles.statsGrid}>
              <StatCard
                label="Awaiting Inspection"
                value={pendingInspectionsCount}
                subtitle="Batches in queue"
                icon={<Ionicons name="time" size={18} color="#D97706" />}
                color="#D97706"
                onPress={() => router.push('/inspector' as any)}
              />
              <StatCard
                label="Certified Grade A"
                value={approvedCount}
                subtitle="Export grade"
                icon={<Ionicons name="ribbon" size={18} color={Colors.primary} />}
                color={Colors.primary}
                onPress={() => router.push('/inspector' as any)}
              />
              <StatCard
                label="Grade B / C"
                value={1}
                subtitle="Domestic market"
                icon={<Ionicons name="checkmark-circle" size={18} color="#0284C7" />}
                color="#0284C7"
              />
              <StatCard
                label="Rejected Batches"
                value={rejectedCount}
                subtitle="Excess moisture / mold"
                icon={<Ionicons name="close-circle" size={18} color="#DC2626" />}
                color="#DC2626"
              />
            </View>

            {/* Inspector Quick Actions */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Inspector Workstation</Text>
              <Text style={styles.sectionSubtitle}>Evaluate moisture, foreign matter, and defects</Text>
            </View>

            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/inspector' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="clipboard" size={22} color="#D97706" />
                </View>
                <Text style={styles.actionBtnText}>Inspection Queue</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/qr-scanner' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="scan" size={22} color={Colors.primary} />
                </View>
                <Text style={styles.actionBtnText}>Scan Batch QR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/harvests' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="cube" size={22} color="#0284C7" />
                </View>
                <Text style={styles.actionBtnText}>Batch Ledger</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/reports' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="shield-checkmark" size={22} color="#7C3AED" />
                </View>
                <Text style={styles.actionBtnText}>Certificates Export</Text>
              </TouchableOpacity>
            </View>

            {/* Priority Inspection Queue List */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Pending Verification Batches</Text>
                <Text style={styles.sectionSubtitle}>Tap batch to launch moisture & grade evaluation</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/inspector' as any)}>
                <Text style={styles.seeAllText}>Queue ({pendingInspectionsCount})</Text>
              </TouchableOpacity>
            </View>

            {harvests.slice(0, 3).map((batch) => {
              const isPending =
                batch.status === 'submitted' ||
                batch.status === 'pending_inspection' ||
                batch.status === 'under_inspection';
              return (
                <Card key={batch.id} style={styles.batchCard}>
                  <View style={styles.batchHeader}>
                    <View>
                      <Text style={styles.batchRef}>{batch.batch_reference}</Text>
                      <Text style={styles.batchCrop}>
                        {batch.crop?.name || 'Produce'} • {batch.crop_variety_id || 'Standard'}
                      </Text>
                    </View>
                    <Badge
                      label={batch.status.replace('_', ' ').toUpperCase()}
                      variant={isPending ? 'warning' : 'success'}
                      size="sm"
                    />
                  </View>

                  <View style={styles.batchDetailsRow}>
                    <Text style={styles.batchDetail}>
                      Qty: <Text style={{ fontWeight: '700' }}>{batch.quantity} {batch.unit}</Text>
                    </Text>
                    <Text style={styles.batchDetail}>
                      Harvested: <Text style={{ fontWeight: '700' }}>{batch.harvest_date}</Text>
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.inspectButton, { backgroundColor: isPending ? '#D97706' : Colors.primary }]}
                    onPress={() => router.push(`/inspector/inspect/${batch.id}` as any)}
                  >
                    <Ionicons name="speedometer-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.inspectButtonText}>
                      {isPending ? 'Perform Official Quality Inspection' : 'Review Official Certificate'}
                    </Text>
                  </TouchableOpacity>
                </Card>
              );
            })}
          </>
        )}

        {/* ========================================================= */}
        {/* ROLE 4: COOPERATIVE MANAGER / ADMIN VIEW */}
        {/* ========================================================= */}
        {(currentRole === 'cooperative_manager' ||
          currentRole === 'agricultural_admin' ||
          currentRole === 'super_admin') && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Cooperative Union Aggregate</Text>
              <Text style={styles.sectionSubtitle}>Nimba Farmers Multipurpose Union Ledger</Text>
            </View>

            <View style={styles.statsGrid}>
              <StatCard
                label="Registered Farmers"
                value={48}
                subtitle="Union members"
                icon={<Ionicons name="people" size={18} color="#7C3AED" />}
                color="#7C3AED"
              />
              <StatCard
                label="Cooperative Land"
                value={totalCultivatedArea.toFixed(1)}
                unit="Acres"
                subtitle="Under cultivation"
                icon={<Ionicons name="layers" size={18} color="#0284C7" />}
                color="#0284C7"
                onPress={() => router.push('/farms' as any)}
              />
              <StatCard
                label="Total Union Harvest"
                value={totalHarvestWeight.toLocaleString()}
                unit="kg"
                subtitle="Reaped this season"
                icon={<Ionicons name="basket" size={18} color={Colors.harvestGold} />}
                color={Colors.harvestGold}
                onPress={() => router.push('/harvests' as any)}
              />
              <StatCard
                label="Export Approved"
                value={approvedCount}
                subtitle="Grade A certification"
                icon={<Ionicons name="ribbon" size={18} color={Colors.primary} />}
                color={Colors.primary}
                onPress={() => router.push('/reports' as any)}
              />
            </View>

            {/* Cooperative Admin Actions */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Union Management Workstation</Text>
              <Text style={styles.sectionSubtitle}>Aggregate data export & member auditing</Text>
            </View>

            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/reports' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="document-text" size={22} color="#0284C7" />
                </View>
                <Text style={styles.actionBtnText}>Export CSV / PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/harvests' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="grid" size={22} color="#D97706" />
                </View>
                <Text style={styles.actionBtnText}>Harvest Manifest</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/farms' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="map" size={22} color={Colors.primary} />
                </View>
                <Text style={styles.actionBtnText}>Member Parcels</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/sync-center' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="sync" size={22} color="#475569" />
                </View>
                <Text style={styles.actionBtnText}>Audit & Sync Logs</Text>
              </TouchableOpacity>
            </View>
          </>
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
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl * 2,
  },
  heroCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heroAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginRight: Spacing.sm,
  },
  greetingText: {
    fontSize: 13,
    color: '#A3E635',
    fontWeight: '600',
  },
  userName: {
    fontSize: Typography.sizes.xl,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  idChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.3)',
  },
  idChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A3E635',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    paddingTop: Spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  sectionHeader: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    width: (SCREEN_WIDTH - Spacing.md * 2 - Spacing.sm * 2) / 3,
    minWidth: 95,
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
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
    marginBottom: 4,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityIcon: {
    marginRight: 2,
  },
  activityType: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  activityDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 6,
  },
  activityDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  visitCard: {
    marginBottom: Spacing.sm,
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  visitFarmer: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  visitFarm: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  visitTopic: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: '#0284C7',
    marginBottom: 4,
  },
  visitRec: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 17,
    marginBottom: 8,
  },
  visitFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 6,
  },
  visitDateText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  visitGpsText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
  actionLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  batchCard: {
    marginBottom: Spacing.sm,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  batchRef: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  batchCrop: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  batchDetailsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  batchDetail: {
    fontSize: 12,
    color: Colors.text,
  },
  inspectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    marginTop: 4,
  },
  inspectButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
