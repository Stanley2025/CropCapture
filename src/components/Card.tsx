import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, Shadows } from '../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle | (ViewStyle | false | undefined)[];
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  noPadding = false,
}) => {
  return (
    <View
      style={[
        styles.card,
        noPadding ? styles.noPadding : styles.padding,
        style as any,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  padding: {
    padding: Spacing.xl,
  },
  noPadding: {
    padding: 0,
  },
});
