import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheet } from '../BottomSheet';
import { Colors, Spacing } from '../../constants/theme';
import { t } from '../../i18n/en';
import { weatherLabel } from '../../shared/activityWeather';

interface Props {
  activity: any | null;
  farmName?: string;
  onClose: () => void;
}

/** Everything saved on one activity, including the weather the farmer recorded. */
export const ActivityDetailSheet: React.FC<Props> = ({ activity, farmName, onClose }) => {
  const weather = activity ? weatherLabel(activity) : null;
  const rows: Array<[string, string]> = activity
    ? [
        [t('detailDate'), activity.activity_date || t('notRecorded')],
        [t('detailFarm'), farmName || t('notRecorded')],
        [t('detailWeather'), weather || t('noWeatherOnEntry')],
        [t('detailWorkers'), activity.labor_count ? String(activity.labor_count) : t('notRecorded')],
        [t('detailCost'), activity.cost ? `$${activity.cost}` : t('notRecorded')],
      ]
    : [];
  return (
    <BottomSheet visible={!!activity} title={activity ? activity.activity_type : t('activityDetails')} subtitle={t('activityDetails')} onClose={onClose}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
      {activity && activity.description ? (
        <View style={styles.notes}>
          <Text style={styles.label}>{t('detailNotes')}</Text>
          <Text style={styles.value}>{activity.description}</Text>
        </View>
      ) : null}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { fontSize: 14, color: Colors.textMuted },
  value: { fontSize: 15, fontWeight: '600', color: Colors.text, flexShrink: 1, textAlign: 'right' },
  notes: { paddingVertical: 10, gap: 4 },
});
