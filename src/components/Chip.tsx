import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Radius, Spacing, FontFamily } from '../constants/theme';

export type ChipVariant =
  | 'default'
  | 'active'
  | 'primary'
  | 'success'
  | 'warning'
  | 'amber'
  | 'danger'
  | 'sky'
  | 'soft';

interface ChipProps {
  label: string;
  variant?: ChipVariant;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md';
}

export const Chip: React.FC<ChipProps> = ({
  label,
  variant = 'default',
  selected = false,
  onPress,
  icon,
  style,
  textStyle,
  size = 'md',
}) => {
  const isSelected = selected || variant === 'active';

  const getColors = () => {
    if (isSelected) {
      return {
        bg: Colors.primary,
        border: Colors.primary,
        text: Colors.white,
      };
    }

    switch (variant) {
      case 'success':
        return {
          bg: Colors.tint,
          border: Colors.tint,
          text: Colors.primary,
        };
      case 'warning':
      case 'amber':
        return {
          bg: Colors.amberBg,
          border: Colors.amberBg,
          text: Colors.amberText,
        };
      case 'danger':
        return {
          bg: Colors.dangerBg,
          border: Colors.dangerBg,
          text: Colors.danger,
        };
      case 'sky':
        return {
          bg: Colors.sky,
          border: Colors.sky,
          text: Colors.primaryDark,
        };
      case 'soft':
        return {
          bg: Colors.tintSoft,
          border: Colors.border,
          text: Colors.text,
        };
      case 'default':
      default:
        return {
          bg: Colors.card,
          border: Colors.border,
          text: Colors.text,
        };
    }
  };

  const colors = getColors();

  const content = (
    <View
      style={[
        styles.chip,
        size === 'sm' ? styles.chipSm : styles.chipMd,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text
        style={[
          styles.text,
          size === 'sm' ? styles.textSm : styles.textMd,
          { color: colors.text },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

export const StatusPill = Chip;

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipMd: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    minHeight: 44,
  },
  chipSm: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 32,
  },
  iconContainer: {
    marginRight: Spacing.xs,
  },
  text: {
    fontFamily: FontFamily.bold,
  },
  textMd: {
    fontSize: 14,
    lineHeight: 18,
  },
  textSm: {
    fontSize: 12,
    lineHeight: 16,
  },
});
