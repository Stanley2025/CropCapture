import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, {
  Rect,
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';

interface FarmerHeroProps {
  width?: number | string;
  height?: number;
  style?: ViewStyle;
}

export const FarmerHero: React.FC<FarmerHeroProps> = ({
  width = '100%',
  height = 280,
  style,
}) => {
  return (
    <View style={[styles.container, { width: width as any, height }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 320 280" preserveAspectRatio="xMidYMid meet">
        <Defs>
          <LinearGradient id="heroSunGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FDC55E" />
            <Stop offset="1" stopColor="#F2A93B" />
          </LinearGradient>
          <LinearGradient id="heroShirtGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#E0E6DD" />
          </LinearGradient>
        </Defs>

        {/* Big Warm Sun */}
        <Circle cx="240" cy="80" r="50" fill="url(#heroSunGrad)" opacity={0.3} />
        <Circle cx="240" cy="80" r="38" fill="url(#heroSunGrad)" />

        {/* Distant Soft Hills */}
        <Path d="M 0 140 Q 80 120, 160 135 T 320 125 L 320 280 L 0 280 Z" fill="#9CCC65" />
        <Path d="M 0 160 Q 90 145, 180 155 T 320 148 L 320 280 L 0 280 Z" fill="#2E7D32" />

        {/* Perspective Farm Rows */}
        <Path d="M 160 155 L -40 280 L 0 280 L 160 155 Z" fill="#43A047" opacity={0.6} />
        <Path d="M 160 155 L 40 280 L 80 280 L 160 155 Z" fill="#43A047" opacity={0.6} />
        <Path d="M 160 155 L 120 280 L 160 280 L 160 155 Z" fill="#43A047" opacity={0.7} />
        <Path d="M 160 155 L 200 280 L 240 280 L 160 155 Z" fill="#43A047" opacity={0.6} />
        <Path d="M 160 155 L 280 280 L 320 280 L 160 155 Z" fill="#43A047" opacity={0.6} />
        <Path d="M 160 155 L 350 280 L 380 280 L 160 155 Z" fill="#43A047" opacity={0.5} />

        {/* Farmer Body (Back/Over Shoulder Perspective) */}
        <G transform="translate(0, 10)">
          {/* Torso / Shoulders */}
          <Path
            d="M 110 280 C 110 215, 140 195, 180 195 C 220 195, 250 215, 250 280 Z"
            fill="url(#heroShirtGrad)"
          />

          {/* Neck */}
          <Rect x="168" y="175" width="24" height="24" rx="6" fill="#8D5524" />

          {/* Head */}
          <Circle cx="180" cy="165" r="24" fill="#8D5524" />

          {/* Headwrap / Hair */}
          <Path
            d="M 158 160 C 158 144, 170 142, 180 142 C 190 142, 202 144, 202 160 C 202 150, 195 138, 180 138 C 165 138, 158 150, 158 160 Z"
            fill="#F2A93B"
          />
          <Circle cx="196" cy="142" r="10" fill="#F2A93B" />

          {/* Right Arm extended holding phone */}
          <Path
            d="M 235 215 Q 260 210, 275 220 Q 285 225, 290 240"
            stroke="url(#heroShirtGrad)"
            strokeWidth="28"
            strokeLinecap="round"
          />

          {/* Hand holding phone */}
          <Circle cx="288" cy="225" r="12" fill="#8D5524" />

          {/* Smartphone */}
          <G transform="translate(270, 185)">
            <Rect
              x="0"
              y="0"
              width="36"
              height="58"
              rx="8"
              fill="#17301F"
              stroke="#A5D65A"
              strokeWidth="1.5"
            />
            {/* Screen */}
            <Rect x="3" y="5" width="30" height="48" rx="5" fill="#2E7D32" />
            {/* QR / Verified Target Box */}
            <Rect
              x="8"
              y="14"
              width="20"
              height="20"
              rx="3"
              fill="none"
              stroke="#A5D65A"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
            <Circle cx="18" cy="24" r="3" fill="#A5D65A" />
          </G>
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
