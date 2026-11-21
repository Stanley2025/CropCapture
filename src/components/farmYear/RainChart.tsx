import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { t, StringKey } from '../../i18n/en';
import { MonthRain } from '../../shared/farmYear';

const BAR_AREA = 110; // height available for the tallest bar

interface Props {
  year: number;
  months: MonthRain[];
}

const monthName = (m: number) => t(`month${m}` as StringKey);

/** The spoken description of the whole chart, month by month. */
export function rainChartDescription(year: number, months: MonthRain[]): string {
  const details = months
    .map((m) =>
      t('chartMonthValue', {
        month: monthName(m.month),
        value: m.rainyDays === null ? t('notRecorded') : m.rainyDays === 1 ? t('chartOneDay') : t('chartDays', { count: m.rainyDays }),
      })
    )
    .join('. ');
  return t('rainyDaysChartLabel', { year, details });
}

/**
 * Rainy days recorded in each month. A month where no weather was recorded has no bar and shows a dash
 * (not recorded); a month with weather but no rainy days shows 0. The chart has one spoken label for the
 * whole thing, so a screen reader reads each month and its value in order.
 */
export const RainChart: React.FC<Props> = ({ year, months }) => {
  const max = Math.max(1, ...months.map((m) => m.rainyDays || 0));
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('rainyDaysChart')}</Text>
      <View style={styles.chart} accessible accessibilityRole="image" accessibilityLabel={rainChartDescription(year, months)}>
        {months.map((m) => {
          const recorded = m.rainyDays !== null;
          const h = recorded ? Math.max(m.rainyDays! > 0 ? 6 : 2, Math.round(((m.rainyDays as number) / max) * BAR_AREA)) : 0;
          return (
            <View key={m.month} style={styles.col}>
              <Text style={styles.value}>{recorded ? m.rainyDays : '–'}</Text>
              <View style={styles.barArea}>
                {recorded ? <View style={[styles.bar, { height: h }]} /> : <View style={styles.noBar} />}
              </View>
              <Text style={styles.month}>{monthName(m.month)}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.legend}>– = {t('notRecorded')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { backgroundColor: Colors.card, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg },
  title: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: Spacing.md },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  col: { flex: 1, alignItems: 'center' },
  value: { fontSize: 11, fontWeight: '700', color: Colors.primaryDark, marginBottom: 3 },
  barArea: { height: BAR_AREA, justifyContent: 'flex-end', alignItems: 'center', width: '100%' },
  bar: { width: '70%', backgroundColor: Colors.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  noBar: { width: '70%', height: 2, backgroundColor: Colors.border },
  month: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  legend: { fontSize: 12, color: Colors.textMuted, marginTop: Spacing.sm },
});
