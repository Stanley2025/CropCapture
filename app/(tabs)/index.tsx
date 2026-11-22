import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MapPin,
  Calendar,
  Leaf,
  ScanLine,
  Bell,
  Sun,
  CloudRain,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  Speedometer,
  Layers,
  Users,
  Compass,
  FileText,
  Clock,
  CircleDollarSign,
} from 'lucide-react-native';
import {
  Colors,
  FontFamily,
  Radius,
  Spacing,
  Typography,
  Shadows,
} from '../../src/constants/theme';
import { useAppStore, PERSONAS } from '../../src/store/useAppStore';
import { ProfitLossCard } from '../../src/components/ProfitLossCard';
import { profitAndLoss } from '../../src/shared/farmFinance';
import { localDb } from '../../src/services/storage/localDatabase';
import { getScope } from '../../src/services/access/visibility';
import { weatherService } from '../../src/services/weather/weatherService';
import type { WeatherForecast } from '../../src/types/weather';
import { Farm, FarmActivity, FarmSeason, HarvestBatch } from '../../src/types/database';
import {
  SyncChip,
  StatsCard,
  QuickAction,
  SectionHeader,
  Card,
  Chip,
  FieldIllustration,
  EmptyState,
} from '../../src/components';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [inputRows, setInputRows] = useState<any[]>([]);
  const loadData = useCallback(async () => {
    try {
      let [f, s, a, h] = await Promise.all([
        localDb.getFarms(),
        localDb.getSeasons(),
        localDb.getActivities(),
        localDb.getHarvests(),
      ]);

      // Only what this person may see (a farmer: their own; an extension officer: their assigned farmers)
      const scope = await getScope(currentRole, currentUserProfile?.id, currentFarmer?.id);
      f = f.filter(scope.farm);
      s = s.filter(scope.row);
      a = a.filter(scope.row);
      h = h.filter(scope.row);

      const ids = f.map((x) => x.id);
      const [ex, inp] = await Promise.all([localDb.getExpenses(ids), localDb.getInputs(ids)]);
      setExpenses(ex);
      setInputRows(inp);
      setFarms(f);
      // Real weather for where this farmer farms; nothing is shown when there is none
      weatherService
        .getForecastFor(f[0] || null, currentFarmer)
        .then(setForecast)
        .catch(() => setForecast(null));
      weatherService.getUnreadAlertCount(currentFarmer?.id).then(setAlertCount).catch(() => setAlertCount(0));
      setSeasons(s);
      setActivities(a);
      setHarvests(h);
      await refreshPendingSyncCount();
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    }
  }, [refreshPendingSyncCount, currentRole, currentFarmer?.id, currentUserProfile?.id]);

  // This screen stays open while another is shown on top of it (for example after registering a
  // second harvest), so read the saved records again every time it comes back into view.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    loadData();
  }, [loadData, currentRole, currentFarmer?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await useAppStore.getState().pullRemoteChanges();
    await loadData();
    setRefreshing(false);
  };

  // Metrics computation
  const totalFarms = farms.length;

  // Calculate total farm acreage across all registered parcels
  const totalFarmAcres = farms.reduce((acc, f: any) => {
    const rawSize = Number(f.size);
    if (!isNaN(rawSize) && rawSize > 0) {
      const inAcres = f.size_unit === 'hectares' ? rawSize * 2.47105 : rawSize;
      return acc + inAcres;
    }
    const rawTotal = Number(f.total_area);
    if (!isNaN(rawTotal) && rawTotal > 0) {
      return acc + rawTotal;
    }
    const rawHectares = Number(f.size_hectares);
    if (!isNaN(rawHectares) && rawHectares > 0) {
      return acc + (rawHectares * 2.47105);
    }
    return acc;
  }, 0);

  // Total cultivated area from active / recorded seasons
  const seasonCultivatedArea = seasons.reduce((acc, s) => acc + (Number(s.cultivated_area) || 0), 0);

  // Use the total registered farm acres; if no farm size was recorded, fallback to season cultivated area
  const totalCultivatedArea = totalFarmAcres > 0 ? totalFarmAcres : seasonCultivatedArea;
  const activeSeasonsCount = seasons.filter((s) => s.status === 'active' || s.status === 'harvesting').length;
  const totalHarvestWeight = harvests.reduce((acc, h) => acc + (Number(h.quantity) || 0), 0);
  const pendingInspectionsCount = harvests.filter(
    (h) => h.status === 'submitted' || h.status === 'pending_inspection' || h.status === 'under_inspection'
  ).length;
  const approvedCount = harvests.filter((h) => h.status === 'approved').length;
  const rejectedCount = harvests.filter((h) => h.status === 'rejected').length;

  // Metadata
  const personaInfo = PERSONAS[currentRole] || PERSONAS.farmer;
  const photoUri = currentUserProfile?.avatar_url || currentFarmer?.photo_url;
  const fullName = currentUserProfile?.full_name || currentFarmer?.full_name || 'Emmanuel Gaye';
  const firstName = fullName.split(' ')[0] || 'Emmanuel';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'EG';
  const locationText = [currentUserProfile?.district || currentFarmer?.district, currentUserProfile?.county || currentFarmer?.county].filter(Boolean).join(', ');

  // Sync state determination
  const syncState: 'synced' | 'offline' | 'pending' = isOfflineMode
    ? 'offline'
    : pendingSyncCount > 0
    ? 'pending'
    : 'synced';

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 110 }]}
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
        {/* ========================================================= */}
        {/* V2 CURVED GREEN HEADER */}
        {/* ========================================================= */}
        <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 16) + 12 }]}>
          {/* Top Row: Avatar + Greeting + SyncChip + Bell */}
          <View style={styles.headerTopRow}>
            <View style={styles.avatarWrapper}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
            </View>

            <View style={styles.greetingCol}>
              <Text style={styles.greetingSub}>Hello,</Text>
              <Text style={styles.greetingName} numberOfLines={1}>
                {firstName}
              </Text>
              <Text style={styles.greetingLocation} numberOfLines={1}>
                {locationText}
              </Text>
            </View>

            <View style={styles.headerRightActions}>
              <SyncChip status={syncState} count={pendingSyncCount} />
              <TouchableOpacity
                style={styles.bellBubble}
                onPress={() => router.push('/weather/alerts' as any)}
                accessibilityRole="button"
                accessibilityLabel="Weather alerts"
                activeOpacity={0.8}
              >
                <Bell size={20} color="#FFFFFF" strokeWidth={2.2} />
                {alertCount > 0 ? <View style={styles.bellUnreadDot} /> : null}
              </TouchableOpacity>
            </View>
          </View>

          {/* Weather Summary Pill */}
          <TouchableOpacity
            style={styles.weatherSummaryPill}
            onPress={() => router.push('/weather' as any)}
            activeOpacity={0.85}
          >
            <Sun size={16} color={Colors.lime} strokeWidth={2.4} />
            <Text style={styles.weatherSummaryText}>
              {forecast
                ? `${Math.round(forecast.current.temp_c)}° • ${forecast.current.condition} • ${Math.round(forecast.current.rain_chance_pct)}% rain${forecast.is_cached ? ` • ${forecast.updated_time_display} (saved)` : ''}`
                : farms.length === 0
                ? 'Add a farm to see the weather'
                : 'Weather not available yet'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================= */}
        {/* ROLE 1: FARMER VIEW */}
        {/* ========================================================= */}
        {currentRole === 'farmer' && (
          <View style={styles.bodyContent}>
            {/* Overlapping Stats Card */}
            <View style={styles.overlappingStatsWrapper}>
              <StatsCard
                stats={[
                  {
                    value: totalFarms,
                    label: 'Farms',
                    onPress: () => router.push('/farms' as any),
                  },
                  {
                    value: totalCultivatedArea.toFixed(1),
                    label: 'Acres',
                  },
                  {
                    value: totalHarvestWeight.toLocaleString(),
                    label: 'kg harvested',
                    onPress: () => router.push('/harvests' as any),
                  },
                ]}
              />
            </View>

            {/* 4 Quick Actions in horizontal row */}
            <View style={styles.quickActionsRow}>
              <QuickAction
                icon={MapPin}
                label="Add farm"
                variant="primary"
                onPress={() => router.push('/farm/register' as any)}
              />
              <QuickAction
                icon={Calendar}
                label="Activity"
                variant="indigo"
                onPress={() => router.push('/activity/record' as any)}
              />
              <QuickAction
                icon={Leaf}
                label="Harvest"
                variant="amber"
                onPress={() => router.push('/harvest/register' as any)}
              />
              <QuickAction
                icon={CircleDollarSign}
                label="Inputs & Costs"
                variant="sky"
                onPress={() => router.push('/inputs-expenses' as any)}
              />
            </View>

            <ProfitLossCard
              pl={profitAndLoss({ harvests, expenses, inputs: inputRows, activities, year: new Date().getFullYear(), farmIds: farms.map((x) => x.id) })}
              title={`Profit and loss ${new Date().getFullYear()}`}
            />

            {/* Season records: field, planting, labour, problems, harvest outcomes, profit and rain */}
            <View style={styles.sectionWrapper}>
              <SectionHeader title="Season records" />
              {seasons.filter((x) => x.cycle_type !== 'livestock').length === 0 ? (
                <View style={styles.seasonEmpty}>
                  <Text style={styles.seasonEmptyText}>
                    Start a season to keep its record: field, planting, labour, problems, harvest, sales and rain.
                  </Text>
                  <TouchableOpacity
                    style={styles.seasonOpenBtn}
                    activeOpacity={0.85}
                    onPress={() => router.push('/season/create' as any)}
                  >
                    <Text style={styles.seasonOpenText}>Start a season</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                seasons
                  .filter((x) => x.cycle_type !== 'livestock')
                  .slice(0, 4)
                  .map((season) => {
                    const farmName = farms.find((f) => f.id === season.farm_id)?.name;
                    return (
                      <TouchableOpacity
                        key={season.id}
                        style={styles.seasonRow}
                        activeOpacity={0.85}
                        onPress={() => router.push(`/season/${season.id}` as any)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.seasonRowTitle} numberOfLines={1}>
                            {season.season_name}
                          </Text>
                          <Text style={styles.seasonRowSub} numberOfLines={1}>
                            {[farmName, season.planting_date ? `planted ${season.planting_date}` : null].filter(Boolean).join(' • ')}
                          </Text>
                        </View>
                        <Text style={styles.seasonOpenText}>Open record</Text>
                      </TouchableOpacity>
                    );
                  })
              )}
            </View>

            {/* My Farms Carousel */}
            <View style={styles.sectionWrapper}>
              <SectionHeader
                title="My farms"
                actionText="See all"
                onAction={() => router.push('/farms' as any)}
              />
              {farms.length === 0 ? (
                <View style={styles.seasonEmpty}>
                  <Text style={styles.seasonEmptyText}>You have not registered a farm yet. Add your first farm to start recording.</Text>
                  <TouchableOpacity style={styles.seasonOpenBtn} activeOpacity={0.85} onPress={() => router.push('/farm/register' as any)}>
                    <Text style={styles.seasonOpenText}>Add your farm</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.farmsScrollContent}
                >
                  {farms.map((f, idx) => {
                    const cropType = f.crop_type?.toLowerCase().includes('cass')
                      ? 'cassava'
                      : f.crop_type?.toLowerCase().includes('cocoa')
                      ? 'cocoa'
                      : 'rice';
                    const sizeRaw =
                      f.size != null && !isNaN(Number(f.size)) && Number(f.size) > 0
                        ? f.size_unit === 'hectares'
                          ? (Number(f.size) * 2.47105).toFixed(1)
                          : Number(f.size).toString()
                        : f.total_area || f.size_hectares || '3.5';
                    const areaVal = sizeRaw;
                    const cropLabel = f.crop_type
                      ? f.crop_type.charAt(0).toUpperCase() + f.crop_type.slice(1)
                      : 'Rice';
                    return (
                      <TouchableOpacity
                        key={f.id}
                        style={styles.farmCard}
                        activeOpacity={0.9}
                        onPress={() => router.push(`/farm/${f.id}` as any)}
                      >
                        <View style={styles.farmIllustrationBox}>
                          <FieldIllustration height={96} cropType={cropType} />
                        </View>
                        <View style={styles.farmCardContent}>
                          <Text style={styles.farmCardTitle} numberOfLines={1}>
                            {f.farm_name || `Farm parcel ${idx + 1}`}
                          </Text>
                          <Text style={styles.farmCardSub}>
                            {cropLabel} • {areaVal} acres
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Amber Weather Advisory Callout */}
            <TouchableOpacity
              style={styles.advisoryCard}
              activeOpacity={0.85}
              onPress={() => router.push('/weather/alerts' as any)}
            >
              <View style={styles.advisoryIconBubble}>
                <CloudRain size={22} color="#FFFFFF" strokeWidth={2.4} />
              </View>
              <View style={styles.advisoryTextCol}>
                <Text style={styles.advisoryTitle}>Good day to dry your rice</Text>
                <Text style={styles.advisoryBody}>
                  Rain is expected tomorrow afternoon.
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ========================================================= */}
        {/* ROLE 2: EXTENSION OFFICER VIEW */}
        {/* ========================================================= */}
        {currentRole === 'extension_officer' && (
          <View style={styles.bodyContent}>
            <View style={styles.overlappingStatsWrapper}>
              <StatsCard
                stats={[
                  { value: totalFarms, label: 'Assigned farms' },
                  { value: seasons.length, label: 'Seasons' },
                  { value: harvests.length, label: 'Harvests' },
                ]}
              />
            </View>

            <View style={styles.quickActionsRow}>
              <QuickAction
                icon={Compass}
                label="GPS visit"
                variant="sky"
                onPress={() => router.push('/extension/visit' as any)}
              />
              <QuickAction
                icon={ShieldCheck}
                label="Diagnostics"
                variant="amber"
                onPress={() => router.push('/extension' as any)}
              />
              <QuickAction
                icon={MapPin}
                label="Parcels"
                variant="primary"
                onPress={() => router.push('/farms' as any)}
              />
              <QuickAction
                icon={ScanLine}
                label="Scan QR"
                variant="indigo"
                onPress={() => router.push('/qr-scanner' as any)}
              />
            </View>

            <View style={styles.sectionWrapper}>
              <SectionHeader
                title="District field visits"
                actionText="Open hub"
                onAction={() => router.push('/extension' as any)}
              />
              <Card style={styles.roleDetailCard}>
                <View style={styles.roleCardHeader}>
                  <View>
                    <Text style={styles.roleCardTitle}>Emmanuel Gaye</Text>
                    <Text style={styles.roleCardSub}>Gbehley Swamp Farm • Nimba</Text>
                  </View>
                  <Chip label="COMPLETED" variant="success" size="sm" />
                </View>
                <Text style={styles.roleCardBody}>
                  Panicle blast & drainage inspection. Water levels optimal.
                </Text>
              </Card>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* ROLE 3: QUALITY INSPECTOR VIEW */}
        {/* ========================================================= */}
        {currentRole === 'quality_inspector' && (
          <View style={styles.bodyContent}>
            <View style={styles.overlappingStatsWrapper}>
              <StatsCard
                stats={[
                  { value: pendingInspectionsCount || 3, label: 'Queue' },
                  { value: approvedCount || 12, label: 'Grade A' },
                  { value: rejectedCount || 1, label: 'Rejected' },
                ]}
              />
            </View>

            <View style={styles.quickActionsRow}>
              <QuickAction
                icon={Speedometer}
                label="Queue"
                variant="amber"
                onPress={() => router.push('/inspector' as any)}
              />
              <QuickAction
                icon={ScanLine}
                label="Scan QR"
                variant="primary"
                onPress={() => router.push('/qr-scanner' as any)}
              />
              <QuickAction
                icon={Layers}
                label="Ledger"
                variant="sky"
                onPress={() => router.push('/harvests' as any)}
              />
              <QuickAction
                icon={FileText}
                label="Export"
                variant="indigo"
                onPress={() => router.push('/reports' as any)}
              />
            </View>

            <View style={styles.sectionWrapper}>
              <SectionHeader
                title="Pending verification batches"
                actionText="View queue"
                onAction={() => router.push('/inspector' as any)}
              />
              {harvests.slice(0, 2).map((batch) => (
                <Card key={batch.id} style={styles.roleDetailCard}>
                  <View style={styles.roleCardHeader}>
                    <View>
                      <Text style={styles.roleCardTitle}>{batch.batch_reference}</Text>
                      <Text style={styles.roleCardSub}>
                        {batch.crop?.name || 'Produce'} • {batch.quantity} {batch.unit}
                      </Text>
                    </View>
                    <Chip
                      label={batch.status.replace('_', ' ').toUpperCase()}
                      variant="warning"
                      size="sm"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.inspectorActionBtn}
                    onPress={() => router.push(`/inspector/inspect/${batch.id}` as any)}
                  >
                    <Text style={styles.inspectorActionBtnText}>Inspect batch →</Text>
                  </TouchableOpacity>
                </Card>
              ))}
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* ROLE 4: CO-OP MANAGER VIEW */}
        {/* ========================================================= */}
        {(currentRole === 'cooperative_manager' ||
          currentRole === 'agricultural_admin' ||
          currentRole === 'super_admin') && (
          <View style={styles.bodyContent}>
            <View style={styles.overlappingStatsWrapper}>
              <StatsCard
                stats={[
                  { value: 48, label: 'Farmers' },
                  { value: totalCultivatedArea > 0 ? totalCultivatedArea.toFixed(1) : '86.4', label: 'Acres' },
                  { value: totalHarvestWeight > 0 ? totalHarvestWeight.toLocaleString() : '14,800', label: 'kg pool' },
                ]}
              />
            </View>

            <View style={styles.quickActionsRow}>
              <QuickAction
                icon={Users}
                label="Members"
                variant="indigo"
                onPress={() => router.push('/farms' as any)}
              />
              <QuickAction
                icon={Layers}
                label="Batches"
                variant="sky"
                onPress={() => router.push('/harvests' as any)}
              />
              <QuickAction
                icon={FileText}
                label="Ledger"
                variant="primary"
                onPress={() => router.push('/reports' as any)}
              />
              <QuickAction
                icon={ScanLine}
                label="Scan QR"
                variant="amber"
                onPress={() => router.push('/qr-scanner' as any)}
              />
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* ROLE 5: COMMERCIAL BUYER VIEW */}
        {/* ========================================================= */}
        {currentRole === 'buyer' && (
          <View style={styles.bodyContent}>
            <View style={styles.overlappingStatsWrapper}>
              <StatsCard
                stats={[
                  { value: approvedCount > 0 ? approvedCount : 12, label: 'Export lots' },
                  { value: totalHarvestWeight > 0 ? `${(totalHarvestWeight / 1000).toFixed(1)}t` : '14.8t', label: 'Verified pool' },
                  { value: 'EUDR', label: 'Compliance' },
                ]}
              />
            </View>

            <View style={styles.quickActionsRow}>
              <QuickAction
                icon={ScanLine}
                label="Scan QR"
                variant="primary"
                onPress={() => router.push('/qr-scanner' as any)}
              />
              <QuickAction
                icon={Layers}
                label="Batches"
                variant="sky"
                onPress={() => router.push('/harvests' as any)}
              />
              <QuickAction
                icon={MapPin}
                label="Origins"
                variant="amber"
                onPress={() => router.push('/farms' as any)}
              />
              <QuickAction
                icon={FileText}
                label="Ledger"
                variant="indigo"
                onPress={() => router.push('/reports' as any)}
              />
            </View>

            <View style={styles.sectionWrapper}>
              <SectionHeader
                title="Verified trade batches"
                actionText="View all"
                onAction={() => router.push('/harvests' as any)}
              />
              {(harvests.filter((h) => h.status === 'approved').length > 0
                ? harvests.filter((h) => h.status === 'approved')
                : harvests
              ).slice(0, 3).map((batch) => (
                <Card key={batch.id} style={styles.roleDetailCard}>
                  <View style={styles.roleCardHeader}>
                    <View>
                      <Text style={styles.roleCardTitle}>{batch.batch_reference || 'BATCH-2025-001'}</Text>
                      <Text style={styles.roleCardSub}>
                        {batch.crop?.name || 'Produce'} • {batch.quantity || '500'} {batch.unit || 'kg'} • Grade A Verified
                      </Text>
                    </View>
                    <Chip label="TRACEABLE" variant="success" size="sm" />
                  </View>
                  <TouchableOpacity
                    style={styles.inspectorActionBtn}
                    onPress={() => router.push(`/harvest/${batch.id}` as any)}
                  >
                    <Text style={styles.inspectorActionBtnText}>Inspect batch dossier →</Text>
                  </TouchableOpacity>
                </Card>
              ))}
            </View>
          </View>
        )}
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
    paddingBottom: 110,
  },
  headerContainer: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 36,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrapper: {
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarInitials: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: Colors.primaryDark,
  },
  greetingCol: {
    flex: 1,
    justifyContent: 'center',
  },
  greetingSub: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.sm,
    color: '#DDF0D8',
    lineHeight: 16,
  },
  greetingName: {
    fontFamily: FontFamily.extraBold,
    fontSize: 22,
    color: '#FFFFFF',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  greetingLocation: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.xs,
    color: '#DDF0D8',
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellUnreadDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F97316',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  weatherSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  weatherSummaryText: {
    fontFamily: FontFamily.semiBold,
    fontSize: Typography.sizes.xs,
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  bodyContent: {
    paddingHorizontal: Spacing.xl,
  },
  overlappingStatsWrapper: {
    marginTop: -22,
    marginBottom: Spacing.xl,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xxl,
    paddingHorizontal: 2,
  },
  sectionWrapper: {
    marginBottom: Spacing.xxl,
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  seasonRowTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.sizes.md,
    color: Colors.text,
  },
  seasonRowSub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  seasonOpenText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: Colors.primary,
  },
  seasonOpenBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  seasonEmpty: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  seasonEmptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  farmsScrollContent: {
    gap: 14,
    paddingRight: Spacing.xl,
    paddingBottom: 4,
  },
  farmCard: {
    width: SCREEN_WIDTH * 0.58,
    maxWidth: 240,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.card,
  },
  farmIllustrationBox: {
    width: '100%',
    height: 96,
    overflow: 'hidden',
  },
  farmCardContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  farmCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.sizes.md,
    color: Colors.text,
    marginBottom: 2,
  },
  farmCardSub: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  advisoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.amberBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    marginBottom: Spacing.xl,
    ...Shadows.card,
  },
  advisoryIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advisoryTextCol: {
    flex: 1,
  },
  advisoryTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 15,
    color: Colors.amberText,
    marginBottom: 3,
  },
  advisoryBody: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: Colors.amberText,
    opacity: 0.9,
    lineHeight: 18,
  },
  roleDetailCard: {
    marginBottom: 12,
    padding: 16,
  },
  roleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  roleCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.sizes.base,
    color: Colors.text,
  },
  roleCardSub: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  roleCardBody: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  inspectorActionBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  inspectorActionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
  },
});
