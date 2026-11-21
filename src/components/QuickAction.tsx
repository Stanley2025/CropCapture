import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, Radius, Spacing } from '../constants/theme';

export type QuickActionVariant =
  | 'primary'
  | 'indigo'
  | 'amber'
  | 'sky'
  | 'rose'
  | 'emerald';

const VARIANT_PALETTES: Record<
  QuickActionVariant,
  { bubbleBg: string; iconColor: string }
> = {
  primary: { bubbleBg: '#DDF0D8', iconColor: '#0F3D22' },
  indigo: { bubbleBg: '#E6E9FA', iconColor: '#3730A3' },
  amber: { bubbleBg: '#FFF3D2', iconColor: '#92400E' },
  sky: { bubbleBg: '#E0F2FE', iconColor: '#0284C7' },
  rose: { bubbleBg: '#FEE2E2', iconColor: '#B91C1C' },
  emerald: { bubbleBg: '#D1FAE5', iconColor: '#047857' },
};

export interface QuickActionProps {
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  iconName?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  variant?: QuickActionVariant;
  bubbleBg?: string;
  iconColor?: string;
  style?: ViewStyle;
}

export const QuickAction: React.FC<QuickActionProps> = ({
  icon: IconComponent,
  iconName,
  label,
  onPress,
  variant = 'primary',
  bubbleBg,
  iconColor,
  style,
}) => {
  const palette = VARIANT_PALETTES[variant] || VARIANT_PALETTES.primary;
  const resolvedBg = bubbleBg || palette.bubbleBg;
  const resolvedColor = iconColor || palette.iconColor;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.container, style]}
    >
      <View style={[styles.bubble, { backgroundColor: resolvedBg }]}>
        {IconComponent ? (
          <IconComponent size={24} color={resolvedColor} strokeWidth={2.2} />
        ) : iconName ? (
          <Ionicons name={iconName} size={24} color={resolvedColor} />
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 76,
  },
  bubble: {
    width: 60,
    height: 60,
    borderRadius: Radius.iconBubble,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  label: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.text,
    textAlign: 'center',
  },
});
