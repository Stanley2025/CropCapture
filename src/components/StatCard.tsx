import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Card } from './Card';
import { Colors, FontFamily, Spacing } from '../constants/theme';

export interface StatItem {
  value: string | number;
  label: string;
}

interface StatsCardProps {
  stats: StatItem[];
  style?: ViewStyle;
}

export const StatsCard: React.FC<StatsCardProps> = ({ stats, style }) => {
  return (
    <Card style={[styles.card, style]}>
      <View style={styles.statsRow}>
        {stats.map((item, idx) => (
          <React.Fragment key={idx}>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
            {idx < stats.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </View>
    </Card>
  );
};

// Compatibility export
export const StatCard = StatsCard;

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  statValue: {
    fontFamily: FontFamily.extraBold,
    fontSize: 22,
    lineHeight: 28,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
  },
});
