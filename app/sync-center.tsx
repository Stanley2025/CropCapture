import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../src/constants/theme';
import { localDb, SyncQueueItem } from '../src/services/storage/localDatabase';
import { useAppStore } from '../src/store/useAppStore';
import { Header } from '../src/components/Header';
import { Card } from '../src/components/Card';
import { Badge } from '../src/components/Badge';
import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';

export default function OfflineSyncCenterScreen() {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return <Badge label="Synced" variant="success" size="sm" />;
      case 'waiting_to_sync':
        return <Badge label="Waiting to Sync" variant="warning" size="sm" />;
      case 'synchronizing':
        return <Badge label="Synchronizing..." variant="info" size="sm" />;
      case 'sync_failed':
        return <Badge label="Sync Failed" variant="danger" size="sm" />;
      default:
        return <Badge label="Saved on Device" variant="default" size="sm" />;
    }
  };

  const totalLocalRecords = Object.values(storageStats).reduce((a, b) => a + b, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Offline Sync Center"
        subtitle="Local SQLite database & cloud queue"
        showBack
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* Connection Control Card */}
        <Card style={styles.controlCard}>
          <View style={styles.controlTopRow}>
            <View>
              <Text style={styles.controlTitle}>Connection Mode</Text>
              <Text style={styles.controlSub}>
                {isOfflineMode
                  ? 'Forced Offline: Working securely from local storage'
                  : 'Online: Automated synchronization enabled'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggleBtn, isOfflineMode ? styles.toggleOffline : styles.toggleOnline]}
              onPress={toggleOfflineMode}
            >
              <Ionicons
                name={isOfflineMode ? 'cloud-offline' : 'cloud-done'}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.toggleBtnText}>
                {isOfflineMode ? 'Go Online' : 'Simulate Offline'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.syncMetaRow}>
            <View style={styles.syncMetaItem}>
              <Text style={styles.metaLabel}>ENGINE STATUS</Text>
              <Text style={styles.metaValue}>{syncStatus.toUpperCase()}</Text>
            </View>
            <View style={styles.syncMetaItem}>
              <Text style={styles.metaLabel}>LAST SUCCESSFUL SYNC</Text>
              <Text style={styles.metaValue}>
                {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Never'}
              </Text>
            </View>
            <View style={styles.syncMetaItem}>
              <Text style={styles.metaLabel}>PENDING QUEUE</Text>
              <Text style={styles.metaValue}>
                {queue.filter((i) => i.status !== 'synced').length} Records
              </Text>
            </View>
          </View>

          <Button
            title={syncStatus === 'synchronizing' ? 'Syncing Records...' : 'Execute Synchronization'}
            onPress={handleSyncNow}
            size="md"
            loading={syncStatus === 'synchronizing'}
            icon={<Ionicons name="refresh" size={18} color="#FFFFFF" />}
            style={{ marginTop: Spacing.md }}
          />
        </Card>

        {/* Local Storage Telemetry */}
        <Card style={styles.storageCard}>
          <Text style={styles.sectionTitle}>Local SQLite Database Store</Text>
          <Text style={styles.sectionSubtitle}>
            {totalLocalRecords} records stored securely in persistent storage
          </Text>

          <View style={styles.storageGrid}>
            <View style={styles.storageItem}>
              <Text style={styles.storageCount}>{storageStats.farms}</Text>
              <Text style={styles.storageLabel}>Farms</Text>
            </View>
            <View style={styles.storageItem}>
              <Text style={styles.storageCount}>{storageStats.seasons}</Text>
              <Text style={styles.storageLabel}>Seasons</Text>
            </View>
            <View style={styles.storageItem}>
              <Text style={styles.storageCount}>{storageStats.activities}</Text>
              <Text style={styles.storageLabel}>Activities</Text>
            </View>
            <View style={styles.storageItem}>
              <Text style={styles.storageCount}>{storageStats.harvests}</Text>
              <Text style={styles.storageLabel}>Harvests</Text>
            </View>
            <View style={styles.storageItem}>
              <Text style={styles.storageCount}>{storageStats.inputs}</Text>
              <Text style={styles.storageLabel}>Inputs</Text>
            </View>
            <View style={styles.storageItem}>
              <Text style={styles.storageCount}>{storageStats.expenses}</Text>
              <Text style={styles.storageLabel}>Expenses</Text>
            </View>
          </View>
        </Card>

        {/* Sync Queue List */}
        <View style={styles.queueHeaderRow}>
          <Text style={styles.sectionTitle}>Active Sync Queue</Text>
          {queue.length > 0 && (
            <TouchableOpacity
              onPress={async () => {
                await localDb.clearCompletedSyncQueue();
                await loadData();
              }}
            >
              <Text style={styles.clearText}>Clear Synced</Text>
            </TouchableOpacity>
          )}
        </View>

        {queue.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="checkmark-done-circle-outline" size={32} color={Colors.primary} />}
            title="All Records Up to Date"
            description="Your device local database is synchronized with the backend. Any new records created while offline will queue here."
          />
        ) : (
          queue.map((item) => (
            <Card key={item.id} style={styles.queueCard}>
              <View style={styles.queueItemHeader}>
                <View style={styles.queueTypeRow}>
                  <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
                  <Text style={styles.queueType}>
                    {item.entity_type.toUpperCase()} • {item.action.toUpperCase()}
                  </Text>
                </View>
                {getStatusBadge(item.status)}
              </View>

              <Text style={styles.queueId}>Client UUID: {item.id}</Text>
              <Text style={styles.queueTimestamp}>
                Queued at {new Date(item.created_at).toLocaleTimeString()} • Retries: {item.retry_count}
              </Text>

              {item.last_error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={14} color={Colors.danger} />
                  <Text style={styles.errorText}>{item.last_error}</Text>
                </View>
              )}
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
  controlCard: {
    marginBottom: Spacing.md,
  },
  controlTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  controlTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  controlSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
    maxWidth: 200,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  toggleOnline: {
    backgroundColor: '#047857',
  },
  toggleOffline: {
    backgroundColor: '#B45309',
  },
  toggleBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  syncMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  syncMetaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  storageCard: {
    marginBottom: Spacing.md,
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
    marginBottom: Spacing.sm,
  },
  storageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  storageItem: {
    width: '31%',
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storageCount: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
  },
  storageLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  queueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  clearText: {
    fontSize: Typography.sizes.xs,
    color: Colors.primary,
    fontWeight: '700',
  },
  queueCard: {
    marginBottom: Spacing.xs,
    padding: Spacing.sm,
  },
  queueItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  queueTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  queueType: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  queueId: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  queueTimestamp: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    padding: 6,
    borderRadius: Radius.sm,
    marginTop: 4,
  },
  errorText: {
    fontSize: 10,
    color: Colors.danger,
    flex: 1,
  },
});
