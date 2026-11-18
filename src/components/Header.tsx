import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  rightAction,
}) => {
  const router = useRouter();
  const { currentRole, isOfflineMode, syncStatus, pendingSyncCount, toggleOfflineMode } =
    useAppStore();

  const getSyncLabel = () => {
    if (isOfflineMode) return 'Offline';
    if (syncStatus === 'synchronizing') return 'Syncing...';
    if (pendingSyncCount > 0) return `${pendingSyncCount} Queue`;
    return 'Online';
  };

  const getSyncColor = () => {
    if (isOfflineMode) return Colors.warning;
    if (syncStatus === 'synchronizing') return Colors.info;
    if (pendingSyncCount > 0) return Colors.warning;
    return Colors.accent;
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.leftSection}>
          {showBack && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.appTitle}>CROPCAPTURE</Text>
            {title && <Text style={styles.screenTitle}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>

        <View style={styles.rightSection}>
          {/* Offline / Online Sync Indicator Pill */}
          <TouchableOpacity
            style={[styles.syncPill, { borderColor: getSyncColor() }]}
            onPress={toggleOfflineMode}
            accessibilityLabel={`Toggle offline mode. Current: ${getSyncLabel()}`}
          >
            <View style={[styles.statusDot, { backgroundColor: getSyncColor() }]} />
            <Text style={[styles.syncText, { color: getSyncColor() }]}>
              {getSyncLabel()}
            </Text>
          </TouchableOpacity>

          {/* Sync Center Navigation */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/sync-center' as any)}
            accessibilityLabel="Open Offline Sync Center"
          >
            <Ionicons name="cloud-outline" size={22} color={Colors.white} />
            {pendingSyncCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingSyncCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Scanner shortcut */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/qr-scanner' as any)}
            accessibilityLabel="Scan QR Batch"
          >
            <Ionicons name="qr-code-outline" size={20} color={Colors.white} />
          </TouchableOpacity>

          {rightAction}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primaryDark,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: Spacing.sm,
    padding: Spacing.xs,
  },
  appTitle: {
    color: Colors.primaryLight,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.2,
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    marginTop: 2,
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: Typography.sizes.xs,
    marginTop: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  syncText: {
    fontSize: 11,
    fontWeight: '600',
  },
  iconButton: {
    position: 'relative',
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.danger,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
