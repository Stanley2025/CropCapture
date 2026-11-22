import React, { useState, useEffect, useMemo } from 'react';
import { KeyboardAwareScrollView } from '../../src/components/KeyboardAwareScrollView';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { localDb, generateUUID } from '../../src/services/storage/localDatabase';
import { VARIETIES_BY_CROP_CODE } from '../../src/shared/seasonRecord';
import { useAppStore } from '../../src/store/useAppStore';
import { Farm, FarmSeason } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { DatePickerField } from '../../src/components/DatePickerField';

const CROPS = [
  {
    id: '11111111-1111-1111-1111-111111111105',
    name: 'Coffee',
    emoji: '☕',
    code: 'COFF',
    category: 'Cash Crop',
    varieties: VARIETIES_BY_CROP_CODE.COFF,
  },
  {
    id: '11111111-1111-1111-1111-111111111104',
    name: 'Cocoa',
    emoji: '🍫',
    code: 'COCO',
    category: 'Cash Crop',
    varieties: VARIETIES_BY_CROP_CODE.COCO,
  },
  {
    id: '11111111-1111-1111-1111-111111111101',
    name: 'Rice',
    emoji: '🌾',
    code: 'RICE',
    category: 'Cereal / Staple',
    varieties: VARIETIES_BY_CROP_CODE.RICE,
  },
  {
    id: '11111111-1111-1111-1111-111111111102',
    name: 'Cassava',
    emoji: '🥔',
    code: 'CASS',
    category: 'Root / Tuber',
    varieties: VARIETIES_BY_CROP_CODE.CASS,
  },
  {
    id: '11111111-1111-1111-1111-111111111110',
    name: 'Oil Palm',
    emoji: '🌴',
    code: 'PALM',
    category: 'Tree Crop',
    varieties: VARIETIES_BY_CROP_CODE.PALM,
  },
  {
    id: '11111111-1111-1111-1111-111111111103',
    name: 'Maize',
    emoji: '🌽',
    code: 'MAIZ',
    category: 'Cereal / Grain',
    varieties: VARIETIES_BY_CROP_CODE.MAIZ,
  },
  {
    id: '11111111-1111-1111-1111-111111111106',
    name: 'Pepper',
    emoji: '🌶️',
    code: 'PEPP',
    category: 'Vegetable / Spice',
    varieties: VARIETIES_BY_CROP_CODE.PEPP,
  },
  {
    id: '11111111-1111-1111-1111-111111111107',
    name: 'Plantain',
    emoji: '🍌',
    code: 'PLAN',
    category: 'Horticulture',
    varieties: VARIETIES_BY_CROP_CODE.PLAN,
  },
  {
    id: '11111111-1111-1111-1111-111111111108',
    name: 'Sweet Potato',
    emoji: '🍠',
    code: 'SPOT',
    category: 'Root / Tuber',
    varieties: VARIETIES_BY_CROP_CODE.SPOT,
  },
  {
    id: '11111111-1111-1111-1111-111111111109',
    name: 'Vegetables',
    emoji: '🥬',
    code: 'VEG',
    category: 'Horticulture',
    varieties: VARIETIES_BY_CROP_CODE.VEG,
  },
];

const LIVESTOCK_SPECIES = [
  { label: 'Goats', emoji: '🐐', defaultBreed: 'West African Dwarf', code: 'GOAT' },
  { label: 'Pigs', emoji: '🐖', defaultBreed: 'Large White / Landrace', code: 'PIGS' },
  { label: 'Sheep', emoji: '🐑', defaultBreed: 'Djallonke (West African Dwarf)', code: 'SHEP' },
  { label: 'Chickens', emoji: '🐔', defaultBreed: 'Local / Broiler / Layer', code: 'CHCK' },
  { label: 'Cow', emoji: '🐄', defaultBreed: 'Ndama / Muturu', code: 'CATT' },
];

const LIVESTOCK_PURPOSES = [
  'Meat production',
  'Egg production',
  'Milk production',
  'Breeding',
];

const MANAGEMENT_SYSTEMS = ['Free-range', 'Semi-intensive', 'Intensive'];

export default function CreateSeasonScreen() {
  const router = useRouter();
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const { currentFarmer, currentRole, refreshPendingSyncCount } = useAppStore();

  const [activeTab, setActiveTab] = useState<'create' | 'log'>('create');
  const [seasons, setSeasons] = useState<FarmSeason[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'crops' | 'livestock'>('all');
  const [selectedLogFarmId, setSelectedLogFarmId] = useState<string>('all');

  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>(farmId || '');

  // Enterprise Cycle Type: 'crops' | 'livestock'
  const [cycleType, setCycleType] = useState<'crops' | 'livestock'>('crops');

  // Crop State
  const [selectedCrop, setSelectedCrop] = useState(CROPS[0]);
  const [selectedVariety, setSelectedVariety] = useState(CROPS[0].varieties[0]);

  // Livestock Cycle State
  const [livestockSpecies, setLivestockSpecies] = useState<'Goats' | 'Pigs' | 'Sheep' | 'Chickens' | 'Cow'>('Goats');
  const [livestockBreed, setLivestockBreed] = useState('West African Dwarf');
  const [livestockHeadCount, setLivestockHeadCount] = useState('25');
  const [livestockPurposes, setLivestockPurposes] = useState<string[]>(['Meat production']);
  const [livestockManagement, setLivestockManagement] = useState('Semi-intensive');

  // Shared Season Schedule & Sizing
  const [seasonName, setSeasonName] = useState('2026 Main Cropping Cycle');
  const [plantingDate, setPlantingDate] = useState(new Date().toISOString().split('T')[0]);
  const [harvestDate, setHarvestDate] = useState('2026-11-30');
  const [cultivatedArea, setCultivatedArea] = useState('3.5');
  const [seedQuantity, setSeedQuantity] = useState('120');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch registered farms and existing active seasons
  useEffect(() => {
    Promise.all([localDb.getFarms(), localDb.getSeasons()]).then(([f, s]) => {
      const myFarms =
        currentRole === 'farmer' && currentFarmer?.id
          ? f.filter((farm) => farm.farmer_id === currentFarmer.id)
          : f;
      const myFarmIds = new Set(myFarms.map((farm) => farm.id));
      const mySeasons = s.filter((season) => myFarmIds.has(season.farm_id));

      setFarms(myFarms);
      setSeasons(mySeasons.length > 0 ? mySeasons : s);

      if (!selectedFarmId && myFarms.length > 0) {
        setSelectedFarmId(myFarms[0].id);
      }
    });
  }, [selectedFarmId, currentFarmer?.id, currentRole]);

  const selectedFarm = farms.find((f) => f.id === selectedFarmId);

  // When selected farm changes, adapt the interface dynamically based on enterprise type
  useEffect(() => {
    if (selectedFarm) {
      if (selectedFarm.farming_type === 'livestock') {
        setCycleType('livestock');
        const primaryAnimal =
          selectedFarm.livestock_details?.selected_animals?.[0] ||
          selectedFarm.livestock_details?.animal_type ||
          'Goats';
        const matched =
          LIVESTOCK_SPECIES.find((s) => s.label === primaryAnimal) || LIVESTOCK_SPECIES[0];

        setLivestockSpecies(matched.label as any);
        setLivestockBreed(selectedFarm.livestock_details?.breed || matched.defaultBreed);
        setLivestockHeadCount(String(selectedFarm.livestock_details?.head_count || '25'));

        if (selectedFarm.livestock_details?.production_purpose?.length) {
          setLivestockPurposes(selectedFarm.livestock_details.production_purpose);
        }
        if (selectedFarm.livestock_details?.management_system) {
          setLivestockManagement(selectedFarm.livestock_details.management_system);
        }
        setSeasonName(`${new Date().getFullYear()} ${matched.label} Production Cycle`);
      } else if (selectedFarm.farming_type === 'crops') {
        setCycleType('crops');
        setSeasonName(`${new Date().getFullYear()} ${selectedCrop.name} (${selectedVariety}) Season`);
      } else if (selectedFarm.farming_type === 'both') {
        // For integrated farm, default to previous choice or crops
        if (cycleType === 'livestock') {
          setSeasonName(`${new Date().getFullYear()} ${livestockSpecies} Production Cycle`);
        } else {
          setSeasonName(`${new Date().getFullYear()} ${selectedCrop.name} (${selectedVariety}) Season`);
        }
      }
    }
  }, [selectedFarmId, selectedFarm]);

  const handleCropChange = (crop: typeof CROPS[0]) => {
    setSelectedCrop(crop);
    setSelectedVariety(crop.varieties[0]);
    setSeasonName(`${new Date().getFullYear()} ${crop.name} (${crop.varieties[0]}) Season`);
  };

  const handleLivestockSpeciesChange = (species: typeof LIVESTOCK_SPECIES[0]) => {
    setLivestockSpecies(species.label as any);
    setLivestockBreed(species.defaultBreed);
    setSeasonName(`${new Date().getFullYear()} ${species.label} (${livestockPurposes[0] || 'Production'}) Cycle`);
  };

  const toggleLivestockPurpose = (purpose: string) => {
    setLivestockPurposes((prev) => {
      const next = prev.includes(purpose)
        ? prev.length > 1
          ? prev.filter((p) => p !== purpose)
          : prev
        : [...prev, purpose];
      setSeasonName(`${new Date().getFullYear()} ${livestockSpecies} (${next[0] || 'Production'}) Cycle`);
      return next;
    });
  };

  const farmLookup = useMemo(() => {
    const map = new Map<string, Farm>();
    farms.forEach((f) => map.set(f.id, f));
    return map;
  }, [farms]);

  const cropSeasonsCount = useMemo(() => {
    return seasons.filter(
      (s) => s.cycle_type !== 'livestock' && s.crop?.category !== 'Livestock Cycle'
    ).length;
  }, [seasons]);

  const livestockCyclesCount = useMemo(() => {
    return seasons.length - cropSeasonsCount;
  }, [seasons, cropSeasonsCount]);

  const filteredSeasons = useMemo(() => {
    return seasons.filter((item) => {
      const isLive =
        item.cycle_type === 'livestock' ||
        item.crop?.category === 'Livestock Cycle' ||
        item.crop_id?.startsWith('livestock-');
      if (logFilter === 'crops' && isLive) return false;
      if (logFilter === 'livestock' && !isLive) return false;
      if (selectedLogFarmId !== 'all' && item.farm_id !== selectedLogFarmId) return false;
      return true;
    });
  }, [seasons, logFilter, selectedLogFarmId]);

  const handleSubmit = async () => {
    if (!selectedFarmId) {
      Alert.alert('Farm Required', 'Please select a farm parcel for this season.');
      return;
    }

    const isLivestockCycle = cycleType === 'livestock';

    if (isLivestockCycle) {
      if (
        !livestockHeadCount.trim() ||
        isNaN(Number(livestockHeadCount)) ||
        Number(livestockHeadCount) <= 0
      ) {
        Alert.alert(
          'Invalid Head Count',
          'Please enter a valid number of animals (head count) for this livestock cycle.'
        );
        return;
      }
      if (livestockPurposes.length === 0) {
        Alert.alert('Required Field', 'Please select at least one production purpose.');
        return;
      }
    } else {
      if (
        !cultivatedArea ||
        isNaN(Number(cultivatedArea)) ||
        Number(cultivatedArea) <= 0
      ) {
        Alert.alert('Invalid Area', 'Please enter a valid cultivated acreage.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const newSeason: FarmSeason = {
        id: generateUUID(),
        farm_id: selectedFarmId,
        crop_id: isLivestockCycle
          ? `livestock-${livestockSpecies.toLowerCase()}`
          : selectedCrop.id,
        crop_variety_id: isLivestockCycle ? livestockBreed : selectedVariety,
        season_name: seasonName.trim(),
        planting_date: plantingDate,
        expected_harvest_date: harvestDate,
        cultivated_area: parseFloat(cultivatedArea) || selectedFarm?.size || 1,
        seed_quantity: isLivestockCycle
          ? parseFloat(livestockHeadCount)
          : seedQuantity
          ? parseFloat(seedQuantity)
          : null,
        status: 'active',
        cycle_type: isLivestockCycle ? 'livestock' : 'crops',
        livestock_type: isLivestockCycle ? livestockSpecies : undefined,
        head_count: isLivestockCycle ? parseInt(livestockHeadCount, 10) : undefined,
        production_purpose: isLivestockCycle ? livestockPurposes : undefined,
        management_system: isLivestockCycle ? livestockManagement : undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        crop: isLivestockCycle
          ? {
              id: `livestock-${livestockSpecies.toLowerCase()}`,
              name: livestockSpecies,
              code: livestockSpecies.substring(0, 4).toUpperCase(),
              category: 'Livestock Cycle',
              default_unit: 'heads',
              is_active: true,
            }
          : {
              id: selectedCrop.id,
              name: selectedCrop.name,
              code: selectedCrop.code,
              category: selectedCrop.category || 'Cash Crop',
              default_unit: 'kg',
              is_active: true,
            },
      };

      await localDb.saveSeason(newSeason, true);
      await refreshPendingSyncCount();

      // Prepend to in-memory seasons log immediately
      setSeasons((prev) => [newSeason, ...prev]);

      Alert.alert(
        isLivestockCycle ? 'Livestock Cycle Activated!' : 'Season Activated!',
        `"${newSeason.season_name}" is now active on your farm parcel.`,
        [
          {
            text: 'View in Seasons Log',
            onPress: () => setActiveTab('log'),
          },
          {
            text: 'Record Activity',
            onPress: () => router.push(`/activity/record?farmId=${selectedFarmId}` as any),
          },
          {
            text: 'Activate Another',
            style: 'cancel',
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save season');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={
          activeTab === 'log'
            ? 'Seasons & Production Cycles'
            : cycleType === 'livestock'
            ? 'New Livestock Cycle'
            : 'New Crop Season'
        }
        subtitle={
          activeTab === 'log'
            ? `${seasons.length} Active & Recorded Cycle${seasons.length === 1 ? '' : 's'}`
            : cycleType === 'livestock'
            ? 'Plan herd/flock production & offtake'
            : 'Plan planting & expected harvest'
        }
        showBack
      />

      {/* Segmented Tab Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'create' &&
              (cycleType === 'livestock'
                ? styles.tabBtnActiveLivestock
                : styles.tabBtnActive),
          ]}
          onPress={() => setActiveTab('create')}
        >
          <Ionicons
            name="add-circle-outline"
            size={16}
            color={activeTab === 'create' ? '#FFFFFF' : Colors.textMuted}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'create' && styles.tabBtnTextActive,
            ]}
          >
            {cycleType === 'livestock' ? 'Activate Cycle' : 'Activate Season'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'log' &&
              (cycleType === 'livestock'
                ? styles.tabBtnActiveLivestock
                : styles.tabBtnActive),
          ]}
          onPress={() => setActiveTab('log')}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={activeTab === 'log' ? '#FFFFFF' : Colors.textMuted}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'log' && styles.tabBtnTextActive,
            ]}
          >
            Seasons Log ({seasons.length})
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content}>
        {activeTab === 'create' ? (
          <>
            {/* ========================================================= */}
            {/* SECTION 1: FARM PARCEL SELECTION */}
            {/* ========================================================= */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>1. Farm Parcel</Text>
          <Text style={styles.label}>Select Registered Farm</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {farms.map((f) => {
              const isSelected = selectedFarmId === f.id;
              const farmType = f.farming_type || 'crops';
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.farmSelectChip, isSelected && styles.farmSelectChipActive]}
                  onPress={() => setSelectedFarmId(f.id)}
                >
                  <View style={styles.farmSelectTop}>
                    <Ionicons
                      name={
                        farmType === 'livestock'
                          ? 'paw'
                          : farmType === 'both'
                          ? 'grid'
                          : 'leaf'
                      }
                      size={14}
                      color={isSelected ? '#FFFFFF' : Colors.primary}
                    />
                    <Text
                      style={[
                        styles.farmSelectText,
                        isSelected && styles.farmSelectTextActive,
                      ]}
                    >
                      {f.name}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.farmSelectSub,
                      isSelected && styles.farmSelectSubActive,
                    ]}
                  >
                    {f.size} {f.size_unit} •{' '}
                    {farmType === 'both'
                      ? 'Crops & Livestock'
                      : farmType === 'livestock'
                      ? 'Livestock Farm'
                      : 'Crops Farm'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* If the farm is integrated (both), allow farmer to choose cycle type */}
          {selectedFarm?.farming_type === 'both' && (
            <View style={styles.bothCycleToggleWrap}>
              <Text style={styles.bothToggleLabel}>
                SELECT CYCLE TYPE FOR THIS INTEGRATED FARM:
              </Text>
              <View style={styles.cycleToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.cycleToggleBtn,
                    cycleType === 'crops' && styles.cycleToggleBtnActive,
                  ]}
                  onPress={() => {
                    setCycleType('crops');
                    setSeasonName(
                      `${new Date().getFullYear()} ${selectedCrop.name} (${selectedVariety}) Season`
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="leaf"
                    size={16}
                    color={cycleType === 'crops' ? '#FFFFFF' : Colors.primary}
                  />
                  <Text
                    style={[
                      styles.cycleToggleBtnText,
                      cycleType === 'crops' && styles.cycleToggleBtnTextActive,
                    ]}
                  >
                    Crop Season
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.cycleToggleBtn,
                    cycleType === 'livestock' && styles.cycleToggleBtnActive,
                  ]}
                  onPress={() => {
                    setCycleType('livestock');
                    setSeasonName(
                      `${new Date().getFullYear()} ${livestockSpecies} Production Cycle`
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="paw"
                    size={16}
                    color={cycleType === 'livestock' ? '#FFFFFF' : '#D97706'}
                  />
                  <Text
                    style={[
                      styles.cycleToggleBtnText,
                      cycleType === 'livestock' && styles.cycleToggleBtnTextActive,
                    ]}
                  >
                    Livestock Cycle
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>

        {/* ========================================================= */}
        {/* SECTION 2A: LIVESTOCK PRODUCTION CYCLE (When Livestock selected) */}
        {/* ========================================================= */}
        {cycleType === 'livestock' ? (
          <Card style={styles.formCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="paw" size={18} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>2. Livestock Production Cycle</Text>
                <Text style={styles.sectionSubtitle}>
                  Species inventory, breed allocation, and purpose
                </Text>
              </View>
            </View>

            {/* Livestock Species Selection */}
            <Text style={styles.label}>Livestock Species *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {LIVESTOCK_SPECIES.map((s) => {
                const isSelected = livestockSpecies === s.label;
                return (
                  <TouchableOpacity
                    key={s.label}
                    style={[styles.cropChip, isSelected && styles.cropChipActive]}
                    onPress={() => handleLivestockSpeciesChange(s)}
                  >
                    <Text style={styles.cropChipEmoji}>{s.emoji}</Text>
                    <Text
                      style={[
                        styles.cropChipText,
                        isSelected && styles.cropChipTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Selected Livestock Banner */}
            <View style={styles.selectedCropBanner}>
              <Text style={styles.selectedCropEmoji}>
                {LIVESTOCK_SPECIES.find((s) => s.label === livestockSpecies)?.emoji}
              </Text>
              <View style={{ flex: 1, marginLeft: Spacing.xs }}>
                <Text style={styles.selectedCropTitle}>
                  {livestockSpecies} Cycle
                </Text>
                <Text style={styles.selectedCropCategory}>
                  Default Breed: {livestockBreed} • System: {livestockManagement}
                </Text>
              </View>
            </View>

            {/* Breed & Head Count */}
            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1.25, marginRight: Spacing.xs }]}>
                <Text style={styles.label}>Breed / Strain</Text>
                <TextInput
                  style={styles.input}
                  value={livestockBreed}
                  onChangeText={setLivestockBreed}
                  placeholder="e.g. West African Dwarf"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 0.85, marginLeft: Spacing.xs }]}>
                <Text style={styles.label}>Head Count (Batch) *</Text>
                <TextInput
                  style={styles.input}
                  value={livestockHeadCount}
                  onChangeText={setLivestockHeadCount}
                  keyboardType="numeric"
                  placeholder="e.g. 25"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            {/* Production Purpose */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Production Purpose *</Text>
              <View style={styles.purposeGrid}>
                {LIVESTOCK_PURPOSES.map((p) => {
                  const isSelected = livestockPurposes.includes(p);
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.purposeChip, isSelected && styles.purposeChipActive]}
                      onPress={() => toggleLivestockPurpose(p)}
                    >
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={14}
                        color={isSelected ? '#FFFFFF' : Colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.purposeChipText,
                          isSelected && styles.purposeChipTextActive,
                        ]}
                      >
                        {p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Management System */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Management System</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {MANAGEMENT_SYSTEMS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, livestockManagement === m && styles.chipActive]}
                    onPress={() => setLivestockManagement(m)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        livestockManagement === m && styles.chipTextActive,
                      ]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Display Name */}
            <View style={[styles.inputGroup, { marginTop: Spacing.xs }]}>
              <Text style={styles.label}>Cycle Display Name</Text>
              <TextInput
                style={styles.input}
                value={seasonName}
                onChangeText={setSeasonName}
                placeholder="e.g. 2026 Goats Breeding Cycle"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </Card>
        ) : (
          /* ========================================================= */
          /* SECTION 2B: CROP SELECTION (When Crop selected) */
          /* ========================================================= */
          <Card style={styles.formCard}>
            <Text style={styles.sectionTitle}>2. Crop Selection</Text>
            <Text style={styles.label}>Crop Catalogue</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {CROPS.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.cropChip, selectedCrop.id === c.id && styles.cropChipActive]}
                  onPress={() => handleCropChange(c)}
                >
                  <Text style={styles.cropChipEmoji}>{c.emoji}</Text>
                  <Text
                    style={[
                      styles.cropChipText,
                      selectedCrop.id === c.id && styles.cropChipTextActive,
                    ]}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Selected Crop Banner */}
            <View style={styles.selectedCropBanner}>
              <Text style={styles.selectedCropEmoji}>{selectedCrop.emoji}</Text>
              <View style={{ flex: 1, marginLeft: Spacing.xs }}>
                <Text style={styles.selectedCropTitle}>
                  {selectedCrop.name} ({selectedCrop.code})
                </Text>
                <Text style={styles.selectedCropCategory}>
                  Category: {selectedCrop.category} • Selected Variety: {selectedVariety}
                </Text>
              </View>
            </View>

            <Text style={[styles.label, { marginTop: Spacing.sm }]}>
              Crop Variety ({selectedCrop.varieties.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {selectedCrop.varieties.map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.chip, selectedVariety === v && styles.chipActive]}
                  onPress={() => {
                    setSelectedVariety(v);
                    setSeasonName(
                      `${new Date().getFullYear()} ${selectedCrop.name} (${v}) Season`
                    );
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedVariety === v && styles.chipTextActive,
                    ]}
                  >
                    {v}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={[styles.inputGroup, { marginTop: Spacing.md }]}>
              <Text style={styles.label}>Season Display Name</Text>
              <TextInput
                style={styles.input}
                value={seasonName}
                onChangeText={setSeasonName}
                placeholder="e.g. 2026 Coffee (Liberica Indigenous) Season"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </Card>
        )}

        {/* ========================================================= */}
        {/* SECTION 3: SCHEDULE & PRODUCTION ALLOCATION */}
        {/* ========================================================= */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>
            {cycleType === 'livestock'
              ? '3. Cycle Schedule & Production Window'
              : '3. Planting Schedule & Cultivation'}
          </Text>

          <DatePickerField
            label={cycleType === 'livestock' ? 'Cycle Start Date' : 'Planting Date'}
            value={plantingDate}
            onChange={setPlantingDate}
            helperText={
              cycleType === 'livestock'
                ? 'Date animals were penned or cycle commenced'
                : 'Date seeds or stems were sown'
            }
          />

          <DatePickerField
            label={
              cycleType === 'livestock'
                ? 'Expected Marketing / Offtake Date'
                : 'Expected Harvest Date'
            }
            value={harvestDate}
            onChange={setHarvestDate}
            helperText={
              cycleType === 'livestock'
                ? 'Estimated maturity, egg production or offtake window'
                : 'Estimated maturity window'
            }
          />

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.xs }]}>
              <Text style={styles.label}>
                {cycleType === 'livestock'
                  ? 'Pasture Allocation (Acres)'
                  : 'Cultivated Area (Acres)'}
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={cultivatedArea}
                onChangeText={setCultivatedArea}
                placeholder="e.g. 3.5"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.xs }]}>
              <Text style={styles.label}>
                {cycleType === 'livestock'
                  ? 'Initial Stock (Heads)'
                  : 'Seed Quantity (kg)'}
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={cycleType === 'livestock' ? livestockHeadCount : seedQuantity}
                onChangeText={
                  cycleType === 'livestock'
                    ? setLivestockHeadCount
                    : setSeedQuantity
                }
                placeholder={cycleType === 'livestock' ? 'e.g. 25' : 'e.g. 120'}
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>
        </Card>

        <Button
          title={
            cycleType === 'livestock'
              ? 'Activate Livestock Cycle'
              : 'Activate Crop Season'
          }
          onPress={handleSubmit}
          size="lg"
          loading={isSubmitting}
          icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
        />

        {/* Recent Seasons & Production Cycles Log Preview */}
        {seasons.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time-outline" size={18} color={Colors.text} />
                <Text style={styles.recentTitle}>Active & Recent Cycles Log</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveTab('log')}>
                <Text style={styles.viewAllText}>See all ({seasons.length}) →</Text>
              </TouchableOpacity>
            </View>

            {seasons.slice(0, 3).map((item) => {
              const itemIsLivestock =
                item.cycle_type === 'livestock' ||
                item.crop?.category === 'Livestock Cycle' ||
                item.crop?.category === 'Livestock' ||
                item.crop_id?.startsWith('livestock-');
              const farmObj = farmLookup.get(item.farm_id);

              return (
                <Card key={item.id} style={styles.recentItemCard}>
                  <View style={styles.recentTopRow}>
                    <View style={styles.recentTitleWrap}>
                      <Text style={styles.recentEmoji}>
                        {itemIsLivestock ? '🐾' : '🌾'}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recentSeasonName} numberOfLines={1}>
                          {item.season_name}
                        </Text>
                        <Text style={styles.recentFarmSubtitle}>
                          {farmObj?.name || 'Farm Parcel'}
                          {farmObj?.county ? ` • ${farmObj.district}, ${farmObj.county}` : ''}
                        </Text>
                      </View>
                    </View>
                    <Badge
                      label={item.status}
                      variant={
                        item.status === 'active'
                          ? 'success'
                          : item.status === 'harvesting'
                          ? 'gold'
                          : 'default'
                      }
                      size="sm"
                    />
                  </View>

                  <View style={styles.recentMetaRow}>
                    <View style={styles.recentMetaBlock}>
                      <Text style={styles.recentMetaLabel}>VARIETY / BREED</Text>
                      <Text style={styles.recentMetaVal}>
                        {item.crop?.name || 'Crop'} ({item.crop_variety_id || 'Standard'})
                      </Text>
                    </View>
                    <View style={styles.recentMetaBlock}>
                      <Text style={styles.recentMetaLabel}>
                        {itemIsLivestock ? 'FLOCK / HERD' : 'CULTIVATED AREA'}
                      </Text>
                      <Text style={styles.recentMetaVal}>
                        {itemIsLivestock
                          ? `${item.head_count || item.seed_quantity || '25'} heads`
                          : `${item.cultivated_area || '1'} acres`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.recentBottomRow}>
                    <Text style={styles.recentDate}>
                      Start: <Text style={{ fontWeight: '700' }}>{item.planting_date}</Text>
                    </Text>
                    {item.expected_harvest_date ? (
                      <Text style={styles.recentDate}>
                        Offtake/Harvest: <Text style={{ fontWeight: '700' }}>{item.expected_harvest_date}</Text>
                      </Text>
                    ) : null}
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </>
    ) : (
      <View style={styles.logContainer}>
        {/* Quick Metrics Bar */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL CYCLES</Text>
            <Text style={styles.statVal}>{seasons.length}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>CROP SEASONS</Text>
            <Text style={[styles.statVal, { color: Colors.primary }]}>
              {cropSeasonsCount}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>LIVESTOCK</Text>
            <Text style={[styles.statVal, { color: '#D97706' }]}>
              {livestockCyclesCount}
            </Text>
          </Card>
        </View>

        {/* Enterprise Filter Pills */}
        <View style={styles.logFilterSection}>
          <Text style={styles.logFilterLabel}>FILTER ENTERPRISE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.logFilterScroll}>
            <TouchableOpacity
              style={[styles.logFilterPill, logFilter === 'all' && styles.logFilterPillActive]}
              onPress={() => setLogFilter('all')}
            >
              <Text style={[styles.logFilterText, logFilter === 'all' && styles.logFilterTextActive]}>
                All Cycles ({seasons.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.logFilterPill, logFilter === 'crops' && styles.logFilterPillActive]}
              onPress={() => setLogFilter('crops')}
            >
              <Ionicons
                name="leaf-outline"
                size={14}
                color={logFilter === 'crops' ? '#FFFFFF' : Colors.primary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.logFilterText, logFilter === 'crops' && styles.logFilterTextActive]}>
                Crop Seasons ({cropSeasonsCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.logFilterPill, logFilter === 'livestock' && styles.logFilterPillActiveLive]}
              onPress={() => setLogFilter('livestock')}
            >
              <Ionicons
                name="paw"
                size={14}
                color={logFilter === 'livestock' ? '#FFFFFF' : '#D97706'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[styles.logFilterText, logFilter === 'livestock' && styles.logFilterTextActive]}
              >
                Livestock Cycles ({livestockCyclesCount})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Filter by Farm (if multiple farms) */}
        {farms.length > 1 && (
          <View style={[styles.logFilterSection, { marginTop: 6 }]}>
            <Text style={styles.logFilterLabel}>FILTER BY FARM</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.logFilterScroll}>
              <TouchableOpacity
                style={[
                  styles.logFarmChip,
                  selectedLogFarmId === 'all' && styles.logFarmChipActive,
                ]}
                onPress={() => setSelectedLogFarmId('all')}
              >
                <Text
                  style={[
                    styles.logFarmChipText,
                    selectedLogFarmId === 'all' && styles.logFarmChipTextActive,
                  ]}
                >
                  All Farms
                </Text>
              </TouchableOpacity>
              {farms.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.logFarmChip,
                    selectedLogFarmId === f.id && styles.logFarmChipActive,
                  ]}
                  onPress={() => setSelectedLogFarmId(f.id)}
                >
                  <Text
                    style={[
                      styles.logFarmChipText,
                      selectedLogFarmId === f.id && styles.logFarmChipTextActive,
                    ]}
                  >
                    {f.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* List of Seasons and Cycles */}
        {filteredSeasons.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Seasons or Cycles Found</Text>
            <Text style={styles.emptySub}>
              {logFilter === 'all'
                ? "You haven't activated any crop seasons or livestock cycles yet. Use the 'Activate' tab to start your first production cycle."
                : `No cycles found under "${logFilter === 'crops' ? 'Crop Seasons' : 'Livestock Cycles'}".`}
            </Text>
            <Button
              title="+ Activate First Cycle"
              onPress={() => setActiveTab('create')}
              size="sm"
              style={{ marginTop: Spacing.sm }}
            />
          </Card>
        ) : (
          filteredSeasons.map((item) => {
            const itemIsLivestock =
              item.cycle_type === 'livestock' ||
              item.crop?.category === 'Livestock Cycle' ||
              item.crop?.category === 'Livestock' ||
              item.crop_id?.startsWith('livestock-');

            const farmObj = farmLookup.get(item.farm_id);
            const isHarvesting = item.status === 'harvesting';
            const isActive = item.status === 'active';

            return (
              <Card key={item.id} style={styles.logSeasonCard}>
                {/* Header: Enterprise Badge & Status */}
                <View style={styles.logCardHeader}>
                  <View
                    style={[
                      styles.logBadgeWrap,
                      itemIsLivestock && styles.logBadgeWrapLivestock,
                    ]}
                  >
                    <Ionicons
                      name={itemIsLivestock ? 'paw' : 'leaf'}
                      size={14}
                      color={itemIsLivestock ? '#D97706' : Colors.primary}
                    />
                    <Text
                      style={[
                        styles.logBadgeText,
                        itemIsLivestock && styles.logBadgeTextLivestock,
                      ]}
                    >
                      {itemIsLivestock ? 'Livestock Cycle' : 'Crop Season'}
                    </Text>
                  </View>

                  <Badge
                    label={item.status}
                    variant={isHarvesting ? 'gold' : isActive ? 'success' : 'default'}
                    size="sm"
                  />
                </View>

                {/* Season Title & Farm */}
                <View style={styles.logTitleBlock}>
                  <Text style={styles.logSeasonTitle}>
                    {itemIsLivestock ? '🐾 ' : '🌾 '}
                    {item.season_name}
                  </Text>
                  <Text style={styles.logVarietyText}>
                    {item.crop?.name || 'Crop'} • {item.crop_variety_id || 'Standard Variety'}
                    {item.crop?.category ? ` (${item.crop.category})` : ''}
                  </Text>
                  <Text style={styles.logFarmText}>
                    {farmObj?.name || 'Farm Parcel'}
                    {farmObj?.county ? ` • ${farmObj.district}, ${farmObj.county}` : ''}
                  </Text>
                </View>

                {/* 4-Item Grid */}
                <View style={styles.logMetaGrid}>
                  <View style={styles.logMetaItem}>
                    <Text style={styles.logMetaLabel}>START / PLANTING</Text>
                    <Text style={styles.logMetaValue}>{item.planting_date}</Text>
                  </View>

                  <View style={styles.logMetaItem}>
                    <Text style={styles.logMetaLabel}>EXPECTED HARVEST</Text>
                    <Text style={styles.logMetaValue}>
                      {item.expected_harvest_date || 'Ongoing'}
                    </Text>
                  </View>

                  <View style={styles.logMetaItem}>
                    <Text style={styles.logMetaLabel}>
                      {itemIsLivestock ? 'HERD / FLOCK SIZE' : 'CULTIVATED ACRES'}
                    </Text>
                    <Text style={styles.logMetaValue}>
                      {itemIsLivestock
                        ? `${item.head_count || item.seed_quantity || '25'} heads`
                        : `${item.cultivated_area || '1'} acres`}
                    </Text>
                  </View>

                  <View style={styles.logMetaItem}>
                    <Text style={styles.logMetaLabel}>
                      {itemIsLivestock ? 'PRIMARY PURPOSE' : 'SEED SOWN'}
                    </Text>
                    <Text style={styles.logMetaValue} numberOfLines={1}>
                      {itemIsLivestock
                        ? item.production_purpose?.[0] || 'Meat production'
                        : item.seed_quantity
                        ? `${item.seed_quantity} kg seeds`
                        : 'Standard sowing'}
                    </Text>
                  </View>
                </View>

                {/* Livestock Extra Tags */}
                {itemIsLivestock && (
                  <View style={styles.logPillsRow}>
                    {item.management_system && (
                      <View style={styles.logPill}>
                        <Ionicons name="shield-outline" size={11} color={Colors.textMuted} />
                        <Text style={styles.logPillText}>{item.management_system}</Text>
                      </View>
                    )}
                    {item.production_purpose?.map((p) => (
                      <View key={p} style={[styles.logPill, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[styles.logPillText, { color: '#92400E' }]}>{p}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Action Shortcuts Footer */}
                <View style={styles.logCardFooter}>
                  <TouchableOpacity
                    style={styles.logActionBtn}
                    onPress={() =>
                      router.push(`/activity/record?farmId=${item.farm_id}` as any)
                    }
                  >
                    <Ionicons name="clipboard-outline" size={14} color={Colors.primary} />
                    <Text style={styles.logActionBtnText}>Record Activity</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.logActionBtn, { backgroundColor: '#FFFBEB' }]}
                    onPress={() =>
                      router.push(`/harvest/register?farmId=${item.farm_id}` as any)
                    }
                  >
                    <Ionicons name="basket-outline" size={14} color="#D97706" />
                    <Text style={[styles.logActionBtnText, { color: '#B45309' }]}>
                      {itemIsLivestock ? 'Register Offtake' : 'Register Harvest'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })
        )}
      </View>
    )}

        <View style={{ height: Spacing.xxl }} />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
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
  sectionSubtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 1,
    marginBottom: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
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
  chipRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  chip: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    marginRight: Spacing.xs,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  cropChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    marginRight: Spacing.xs,
  },
  cropChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  cropChipEmoji: {
    fontSize: 16,
  },
  cropChipText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text,
    fontWeight: '700',
  },
  cropChipTextActive: {
    color: '#FFFFFF',
  },
  selectedCropBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginVertical: Spacing.xs + 2,
  },
  selectedCropEmoji: {
    fontSize: 24,
  },
  selectedCropTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  selectedCropCategory: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  // Farm Select Chips
  farmSelectChip: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: Spacing.xs,
  },
  farmSelectChipActive: {
    backgroundColor: '#065F46',
    borderColor: '#065F46',
  },
  farmSelectTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  farmSelectText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  farmSelectTextActive: {
    color: '#FFFFFF',
  },
  farmSelectSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  farmSelectSubActive: {
    color: '#A7F3D0',
  },
  // Both Cycle Toggle
  bothCycleToggleWrap: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  bothToggleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  cycleToggleRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  cycleToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cycleToggleBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  cycleToggleBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  cycleToggleBtnTextActive: {
    color: '#FFFFFF',
  },
  // Purpose Grid for Livestock Season
  purposeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  purposeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  purposeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  purposeChipText: {
    fontSize: 11,
    color: Colors.text,
    fontWeight: '600',
  },
  purposeChipTextActive: {
    color: '#FFFFFF',
  },
  // Tab Switcher Styles
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
  },
  tabBtnActive: {
    backgroundColor: Colors.primary,
  },
  tabBtnActiveLivestock: {
    backgroundColor: '#D97706',
  },
  tabBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  // Recent Cycles Preview Section
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
  recentItemCard: {
    marginBottom: Spacing.xs,
    padding: Spacing.sm,
  },
  recentTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  recentTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.xs,
    gap: 6,
  },
  recentEmoji: {
    fontSize: 20,
  },
  recentSeasonName: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  recentFarmSubtitle: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  recentMetaRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    padding: 6,
    marginVertical: 4,
    gap: Spacing.sm,
  },
  recentMetaBlock: {
    flex: 1,
  },
  recentMetaLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 1,
  },
  recentMetaVal: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
  },
  recentBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  recentDate: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  // Seasons Log Tab Styles
  logContainer: {
    paddingBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  statVal: {
    fontSize: Typography.sizes.md,
    fontWeight: '800',
    color: Colors.text,
  },
  logFilterSection: {
    marginBottom: Spacing.xs,
  },
  logFilterLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  logFilterScroll: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  logFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    marginRight: Spacing.xs,
  },
  logFilterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  logFilterPillActiveLive: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  logFilterText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    color: Colors.text,
  },
  logFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  logFarmChip: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.md,
    marginRight: 6,
  },
  logFarmChipActive: {
    backgroundColor: '#E0E7FF',
    borderColor: '#6366F1',
  },
  logFarmChipText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  logFarmChipTextActive: {
    color: '#4338CA',
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    marginTop: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  logSeasonCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
  },
  logCardHeader: {
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
  logBadgeWrapLivestock: {
    backgroundColor: '#FEF3C7',
  },
  logBadgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  logBadgeTextLivestock: {
    color: '#92400E',
  },
  logTitleBlock: {
    marginBottom: Spacing.xs,
  },
  logSeasonTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  logVarietyText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    color: Colors.primaryDark,
    marginBottom: 1,
  },
  logFarmText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  logMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.xs,
    marginVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  logMetaItem: {
    minWidth: '45%',
    flex: 1,
  },
  logMetaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 1,
  },
  logMetaValue: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    color: Colors.text,
  },
  logPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
    marginBottom: Spacing.xs,
  },
  logPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  logPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  logCardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  logActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: Radius.sm,
  },
  logActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
});
