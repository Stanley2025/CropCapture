import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Rect, Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Radius } from '../constants/theme';

interface FieldIllustrationProps {
  cropType?: 'rice' | 'cassava' | 'cocoa' | 'coffee' | 'vegetables' | string;
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const FieldIllustration: React.FC<FieldIllustrationProps> = ({
  cropType = 'rice',
  width = '100%',
  height = 90,
  borderRadius = Radius.iconBubble,
  style,
}) => {
  const cleanCrop = (cropType || 'rice').toLowerCase();

  // Color selection based on crop
  let fieldDark = '#2E7D32';
  let fieldLight = '#66BB6A';
  let hillColor = '#9CCC65';

  if (cleanCrop.includes('cassava')) {
    fieldDark = '#558B2F';
    fieldLight = '#7CB342';
    hillColor = '#9E9D24';
  } else if (cleanCrop.includes('cocoa') || cleanCrop.includes('coffee')) {
    fieldDark = '#3E2723';
    fieldLight = '#5D4037';
    hillColor = '#8D6E63';
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: width as any,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#B9E2F3" />
            <Stop offset="1" stopColor="#DDF0D8" />
          </LinearGradient>
          <LinearGradient id="sunGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FDC55E" />
            <Stop offset="1" stopColor="#F2A93B" />
          </LinearGradient>
        </Defs>

        {/* Sky Background */}
        <Rect x="0" y="0" width="200" height="120" fill="url(#skyGrad)" />

        {/* Sun */}
        <Circle cx="150" cy="35" r="18" fill="url(#sunGrad)" opacity={0.9} />

        {/* Distant Hills */}
        <Path
          d="M 0 65 Q 40 45, 90 58 T 200 50 L 200 120 L 0 120 Z"
          fill={hillColor}
          opacity={0.85}
        />

        {/* Main Farm Field Ground */}
        <Path
          d="M 0 70 Q 70 58, 140 68 T 200 65 L 200 120 L 0 120 Z"
          fill={fieldDark}
        />

        {/* Perspective Crop Rows radiating from center horizon */}
        {/* Row 1 (Center Left) */}
        <Path d="M 100 68 L 10 120 L 30 120 L 100 68 Z" fill={fieldLight} opacity={0.65} />
        {/* Row 2 (Far Left) */}
        <Path d="M 100 68 L -30 120 L -10 120 L 100 68 Z" fill={fieldLight} opacity={0.5} />
        {/* Row 3 (Center Right) */}
        <Path d="M 100 68 L 70 120 L 95 120 L 100 68 Z" fill={fieldLight} opacity={0.65} />
        {/* Row 4 (Right) */}
        <Path d="M 100 68 L 135 120 L 160 120 L 100 68 Z" fill={fieldLight} opacity={0.65} />
        {/* Row 5 (Far Right) */}
        <Path d="M 100 68 L 195 120 L 220 120 L 100 68 Z" fill={fieldLight} opacity={0.5} />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#B9E2F3',
  },
});
