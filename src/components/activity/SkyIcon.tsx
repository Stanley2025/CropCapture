import React from 'react';
import { Image } from 'react-native';
import type { WeatherSky } from '../../shared/activityWeather';

/** Pictures supplied for the sky choices (transparent background). */
const PICTURES: Partial<Record<WeatherSky, any>> = {
  sunny: require('../../../assets/weather/sunny.png'),
  cloudy: require('../../../assets/weather/cloudy.png'),
  rain: require('../../../assets/weather/rain.png'),
  heavy_rain: require('../../../assets/weather/heavy-rain.png'),
};

export const hasSkyPicture = (sky: WeatherSky | null | undefined): boolean => Boolean(sky && PICTURES[sky]);

export const SkyIcon: React.FC<{ sky: WeatherSky; size?: number }> = ({ sky, size = 28 }) =>
  PICTURES[sky] ? <Image source={PICTURES[sky]} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors /> : null;
