import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { useAppStore } from '../../src/store/useAppStore';
import { SeasonWeather } from '../../src/types/database';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { findCropById } from '../../src/shared/farmRecords';
import { compareSeasons, ComparisonItem, ComparisonRow, STILL_RUNNING } from '../../src/shared/seasonWeather';
import { ensureSeasonWeather, getSeasonWeather } from '../../src/services/season/seasonWeatherService';

const COLUMN_WIDTH = 124;
const MAX_SEASONS = 4;

const daysFrom = (d: number | null) =>
  d === null ? 'not seen yet' : d < 0 ? `${Math.abs(d)} days before planting` : d === 0 ? 'on planting day' : `${d} days after planting`;

export default function CompareSeasonsScreen() {
  const { cropId, from } = useLocalSearchParams<{ cropId: string; from?: string }>();
  const { isOfflineMode } = useAppStore();
  const crop = cropId ? findCropById(cropId) : null;

  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!cropId) return;
    const seasons = (await localDb.getSeasons()).filter((s) => s.crop_id === cropId);
    const rows: ComparisonItem[] = [];
    for (const s of seasons) {
      // Record the weather quietly if it is missing or out of date, then read the summary.
      let weather: SeasonWeather | null = await getSeasonWeather(s.id);
      weather = (await ensureSeasonWeather(s.id, { offline: isOfflineMode })) || weather;
      rows.push({ id: s.id, name: s.season_name, crop_id: s.crop_id, crop_name: crop ? crop.name : undefined, planting_date: s.planting_date, weather });
    }
    setItems(rows);
    setSelected((prev) => {
      if (prev.length) return prev;
      const first = rows.filter((r) => r.id === from).map((r) => r.id);
      const others = rows.filter((r) => r.id !== from).map((r) => r.id);
      return [...first, ...others].slice(0, MAX_SEASONS);
    });
  }, [cropId, from, isOfflineMode, crop]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_SEASONS ? prev : [...prev, id]));

  const result = useMemo(() => compareSeasons(items.filter((i) => selected.includes(i.id))), [items, selected]);

  const metrics: Array<{ label: string; render: (r: ComparisonRow) => string }> = result.ok
    ? [
        { label: 'Planted', render: (r) => r.planting_date },
        {
          label: 'Days after planting covered',
          render: (r) => `${r.days_after_planting_covered}${r.running ? ' (season still running)' : ''}`,
        },
        {
          label: 'Rain in the first 30 days after planting',
          render: (r) => (r.rain_first_30d_mm === null ? '-' : `${r.rain_first_30d_mm} mm${r.first30_complete ? '' : ' so far'}`),
        },
        {
          label: 'Longest dry spell in the first 60 days',
          render: (r) =>
            r.longest_dry_spell_first_60d_days === null ? '-' : `${r.longest_dry_spell_first_60d_days} days${r.first60_complete ? '' : ' so far'}`,
        },
        { label: 'Start of the rains', render: (r) => daysFrom(r.rains_start_days_from_planting) },
        { label: 'Total rain', render: (r) => `${r.total_rain_mm} mm over ${r.window_days} days` },
        { label: 'Rainy days', render: (r) => `${r.rainy_days}` },
        { label: 'Very heavy rain days (50 mm or more)', render: (r) => `${r.heavy_rain_days}` },
      ]
    : [];

  return (
    <Screen>
      <Header title="Compare seasons" subtitle={crop ? `${crop.name} only` : undefined} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          {`Only seasons of the same crop are compared. They are lined up by days since planting, not by calendar month. Pick up to ${MAX_SEASONS}.`}
        </Text>

        <View style={styles.chipRow}>
          {items.map((i) => (
            <Chip key={i.id} label={i.name} size="sm" selected={selected.includes(i.id)} onPress={() => toggle(i.id)} />
          ))}
        </View>

        {!result.ok ? (
          <Card style={styles.card}>
            <Text style={styles.message}>{result.message}</Text>
            {result.reason === 'no_weather' ? (
              <Text style={styles.note}>
                Weather is recorded for a season when you are online and the farm has a location, once the season has been planted for a few days.
              </Text>
            ) : null}
          </Card>
        ) : (
          <>
            {result.notes.length > 0 ? (
              <View style={styles.warnBox}>
                {result.notes.map((n) => (
                  <Text key={n} style={styles.warn}>
                    {n.toLowerCase().includes(STILL_RUNNING) ? `${n}` : n}
                  </Text>
                ))}
              </View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={styles.tableRow}>
                  <View style={styles.labelCell} />
                  {result.rows.map((r) => (
                    <View key={r.id} style={[styles.cell, styles.headCell]}>
                      <Text style={styles.headText} numberOfLines={3}>
                        {r.name}
                      </Text>
                      {r.running ? <Text style={styles.runningTag}>season still running</Text> : null}
                    </View>
                  ))}
                </View>
                {metrics.map((m) => (
                  <View key={m.label} style={styles.tableRow}>
                    <View style={styles.labelCell}>
                      <Text style={styles.labelText}>{m.label}</Text>
                    </View>
                    {result.rows.map((r) => (
                      <View key={r.id} style={styles.cell}>
                        <Text style={styles.cellText}>{m.render(r)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.footnotes}>
              <Text style={styles.note}>{`Every season here has weather for its first ${result.commonDaysAfterPlanting} days after planting.`}</Text>
              {!result.fair.first30 ? <Text style={styles.note}>Rain in the first 30 days: at least one season has not reached day 30 yet, so those numbers are "so far".</Text> : null}
              {!result.fair.first60 ? <Text style={styles.note}>Dry spell in the first 60 days: at least one season has not reached day 60 yet, so those numbers are "so far".</Text> : null}
              {!result.fair.totals ? <Text style={styles.note}>Total rain covers a different number of days for each season, so compare the first-30-day and dry-spell rows instead.</Text> : null}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.xl, paddingBottom: 80, gap: Spacing.lg },
  intro: { color: Colors.textMuted, fontSize: 14, lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  message: { ...Typography.sectionTitle, fontSize: 16 },
  note: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  warnBox: { backgroundColor: Colors.amberBg, borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  warn: { color: Colors.amberText, fontSize: 14, fontWeight: '600' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  labelCell: { width: 150, paddingVertical: 10, paddingRight: Spacing.sm, justifyContent: 'center' },
  labelText: { color: Colors.textMuted, fontSize: 13 },
  cell: { width: COLUMN_WIDTH, paddingVertical: 10, paddingHorizontal: 6, justifyContent: 'center' },
  headCell: { backgroundColor: Colors.tint, borderTopLeftRadius: Radius.sm, borderTopRightRadius: Radius.sm },
  headText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  runningTag: { color: Colors.amberText, fontSize: 11, fontWeight: '700', marginTop: 2 },
  cellText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  footnotes: { gap: 4 },
});
