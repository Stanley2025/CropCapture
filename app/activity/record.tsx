import React, { useState, useEffect, useMemo } from 'react';
import { KeyboardAwareScrollView } from '../../src/components/KeyboardAwareScrollView';
import { WeatherCard } from '../../src/components/activity/WeatherCard';
import { ActivityWeatherLine } from '../../src/components/activity/ActivityWeatherLine';
import { ActivityDetailSheet } from '../../src/components/activity/ActivityDetailSheet';
import { validateWeather, WeatherSky, DayFeel } from '../../src/shared/activityWeather';
import { t, StringKey } from '../../src/i18n/en';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { localDb, generateUUID } from '../../src/services/storage/localDatabase';
import { syncEngine } from '../../src/services/sync/syncEngine';
import { useAppStore } from '../../src/store/useAppStore';
import { Farm, FarmSeason, FarmActivity } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { DatePickerField } from '../../src/components/DatePickerField';
import {
  CROP_ACTIVITY_SECTIONS,
  CROP_ACTIVITY_TYPES,
  CROP_ACTIVITY_FILTERS,
  matchesCategory,
  groupOf,
} from '../../src/shared/activityTypes';
import { BottomSheet } from '../../src/components/BottomSheet';

// Crop activities are grouped (Fertilizer application, Weeding, Irrigation and watering, Pest management).
// The list lives in src/shared/activityTypes.js so the activity log and the tabs filter use the same groups.
export { CROP_ACTIVITY_TYPES };

// The 17 specific land preparation operations offered when "Land preparation" is selected.
export const LAND_PREPARATION_OPERATIONS = [
  'Bush clearing',
  'Brushing',
  'Tree felling',
  'Destumping',
  'Gathering cleared vegetation',
  'Burning cleared vegetation',
  'Land tilling',
  'Soil digging',
  'Bed preparation',
  'Ridge making',
  'Mound making',
  'Drainage preparation',
  'Irrigation channel preparation',
  'Field leveling',
  'Plot demarcation',
  'Farm layout',
  'Lowland preparation',
];

// The 7 specific harvesting operations offered when "Harvesting" or "Harvest preparation" is selected.
export const HARVESTING_OPERATIONS = [
  'Selective harvesting',
  'Harvesting cocoa pods',
  'Rubber tapping',
  'Latex collection',
  'Weighing harvested produce',
  'Counting harvested produce',
  'Harvest transportation',
];

export const LIVESTOCK_ACTIVITY_TYPES = [
  'Feeding & Nutrition',
  'Veterinary Care & Vaccination',
  'Deworming & Parasite Treatment',
  'Pen Cleaning & Sanitation',
  'Water Supply & Maintenance',
  'Breeding & Insemination',
  'Birth / Kidding / Calving',
  'Milking & Dairy Handling',
  'Egg Collection & Packaging',
  'Clinical Health Inspection',
  'Animal Tagging & Identification',
  'Pasture & Grazing Management',
  'Quarantine & Isolation',
  'Other livestock operation',
];

export const CROP_UNITS = ['kg', '50kg bags', 'liters', 'tonnes', 'bunches'];
export const LIVESTOCK_UNITS = ['heads', 'doses', 'kg (feed)', 'bales', 'bags', 'litres', 'crates'];

export default function RecordActivityScreen() {
  const router = useRouter();
  const { farmId, initialType } = useLocalSearchParams<{ farmId?: string; initialType?: string }>();
  const { currentFarmer, currentUserProfile, currentRole, refreshPendingSyncCount } = useAppStore();

  const [activeTab, setActiveTab] = useState<'record' | 'log'>('record');
  const [farms, setFarms] = useState<Farm[]>([]);
  const [seasons, setSeasons] = useState<FarmSeason[]>([]);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>(farmId || '');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [bothEnterpriseMode, setBothEnterpriseMode] = useState<'crops' | 'livestock'>('crops');

  const [activityType, setActivityType] = useState(initialType || 'Land preparation');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [cost, setCost] = useState('');
  const [laborCount, setLaborCount] = useState('2');
  const [selectedLandPrepOps, setSelectedLandPrepOps] = useState<string[]>([]);
  const [selectedHarvestOps, setSelectedHarvestOps] = useState<string[]>([]);
  // Choosing from the long lists happens in sheets, so the form behind them never grows.
  const [activitySheetOpen, setActivitySheetOpen] = useState(false);
  const [tasksSheetOpen, setTasksSheetOpen] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  // Weather the farmer saw today: all optional
  const [weatherSky, setWeatherSky] = useState<WeatherSky | null>(null);
  const [rainMm, setRainMm] = useState('');
  const [dayFeel, setDayFeel] = useState<DayFeel | null>(null);
  const [rainError, setRainError] = useState<StringKey | null>(null);
  const [detailActivity, setDetailActivity] = useState<FarmActivity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logFilterCategory, setLogFilterCategory] = useState('All');

  const isHarvestingActivity = (type: string) => {
    const norm = (type || '').toLowerCase();
    return (
      norm === 'harvesting' ||
      norm === 'harvest preparation' ||
      HARVESTING_OPERATIONS.some((op) => op.toLowerCase() === norm)
    );
  };

  const toggleLandPrepOp = (op: string) => {
    setSelectedLandPrepOps((prev) => {
      const exists = prev.includes(op);
      const next = exists ? prev.filter((item) => item !== op) : [...prev, op];

      if (next.length > 0) {
        const autoText = `Land prep: ${next.join(', ')}`;
        if (!description.trim() || description.startsWith('Land prep:')) {
          setDescription(autoText);
        }
      } else if (description.startsWith('Land prep:')) {
        setDescription('');
      }
      return next;
    });
  };

  const toggleHarvestOp = (op: string) => {
    setSelectedHarvestOps((prev) => {
      const exists = prev.includes(op);
      const next = exists ? prev.filter((item) => item !== op) : [...prev, op];

      if (next.length > 0) {
        const autoText = `Harvesting: ${next.join(', ')}`;
        if (!description.trim() || description.startsWith('Harvesting:')) {
          setDescription(autoText);
        }
      } else if (description.startsWith('Harvesting:')) {
        setDescription('');
      }
      return next;
    });
  };

  const loadData = async () => {
    try {
      const [allFarms, allSeasons, allActivities] = await Promise.all([
        localDb.getFarms(),
        localDb.getSeasons(),
        localDb.getActivities(),
      ]);

      const myFarms =
        currentRole === 'farmer' && currentFarmer?.id
          ? allFarms.filter((f) => f.farmer_id === currentFarmer.id)
          : allFarms;
      const myFarmIds = new Set(myFarms.map((f) => f.id));

      const mySeasons = allSeasons.filter((s) => myFarmIds.has(s.farm_id));
      const myActivities = allActivities.filter(
        (a) =>
          (currentFarmer?.id && a.farmer_id === currentFarmer.id) ||
          myFarmIds.has(a.farm_id)
      );

      setFarms(myFarms);
      setSeasons(mySeasons);
      setActivities(myActivities);

      const targetFarmId = selectedFarmId || (myFarms.length > 0 ? myFarms[0].id : '');
      if (targetFarmId) {
        setSelectedFarmId(targetFarmId);
        const f = myFarms.find((x) => x.id === targetFarmId);
        if (f?.farming_type === 'livestock') {
          setActivityType((prev) =>
            LIVESTOCK_ACTIVITY_TYPES.includes(prev) ? prev : 'Feeding & Nutrition'
          );
          setUnit('heads');
        } else if (f?.farming_type === 'crops') {
          setActivityType((prev) =>
            CROP_ACTIVITY_TYPES.includes(prev) ? prev : 'Land preparation'
          );
          setUnit('kg');
        }
      }
    } catch (e) {
      console.error('Failed to load activity data:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentFarmer?.id, currentRole]);

  const selectedFarm = farms.find((f) => f.id === selectedFarmId);
  const farmType = selectedFarm?.farming_type || 'crops';
  const isLivestock =
    farmType === 'livestock' || (farmType === 'both' && bothEnterpriseMode === 'livestock');

  const handleFarmSelect = (farm: Farm) => {
    setSelectedFarmId(farm.id);
    setSelectedSeasonId('');
    if (farm.farming_type === 'livestock') {
      setActivityType('Feeding & Nutrition');
      setUnit('heads');
    } else if (farm.farming_type === 'crops') {
      setActivityType('Land preparation');
      setUnit('kg');
    } else {
      if (bothEnterpriseMode === 'livestock') {
        setActivityType('Feeding & Nutrition');
        setUnit('heads');
      } else {
        setActivityType('Land preparation');
        setUnit('kg');
      }
    }
  };

  const handleToggleBothMode = (mode: 'crops' | 'livestock') => {
    setBothEnterpriseMode(mode);
    setSelectedSeasonId('');
    if (mode === 'livestock') {
      setActivityType('Feeding & Nutrition');
      setUnit('heads');
    } else {
      setActivityType('Land preparation');
      setUnit('kg');
    }
  };

  const currentActivityTypes = isLivestock ? LIVESTOCK_ACTIVITY_TYPES : CROP_ACTIVITY_TYPES;
  const currentUnits = isLivestock ? LIVESTOCK_UNITS : CROP_UNITS;

  // Land preparation and harvesting each come with a checklist of specific tasks.
  const tasksKind = !isLivestock && activityType === 'Land preparation' ? 'land' : !isLivestock && isHarvestingActivity(activityType) ? 'harvest' : null;
  const taskOps: string[] | null = tasksKind === 'land' ? LAND_PREPARATION_OPERATIONS : tasksKind === 'harvest' ? HARVESTING_OPERATIONS : null;
  const selectedTasks = tasksKind === 'land' ? selectedLandPrepOps : tasksKind === 'harvest' ? selectedHarvestOps : [];
  const toggleTask = (op: string) => (tasksKind === 'land' ? toggleLandPrepOp(op) : toggleHarvestOp(op));
  const clearTasks = () => (tasksKind === 'land' ? setSelectedLandPrepOps([]) : setSelectedHarvestOps([]));
  const taskTitle = tasksKind === 'land' ? 'Land preparation tasks' : 'Harvesting tasks';

  const availableSeasons = useMemo(() => {
    if (!selectedFarmId) return [];
    return seasons.filter((s) => {
      if (s.farm_id !== selectedFarmId) return false;
      if (isLivestock) {
        return s.cycle_type === 'livestock' || s.crop?.category === 'Livestock Cycle';
      } else {
        return s.cycle_type !== 'livestock';
      }
    });
  }, [seasons, selectedFarmId, isLivestock]);

  const handleSubmit = async () => {
    if (!currentFarmer?.id) {
      Alert.alert('Farmer Profile Required', 'Please ensure a farmer profile is active.');
      return;
    }
    if (!selectedFarmId) {
      Alert.alert('Farm Required', 'Please select a registered farm.');
      return;
    }
    if (!description.trim() && selectedLandPrepOps.length === 0 && selectedHarvestOps.length === 0) {
      Alert.alert(
        'Details Required',
        activityType === 'Land preparation'
          ? 'Please select at least one land preparation task or enter field observations.'
          : isHarvestingActivity(activityType)
          ? 'Please select at least one harvesting task or enter field observations.'
          : 'Please provide notes or details for this activity.'
      );
      return;
    }

    const weather = validateWeather({ sky: weatherSky, rainMm, dayFeel });
    if (!weather.ok) {
      setRainError((weather.errors.rain_mm as StringKey) || null);
      return;
    }
    setRainError(null);

    setIsSubmitting(true);
    try {
      const finalDesc = description.trim()
        ? description.trim()
        : selectedLandPrepOps.length > 0
        ? `Land prep: ${selectedLandPrepOps.join(', ')}`
        : selectedHarvestOps.length > 0
        ? `Harvesting: ${selectedHarvestOps.join(', ')}`
        : `${activityType} completed.`;

      const newActivity: FarmActivity = {
        id: generateUUID(),
        farmer_id: currentFarmer.id,
        farm_id: selectedFarmId,
        season_id: selectedSeasonId || null,
        activity_type: activityType,
        activity_date: activityDate,
        description: finalDesc,
        quantity: quantity ? parseFloat(quantity) : null,
        unit: quantity ? unit : null,
        cost: cost ? parseFloat(cost) : 0,
        labor_count: laborCount ? parseInt(laborCount, 10) : 1,
        photo_url: null,
        recorded_by: currentUserProfile.id,
        ...weather.values,
        sync_status: 'waiting_to_sync',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await localDb.saveActivity(newActivity, true);
      await refreshPendingSyncCount();
      syncEngine.syncQueue().catch((e) => console.warn('Background auto-sync on activity save:', e));
      await loadData();

      // Clear form inputs
      setDescription('');
      setSelectedLandPrepOps([]);
      setSelectedHarvestOps([]);
      setQuantity('');
      setCost('');
      setWeatherSky(null);
      setRainMm('');
      setDayFeel(null);
      setRainError(null);

      Alert.alert(
        'Activity Recorded Successfully!',
        `"${newActivity.activity_type}" was saved to your device and queued for sync.`,
        [
          {
            text: 'View Activity Log',
            onPress: () => setActiveTab('log'),
          },
          {
            text: 'Record Another',
            style: 'cancel',
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to record activity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const farmLookup = new Map(farms.map((f) => [f.id, f.name]));

  const filteredActivities = activities.filter((a) => {
    if (logFilterCategory === 'All') return true;
    return isLivestock
      ? a.activity_type.toLowerCase() === logFilterCategory.toLowerCase()
      : matchesCategory(a.activity_type, logFilterCategory);
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={activeTab === 'record' ? 'Record Activity' : 'Activity Log'}
        subtitle={
          activeTab === 'record'
            ? 'Log field operations & agronomy'
            : `${activities.length} Recorded ${activities.length === 1 ? 'Operation' : 'Operations'}`
        }
        showBack
      />

      {/* Segmented Tab Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'record' && styles.tabBtnActive]}
          onPress={() => setActiveTab('record')}
        >
          <Ionicons
            name="create-outline"
            size={16}
            color={activeTab === 'record' ? '#FFFFFF' : Colors.textMuted}
          />
          <Text style={[styles.tabBtnText, activeTab === 'record' && styles.tabBtnTextActive]}>
            Record Activity
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'log' && styles.tabBtnActive]}
          onPress={() => setActiveTab('log')}
        >
          <Ionicons
            name="list-outline"
            size={16}
            color={activeTab === 'log' ? '#FFFFFF' : Colors.textMuted}
          />
          <Text style={[styles.tabBtnText, activeTab === 'log' && styles.tabBtnTextActive]}>
            Activity Log ({activities.length})
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content}>
        {activeTab === 'record' ? (
          <>
            {farms.length === 0 ? (
              <Card style={styles.noFarmCard}>
                <View style={styles.noFarmIconWrap}>
                  <Ionicons name="alert-circle-outline" size={36} color={Colors.accent} />
                </View>
                <Text style={styles.noFarmTitle}>No Registered Farm Found</Text>
                <Text style={styles.noFarmDesc}>
                  You need at least one registered farm parcel before recording agronomic
                  activities.
                </Text>
                <Button
                  title="+ Register Your Farm First"
                  onPress={() => router.push('/farm/register' as any)}
                  size="md"
                />
              </Card>
            ) : (
              <>
                {/* 1. Select Farm and Season */}
                <Card style={styles.formCard}>
                  <Text style={styles.sectionTitle}>1. Target Parcel & Season</Text>
                  <Text style={styles.label}>Select Farm Parcel *</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipRow}
                  >
                    {farms.map((f) => {
                      const isSelected = selectedFarmId === f.id;
                      const isFarmLive = f.farming_type === 'livestock';
                      const isFarmBoth = f.farming_type === 'both';
                      return (
                        <TouchableOpacity
                          key={f.id}
                          style={[
                            styles.chip,
                            isSelected && (isFarmLive ? styles.chipActiveLivestock : styles.chipActive),
                          ]}
                          onPress={() => handleFarmSelect(f)}
                        >
                          <Ionicons
                            name={isFarmLive ? 'paw' : isFarmBoth ? 'layers' : 'leaf'}
                            size={13}
                            color={
                              isSelected
                                ? '#FFFFFF'
                                : isFarmLive
                                ? '#D97706'
                                : Colors.primary
                            }
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextActive,
                            ]}
                          >
                            {f.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* AUTO-DETECTED ENTERPRISE NOTICE BANNER */}
                  {selectedFarm && (
                    <View
                      style={[
                        styles.detectionBanner,
                        isLivestock && styles.detectionBannerLivestock,
                      ]}
                    >
                      <View
                        style={[
                          styles.detectionIconWrap,
                          isLivestock && styles.detectionIconWrapLivestock,
                        ]}
                      >
                        <Ionicons
                          name={isLivestock ? 'paw' : farmType === 'both' ? 'layers' : 'leaf'}
                          size={16}
                          color={isLivestock ? '#B45309' : Colors.primaryDark}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.detectionTitle,
                            isLivestock && styles.detectionTitleLivestock,
                          ]}
                        >
                          {farmType === 'livestock'
                            ? `🐐 Livestock Farm: ${selectedFarm.livestock_details?.animal_type || 'Livestock'}`
                            : farmType === 'both'
                            ? `🌱 Integrated Farm: Crops & ${selectedFarm.livestock_details?.animal_type || 'Livestock'}`
                            : `🌾 Crops Farm (${selectedFarm.size} ${selectedFarm.size_unit})`}
                        </Text>
                        <Text
                          style={[
                            styles.detectionSubtitle,
                            isLivestock && styles.detectionSubtitleLivestock,
                          ]}
                        >
                          {isLivestock
                            ? 'Showing livestock operations: feeding, vaccination, pen sanitation & cycle records'
                            : 'Showing crop agronomy: land prep, planting, weeding, fertilizers & crop seasons'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* If the farm is integrated ('both'), display enterprise mode toggle */}
                  {farmType === 'both' && (
                    <View style={styles.bothModeToggleWrap}>
                      <Text style={styles.bothModeLabel}>RECORD OPERATION TYPE FOR THIS PARCEL:</Text>
                      <View style={styles.bothModeRow}>
                        <TouchableOpacity
                          style={[
                            styles.bothModeBtn,
                            bothEnterpriseMode === 'crops' && styles.bothModeBtnActive,
                          ]}
                          onPress={() => handleToggleBothMode('crops')}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="leaf"
                            size={14}
                            color={bothEnterpriseMode === 'crops' ? '#FFFFFF' : Colors.primary}
                          />
                          <Text
                            style={[
                              styles.bothModeBtnText,
                              bothEnterpriseMode === 'crops' && styles.bothModeBtnTextActive,
                            ]}
                          >
                            Crop Agronomy
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.bothModeBtn,
                            bothEnterpriseMode === 'livestock' && styles.bothModeBtnActiveLivestock,
                          ]}
                          onPress={() => handleToggleBothMode('livestock')}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="paw"
                            size={14}
                            color={bothEnterpriseMode === 'livestock' ? '#FFFFFF' : '#D97706'}
                          />
                          <Text
                            style={[
                              styles.bothModeBtnText,
                              bothEnterpriseMode === 'livestock' && styles.bothModeBtnTextActive,
                            ]}
                          >
                            Livestock Care
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {availableSeasons.length > 0 && (
                    <>
                      <Text style={[styles.label, { marginTop: Spacing.sm }]}>
                        {isLivestock
                          ? 'Associated Livestock Production Cycle (Optional)'
                          : 'Associated Crop Season (Optional)'}
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.chipRow}
                      >
                        {availableSeasons.map((s) => (
                          <TouchableOpacity
                            key={s.id}
                            style={[
                              styles.chip,
                              selectedSeasonId === s.id &&
                                (isLivestock ? styles.chipActiveLivestock : styles.chipActive),
                            ]}
                            onPress={() =>
                              setSelectedSeasonId(s.id === selectedSeasonId ? '' : s.id)
                            }
                          >
                            <Ionicons
                              name={isLivestock ? 'paw-outline' : 'leaf-outline'}
                              size={12}
                              color={
                                selectedSeasonId === s.id
                                  ? '#FFFFFF'
                                  : isLivestock
                                  ? '#D97706'
                                  : Colors.primary
                              }
                              style={{ marginRight: 4 }}
                            />
                            <Text
                              style={[
                                styles.chipText,
                                selectedSeasonId === s.id && styles.chipTextActive,
                              ]}
                            >
                              {s.season_name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  )}
                </Card>

                {/* 2. What was done */}
                <Card style={styles.formCard}>
                  <Text style={styles.sectionTitle}>{isLivestock ? '2. Operation' : '2. What did you do?'}</Text>

                  <TouchableOpacity style={styles.pickerRow} activeOpacity={0.8} onPress={() => setActivitySheetOpen(true)}>
                    <View style={[styles.pickerIcon, isLivestock && styles.pickerIconLivestock]}>
                      <Ionicons name={isLivestock ? 'paw' : 'leaf'} size={18} color={isLivestock ? '#B45309' : Colors.primaryDark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerLabel}>{isLivestock ? 'Operation' : 'Activity'}</Text>
                      <Text style={styles.pickerValue} numberOfLines={1}>
                        {activityType}
                      </Text>
                      {!isLivestock && groupOf(activityType) && groupOf(activityType) !== activityType ? (
                        <Text style={styles.pickerHint}>{groupOf(activityType)}</Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>

                  {taskOps ? (
                    <TouchableOpacity
                      style={[styles.pickerRow, { marginTop: Spacing.sm }]}
                      activeOpacity={0.8}
                      onPress={() => setTasksSheetOpen(true)}
                    >
                      <View style={[styles.pickerIcon, tasksKind === 'harvest' && styles.pickerIconHarvest]}>
                        <Ionicons
                          name={tasksKind === 'harvest' ? 'basket-outline' : 'construct-outline'}
                          size={18}
                          color={tasksKind === 'harvest' ? '#92400E' : Colors.primaryDark}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerLabel}>{taskTitle} *</Text>
                        {selectedTasks.length > 0 ? (
                          <View style={styles.tagRow}>
                            {selectedTasks.slice(0, 3).map((t) => (
                              <Text key={t} style={styles.tag} numberOfLines={1}>
                                {t}
                              </Text>
                            ))}
                            {selectedTasks.length > 3 ? <Text style={styles.tag}>{`+${selectedTasks.length - 3} more`}</Text> : null}
                          </View>
                        ) : (
                          <Text style={styles.pickerPlaceholder}>Tap to choose the tasks you did</Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                    </TouchableOpacity>
                  ) : null}

                  <View style={{ marginTop: Spacing.md }}>
                    <DatePickerField
                      label={isLivestock ? 'Operation Date' : 'Activity Date'}
                      value={activityDate}
                      onChange={setActivityDate}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{selectedTasks.length > 0 ? 'Notes (optional)' : 'Notes *'}</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder={isLivestock ? 'e.g. Vaccinated 25 goats and cleaned the pens' : 'e.g. Applied compost along the rice bunds'}
                      placeholderTextColor={Colors.textMuted}
                      multiline
                      numberOfLines={2}
                      value={description}
                      onChangeText={setDescription}
                    />
                  </View>
                </Card>

                <WeatherCard
                  sky={weatherSky}
                  onSky={setWeatherSky}
                  rainMm={rainMm}
                  onRainMm={(v) => {
                    setRainMm(v);
                    if (rainError) setRainError(null);
                  }}
                  rainError={rainError}
                  dayFeel={dayFeel}
                  onDayFeel={setDayFeel}
                />

                {/* 3. Cost, workers and (optionally) materials */}
                <Card style={styles.formCard}>
                  <Text style={styles.sectionTitle}>3. Cost & workers</Text>

                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.xs }]}>
                      <Text style={styles.label}>Cost (USD)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 45"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="numeric"
                        value={cost}
                        onChangeText={setCost}
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.xs }]}>
                      <Text style={styles.label}>Workers</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 2"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="numeric"
                        value={laborCount}
                        onChangeText={setLaborCount}
                      />
                    </View>
                  </View>

                  <TouchableOpacity style={styles.materialsToggle} activeOpacity={0.7} onPress={() => setShowMaterials((v) => !v)}>
                    <Ionicons name={showMaterials ? 'remove-circle-outline' : 'add-circle-outline'} size={18} color={Colors.primary} />
                    <Text style={styles.materialsToggleText}>
                      {showMaterials ? 'Hide materials' : isLivestock ? 'Add animals / feed used (optional)' : 'Add materials used (optional)'}
                    </Text>
                  </TouchableOpacity>

                  {showMaterials ? (
                    <View>
                      <View style={styles.inputRow}>
                        <View style={[styles.inputGroup, { flex: 1.3, marginRight: Spacing.xs }]}>
                          <Text style={styles.label}>{isLivestock ? 'Animals / Quantity' : 'Quantity'}</Text>
                          <TextInput
                            style={styles.input}
                            placeholder={isLivestock ? 'e.g. 25' : 'e.g. 50'}
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="numeric"
                            value={quantity}
                            onChangeText={setQuantity}
                          />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1.1, marginLeft: Spacing.xs }]}>
                          <Text style={styles.label}>Unit</Text>
                          <TextInput
                            style={styles.input}
                            placeholder={isLivestock ? 'heads / doses' : 'kg / bags'}
                            placeholderTextColor={Colors.textMuted}
                            value={unit}
                            onChangeText={setUnit}
                          />
                        </View>
                      </View>
                      <View style={styles.groupChips}>
                        {currentUnits.map((u) => (
                          <TouchableOpacity
                            key={u}
                            style={[styles.unitChip, unit === u && (isLivestock ? styles.unitChipActiveLivestock : styles.unitChipActive)]}
                            onPress={() => setUnit(u)}
                          >
                            <Text style={[styles.unitChipText, unit === u && styles.unitChipTextActive]}>{u}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </Card>

                <Button
                  title={isLivestock ? 'Save Livestock Record' : 'Save Activity Record'}
                  onPress={handleSubmit}
                  size="lg"
                  loading={isSubmitting}
                  icon={<Ionicons name="checkmark-done" size={20} color="#FFFFFF" />}
                />

                {/* Choose the activity: the groups are headings, so a long list stays easy to scan */}
                <BottomSheet
                  visible={activitySheetOpen}
                  title={isLivestock ? 'Choose an operation' : 'Choose an activity'}
                  onClose={() => setActivitySheetOpen(false)}
                >
                  {isLivestock ? (
                    <View style={styles.groupChips}>
                      {LIVESTOCK_ACTIVITY_TYPES.map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[styles.chip, activityType === type && styles.chipActiveLivestock]}
                          onPress={() => {
                            setActivityType(type);
                            setActivitySheetOpen(false);
                          }}
                        >
                          <Text style={[styles.chipText, activityType === type && styles.chipTextActive]}>{type}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    CROP_ACTIVITY_SECTIONS.map((section) => (
                      <View key={section.title || section.items[0]}>
                        {section.title ? <Text style={styles.groupTitle}>{section.title}</Text> : null}
                        <View style={styles.groupChips}>
                          {section.items.map((type) => (
                            <TouchableOpacity
                              key={type}
                              style={[styles.chip, activityType === type && styles.chipActive]}
                              onPress={() => {
                                setActivityType(type);
                                setActivitySheetOpen(false);
                              }}
                            >
                              <Text style={[styles.chipText, activityType === type && styles.chipTextActive]}>{type}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ))
                  )}
                </BottomSheet>

                {/* Choose the tasks: a two-column checklist that scrolls inside the sheet */}
                <BottomSheet
                  visible={tasksSheetOpen && !!taskOps}
                  title={taskTitle}
                  subtitle="Tap every task you completed"
                  onClose={() => setTasksSheetOpen(false)}
                  footer={
                    <>
                      <Button title="Clear" variant="outline" size="md" onPress={clearTasks} style={{ flex: 1 }} />
                      <Button
                        title={selectedTasks.length > 0 ? `Done (${selectedTasks.length})` : 'Done'}
                        size="md"
                        onPress={() => setTasksSheetOpen(false)}
                        style={{ flex: 2 }}
                      />
                    </>
                  }
                >
                  <View style={styles.taskGrid}>
                    {(taskOps || []).map((op) => {
                      const on = selectedTasks.includes(op);
                      return (
                        <TouchableOpacity
                          key={op}
                          style={[styles.taskItem, on && styles.taskItemActive]}
                          onPress={() => toggleTask(op)}
                          activeOpacity={0.75}
                        >
                          <Ionicons name={on ? 'checkbox' : 'square-outline'} size={18} color={on ? '#FFFFFF' : Colors.primaryDark} />
                          <Text style={[styles.taskText, on && styles.taskTextActive]}>{op}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </BottomSheet>
              </>
            )}

            {/* Recent Activities Section */}
            {activities.length > 0 && (
              <View style={styles.recentSection}>
                <View style={styles.recentHeader}>
                  <Text style={styles.recentTitle}>Recent Activity Log</Text>
                  <TouchableOpacity onPress={() => setActiveTab('log')}>
                    <Text style={styles.viewAllText}>View All ({activities.length}) →</Text>
                  </TouchableOpacity>
                </View>

                {activities.slice(0, 3).map((act) => {
                  const isLive = LIVESTOCK_ACTIVITY_TYPES.includes(act.activity_type);
                  return (
                    <TouchableOpacity
                      key={act.id}
                      activeOpacity={0.85}
                      onPress={() => setDetailActivity(act)}
                      accessibilityRole="button"
                      accessibilityLabel={`${act.activity_type}. ${t('tapForDetails')}`}
                    >
                    <Card style={styles.logCardCompact}>
                      <View style={styles.logTopRow}>
                        <View style={[styles.logBadgeWrap, isLive && styles.logBadgeWrapLivestock]}>
                          <Ionicons
                            name={isLive ? 'paw' : 'construct-outline'}
                            size={14}
                            color={isLive ? '#D97706' : Colors.primary}
                          />
                          <Text style={[styles.logBadgeText, isLive && styles.logBadgeTextLivestock]}>
                            {act.activity_type}
                          </Text>
                        </View>
                        <Text style={styles.logDateText}>{act.activity_date}</Text>
                      </View>
                      <Text style={styles.logDescText} numberOfLines={2}>
                        {act.description}
                      </Text>
                      <ActivityWeatherLine activity={act} />
                      <View style={styles.logMetaRow}>
                        <Text style={styles.logFarmText}>
                          📍 {farmLookup.get(act.farm_id) || 'Registered Farm'}
                        </Text>
                        {act.cost ? <Text style={styles.logCostText}>${act.cost}</Text> : null}
                      </View>
                    </Card>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          /* Activity Log Tab */
          <View style={styles.logContainer}>
            {/* Category Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.chipRow, { marginBottom: Spacing.md }]}
            >
              {['All', ...(isLivestock ? currentActivityTypes : CROP_ACTIVITY_FILTERS)].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.chip,
                    logFilterCategory === cat &&
                      (isLivestock ? styles.chipActiveLivestock : styles.chipActive),
                  ]}
                  onPress={() => setLogFilterCategory(cat)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      logFilterCategory === cat && styles.chipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filteredActivities.length === 0 ? (
              <Card style={styles.noFarmCard}>
                <Ionicons name="newspaper-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.noFarmTitle}>No Activity Logs Found</Text>
                <Text style={styles.noFarmDesc}>
                  {logFilterCategory === 'All'
                    ? "You haven't recorded any farm activities yet. Use the 'Record Activity' tab to log your field operations."
                    : `No activities found under "${logFilterCategory}".`}
                </Text>
                <Button
                  title="+ Record First Activity"
                  onPress={() => setActiveTab('record')}
                  size="sm"
                />
              </Card>
            ) : (
              filteredActivities.map((act) => {
                const isLive = LIVESTOCK_ACTIVITY_TYPES.includes(act.activity_type);
                return (
                  <TouchableOpacity
                    key={act.id}
                    activeOpacity={0.85}
                    onPress={() => setDetailActivity(act)}
                    accessibilityRole="button"
                    accessibilityLabel={`${act.activity_type}. ${t('tapForDetails')}`}
                  >
                  <Card style={styles.logCard}>
                    <View style={styles.logTopRow}>
                      <View style={[styles.logBadgeWrap, isLive && styles.logBadgeWrapLivestock]}>
                        <Ionicons
                          name={isLive ? 'paw' : 'construct-outline'}
                          size={14}
                          color={isLive ? '#D97706' : Colors.primary}
                        />
                        <Text style={[styles.logBadgeText, isLive && styles.logBadgeTextLivestock]}>
                          {act.activity_type}
                        </Text>
                      </View>
                      <Text style={styles.logDateText}>{act.activity_date}</Text>
                    </View>

                    <Text style={styles.logFullDesc}>{act.description}</Text>
                    <ActivityWeatherLine activity={act} />

                    <View style={styles.logDetailsGrid}>
                      <View style={styles.logDetailItem}>
                        <Text style={styles.logDetailLabel}>FARM PARCEL</Text>
                        <Text style={styles.logDetailValue}>
                          {farmLookup.get(act.farm_id) || 'Farm Parcel'}
                        </Text>
                      </View>

                      {act.labor_count ? (
                        <View style={styles.logDetailItem}>
                          <Text style={styles.logDetailLabel}>LABOR</Text>
                          <Text style={styles.logDetailValue}>
                            {act.labor_count} {act.labor_count === 1 ? 'Worker' : 'Workers'}
                          </Text>
                        </View>
                      ) : null}

                    {act.cost ? (
                      <View style={styles.logDetailItem}>
                        <Text style={styles.logDetailLabel}>EXPENSE</Text>
                        <Text style={styles.logDetailValue}>${act.cost} USD</Text>
                      </View>
                    ) : null}

                    {act.quantity ? (
                      <View style={styles.logDetailItem}>
                        <Text style={styles.logDetailLabel}>QUANTITY</Text>
                        <Text style={styles.logDetailValue}>
                          {act.quantity} {act.unit || ''}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.logFooterRow}>
                    <View style={styles.syncStatusWrap}>
                      <Ionicons
                        name={
                          act.sync_status === 'synced'
                            ? 'cloud-done-outline'
                            : 'cloud-upload-outline'
                        }
                        size={12}
                        color={act.sync_status === 'synced' ? '#15803D' : Colors.accent}
                      />
                      <Text
                        style={[
                          styles.syncStatusText,
                          {
                            color:
                              act.sync_status === 'synced' ? '#15803D' : Colors.accent,
                          },
                        ]}
                      >
                        {act.sync_status === 'synced' ? 'Synced to Cloud' : 'Queued / Local'}
                      </Text>
                    </View>
                  </View>
                </Card>
                  </TouchableOpacity>
              );
            })
          )}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </KeyboardAwareScrollView>

      <ActivityDetailSheet
        activity={detailActivity}
        farmName={detailActivity ? farmLookup.get(detailActivity.farm_id) : undefined}
        onClose={() => setDetailActivity(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.md,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: Colors.primary,
  },
  tabBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
  },
  noFarmCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  noFarmIconWrap: {
    marginBottom: Spacing.sm,
  },
  noFarmTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  noFarmDesc: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  formCard: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: Typography.sizes.sm,
    color: Colors.text,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
  },
  pickerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerIconLivestock: { backgroundColor: '#FEF3C7' },
  pickerIconHarvest: { backgroundColor: '#FEF3C7' },
  pickerLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' },
  pickerValue: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 1 },
  pickerHint: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  pickerPlaceholder: { fontSize: 14, color: Colors.textMuted, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryDark,
    backgroundColor: Colors.tint,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: 'hidden',
    maxWidth: '100%',
  },
  materialsToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  materialsToggleText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  taskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '48.5%',
    minHeight: 48,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBg,
  },
  taskItemActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  taskText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
  taskTextActive: { color: '#FFFFFF' },
  groupTitle: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
    letterSpacing: 0.3,
  },
  groupChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    marginRight: Spacing.xs,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipActiveLivestock: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  chipText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  unitChip: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    marginRight: 6,
  },
  unitChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  unitChipActiveLivestock: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  unitChipText: {
    fontSize: 11,
    color: Colors.text,
    fontWeight: '600',
  },
  unitChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // Detection banner
  detectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  detectionBannerLivestock: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  detectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  detectionIconWrapLivestock: {
    backgroundColor: '#FEF3C7',
  },
  detectionTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  detectionTitleLivestock: {
    color: '#92400E',
  },
  detectionSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  detectionSubtitleLivestock: {
    color: '#B45309',
  },
  bothModeToggleWrap: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  bothModeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bothModeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  bothModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  bothModeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  bothModeBtnActiveLivestock: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  bothModeBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  bothModeBtnTextActive: {
    color: '#FFFFFF',
  },
  recentSection: {
    marginTop: Spacing.lg,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  recentTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  viewAllText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.primary,
  },
  logCardCompact: {
    marginBottom: Spacing.xs,
    padding: Spacing.sm,
  },
  logTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  logBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    gap: 4,
  },
  logBadgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  logBadgeWrapLivestock: {
    backgroundColor: '#FEF3C7',
  },
  logBadgeTextLivestock: {
    color: '#92400E',
  },
  logDateText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  logDescText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  logMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logFarmText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  logCostText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  logContainer: {
    paddingBottom: Spacing.md,
  },
  logCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  logFullDesc: {
    fontSize: Typography.sizes.sm,
    color: Colors.text,
    lineHeight: 20,
    marginVertical: Spacing.xs,
  },
  logDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.xs,
    marginVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  logDetailItem: {
    minWidth: '40%',
  },
  logDetailLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  logDetailValue: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    color: Colors.text,
  },
  logFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.xs,
  },
  syncStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  syncStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  landPrepContainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    padding: Spacing.md,
    backgroundColor: '#F3F8F1',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E1ECDD',
  },
  landPrepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  landPrepTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  landPrepSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  landPrepGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  landPrepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C9DBC4',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  landPrepChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  landPrepChipText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500',
  },
  landPrepChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  harvestContainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    padding: Spacing.md,
    backgroundColor: '#FFFDF0',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  harvestHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  harvestTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  harvestSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  harvestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  harvestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  harvestChipActive: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  harvestChipText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500',
  },
  harvestChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
