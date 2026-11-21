import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { weatherLabel, WeatherSky } from '../../shared/activityWeather';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const SKY_ICON: Record<WeatherSky, IconName> = { sunny: 'sunny', cloudy: 'cloud', rain: 'rainy', heavy_rain: 'thunderstorm' };

/** One line of weather for an activity row, e.g. "Rain · 12 mm". Shows nothing when none was recorded. */
export const ActivityWeatherLine: React.FC<{ activity: any }> = ({ activity }) => {
  const text = weatherLabel(activity);
  if (!text) return null;
  const sky = activity.weather_sky as WeatherSky | null;
  return (
    <View style={styles.row} accessible accessibilityLabel={`Weather: ${text}`}>
      <Ionicons name={sky ? SKY_ICON[sky] : 'partly-sunny-outline'} size={16} color={Colors.primaryDark} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  text: { fontSize: 13, fontWeight: '600', color: Colors.primaryDark },
});
