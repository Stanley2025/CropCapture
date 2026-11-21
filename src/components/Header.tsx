import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, Radius, Spacing, Typography } from '../constants/theme';
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

  const isFarmer = currentRole === 'farmer';

  const getSyncLabel = () => {
    if (isOfflineMode) return 'Offline';
    if (syncStatus === 'synchronizing') return 'Syncing...';
    // For farmers, remove queue indication completely
    if (isFarmer) return 'Online';
    if (pendingSyncCount > 0) return `${pendingSyncCount} Queue`;
    return 'Online';
  };

  const getSyncColor = () => {
    if (isOfflineMode) return Colors.warning;
    if (syncStatus === 'synchronizing') return Colors.info;
    if (isFarmer) return Colors.lime;
    if (pendingSyncCount > 0) return Colors.warning;
    return Colors.lime;
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
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.appTitle}>CROPCAPTURE</Text>
            {title && <Text style={styles.screenTitle}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>

        <View style={styles.rightSection}>
          {/* Offline / Online Sync Indicator Pill - Clean display for farmers without queue text */}
          {(!isFarmer || isOfflineMode || syncStatus === 'synchronizing') && (
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
          )}

          {/* Sync Center Navigation - Queue badge removed on farmer portal */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/sync-center' as any)}
            accessibilityLabel="Open Offline Sync Center"
          >
            <Ionicons name="cloud-outline" size={20} color="#FFFFFF" />
            {!isFarmer && pendingSyncCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingSyncCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Scanner shortcut - Removed on farmer portal */}
          {!isFarmer && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/qr-scanner' as any)}
              accessibilityLabel="Scan QR Batch"
            >
              <Ionicons name="qr-code-outline" size={19} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {rightAction}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primary,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
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
    paddingRight: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  appTitle: {
    color: '#DDF0D8',
    fontSize: 10,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.2,
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.lg,
    fontFamily: FontFamily.extraBold,
    marginTop: 1,
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#DDF0D8',
    fontSize: Typography.sizes.xs,
    fontFamily: FontFamily.medium,
    marginTop: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  syncText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
  },
  iconButton: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
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
