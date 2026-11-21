import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors, Radius, Spacing } from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { Farm, FarmActivity, HarvestBatch } from '../../src/types/database';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { RainChart } from '../../src/components/farmYear/RainChart';
import { ActivityWeatherLine } from '../../src/components/activity/ActivityWeatherLine';
import { t, StringKey } from '../../src/i18n/en';
import { weatherLabel } from '../../src/shared/activityWeather';
import { ProfitLossCard } from '../../src/components/ProfitLossCard';
import { profitAndLoss } from '../../src/shared/farmFinance';
import { yearsWithData, summarizeYear, activitiesInYear, showMeasure, buildYearPdfHtml } from '../../src/shared/farmYear';

const monthNames = () => Array.from({ length: 12 }, (_, i) => t(`month${i + 1}` as StringKey));

export default function FarmRecordScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [making, setMaking] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [inputs, setInputs] = useState<any[]>([]);

  // Read from the local database every time the screen is shown, so a new activity appears at once.
  const load = useCallback(async () => {
    if (!id) return;
    const farms = await localDb.getFarms();
    setFarm(farms.find((f) => f.id === id) || null);
    setActivities(await localDb.getActivities(undefined, [id]));
    setHarvests(await localDb.getHarvests(undefined, [id]));
    setExpenses(await localDb.getExpenses([id]));
    setInputs(await localDb.getInputs([id]));
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  useEffect(() => {
    load();
  }, [load]);

  const years = useMemo(() => yearsWithData({ activities, harvests }), [activities, harvests]);
  const pl = useMemo(() => profitAndLoss({ harvests, expenses, inputs, activities, year, farmIds: [id as string] }), [harvests, expenses, inputs, activities, year, id]);
  const summary = useMemo(() => summarizeYear({ activities, harvests, year }), [activities, harvests, year]);
  const yearActivities = useMemo(
    () => [...activitiesInYear(activities, year)].sort((a, b) => String(a.activity_date).localeCompare(String(b.activity_date))),
    [activities, year]
  );
  const nr = t('notRecorded');

  const savePdf = async () => {
    if (!farm) return;
    setMaking(true);
    try {
      const createdOn = new Date().toISOString().slice(0, 10);
      const html = buildYearPdfHtml({
        farmName: farm.name,
        year,
        createdOn,
        summary,
        activities: yearActivities,
        notRecorded: nr,
        weatherText: (a) => weatherLabel(a),
        labels: {
          title: t('pdfTitle', { farm: farm.name, year }),
          yearLine: t('yearTab', { year }),
          createdOn: t('pdfCreatedOn', { date: createdOn }),
          tileHarvest: t('tileHarvest'),
          tileActivities: t('tileActivities'),
          tileFirstPlanting: t('tileFirstPlanting'),
          tileLastHarvest: t('tileLastHarvest'),
          rainyDays: t('rainyDaysChart'),
          rainyDaysShort: t('rowRainyDays'),
          month: 'Month',
          timeline: t('timeline'),
          date: t('detailDate'),
          activity: t('tileActivities'),
          weather: t('detailWeather'),
          noWeather: t('noWeatherOnEntry'),
          noRecords: t('noRecordsYear'),
          footer: t('pdfFooter'),
          monthNames: monthNames(),
        },
      });
      // Made on the phone: works with no network
      const file = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: t('savePdf') });
      } else {
        Alert.alert(t('savePdf'), file.uri);
      }
    } catch (e) {
      Alert.alert(t('savePdf'), t('pdfFailed'));
    } finally {
      setMaking(false);
    }
  };

  const tiles: Array<{ label: string; value: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
    { label: t('tileHarvest'), value: showMeasure(summary.harvestKg, nr, t('kg')), icon: 'basket-outline' },
    { label: t('tileActivities'), value: showMeasure(summary.activityCount, nr), icon: 'list-outline' },
    { label: t('tileFirstPlanting'), value: showMeasure(summary.firstPlantingDate, nr), icon: 'leaf-outline' },
    { label: t('tileLastHarvest'), value: showMeasure(summary.lastHarvestDate, nr), icon: 'calendar-outline' },
  ];

  return (
    <Screen>
      <Header title={t('farmRecord')} subtitle={farm ? farm.name : ''} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Years that have data, plus this year */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
          {years.map((y) => (
            <TouchableOpacity
              key={y}
              style={[styles.tab, y === year && styles.tabOn]}
              onPress={() => setYear(y)}
              accessibilityRole="tab"
              accessibilityState={{ selected: y === year }}
              accessibilityLabel={t('yearTab', { year: y })}
            >
              <Text style={[styles.tabText, y === year && styles.tabTextOn]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {!summary.hasData ? (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={30} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{t('noRecordsYear')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.tiles}>
              {tiles.map((tile) => (
                <View key={tile.label} style={styles.tile} accessible accessibilityLabel={`${tile.label}: ${tile.value}`}>
                  <Ionicons name={tile.icon} size={20} color={Colors.primary} />
                  <Text style={styles.tileLabel}>{tile.label}</Text>
                  <Text style={styles.tileValue}>{tile.value}</Text>
                </View>
              ))}
            </View>

            <ProfitLossCard pl={pl} />

            <RainChart year={year} months={summary.months} />

            <Text style={styles.sectionTitle}>{t('timeline')}</Text>
            {yearActivities.length === 0 ? <Text style={styles.muted}>{nr}</Text> : null}
            {yearActivities.map((a) => (
              <View key={a.id} style={styles.entry} accessible accessibilityLabel={`${a.activity_date}. ${a.activity_type}. ${weatherLabel(a) || t('noWeatherOnEntry')}`}>
                <View style={styles.dot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryDate}>{a.activity_date}</Text>
                  <Text style={styles.entryTitle}>{a.activity_type}</Text>
                  {weatherLabel(a) ? <ActivityWeatherLine activity={a} /> : <Text style={styles.noWeather}>{t('noWeatherOnEntry')}</Text>}
                </View>
              </View>
            ))}
          </>
        )}

        <View style={styles.actions}>
          <Button
            title={making ? t('pdfWorking') : t('savePdf')}
            onPress={savePdf}
            disabled={!summary.hasData || making}
            icon={making ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="download-outline" size={20} color="#FFFFFF" />}
          />
          <Button
            title={t('openPlanNext', { year: new Date().getFullYear() + 1 })}
            variant="outline"
            onPress={() => router.push(`/farm-plan/${id}` as any)}
            icon={<Ionicons name="trending-up-outline" size={20} color={Colors.primary} />}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.xl, paddingBottom: 80, gap: Spacing.lg },
  tabs: { gap: Spacing.sm, paddingVertical: 2 },
  tab: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  tabOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 16, fontWeight: '700', color: Colors.text },
  tabTextOn: { color: '#FFFFFF' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: { width: '48.5%', backgroundColor: Colors.tint, borderRadius: Radius.card, padding: Spacing.lg, gap: 4 },
  tileLabel: { fontSize: 13, color: Colors.textMuted },
  tileValue: { fontSize: 20, fontWeight: '800', color: Colors.primaryDark },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginTop: Spacing.sm },
  muted: { color: Colors.textMuted, fontSize: 14 },
  entry: { flexDirection: 'row', gap: Spacing.md, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, minHeight: 44 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginTop: 6 },
  entryDate: { fontSize: 12, color: Colors.textMuted },
  entryTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  noWeather: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  empty: { alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xxl },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  actions: { gap: Spacing.sm, marginTop: Spacing.md },
});
