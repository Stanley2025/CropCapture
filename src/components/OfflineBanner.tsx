import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';

export const OfflineBanner: React.FC = () => {
  const router = useRouter();
  const { isOfflineMode, pendingSyncCount, syncStatus, triggerManualSync } = useAppStore();

  if (!isOfflineMode && pendingSyncCount === 0 && syncStatus !== 'sync_failed') {
    return null;
  }

  const getBannerDetails = () => {
    if (isOfflineMode) {
      return {
        bg: '#FEF3C7',
        border: '#FDE68A',
        textColor: '#92400E',
        icon: 'cloud-offline-outline' as const,
        text: 'Working in Offline Mode. Records saved locally on device.',
        actionText: 'Review Queue',
      };
    }
    if (syncStatus === 'sync_failed') {
      return {
        bg: '#FEE2E2',
        border: '#FECACA',
        textColor: '#991B1B',
        icon: 'alert-circle-outline' as const,
        text: 'Sync encountered an error. Records remain safe locally.',
        actionText: 'Retry Sync',
      };
    }
    return {
      bg: '#E0F2FE',
      border: '#BAE6FD',
      textColor: '#075985',
      icon: 'cloud-upload-outline' as const,
      text: `${pendingSyncCount} record(s) queued for synchronization.`,
      actionText: 'Sync Now',
    };
  };

  const details = getBannerDetails();

  return (
    <View style={[styles.container, { backgroundColor: details.bg, borderColor: details.border }]}>
      <View style={styles.content}>
        <Ionicons name={details.icon} size={18} color={details.textColor} style={styles.icon} />
        <Text style={[styles.text, { color: details.textColor }]}>{details.text}</Text>
      </View>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: details.textColor }]}
        onPress={() => {
          if (details.actionText === 'Sync Now' || details.actionText === 'Retry Sync') {
            triggerManualSync();
          } else {
            router.push('/sync-center' as any);
          }
        }}
      >
        <Text style={styles.buttonText}>{details.actionText}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  text: {
    fontSize: Typography.sizes.xs,
    fontWeight: '500',
    flexShrink: 1,
  },
  button: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
