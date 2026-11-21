import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, Radius, Spacing } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';

interface SyncChipProps {
  style?: ViewStyle;
}

export const SyncChip: React.FC<SyncChipProps> = ({ style }) => {
  const router = useRouter();
  const { isOfflineMode, syncStatus, pendingSyncCount } = useAppStore();

  const isOffline = isOfflineMode;
  const isFailed = syncStatus === 'sync_failed';
  const isSyncing = syncStatus === 'synchronizing';
  const hasPending = pendingSyncCount > 0;

  const getDetails = () => {
    if (isOffline) {
      return {
        bg: Colors.amberBg,
        text: Colors.amberText,
        icon: 'cloud-offline-outline' as const,
        label: 'Offline',
      };
    }
    if (isFailed) {
      return {
        bg: Colors.dangerBg,
        text: Colors.danger,
        icon: 'alert-circle-outline' as const,
        label: 'Retry sync',
      };
    }
    if (isSyncing) {
      return {
        bg: Colors.tint,
        text: Colors.primaryDark,
        icon: 'sync-outline' as const,
        label: 'Syncing...',
      };
    }
    if (hasPending) {
      return {
        bg: Colors.amberBg,
        text: Colors.amberText,
        icon: 'cloud-upload-outline' as const,
        label: `${pendingSyncCount} waiting`,
      };
    }
    return {
      bg: 'rgba(255, 255, 255, 0.2)',
      text: Colors.white,
      icon: 'cloud-done-outline' as const,
      label: 'Synced',
    };
  };

  const details = getDetails();

  return (
    <TouchableOpacity
      onPress={() => router.push('/sync-center' as any)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Sync status: ${details.label}`}
      style={[
        styles.chip,
        { backgroundColor: details.bg },
        style,
      ]}
    >
      <Ionicons
        name={details.icon}
        size={14}
        color={details.text}
        style={styles.icon}
      />
      <Text style={[styles.text, { color: details.text }]}>
        {details.label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    minHeight: 32,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  text: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    lineHeight: 16,
  },
});
