import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  LOGO_PATHS,
  LOGO_TONES,
  LOGO_WIDTH,
  LOGO_HEIGHT,
  LOGO_ICON_WIDTH,
  LogoTone,
} from '../constants/brandLogo';

interface LogoProps {
  /** "full" is the sprout with the FarmTori wordmark; "icon" is the sprout alone. */
  variant?: 'full' | 'icon';
  /**
   * "light": light backgrounds (the original colours). "dark": near-black backgrounds.
   * "onGreen": the app's green header.
   */
  tone?: LogoTone;
  /** Height in points; the width follows the logo's proportions. */
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/** The official FarmTori logo, drawn as vector paths so it is sharp at every size. */
export const Logo: React.FC<LogoProps> = ({ variant = 'full', tone = 'light', height = 32, style }) => {
  const c = LOGO_TONES[tone];
  const viewWidth = variant === 'icon' ? LOGO_ICON_WIDTH : LOGO_WIDTH;
  const width = (height * viewWidth) / LOGO_HEIGHT;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${viewWidth} ${LOGO_HEIGHT}`}
      style={style}
      accessible
      accessibilityLabel="FarmTori"
      accessibilityRole="image"
    >
      <Path d={LOGO_PATHS.stem} fill={c.stem} fillRule="evenodd" />
      <Path d={LOGO_PATHS.leafL} fill={c.leafL} fillRule="evenodd" />
      <Path d={LOGO_PATHS.leafR} fill={c.leafR} fillRule="evenodd" />
      {variant === 'full' ? (
        <>
          <Path d={LOGO_PATHS.farm} fill={c.farm} fillRule="evenodd" />
          <Path d={LOGO_PATHS.tori} fill={c.tori} fillRule="evenodd" />
        </>
      ) : null}
    </Svg>
  );
};
