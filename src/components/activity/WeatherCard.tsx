import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../Card';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { t, StringKey } from '../../i18n/en';
import { SKY_OPTIONS, DAY_FEEL_OPTIONS, WeatherSky, DayFeel } from '../../shared/activityWeather';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const SKY: Record<WeatherSky, { label: StringKey; icon: IconName }> = {
  sunny: { label: 'skySunny', icon: 'sunny' },
  cloudy: { label: 'skyCloudy', icon: 'cloud' },
  rain: { label: 'skyRain', icon: 'rainy' },
  heavy_rain: { label: 'skyHeavyRain', icon: 'thunderstorm' },
};
const FEEL: Record<DayFeel, { label: StringKey; icon: IconName }> = {
  cool: { label: 'feelCool', icon: 'snow-outline' },
  warm: { label: 'feelWarm', icon: 'partly-sunny-outline' },
  hot: { label: 'feelHot', icon: 'flame-outline' },
};

interface Props {
  sky: WeatherSky | null;
  onSky: (value: WeatherSky | null) => void;
  rainMm: string;
  onRainMm: (value: string) => void;
  /** key of an error message in the strings file, or null */
  rainError: StringKey | null;
  dayFeel: DayFeel | null;
  onDayFeel: (value: DayFeel | null) => void;
}

/**
 * "Weather today": optional. Four large sky options (tap the chosen one again to clear it), an optional
 * rain amount the farmer measured, and how the day felt. Every option shows an icon together with its words.
 */
export const WeatherCard: React.FC<Props> = ({ sky, onSky, rainMm, onRainMm, rainError, dayFeel, onDayFeel }) => (
  <Card style={styles.card}>
    <View style={styles.titleRow}>
      <Text style={styles.title}>{t('weatherToday')}</Text>
      <Text style={styles.optionalTag}>{t('weatherOptional')}</Text>
    </View>

    <View style={styles.skyGrid} accessibilityRole="radiogroup">
      {SKY_OPTIONS.map((value) => {
        const selected = sky === value;
        const label = t(SKY[value].label);
        return (
          <TouchableOpacity
            key={value}
            style={[styles.skyOption, selected && styles.skyOptionOn]}
            activeOpacity={0.8}
            onPress={() => onSky(selected ? null : value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={t(selected ? 'weatherSelected' : 'weatherNotSelected', { option: label })}
          >
            <Ionicons name={SKY[value].icon} size={28} color={selected ? '#FFFFFF' : Colors.primaryDark} />
            <Text style={[styles.skyText, selected && styles.skyTextOn]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>

    <Text style={styles.label}>{t('rainMeasured')}</Text>
    <TextInput
      style={[styles.input, rainError ? styles.inputError : null]}
      value={rainMm}
      onChangeText={onRainMm}
      keyboardType="decimal-pad"
      placeholder={t('rainPlaceholder')}
      placeholderTextColor={Colors.textMuted}
      accessibilityLabel={t('rainMeasured')}
    />
    {rainError ? (
      <Text style={styles.error} accessibilityLiveRegion="polite">
        {t(rainError)}
      </Text>
    ) : (
      <Text style={styles.helper}>{t('weatherHelper')}</Text>
    )}

    <Text style={styles.label}>{t('dayFeels')}</Text>
    <View style={styles.feelRow} accessibilityRole="radiogroup">
      {DAY_FEEL_OPTIONS.map((value) => {
        const selected = dayFeel === value;
        const label = t(FEEL[value].label);
        return (
          <TouchableOpacity
            key={value}
            style={[styles.feelOption, selected && styles.feelOptionOn]}
            activeOpacity={0.8}
            onPress={() => onDayFeel(selected ? null : value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={t(selected ? 'weatherSelected' : 'weatherNotSelected', { option: label })}
          >
            <Ionicons name={FEEL[value].icon} size={20} color={selected ? '#FFFFFF' : Colors.primaryDark} />
            <Text style={[styles.feelText, selected && styles.skyTextOn]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </Card>
);

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, marginBottom: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  optionalTag: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  skyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  skyOption: {
    width: '48.5%',
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
    paddingVertical: Spacing.sm,
  },
  skyOptionOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  skyText: { fontSize: 15, fontWeight: '700', color: Colors.text },
  skyTextOn: { color: '#FFFFFF' },
  label: { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.xs },
  input: {
    minHeight: 48,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Colors.text,
  },
  inputError: { borderColor: Colors.danger },
  helper: { fontSize: 13, color: Colors.textMuted, marginTop: Spacing.xs, lineHeight: 18 },
  error: { fontSize: 13, color: Colors.danger, marginTop: Spacing.xs, fontWeight: '600' },
  feelRow: { flexDirection: 'row', gap: Spacing.sm },
  feelOption: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
  },
  feelOptionOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  feelText: { fontSize: 14, fontWeight: '700', color: Colors.text },
});
