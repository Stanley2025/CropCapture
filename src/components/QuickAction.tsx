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

interface QuickActionProps {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  bubbleBg?: string;
  iconColor?: string;
  style?: ViewStyle;
}

export const QuickAction: React.FC<QuickActionProps> = ({
  iconName,
  label,
  onPress,
  bubbleBg = Colors.tint,
  iconColor = Colors.primaryDark,
  style,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.container, style]}
    >
      <View style={[styles.bubble, { backgroundColor: bubbleBg }]}>
        <Ionicons name={iconName} size={26} color={iconColor} />
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
    width: 72,
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
