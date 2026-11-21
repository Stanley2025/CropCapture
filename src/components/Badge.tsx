import React from 'react';
import { Chip, ChipVariant } from './Chip';
import { ViewStyle, TextStyle } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  size?: 'sm' | 'md';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'sm',
  style,
  textStyle,
}) => {
  const mapVariant = (): ChipVariant => {
    switch (variant) {
      case 'success':
        return 'success';
      case 'warning':
        return 'amber';
      case 'danger':
        return 'danger';
      case 'info':
        return 'sky';
      default:
        return 'soft';
    }
  };

  return (
    <Chip
      label={label}
      variant={mapVariant()}
      size={size}
      style={style}
      textStyle={textStyle}
    />
  );
};
