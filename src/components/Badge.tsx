import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'gold';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'md',
}) => {
  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: Colors.primaryLight, text: Colors.primaryDark, border: '#86EFAC' };
      case 'warning':
        return { bg: Colors.warningLight, text: '#92400E', border: '#FDE68A' };
      case 'danger':
        return { bg: Colors.dangerLight, text: '#991B1B', border: '#FECACA' };
      case 'info':
        return { bg: Colors.infoLight, text: '#1E40AF', border: '#BFDBFE' };
      case 'gold':
        return { bg: Colors.harvestLight, text: '#854D0E', border: '#FEF08A' };
      default:
        return { bg: Colors.surfaceAlt, text: Colors.textMuted, border: Colors.border };
    }
  };

  const c = getColors();
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: c.bg,
          borderColor: c.border,
          paddingVertical: isSm ? 2 : 4,
          paddingHorizontal: isSm ? 6 : 8,
        },
      ]}
    >
      <Text style={[styles.text, { color: c.text, fontSize: isSm ? 10 : 12 }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
