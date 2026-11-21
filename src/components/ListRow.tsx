import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, Radius, Spacing } from '../constants/theme';

interface ListRowProps {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  note?: string | number;
  onPress?: () => void;
  isDestructive?: boolean;
  showChevron?: boolean;
  showDivider?: boolean;
  style?: ViewStyle;
}

export const ListRow: React.FC<ListRowProps> = ({
  iconName,
  title,
  note,
  onPress,
  isDestructive = false,
  showChevron = true,
  showDivider = true,
  style,
}) => {
  const bubbleBg = isDestructive ? Colors.dangerBg : Colors.tintSoft;
  const iconColor = isDestructive ? Colors.danger : Colors.primary;
  const textColor = isDestructive ? Colors.danger : Colors.text;

  return (
    <View style={style}>
      <TouchableOpacity
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        style={styles.row}
      >
        <View style={[styles.iconBubble, { backgroundColor: bubbleBg }]}>
          <Ionicons name={iconName} size={20} color={iconColor} />
        </View>

        <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
          {title}
        </Text>

        {note !== undefined && note !== null && (
          <Text style={styles.note}>{note}</Text>
        )}

        {showChevron && (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={Colors.textMuted}
            style={styles.chevron}
          />
        )}
      </TouchableOpacity>

      {showDivider && <View style={styles.divider} />}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: Spacing.sm,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: Radius.iconBubble,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  title: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  note: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.textMuted,
    marginRight: Spacing.xs,
  },
  chevron: {
    marginLeft: Spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 44 + Spacing.md,
  },
});
