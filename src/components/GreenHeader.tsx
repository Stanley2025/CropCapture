import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, Radius, Spacing } from '../constants/theme';

interface GreenHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  rightBadge?: boolean | number;
  children?: React.ReactNode;
  style?: ViewStyle;
  overlapOffset?: number; // Distance for overlapping bottom card
}

export const GreenHeader: React.FC<GreenHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  rightIcon,
  onRightPress,
  rightBadge,
  children,
  style,
  overlapOffset = 0,
}) => {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View
      style={[
        styles.headerContainer,
        overlapOffset > 0 && { paddingBottom: overlapOffset + Spacing.lg },
        style,
      ]}
    >
      <View style={styles.topNavRow}>
        {showBack ? (
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={handleBack}
            activeOpacity={0.7}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={22} color={Colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholderBtn} />
        )}

        {title ? (
          <View style={styles.titleWrapper}>
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitleText} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {rightAction ? (
          rightAction
        ) : rightIcon ? (
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={onRightPress}
            activeOpacity={0.7}
            accessibilityLabel="Action"
            accessibilityRole="button"
          >
            <Ionicons name={rightIcon} size={20} color={Colors.white} />
            {rightBadge && (
              <View style={styles.unreadDot} />
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholderBtn} />
        )}
      </View>

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: Radius.headerCurve,
    borderBottomRightRadius: Radius.headerCurve,
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === 'android' ? Spacing.lg : Spacing.md,
    paddingBottom: Spacing.xl,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderBtn: {
    width: 44,
    height: 44,
  },
  titleWrapper: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  titleText: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    color: Colors.white,
    textAlign: 'center',
  },
  subtitleText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginTop: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.amber,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
});
