import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { syncEngine } from '../../src/services/sync/syncEngine';
import { useAppStore } from '../../src/store/useAppStore';
import { Farm, FarmActivity, HarvestBatch, FarmPlan } from '../../src/types/database';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { DatePickerField } from '../../src/components/DatePickerField';
import { KeyboardAwareScrollView } from '../../src/components/KeyboardAwareScrollView';
import { t, StringKey } from '../../src/i18n/en';
import { showMeasure } from '../../src/shared/farmYear';
import { buildPlan, comparePreviousYears, planYearFor, MAX_CROP_LENGTH, MAX_NOTE_LENGTH } from '../../src/shared/farmPlan';

const ROW_LABEL: Record<string, StringKey> = {
  harvest: 'rowHarvest',
  planting: 'rowPlanting',
  rainyDays: 'rowRainyDays',
  weeding: 'rowWeeding',
  fertilizer: 'rowFertilizer',
};

export default function PlanNextSeasonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refreshPendingSyncCount, isOfflineMode } = useAppStore();
  const planYear = planYearFor();

  const [farm, setFarm] = useState<Farm | null>(null);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);
  const [saved, setSaved] = useState<FarmPlan | null>(null);
  const [crop, setCrop] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const [changeNote, setChangeNote] = useState('');

  // Everything is read from the local database, so this works with no network.
  const load = useCallback(async () => {
    if (!id) return;
    setFarm((await localDb.getFarms()).find((f) => f.id === id) || null);
    setActivities(await localDb.getActivities(undefined, [id]));
    setHarvests(await localDb.getHarvests(undefined, [id]));
    const plan = (await localDb.getFarmPlans(id)).find((p) => p.plan_year === planYear) || null;
    setSaved(plan);
    setCrop(plan?.crop || '');
    setPlantingDate(plan?.planting_date || '');
    setChangeNote(plan?.change_note || '');
  }, [id, planYear]);
  useEffect(() => {
    load();
  }, [load]);

  const table = useMemo(() => comparePreviousYears({ activities, harvests, planYear }), [activities, harvests, planYear]);
  const nr = t('notRecorded');

  const cell = (key: string, value: number | string | null) => {
    if (key === 'harvest') return showMeasure(value, nr, t('kg'));
    if (key === 'weeding' || key === 'fertilizer') return value === null ? nr : value === 1 ? t('onceCount') : t('timesCount', { count: value as number });
    return showMeasure(value, nr);
  };

  const finish = async () => {
    await refreshPendingSyncCount();
    // Upload in the background when there is a connection; otherwise it waits in the queue.
    if (!isOfflineMode) syncEngine.syncQueue().catch((e) => console.warn('Plan sync waiting:', e));
    await load();
  };

  const save = async () => {
    if (!id) return;
    try {
      const plan = buildPlan({ farmId: id, year: planYear, crop, plantingDate, changeNote, existing: saved });
      await localDb.saveFarmPlan(plan, true);
      await finish();
      Alert.alert(t('savePlan'), t('planSaved'));
    } catch (e) {
      Alert.alert(t('savePlan'), (e as Error).message);
    }
  };

  const remove = async () => {
    if (!saved) return;
    await localDb.deleteFarmPlan(saved.id, true);
    setCrop('');
    setPlantingDate('');
    setChangeNote('');
    await finish();
    Alert.alert(t('removePlan'), t('planRemoved'));
  };

  return (
    <Screen>
      <Header title={t('planNext', { year: planYear })} subtitle={farm ? farm.name : ''} showBack />
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        {/* What the farmer's own records say about the last two years */}
        <Text style={styles.sectionTitle}>{t('yourLastTwoYears')}</Text>
        <View style={styles.table} accessibilityRole="summary">
          <View style={styles.row}>
            <View style={styles.labelCell} />
            {table.years.map((y) => (
              <Text key={y} style={[styles.cell, styles.head]}>
                {y}
              </Text>
            ))}
          </View>
          {table.rows.map((r) => (
            <View
              key={r.key}
              style={styles.row}
              accessible
              accessibilityLabel={`${t(ROW_LABEL[r.key])}. ${table.years.map((y, i) => `${y}: ${cell(r.key, r.values[i])}`).join('. ')}`}
            >
              <Text style={[styles.labelCell, styles.label]}>{t(ROW_LABEL[r.key])}</Text>
              {r.values.map((v, i) => (
                <Text key={table.years[i]} style={[styles.cell, v === null && styles.missing]}>
                  {cell(r.key, v)}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <Text style={styles.note}>{t('ownRecordsNote')}</Text>

        {/* The farmer's own choices: nothing is suggested */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>{t('yourDecisions')}</Text>
        {!saved ? <Text style={styles.note}>{t('noPlanYet', { year: planYear })}</Text> : null}

        <Text style={styles.fieldLabel}>{t('fieldCrop')}</Text>
        <TextInput
          style={styles.input}
          value={crop}
          onChangeText={setCrop}
          maxLength={MAX_CROP_LENGTH}
          placeholder={t('fieldCropPlaceholder')}
          placeholderTextColor={Colors.textMuted}
          accessibilityLabel={t('fieldCrop')}
        />

        <DatePickerField label={t('fieldPlantingDate')} value={plantingDate} onChange={setPlantingDate} allowFuture />
        {plantingDate ? (
          <TouchableOpacity style={styles.clear} onPress={() => setPlantingDate('')} accessibilityRole="button" accessibilityLabel={`${t('fieldPlantingDate')}: ${t('close')}`}>
            <Ionicons name="close-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.clearText}>{t('tapAgainToClear')}</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.fieldLabel}>{t('fieldChange')}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={changeNote}
          onChangeText={setChangeNote}
          maxLength={MAX_NOTE_LENGTH}
          multiline
          placeholder={t('fieldChangePlaceholder')}
          placeholderTextColor={Colors.textMuted}
          accessibilityLabel={t('fieldChange')}
        />

        <View style={styles.actions}>
          <Button title={t('savePlan')} onPress={save} icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />} />
          {saved ? (
            <Button title={t('removePlan')} variant="outline" onPress={remove} icon={<Ionicons name="trash-outline" size={20} color={Colors.primary} />} />
          ) : null}
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.xl, paddingBottom: 80 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  table: { backgroundColor: Colors.card, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: 1, borderBottomColor: Colors.border },
  labelCell: { width: '34%', paddingRight: 6 },
  label: { fontSize: 14, fontWeight: '700', color: Colors.text },
  cell: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.primaryDark, paddingVertical: 8 },
  head: { fontSize: 15, fontWeight: '800', color: Colors.text },
  missing: { color: Colors.textMuted, fontWeight: '400' },
  note: { fontSize: 13, color: Colors.textMuted, marginTop: Spacing.sm, lineHeight: 18 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.xs },
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
  multiline: { minHeight: 110, paddingTop: 12, textAlignVertical: 'top' },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  clearText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  actions: { gap: Spacing.sm, marginTop: Spacing.xl },
});
