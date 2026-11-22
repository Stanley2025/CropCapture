import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAwareScrollView } from '../../src/components/KeyboardAwareScrollView';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { useAppStore } from '../../src/store/useAppStore';
import {
  Farm,
  FarmSeason,
  FarmActivity,
  HarvestBatch,
  ExpenseRecord,
  InputRecord,
  SeasonDetails,
  SeasonLabor,
  SeasonProblem,
  SeasonDisposal,
  SeasonWeather,
} from '../../src/types/database';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { Button } from '../../src/components/Button';
import { DatePickerField } from '../../src/components/DatePickerField';
import { SeasonAudioNote } from '../../src/components/SeasonAudioNote';
import { findCropById, CROPS } from '../../src/shared/farmRecords';
import {
  FIELD_TYPES,
  LAND_PREPARATION,
  FALLOW_LENGTHS,
  SEED_SOURCES,
  LABOR_TYPES,
  PROBLEM_TYPES,
  DISEASE_SUGGESTIONS,
  SEVERITIES,
  DESTINATIONS,
  LOSS_REASONS,
  STORAGE_METHODS,
  STORAGE_MONTHS,
  REFLECTION_CHOICES,
  CURRENCIES,
  DEFAULT_CURRENCY,
  LOCAL_UNITS,
  VARIETIES_BY_CROP_CODE,
  ESTIMATED_UNITS,
  labelOf,
  toKg,
  mergeSeasonDetails,
  buildLaborEntry,
  buildProblem,
  buildDisposal,
  summarizeHarvestUse,
  attributeSeasonCosts,
  summarizeSeasonProfit,
} from '../../src/shared/seasonRecord';
import { ensureSeasonWeather } from '../../src/services/season/seasonWeatherService';

// ---------------------------------------------------------------------------
// small building blocks
// ---------------------------------------------------------------------------
const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <Card style={styles.card}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    {children}
  </Card>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => <Text style={styles.label}>{children}</Text>;

interface ChoicesProps<T extends string | number> {
  options: Array<{ value: T; label: string }>;
  selected: T[] | T | null | undefined;
  onPress: (value: T) => void;
}
function Choices<T extends string | number>({ options, selected, onPress }: ChoicesProps<T>) {
  const isOn = (v: T) => (Array.isArray(selected) ? selected.includes(v) : selected === v);
  return (
    <View style={styles.chipRow}>
      {options.map((o) => (
        <Chip key={String(o.value)} label={o.label} size="sm" selected={isOn(o.value)} onPress={() => onPress(o.value)} />
      ))}
    </View>
  );
}

const money = (amount: number, currency: string) =>
  `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const monthOptions = (): Array<{ value: string; label: string }> => {
  const out: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({
      value: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
    });
  }
  return out;
};

const currencyOptions = CURRENCIES.map((c) => ({ value: c as string, label: c }));
const unitOptions = LOCAL_UNITS as Array<{ value: string; label: string }>;
const yesNo = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

// ---------------------------------------------------------------------------
export default function SeasonRecordScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isOfflineMode, refreshPendingSyncCount } = useAppStore();

  const [season, setSeason] = useState<FarmSeason | null>(null);
  const [farm, setFarm] = useState<Farm | null>(null);
  const [seasonsOnFarm, setSeasonsOnFarm] = useState<FarmSeason[]>([]);
  const [sameCropSeasons, setSameCropSeasons] = useState<FarmSeason[]>([]);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [inputs, setInputs] = useState<InputRecord[]>([]);
  const [details, setDetails] = useState<SeasonDetails | null>(null);
  const [labor, setLabor] = useState<SeasonLabor[]>([]);
  const [problems, setProblems] = useState<SeasonProblem[]>([]);
  const [disposals, setDisposals] = useState<SeasonDisposal[]>([]);
  const [weather, setWeather] = useState<SeasonWeather | null>(null);

  const crop = season ? findCropById(season.crop_id) : null;
  const cropCode = crop ? crop.code : undefined;

  const load = useCallback(async () => {
    if (!id) return;
    const allSeasons = await localDb.getSeasons();
    const s = allSeasons.find((x) => x.id === id) || null;
    setSeason(s);
    if (!s) return;
    const farms = await localDb.getFarms();
    setFarm(farms.find((f) => f.id === s.farm_id) || null);
    setSeasonsOnFarm(allSeasons.filter((x) => x.farm_id === s.farm_id));
    setSameCropSeasons(allSeasons.filter((x) => x.crop_id === s.crop_id));
    setActivities(await localDb.getActivities(undefined, [s.farm_id]));
    setHarvests(await localDb.getHarvests(undefined, [s.farm_id]));
    setExpenses(await localDb.getExpenses([s.farm_id]));
    setInputs(await localDb.getInputs([s.farm_id]));
    const d = await localDb.getSeasonRecords<SeasonDetails>('details', s.id);
    setDetails(d[0] || null);
    setLabor(await localDb.getSeasonRecords<SeasonLabor>('labor', s.id));
    setProblems(await localDb.getSeasonRecords<SeasonProblem>('problem', s.id));
    setDisposals(await localDb.getSeasonRecords<SeasonDisposal>('disposal', s.id));
    const w = await localDb.getSeasonRecords<SeasonWeather>('weather', s.id);
    setWeather(w[0] || null);
  }, [id]);

  // This screen stays open while another is shown on top of it (for example after registering a
  // second harvest), so read the saved records again every time it comes back into view.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load]);

  // Weather is recorded quietly in the background and shown only in the weather section below.
  useEffect(() => {
    if (!id) return;
    ensureSeasonWeather(id, { offline: isOfflineMode }).then((w) => w && setWeather(w));
  }, [id, isOfflineMode, harvests.length]);

  // ----- saving ------------------------------------------------------------
  const guard = async (fn: () => Promise<void>) => {
    try {
      await fn();
      await refreshPendingSyncCount();
    } catch (e) {
      Alert.alert('Please check this entry', (e as Error).message.replace(/^Invalid /, 'Invalid '));
    }
  };

  const saveDetails = (patch: Parameters<typeof mergeSeasonDetails>[1]) =>
    guard(async () => {
      if (!season) return;
      const next = mergeSeasonDetails(details, patch, { seasonId: season.id, cropCode });
      await localDb.saveSeasonRecord('details', next, true);
      setDetails(next);
    });

  const saveSeason = (patch: Partial<FarmSeason>) =>
    guard(async () => {
      if (!season) return;
      const next = { ...season, ...patch, updated_at: new Date().toISOString() };
      await localDb.saveSeason(next, true);
      setSeason(next);
    });

  const removeRecord = (kind: 'labor' | 'problem' | 'disposal', recordId: string) =>
    guard(async () => {
      await localDb.deleteSeasonRecord(kind, recordId, true);
      await load();
    });

  // ----- add-forms state -----------------------------------------------------
  const [laborType, setLaborType] = useState<string | null>(null);
  const [laborDays, setLaborDays] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [laborCurrency, setLaborCurrency] = useState<string>(DEFAULT_CURRENCY);

  const [problemType, setProblemType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string>('small');
  const [problemDate, setProblemDate] = useState(new Date().toISOString().slice(0, 10));
  const [problemDetail, setProblemDetail] = useState<string | null>(null);

  const [destination, setDestination] = useState<string | null>(null);
  const [outQty, setOutQty] = useState('');
  const [outUnit, setOutUnit] = useState('bag');
  const [lossReason, setLossReason] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [saleCurrency, setSaleCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [saleMonth, setSaleMonth] = useState(new Date().toISOString().slice(0, 7));
  const [buyer, setBuyer] = useState('');
  const [transport, setTransport] = useState('');

  const [seedQty, setSeedQty] = useState('');
  const [lossKg, setLossKg] = useState('');
  const [homePrice, setHomePrice] = useState('');

  useEffect(() => {
    setSeedQty(details && details.seed_qty_local != null ? String(details.seed_qty_local) : '');
    setLossKg(details && details.storage_loss_kg != null ? String(details.storage_loss_kg) : '');
    setHomePrice(details && details.home_price_per_kg != null ? String(details.home_price_per_kg) : '');
  }, [details]);

  const addLabor = () =>
    guard(async () => {
      if (!season) return;
      if (!laborType) throw new Error('Choose family, hired or kuu.');
      const row = buildLaborEntry({ seasonId: season.id, laborType, days: laborDays, cost: laborCost, currency: laborCurrency });
      await localDb.saveSeasonRecord('labor', row, true);
      setLaborDays('');
      setLaborCost('');
      await load();
    });

  const addProblem = () =>
    guard(async () => {
      if (!season) return;
      if (!problemType) throw new Error('Choose what went wrong.');
      const row = buildProblem({ seasonId: season.id, problemType, severity, date: problemDate, detail: problemDetail || undefined });
      await localDb.saveSeasonRecord('problem', row, true);
      setProblemType(null);
      setProblemDetail(null);
      await load();
    });

  const addDisposal = () =>
    guard(async () => {
      if (!season) return;
      if (!destination) throw new Error('Choose where the harvest went.');
      const row = buildDisposal({
        seasonId: season.id,
        destination,
        quantity: outQty,
        unit: outUnit,
        cropCode,
        lossReason,
        sale: { pricePerUnit: price, currency: saleCurrency, month: saleMonth, buyerMarket: buyer, transportCost: transport },
      });
      await localDb.saveSeasonRecord('disposal', row, true);
      setOutQty('');
      setPrice('');
      setBuyer('');
      setTransport('');
      setLossReason(null);
      await load();
    });

  // ----- derived numbers ---------------------------------------------------------
  const seasonHarvests = useMemo(() => harvests.filter((h) => h.season_id === id), [harvests, id]);
  const harvestedKg = useMemo(() => {
    let total = 0;
    for (const h of seasonHarvests) {
      const kg = h.quantity_kg ?? toKg({ quantity: h.quantity, unit: h.unit, cropCode })?.kg ?? null;
      if (kg !== null) total += kg;
    }
    return Math.round(total * 100) / 100;
  }, [seasonHarvests, cropCode]);
  const use = useMemo(() => summarizeHarvestUse(disposals, seasonHarvests.length ? harvestedKg : null), [disposals, harvestedKg, seasonHarvests.length]);

  const costs = useMemo(
    () => (season ? attributeSeasonCosts({ season, seasonsOnFarm, harvests, expenses, inputs, activities }) : null),
    [season, seasonsOnFarm, harvests, expenses, inputs, activities]
  );
  const profit = useMemo(
    () => summarizeSeasonProfit({ details, disposals, labor, costs: costs || {} }),
    [details, disposals, labor, costs]
  );
  const otherSeasonsWithSameCrop = sameCropSeasons.filter((s) => s.id !== id);

  if (!season) {
    return (
      <Screen>
        <Header title="Season record" showBack />
        <View style={styles.empty}>
          <Text style={styles.hint}>This season could not be found on this phone.</Text>
        </View>
      </Screen>
    );
  }

  const varieties = cropCode ? VARIETIES_BY_CROP_CODE[cropCode] || [] : [];
  const diseaseNames = cropCode ? DISEASE_SUGGESTIONS[cropCode] || [] : [];
  const isFallow = details?.previous_crop_name === 'Fallow';
  const seedKg = details && details.seed_kg != null ? details.seed_kg : null;
  const outConv = Number(outQty) > 0 ? toKg({ quantity: Number(outQty), unit: outUnit, cropCode }) : null;

  return (
    <Screen>
      <Header title="Season record" subtitle={season.season_name} showBack />
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          {`${crop ? crop.name : 'Crop'} on ${farm ? farm.name : 'your farm'}. Every question is optional. Your answers are saved as you tap.`}
        </Text>

        {/* 1. FIELD */}
        <Section title="Your field">
          <Label>Field type</Label>
          <Choices
            options={FIELD_TYPES}
            selected={details?.field_type}
            onPress={(v) => saveDetails({ field_type: details?.field_type === v ? null : v })}
          />

          <Label>Field size (acres)</Label>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            defaultValue={String(season.cultivated_area ?? '')}
            placeholder="e.g. 2"
            placeholderTextColor={Colors.textMuted}
            onEndEditing={(e) => {
              const n = Number(e.nativeEvent.text);
              if (Number.isFinite(n) && n > 0 && n !== season.cultivated_area) saveSeason({ cultivated_area: n });
            }}
          />

          <Label>Variety</Label>
          <View style={styles.chipRow}>
            {varieties.map((v) => (
              <Chip
                key={v}
                label={v}
                size="sm"
                selected={season.crop_variety_id === v}
                onPress={() => saveSeason({ crop_variety_id: season.crop_variety_id === v ? null : v })}
              />
            ))}
            <Chip
              label="Saved seed"
              size="sm"
              selected={details?.variety_label === 'Saved seed'}
              onPress={() => saveDetails({ variety_label: details?.variety_label === 'Saved seed' ? null : 'Saved seed' })}
            />
          </View>

          <Label>What was in this field before?</Label>
          <View style={styles.chipRow}>
            <Chip
              label="Fallow"
              size="sm"
              selected={isFallow}
              onPress={() =>
                saveDetails(
                  isFallow
                    ? { previous_crop_name: null, previous_crop_id: null, fallow_months: null }
                    : { previous_crop_name: 'Fallow', previous_crop_id: null, fallow_months: 12 }
                )
              }
            />
            {CROPS.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                size="sm"
                selected={details?.previous_crop_id === c.id}
                onPress={() =>
                  saveDetails(
                    details?.previous_crop_id === c.id
                      ? { previous_crop_name: null, previous_crop_id: null, fallow_months: null }
                      : { previous_crop_name: c.name, previous_crop_id: c.id, fallow_months: 0 }
                  )
                }
              />
            ))}
          </View>
          {isFallow ? (
            <>
              <Label>How long was it fallow?</Label>
              <Choices
                options={FALLOW_LENGTHS.filter((f) => f.value > 0)}
                selected={details?.fallow_months}
                onPress={(v) => saveDetails({ fallow_months: v })}
              />
            </>
          ) : null}

          <Label>How was the land prepared? (tap all that apply)</Label>
          <Choices
            options={LAND_PREPARATION}
            selected={details?.land_preparation || []}
            onPress={(v) => {
              const now = details?.land_preparation || [];
              saveDetails({ land_preparation: now.includes(v) ? now.filter((x) => x !== v) : [...now, v] });
            }}
          />
        </Section>

        {/* 2. PLANTING */}
        <Section title="Planting">
          <Label>Where did the seed come from?</Label>
          <Choices
            options={SEED_SOURCES}
            selected={details?.seed_source}
            onPress={(v) => saveDetails({ seed_source: details?.seed_source === v ? null : v })}
          />
          <Label>How much seed?</Label>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={seedQty}
            onChangeText={setSeedQty}
            onEndEditing={() =>
              saveDetails(
                seedQty.trim() === ''
                  ? { seed_qty_local: null }
                  : { seed_qty_local: Number(seedQty), seed_unit_local: details?.seed_unit_local || 'cup' }
              )
            }
            placeholder="e.g. 10"
            placeholderTextColor={Colors.textMuted}
          />
          <Choices
            options={unitOptions}
            selected={details?.seed_unit_local}
            onPress={(v) => saveDetails({ seed_unit_local: v })}
          />
          {seedKg !== null && details?.seed_unit_local !== 'kg' ? (
            <Text style={styles.note}>
              {`about ${seedKg.toLocaleString()} kg${ESTIMATED_UNITS.includes(details?.seed_unit_local || '') ? ' (estimate: cup and tin sizes vary)' : ''}`}
            </Text>
          ) : null}
          <Label>Planted together with another crop?</Label>
          <Choices
            options={yesNo}
            selected={details?.intercropped == null ? null : details.intercropped ? 'yes' : 'no'}
            onPress={(v) => saveDetails({ intercropped: details?.intercropped === (v === 'yes') ? null : v === 'yes' })}
          />
        </Section>

        {/* 3. LABOUR */}
        <Section title="Labour" hint="Family, hired, or a kuu (communal work group).">
          {labor.map((l) => (
            <View key={l.id} style={styles.listRow}>
              <Text style={styles.listText}>
                {`${labelOf(LABOR_TYPES, l.labor_type)}: ${l.days} day${l.days === 1 ? '' : 's'}${l.cost ? `, ${money(l.cost, l.currency)}` : ''}`}
              </Text>
              <TouchableOpacity onPress={() => removeRecord('labor', l.id)}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
          <Choices options={LABOR_TYPES} selected={laborType} onPress={(v) => setLaborType(v)} />
          <View style={styles.inlineRow}>
            <TextInput style={[styles.input, styles.half]} keyboardType="numeric" value={laborDays} onChangeText={setLaborDays} placeholder="Days" placeholderTextColor={Colors.textMuted} />
            <TextInput style={[styles.input, styles.half]} keyboardType="numeric" value={laborCost} onChangeText={setLaborCost} placeholder="Cost (if any)" placeholderTextColor={Colors.textMuted} />
          </View>
          <Choices options={currencyOptions} selected={laborCurrency} onPress={(v) => setLaborCurrency(v)} />
          <Button title="Add labour" variant="outline" size="sm" onPress={addLabor} style={styles.addButton} />
        </Section>

        {/* 4. PROBLEMS */}
        <Section title="Problems" hint="Birds, rats, insects, disease, flood and more, with a date and how bad.">
          {problems.map((p) => (
            <View key={p.id} style={styles.listRow}>
              <Text style={styles.listText}>
                {`${p.problem_date}: ${labelOf(PROBLEM_TYPES, p.problem_type)}${p.detail ? ` (${p.detail})` : ''}, ${labelOf(SEVERITIES, p.severity).toLowerCase()}`}
              </Text>
              <TouchableOpacity onPress={() => removeRecord('problem', p.id)}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
          <Choices options={PROBLEM_TYPES} selected={problemType} onPress={(v) => setProblemType(v)} />
          {problemType === 'disease' && diseaseNames.length > 0 ? (
            <View style={styles.chipRow}>
              {diseaseNames.map((n) => (
                <Chip key={n} label={n} size="sm" selected={problemDetail === n} onPress={() => setProblemDetail(problemDetail === n ? null : n)} />
              ))}
            </View>
          ) : null}
          <Label>How bad?</Label>
          <Choices options={SEVERITIES} selected={severity} onPress={(v) => setSeverity(v)} />
          <DatePickerField label="When?" value={problemDate} onChange={setProblemDate} />
          <Button title="Add problem" variant="outline" size="sm" onPress={addProblem} style={styles.addButton} />
        </Section>

        {/* 5. HARVEST */}
        <Section title="Harvest" hint="Where did it go? Sold, eaten at home, kept as seed, or lost.">
          {seasonHarvests.map((h) => (
            <Text key={h.id} style={styles.listText}>
              {`${h.harvest_date}: ${h.quantity} ${h.unit}${h.quantity_kg != null && h.unit !== 'kg' ? ` (${h.quantity_kg.toLocaleString()} kg)` : ''}`}
            </Text>
          ))}
          <Button title="Record a harvest" variant="outline" size="sm" onPress={() => router.push('/harvest/register' as any)} style={styles.addButton} />

          {seasonHarvests.length > 0 ? (
            <Text style={styles.note}>
              {`Harvested ${harvestedKg.toLocaleString()} kg. Sold ${use.kg.sold}, eaten ${use.kg.eaten}, seed ${use.kg.seed}, lost ${use.kg.lost} kg.`}
              {use.over ? ' You have recorded more than was harvested.' : use.unaccounted ? ` ${use.unaccounted} kg not yet placed.` : ''}
            </Text>
          ) : null}

          {disposals.map((d) => (
            <View key={d.id} style={styles.listRow}>
              <Text style={styles.listText}>
                {`${labelOf(DESTINATIONS, d.destination)}: ${d.qty_local} ${d.unit_local}${d.qty_kg != null && d.unit_local !== 'kg' ? ` (${d.qty_kg} kg)` : ''}`}
                {d.loss_reason ? `, ${labelOf(LOSS_REASONS, d.loss_reason).toLowerCase()}` : ''}
                {d.destination === 'sold' && d.price_per_unit != null ? `, ${money(d.price_per_unit, d.sale_currency || DEFAULT_CURRENCY)} each` : ''}
                {d.destination === 'sold' && d.sold_month ? `, ${d.sold_month}` : ''}
                {d.buyer_market ? `, ${d.buyer_market}` : ''}
              </Text>
              <TouchableOpacity onPress={() => removeRecord('disposal', d.id)}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}

          <Label>Where did some of it go?</Label>
          <Choices options={DESTINATIONS} selected={destination} onPress={(v) => setDestination(v)} />
          <TextInput style={styles.input} keyboardType="numeric" value={outQty} onChangeText={setOutQty} placeholder="How much?" placeholderTextColor={Colors.textMuted} />
          <Choices options={unitOptions} selected={outUnit} onPress={(v) => setOutUnit(v)} />
          {outConv && outUnit !== 'kg' ? (
            <Text style={styles.note}>{`about ${outConv.kg.toLocaleString()} kg${outConv.estimated ? ' (estimate)' : ''}`}</Text>
          ) : null}
          {destination === 'lost' ? (
            <>
              <Label>Why was it lost?</Label>
              <Choices options={LOSS_REASONS} selected={lossReason} onPress={(v) => setLossReason(lossReason === v ? null : v)} />
            </>
          ) : null}
          {destination === 'sold' ? (
            <>
              <Label>Sale</Label>
              <TextInput style={styles.input} keyboardType="numeric" value={price} onChangeText={setPrice} placeholder={`Price for one ${labelOf(unitOptions, outUnit).toLowerCase().replace(/s$/, '')}`} placeholderTextColor={Colors.textMuted} />
              <Choices options={currencyOptions} selected={saleCurrency} onPress={(v) => setSaleCurrency(v)} />
              <Label>Month sold</Label>
              <Choices options={monthOptions()} selected={saleMonth} onPress={(v) => setSaleMonth(v)} />
              <TextInput style={styles.input} value={buyer} onChangeText={setBuyer} placeholder="Buyer or market" placeholderTextColor={Colors.textMuted} />
              <TextInput style={styles.input} keyboardType="numeric" value={transport} onChangeText={setTransport} placeholder="Transport cost (if any)" placeholderTextColor={Colors.textMuted} />
            </>
          ) : null}
          <Button title="Add" variant="outline" size="sm" onPress={addDisposal} style={styles.addButton} />
        </Section>

        {/* 6. STORAGE */}
        <Section title="Storage">
          <Label>How was it stored?</Label>
          <Choices options={STORAGE_METHODS} selected={details?.storage_method} onPress={(v) => saveDetails({ storage_method: details?.storage_method === v ? null : v })} />
          <Label>For how many months?</Label>
          <Choices
            options={STORAGE_MONTHS.map((m) => ({ value: m, label: `${m}` }))}
            selected={details?.storage_months}
            onPress={(v) => saveDetails({ storage_months: details?.storage_months === v ? null : v })}
          />
          <Label>How much was lost in storage? (kg)</Label>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={lossKg}
            onChangeText={setLossKg}
            onEndEditing={() => saveDetails({ storage_loss_kg: lossKg.trim() === '' ? null : Number(lossKg) })}
            placeholder="e.g. 5"
            placeholderTextColor={Colors.textMuted}
          />
        </Section>

        {/* 7. REFLECTION */}
        <Section title="At the end of the season" hint="What would you do differently?">
          <Choices
            options={REFLECTION_CHOICES}
            selected={details?.reflection_choice}
            onPress={(v) => saveDetails({ reflection_choice: details?.reflection_choice === v ? null : v })}
          />
          <SeasonAudioNote
            seasonId={season.id}
            uploadedPath={details?.reflection_audio_path}
            offline={isOfflineMode}
            onUploaded={(path) => saveDetails({ reflection_audio_path: path })}
          />
        </Section>

        {/* 8. PROFIT: cash profit and food kept for home, as two separate lines */}
        <Section title="Profit" hint="Cash profit and the food you kept for home are shown separately.">
          {profit.currencies.length === 0 ? (
            <Text style={styles.note}>Add a sale and your costs to see your cash profit.</Text>
          ) : (
            profit.currencies.map((c) => (
              <View key={c.currency} style={styles.profitBlock}>
                <Text style={styles.profitLabel}>{`Cash profit (${c.currency})`}</Text>
                <Text style={[styles.profitValue, { color: c.cashProfit >= 0 ? Colors.primary : Colors.danger }]}>
                  {`${c.cashProfit >= 0 ? '+' : '-'}${money(Math.abs(c.cashProfit), c.currency)}`}
                </Text>
                <Text style={styles.note}>{`Sales ${money(c.revenue, c.currency)}. Costs ${money(c.cashCosts, c.currency)}.`}</Text>
              </View>
            ))
          )}
          <View style={styles.profitBlock}>
            <Text style={styles.profitLabel}>Value of food kept for home</Text>
            {profit.homeFood.value !== null ? (
              <Text style={styles.profitValue}>{money(profit.homeFood.value, profit.homeFood.currency)}</Text>
            ) : (
              <Text style={styles.note}>
                {profit.homeFood.needsPrice
                  ? `You kept ${profit.homeFood.kg.toLocaleString()} kg at home. Enter what a kg is worth to you to see its value.`
                  : 'Nothing recorded as eaten at home yet.'}
              </Text>
            )}
            <Text style={styles.note}>This is not cash. It is not added to your profit.</Text>
          </View>
          <Label>What is 1 kg of this crop worth to you?</Label>
          <View style={styles.inlineRow}>
            <TextInput
              style={[styles.input, styles.half]}
              keyboardType="numeric"
              value={homePrice}
              onChangeText={setHomePrice}
              onEndEditing={() => saveDetails({ home_price_per_kg: homePrice.trim() === '' ? null : Number(homePrice), home_price_currency: details?.home_price_currency || DEFAULT_CURRENCY })}
              placeholder="Price per kg"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <Choices options={currencyOptions} selected={details?.home_price_currency || DEFAULT_CURRENCY} onPress={(v) => saveDetails({ home_price_currency: v })} />
          {costs && costs.sharedCount > 0 ? (
            <Text style={styles.note}>
              {`${costs.sharedCount} cost${costs.sharedCount === 1 ? '' : 's'} on this farm happened while another season was also running. They are not counted here, because we cannot tell which season they belong to.`}
            </Text>
          ) : null}
        </Section>

        {/* 9. WEATHER, recorded quietly, shown only here */}
        <Section title="Rain and temperature this season">
          {weather ? (
            <>
              {weather.running ? <Text style={styles.warn}>Season still running</Text> : null}
              {!weather.running && weather.partial ? <Text style={styles.warn}>The latest days are not available yet</Text> : null}
              <Text style={styles.note}>{`${weather.window_start} to ${weather.data_through} (starts 30 days before planting)`}</Text>
              <Fact label="Total rain" value={`${weather.total_rain_mm} mm`} />
              <Fact label="Rainy days" value={`${weather.rainy_days}`} />
              <Fact label="Longest dry spell" value={`${weather.longest_dry_spell_days} days`} />
              <Fact label="Average hottest / coolest" value={`${weather.avg_tmax_c ?? '-'}°C / ${weather.avg_tmin_c ?? '-'}°C`} />
              <Fact label="Rain in the first 30 days after planting" value={weather.rain_first_30d_mm == null ? '-' : `${weather.rain_first_30d_mm} mm${weather.first30_complete ? '' : ' so far'}`} />
              <Fact label="Longest dry spell in the first 60 days" value={weather.longest_dry_spell_first_60d_days == null ? '-' : `${weather.longest_dry_spell_first_60d_days} days${weather.first60_complete ? '' : ' so far'}`} />
              <Fact
                label="Start of the rains"
                value={
                  weather.rains_start_date
                    ? `${weather.rains_start_date} (${Math.abs(weather.rains_start_days_from_planting ?? 0)} days ${(weather.rains_start_days_from_planting ?? 0) < 0 ? 'before' : 'after'} planting)`
                    : 'not seen yet'
                }
              />
              <Fact label="Very heavy rain days (50 mm or more)" value={`${weather.heavy_rain_days}`} />
              <Label>Month by month</Label>
              {Object.entries(weather.monthly).map(([month, m]) => (
                <Fact key={month} label={month} value={`${m.rain_mm} mm, ${m.rainy_days} rainy days`} />
              ))}
              {otherSeasonsWithSameCrop.length > 0 ? (
                <Button
                  title={`Compare with other ${crop ? crop.name : ''} seasons`}
                  variant="outline"
                  size="sm"
                  onPress={() => router.push(`/season/compare?cropId=${season.crop_id}&from=${season.id}` as any)}
                  style={styles.addButton}
                />
              ) : null}
            </>
          ) : (
            <Text style={styles.note}>
              Rain and temperature are recorded for you when you are online and the farm has a location. They will appear here.
            </Text>
          )}
        </Section>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.fact}>
    <Text style={styles.factLabel}>{label}</Text>
    <Text style={styles.factValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  content: { padding: Spacing.xl, paddingBottom: 80, gap: Spacing.lg },
  intro: { color: Colors.textMuted, fontSize: 14, lineHeight: 20 },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  sectionTitle: { ...Typography.sectionTitle, marginBottom: 2 },
  hint: { color: Colors.textMuted, fontSize: 13, marginBottom: Spacing.xs },
  label: { color: Colors.text, fontSize: 14, fontWeight: '600', marginTop: Spacing.md, marginBottom: Spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  input: {
    backgroundColor: Colors.inputBg,
    borderColor: Colors.inputBorder,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  inlineRow: { flexDirection: 'row', gap: Spacing.sm },
  half: { flex: 1 },
  note: { color: Colors.textMuted, fontSize: 13, marginTop: Spacing.xs },
  warn: { color: Colors.amberText, backgroundColor: Colors.amberBg, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start', fontWeight: '700', fontSize: 13 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  listText: { flex: 1, color: Colors.text, fontSize: 14 },
  remove: { color: Colors.danger, fontSize: 13, fontWeight: '600' },
  addButton: { alignSelf: 'flex-start', marginTop: Spacing.sm },
  profitBlock: { marginTop: Spacing.sm },
  profitLabel: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  profitValue: { fontSize: 22, fontWeight: '800', color: Colors.text },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, paddingVertical: 3 },
  factLabel: { flex: 1, color: Colors.textMuted, fontSize: 14 },
  factValue: { color: Colors.text, fontSize: 14, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  empty: { padding: Spacing.xl },
});
