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
import { Colors, Radius, Spacing, Typography } from '../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
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
}) => {
  const getButtonStyles = (): ViewStyle => {
    switch (variant) {
      case 'secondary':
        return { backgroundColor: Colors.primaryLight };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: Colors.primary,
        };
      case 'danger':
        return { backgroundColor: Colors.danger };
      case 'ghost':
        return { backgroundColor: 'transparent' };
      default:
        return { backgroundColor: Colors.primary };
    }
  };

  const getTextStyles = (): TextStyle => {
    switch (variant) {
      case 'secondary':
        return { color: Colors.primaryDark };
      case 'outline':
        return { color: Colors.primary };
      case 'danger':
        return { color: '#FFFFFF' };
      case 'ghost':
        return { color: Colors.primary };
      default:
        return { color: '#FFFFFF' };
    }
  };

  const getHeight = () => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 8, paddingHorizontal: 12, minHeight: 36 };
      case 'lg':
        return { paddingVertical: 16, paddingHorizontal: 24, minHeight: 54 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 18, minHeight: 46 };
    }
  };

  const fontSize =
    size === 'sm'
      ? Typography.sizes.sm
      : size === 'lg'
      ? Typography.sizes.lg
      : Typography.sizes.md;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
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
          color={variant === 'outline' || variant === 'secondary' ? Colors.primary : '#FFFFFF'}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.text,
              getTextStyles(),
              { fontSize },
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
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: Spacing.xs,
  },
  text: {
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
