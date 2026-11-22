import React from 'react';
import { Image } from 'react-native';

/** The sun picture used for "Sunny" (the supplied artwork, with a transparent background). */
export const SunIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <Image source={require('../../../assets/weather/sunny.png')} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />
);
