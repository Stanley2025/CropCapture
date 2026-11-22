import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../Card';
import { SkyIcon, hasSkyPicture } from './SkyIcon';
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
  required?: boolean;
  skyError?: boolean;
}

/**
 * "Weather today": Four large sky options (tap the chosen one again to clear it), an optional
 * rain amount the farmer measured, and how the day felt. Every option shows an icon together with its words.
 */
export const WeatherCard: React.FC<Props> = ({
  sky,
  onSky,
  rainMm,
  onRainMm,
  rainError,
  dayFeel,
  onDayFeel,
  required = false,
  skyError = false,
}) => (
  <Card style={[styles.card, skyError && styles.cardError]}>
    <View style={styles.titleRow}>
      <Text style={styles.title}>{t('weatherToday')}</Text>
      {required ? (
        <View style={[styles.requiredBadge, skyError && styles.requiredBadgeError]}>
          <Text style={[styles.requiredTag, skyError && styles.requiredTagError]}>Required *</Text>
        </View>
      ) : (
        <Text style={styles.optionalTag}>{t('weatherOptional')}</Text>
      )}
    </View>

    {skyError && (
      <Text style={styles.skyErrorText}>
        Please select today's sky condition below (Required)
      </Text>
    )}

    <View style={styles.skyGrid} accessibilityRole="radiogroup">
      {SKY_OPTIONS.map((value) => {
        const selected = sky === value;
        const label = t(SKY[value].label);
        return (
          <TouchableOpacity
            key={value}
            style={[
              styles.skyOption,
              selected && styles.skyOptionOn,
              skyError && !selected && styles.skyOptionError,
            ]}
            activeOpacity={0.8}
            onPress={() => onSky(selected ? null : value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={t(selected ? 'weatherSelected' : 'weatherNotSelected', { option: label })}
          >
            {hasSkyPicture(value) ? (
              <SkyIcon sky={value} size={32} />
            ) : (
              <Ionicons
                name={SKY[value].icon}
                size={28}
                color={selected ? '#FFFFFF' : skyError ? Colors.danger : Colors.primaryDark}
              />
            )}
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
  card: { padding: Spacing.md, marginBottom: Spacing.md },
  cardError: { borderColor: Colors.danger, borderWidth: 1.5 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: 16, fontWeight: '800', color: Colors.text },
  optionalTag: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  requiredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#E4F4DF',
    borderRadius: Radius.pill,
  },
  requiredBadgeError: {
    backgroundColor: '#FBE5DF',
  },
  requiredTag: { fontSize: 12, color: Colors.primaryDark, fontWeight: '700' },
  requiredTagError: { color: Colors.danger },
  skyErrorText: { fontSize: 12, color: Colors.danger, fontWeight: '700', marginBottom: Spacing.sm },
  skyGrid: { flexDirection: 'row', gap: Spacing.sm },
  skyOption: {
    flex: 1,
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
  skyOptionError: { borderColor: '#F5C2B8' },
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
