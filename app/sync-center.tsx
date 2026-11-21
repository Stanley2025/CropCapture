import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
} from 'lucide-react-native';
import {
  Colors,
  FontFamily,
  Spacing,
  Typography,
  Shadows,
} from '../src/constants/theme';
import { localDb, SyncQueueItem } from '../src/services/storage/localDatabase';
import { useAppStore } from '../src/store/useAppStore';

export default function OfflineSyncCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    isOfflineMode,
    syncStatus,
    lastSyncTime,
    toggleOfflineMode,
    triggerManualSync,
    refreshPendingSyncCount,
  } = useAppStore();

  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [storageStats, setStorageStats] = useState({
    farms: 0,
    seasons: 0,
    activities: 0,
    inputs: 0,
    expenses: 0,
    harvests: 0,
    inspections: 0,
  });

  const loadData = useCallback(async () => {
    try {
      const [q, f, s, a, inp, exp, h, insp] = await Promise.all([
        localDb.getSyncQueue(),
        localDb.getFarms(),
        localDb.getSeasons(),
        localDb.getActivities(),
        localDb.getInputs(),
        localDb.getExpenses(),
        localDb.getHarvests(),
        localDb.getInspections(),
      ]);

      setQueue(q);
      setStorageStats({
        farms: f.length,
        seasons: s.length,
        activities: a.length,
        inputs: inp.length,
        expenses: exp.length,
        harvests: h.length,
        inspections: insp.length,
      });
      await refreshPendingSyncCount();
    } catch (e) {
      console.error('Failed to load sync center data:', e);
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

  const handleSyncNow = async () => {
    if (isOfflineMode) {
      Alert.alert(
        'Offline Mode Active',
        'Please switch Offline Mode OFF first to allow the sync engine to communicate with the server.'
      );
      return;
    }
    await triggerManualSync();
    await loadData();
  };

  const totalLocalRecords = Object.values(storageStats).reduce((a, b) => a + b, 0);
  const pendingCount = queue.filter((i) => i.status !== 'synced').length;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: Math.max(insets.top, 16) + 12, paddingBottom: 60 },
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
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={22} color={Colors.text} strokeWidth={2.4} />
          </TouchableOpacity>
          <View style={{ flex: 1, paddingLeft: 12 }}>
            <Text style={styles.screenTitle}>Sync center</Text>
            <Text style={styles.screenSub}>Offline SQLite database & sync queue</Text>
          </View>
        </View>

        {/* Connection Mode Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.cardTitle}>Connection Mode</Text>
              <Text style={styles.cardSub}>
                {isOfflineMode
                  ? 'Forced Offline: Working securely from local device'
                  : 'Online: Background automatic synchronization'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.modeToggleBtn,
                isOfflineMode ? styles.modeToggleOffline : styles.modeToggleOnline,
              ]}
              onPress={toggleOfflineMode}
              activeOpacity={0.85}
            >
              {isOfflineMode ? (
                <CloudOff size={16} color="#FFFFFF" strokeWidth={2.4} />
              ) : (
                <Cloud size={16} color="#FFFFFF" strokeWidth={2.4} />
              )}
              <Text style={styles.modeToggleBtnText}>
                {isOfflineMode ? 'Go online' : 'Force offline'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Telemetry Row */}
          <View style={styles.telemetryRow}>
            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>Status</Text>
              <Text style={styles.telemetryValue}>{syncStatus.toUpperCase()}</Text>
            </View>
            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>Pending Queue</Text>
              <Text style={styles.telemetryValue}>
                {pendingCount} {pendingCount === 1 ? 'item' : 'items'}
              </Text>
            </View>
            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>Last Sync</Text>
              <Text style={styles.telemetryValue}>
                {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
              </Text>
            </View>
          </View>

          {/* Sync Button */}
          <TouchableOpacity
            style={styles.syncPrimaryBtn}
            onPress={handleSyncNow}
            disabled={syncStatus === 'synchronizing'}
            activeOpacity={0.85}
          >
            <RefreshCw size={18} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.syncPrimaryBtnText}>
              {syncStatus === 'synchronizing' ? 'Syncing...' : 'Sync now'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Local Storage Telemetry */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Database size={18} color={Colors.primary} strokeWidth={2.4} />
            <Text style={styles.cardTitle}>Local Device Store</Text>
          </View>
          <Text style={styles.cardSub}>
            {totalLocalRecords} records stored securely in phone database
          </Text>

          <View style={styles.storageGrid}>
            <View style={styles.storageBox}>
              <Text style={styles.storageNum}>{storageStats.farms}</Text>
              <Text style={styles.storageLabel}>Farms</Text>
            </View>
            <View style={styles.storageBox}>
              <Text style={styles.storageNum}>{storageStats.seasons}</Text>
              <Text style={styles.storageLabel}>Seasons</Text>
            </View>
            <View style={styles.storageBox}>
              <Text style={styles.storageNum}>{storageStats.activities}</Text>
              <Text style={styles.storageLabel}>Activities</Text>
            </View>
            <View style={styles.storageBox}>
              <Text style={styles.storageNum}>{storageStats.harvests}</Text>
              <Text style={styles.storageLabel}>Harvests</Text>
            </View>
          </View>
        </View>

        {/* Queue Items Section */}
        <View style={styles.queueSection}>
          <Text style={styles.sectionHeaderTitle}>Sync queue</Text>

          {queue.length === 0 ? (
            <View style={styles.emptyCard}>
              <CheckCircle2 size={32} color={Colors.primary} strokeWidth={2.2} />
              <Text style={styles.emptyTitle}>Everything is synced</Text>
              <Text style={styles.emptySub}>
                All farm records on this phone are up to date with the server.
              </Text>
            </View>
          ) : (
            <View style={styles.queueCard}>
              {queue.map((item, idx) => {
                const isLast = idx === queue.length - 1;
                const isSynced = item.status === 'synced';
                return (
                  <View
                    key={item.id}
                    style={[styles.queueRow, !isLast && styles.queueRowDivider]}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.queueAction}>
                        {item.table_name.toUpperCase()} • {item.action}
                      </Text>
                      <Text style={styles.queueRecordId}>ID: {item.record_id}</Text>
                    </View>
                    <View style={isSynced ? styles.pillSynced : styles.pillPending}>
                      <Text style={isSynced ? styles.pillSyncedText : styles.pillPendingText}>
                        {isSynced ? 'Synced' : 'Waiting'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
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
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E4F4DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 24,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  screenSub: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    marginBottom: 16,
    ...Shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: Colors.text,
  },
  cardSub: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },
  modeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modeToggleOnline: {
    backgroundColor: Colors.primary,
  },
  modeToggleOffline: {
    backgroundColor: Colors.amber,
  },
  modeToggleBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 16,
  },
  telemetryCol: {
    flex: 1,
  },
  telemetryLabel: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  telemetryValue: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  syncPrimaryBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  syncPrimaryBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  storageGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  storageBox: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingVertical: 12,
    alignItems: 'center',
  },
  storageNum: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
    marginBottom: 2,
  },
  storageLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textMuted,
  },
  queueSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  sectionHeaderTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    color: Colors.text,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    alignItems: 'center',
    ...Shadows.card,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: Colors.text,
    marginTop: 10,
    marginBottom: 4,
  },
  emptySub: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  queueCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    ...Shadows.card,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  queueRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  queueAction: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 2,
  },
  queueRecordId: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textMuted,
  },
  pillSynced: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillSyncedText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.primary,
  },
  pillPending: {
    backgroundColor: Colors.amberBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillPendingText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.amberText,
  },
});
