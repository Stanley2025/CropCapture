import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { Colors, Radius, Spacing, FontFamily } from '../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'lime' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const getButtonStyles = (): ViewStyle => {
    switch (variant) {
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: Colors.primary,
        };
      case 'lime':
        return {
          backgroundColor: Colors.lime,
        };
      case 'secondary':
        return {
          backgroundColor: Colors.tint,
        };
      case 'danger':
        return {
          backgroundColor: Colors.danger,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
        };
      default:
        return {
          backgroundColor: Colors.primary,
        };
    }
  };

  const getTextStyles = (): TextStyle => {
    switch (variant) {
      case 'outline':
        return { color: Colors.primary };
      case 'lime':
        return { color: Colors.primaryDark };
      case 'secondary':
        return { color: Colors.primaryDark };
      case 'danger':
        return { color: Colors.white };
      case 'ghost':
        return { color: Colors.primary };
      default:
        return { color: Colors.white };
    }
  };

  const getHeight = () => {
    switch (size) {
      case 'sm':
        return { minHeight: 44, paddingVertical: 10, paddingHorizontal: 18 };
      case 'lg':
      case 'md':
      default:
        return { minHeight: 56, paddingVertical: 16, paddingHorizontal: 24 };
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole="button"
      style={[
        styles.button,
        getButtonStyles(),
        getHeight(),
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'lime' || variant === 'secondary' ? Colors.primaryDark : Colors.white}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.text,
              getTextStyles(),
              size === 'sm' && styles.textSm,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: Spacing.sm,
  },
  text: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  textSm: {
    fontSize: 14,
    lineHeight: 20,
  },
  disabled: {
    opacity: 0.5,
  },
});
