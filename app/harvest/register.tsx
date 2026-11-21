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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import {
  localDb,
  generateUUID,
  generateBatchReference,
} from '../../src/services/storage/localDatabase';
import { useAppStore } from '../../src/store/useAppStore';
import { generateQrToken } from '../../src/shared/farmRecords';
import { toKg } from '../../src/shared/seasonRecord';
import { Farm, FarmSeason, HarvestBatch } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { DatePickerField } from '../../src/components/DatePickerField';
import { newPublicCode } from '../../src/constants/buyerLink';

// Local units (cups, tins, bags) are accepted and converted to kg (see src/shared/seasonRecord.js).
const CROP_UNITS = ['kg', 'tonnes', '50kg bags', 'cups', 'tins', 'bunches'];
const LIVESTOCK_UNITS = ['heads', 'animals', 'crates / trays', 'litres', 'kg (meat)'];

const LIVESTOCK_SPECIES = [
  { id: 'Goats', label: 'Goats', emoji: '🐐', defaultUnit: 'heads' },
  { id: 'Pigs', label: 'Pigs', emoji: '🐖', defaultUnit: 'heads' },
  { id: 'Sheep', label: 'Sheep', emoji: '🐑', defaultUnit: 'heads' },
  { id: 'Chickens', label: 'Chickens', emoji: '🐔', defaultUnit: 'crates / trays' },
  { id: 'Cow', label: 'Cow', emoji: '🐄', defaultUnit: 'heads' },
];

const LIVESTOCK_OFFTAKE_TYPES = [
  { id: 'Live Animal Offtake', label: 'Live Animal Offtake', icon: 'paw', unit: 'heads' },
  { id: 'Meat / Carcass', label: 'Meat / Slaughter', icon: 'restaurant', unit: 'kg (meat)' },
  { id: 'Eggs / Crates', label: 'Eggs / Poultry', icon: 'egg', unit: 'crates / trays' },
  { id: 'Dairy / Milk', label: 'Dairy / Milk', icon: 'water', unit: 'litres' },
  { id: 'Breeding Stock', label: 'Breeding Stock', icon: 'git-network', unit: 'heads' },
];

export default function RegisterHarvestScreen() {
  const router = useRouter();
  const { currentFarmer, refreshPendingSyncCount } = useAppStore();

  const [activeTab, setActiveTab] = useState<'register' | 'log'>('register');
  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'crops' | 'livestock'>('all');
  const [selectedLogFarmId, setSelectedLogFarmId] = useState<string>('all');

  const [farms, setFarms] = useState<Farm[]>([]);
  const [seasons, setSeasons] = useState<FarmSeason[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedSeasonId, setSelectedSeasonId] = useState('');

  // For integrated farms ('both'), toggle between crop harvest and livestock offtake
  const [bothEnterpriseMode, setBothEnterpriseMode] = useState<'crops' | 'livestock'>('crops');

  // Livestock Specific Harvest State
  const [selectedAnimalSpecies, setSelectedAnimalSpecies] = useState('Goats');
  const [offtakeType, setOfftakeType] = useState('Live Animal Offtake');

  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [totalValue, setTotalValue] = useState('');
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split('T')[0]);
  const [storageLocation, setStorageLocation] = useState(
    'Central Cooperative Warehouse, Sanniquellie'
  );
  const [observations, setObservations] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load farms, seasons, and harvest records for the active farmer
  useEffect(() => {
    Promise.all([localDb.getFarms(), localDb.getSeasons(), localDb.getHarvests()]).then(
      ([f, s, h]) => {
        const myFarms = currentFarmer?.id
          ? f.filter((farm) => farm.farmer_id === currentFarmer.id)
          : f;
        const myFarmIds = new Set(myFarms.map((farm) => farm.id));
        const myHarvests = h.filter(
          (batch) =>
            (currentFarmer?.id && batch.farmer_id === currentFarmer.id) ||
            myFarmIds.has(batch.farm_id)
        );

        setFarms(myFarms);
        setSeasons(s);
        setHarvests(myHarvests);

        if (myFarms.length > 0) {
          const first = myFarms[0];
          setSelectedFarmId(first.id);
          if (first.farming_type === 'livestock') {
            setUnit('heads');
          } else {
            setUnit('kg');
          }
        }
      }
    );
  }, [currentFarmer?.id]);

  const selectedFarm = farms.find((f) => f.id === selectedFarmId);

  // System auto-detects enterprise type from selected farm
  const farmType = selectedFarm?.farming_type || 'crops';
  const isLivestock =
    farmType === 'livestock' || (farmType === 'both' && bothEnterpriseMode === 'livestock');

  // Filter seasons relevant to the selected farm and detected enterprise
  const farmSeasons = useMemo(() => {
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

  // When selected farm changes, auto-adapt unit, seasons, and defaults
  const handleFarmSelect = (farm: Farm) => {
    setSelectedFarmId(farm.id);
    if (farm.farming_type === 'livestock' || farm.farming_type === 'both') {
      const liveDetails = farm.livestock_details;
      if (liveDetails?.selected_animals && liveDetails.selected_animals.length > 0) {
        setSelectedAnimalSpecies(liveDetails.selected_animals[0]);
      } else if (liveDetails?.animal_type) {
        const first = liveDetails.animal_type.split(',')[0].trim();
        if (first) setSelectedAnimalSpecies(first);
      }
    }

    if (farm.farming_type === 'livestock') {
      setUnit('heads');
      setStorageLocation('Farm Holding Paddock, Sanniquellie');
    } else if (farm.farming_type === 'crops') {
      setUnit('kg');
      setStorageLocation('Central Cooperative Warehouse, Sanniquellie');
    } else if (farm.farming_type === 'both') {
      if (bothEnterpriseMode === 'livestock') {
        setUnit('heads');
        setStorageLocation('Farm Holding Paddock, Sanniquellie');
      } else {
        setUnit('kg');
        setStorageLocation('Central Cooperative Warehouse, Sanniquellie');
      }
    }

    // Set first matching season
    const matching = seasons.filter((s) => s.farm_id === farm.id);
    if (matching.length > 0) {
      setSelectedSeasonId(matching[0].id);
    } else {
      setSelectedSeasonId('');
    }
  };

  // Toggle for integrated farm
  const handleToggleBothMode = (mode: 'crops' | 'livestock') => {
    setBothEnterpriseMode(mode);
    if (mode === 'livestock') {
      setUnit('heads');
      setStorageLocation('Farm Holding Paddock, Sanniquellie');
    } else {
      setUnit('kg');
      setStorageLocation('Central Cooperative Warehouse, Sanniquellie');
    }
  };

  const selectedSeason = farmSeasons.find((s) => s.id === selectedSeasonId);

  const farmLookup = useMemo(() => {
    const map = new Map<string, Farm>();
    farms.forEach((f) => map.set(f.id, f));
    return map;
  }, [farms]);

  const cropHarvestCount = useMemo(() => {
    return harvests.filter((item) => {
      const itemIsLivestock =
        item.crop?.category === 'Livestock Offtake' ||
        item.crop?.category === 'Livestock Cycle' ||
        item.crop?.category === 'Livestock' ||
        item.crop_id?.startsWith('livestock-') ||
        ['heads', 'animals', 'crates / trays', 'litres', 'kg (meat)'].includes(item.unit);
      return !itemIsLivestock;
    }).length;
  }, [harvests]);

  const livestockHarvestCount = useMemo(() => {
    return harvests.length - cropHarvestCount;
  }, [harvests, cropHarvestCount]);

  const totalYieldValue = useMemo(() => {
    return harvests.reduce((acc, h) => acc + (Number(h.total_value) || 0), 0);
  }, [harvests]);

  const filteredHarvests = useMemo(() => {
    return harvests.filter((item) => {
      const itemIsLivestock =
        item.crop?.category === 'Livestock Offtake' ||
        item.crop?.category === 'Livestock Cycle' ||
        item.crop?.category === 'Livestock' ||
        item.crop_id?.startsWith('livestock-') ||
        ['heads', 'animals', 'crates / trays', 'litres', 'kg (meat)'].includes(item.unit);

      if (logFilter === 'crops' && itemIsLivestock) return false;
      if (logFilter === 'livestock' && !itemIsLivestock) return false;
      if (selectedLogFarmId !== 'all' && item.farm_id !== selectedLogFarmId) return false;
      return true;
    });
  }, [harvests, logFilter, selectedLogFarmId]);

  const handleSubmit = async () => {
    if (!selectedFarmId) {
      Alert.alert('Farm Required', 'Please select a registered farm.');
      return;
    }
    if (!quantity.trim() || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      Alert.alert(
        'Invalid Quantity',
        isLivestock
          ? 'Please enter a valid number of animals or offtake yield.'
          : 'Please enter a valid harvest yield amount.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const animalType = isLivestock ? selectedAnimalSpecies : 'Goats';
      const cropCode = isLivestock
        ? selectedSeason?.crop?.code ||
          animalType.substring(0, 4).toUpperCase() ||
          'LIVE'
        : selectedSeason?.crop?.code || 'CROP';

      const kgConversion = toKg({ quantity: parseFloat(quantity), unit, cropCode: selectedSeason?.crop?.code });
      const batchReference = generateBatchReference(cropCode);
      const randomToken = generateQrToken();

      const newHarvest: HarvestBatch = {
        id: generateUUID(),
        batch_reference: batchReference,
        farmer_id: currentFarmer?.id || 'FARMER-001',
        farm_id: selectedFarmId,
        season_id: selectedSeasonId || null,
        crop_id: isLivestock
          ? selectedSeason?.crop_id || `livestock-${animalType.toLowerCase()}`
          : selectedSeason?.crop_id || '11111111-1111-1111-1111-111111111101',
        crop_variety_id: isLivestock
          ? selectedSeason?.crop_variety_id || selectedFarm?.livestock_details?.breed || 'Standard Breed'
          : selectedSeason?.crop_variety_id || 'Standard Variety',
        harvest_date: harvestDate,
        quantity: parseFloat(quantity),
        unit,
        // Quantity in kg, converted from the local unit (null for units with no weight, e.g. bunches).
        quantity_kg: isLivestock ? null : kgConversion ? kgConversion.kg : null,
        kg_per_unit: isLivestock ? null : kgConversion ? kgConversion.kgPerUnit : null,
        total_value: totalValue.trim() && !isNaN(Number(totalValue)) ? parseFloat(totalValue) : null,
        unit_price:
          totalValue.trim() && !isNaN(Number(totalValue)) && parseFloat(quantity) > 0
            ? parseFloat(totalValue) / parseFloat(quantity)
            : null,
        storage_location: storageLocation.trim(),
        photo_url: isLivestock
          ? 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=600&q=80'
          : 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
        observations:
          observations.trim() ||
          (isLivestock
            ? `${selectedAnimalSpecies} (${offtakeType}) offtaken in healthy condition, inspected and vaccinated.`
            : 'Harvest gathered and bagged in clean dry condition.'),
        status: 'submitted',
        qr_token: randomToken,
        public_code: newPublicCode(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        crop: isLivestock
          ? selectedSeason?.crop || {
              id: `livestock-${animalType.toLowerCase()}`,
              name: animalType,
              code: cropCode,
              category: 'Livestock Offtake',
              default_unit: 'heads',
              is_active: true,
            }
          : selectedSeason?.crop || {
              id: '11111111-1111-1111-1111-111111111101',
              name: 'Rice',
              code: 'RICE',
              category: 'Cereal',
              default_unit: 'kg',
              is_active: true,
            },
        farm: selectedFarm,
      };

      await localDb.saveHarvest(newHarvest, true);
      await refreshPendingSyncCount();

      // Immediately prepend to in-memory harvests log
      setHarvests((prev) => [newHarvest, ...prev]);

      // Reset numerical inputs for clean successive entry
      setQuantity('');
      setTotalValue('');
      setObservations('');

      Alert.alert(
        isLivestock ? 'Livestock Offtake Registered!' : 'Harvest Batch Registered!',
        `Assigned Batch Reference:\n\n${newHarvest.batch_reference}\n\nStatus: Submitted for Quality Inspection. A unique QR verification passport has been generated.`,
        [
          {
            text: 'View in Harvest Log',
            onPress: () => setActiveTab('log'),
          },
          {
            text: isLivestock ? 'View Batch & QR' : 'Add photos for buyers',
            onPress: () => router.push(`/harvest/${newHarvest.id}` as any),
          },
          {
            text: 'Register Another',
            style: 'cancel',
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to register harvest');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={
          activeTab === 'log'
            ? 'Harvest & Offtake Log'
            : isLivestock
            ? 'Register Livestock Offtake'
            : 'Register Harvest'
        }
        subtitle={
          activeTab === 'log'
            ? `${harvests.length} Recorded Batch${harvests.length === 1 ? '' : 'es'}`
            : isLivestock
            ? 'Assign batch reference & QR passport for animals/yield'
            : 'Assign unique batch reference & QR'
        }
        showBack
      />

      {/* Segmented Navigation Tab Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'register' &&
              (isLivestock ? styles.tabBtnActiveLivestock : styles.tabBtnActive),
          ]}
          onPress={() => setActiveTab('register')}
        >
          <Ionicons
            name="create-outline"
            size={16}
            color={activeTab === 'register' ? '#FFFFFF' : Colors.textMuted}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'register' && styles.tabBtnTextActive,
            ]}
          >
            {isLivestock ? 'Register Offtake' : 'Register Harvest'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'log' &&
              (isLivestock ? styles.tabBtnActiveLivestock : styles.tabBtnActive),
          ]}
          onPress={() => setActiveTab('log')}
        >
          <Ionicons
            name="list-outline"
            size={16}
            color={activeTab === 'log' ? '#FFFFFF' : Colors.textMuted}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'log' && styles.tabBtnTextActive,
            ]}
          >
            Harvest Log ({harvests.length})
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content}>
        {activeTab === 'register' ? (
          <>
            {/* ========================================================= */}
            {/* SECTION 1: FARM PARCEL & ENTERPRISE AUTO-DETECTION */}
        {/* ========================================================= */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>
            {isLivestock ? '1. Livestock Farm & Production Cycle' : '1. Farm & Crop Season'}
          </Text>

          <Text style={styles.label}>Select Farm Parcel *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
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
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isFarmLive ? 'paw' : isFarmBoth ? 'layers' : 'leaf'}
                    size={14}
                    color={
                      isSelected
                        ? '#FFFFFF'
                        : isFarmLive
                        ? '#D97706'
                        : Colors.primary
                    }
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
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
                    ? `🐐 Livestock Farm Detected: ${selectedFarm.livestock_details?.animal_type || 'Livestock'}`
                    : farmType === 'both'
                    ? `🌱 Integrated Farm Detected: Crops & ${selectedFarm.livestock_details?.animal_type || 'Livestock'}`
                    : `🌾 Crops Farm Detected (${selectedFarm.size} ${selectedFarm.size_unit})`}
                </Text>
                <Text
                  style={[
                    styles.detectionSubtitle,
                    isLivestock && styles.detectionSubtitleLivestock,
                  ]}
                >
                  {isLivestock
                    ? 'Configured for live animal offtake, flock yields, crates, and head count'
                    : 'Configured for grain, root, vegetable, and cash crop harvest yields'}
                </Text>
              </View>
            </View>
          )}

          {/* If the farm is integrated ('both'), display enterprise mode toggle */}
          {farmType === 'both' && (
            <View style={styles.bothModeToggleWrap}>
              <Text style={styles.bothModeLabel}>RECORD HARVEST TYPE FOR THIS PARCEL:</Text>
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
                    size={15}
                    color={bothEnterpriseMode === 'crops' ? '#FFFFFF' : Colors.primary}
                  />
                  <Text
                    style={[
                      styles.bothModeBtnText,
                      bothEnterpriseMode === 'crops' && styles.bothModeBtnTextActive,
                    ]}
                  >
                    Crop Harvest
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
                    size={15}
                    color={bothEnterpriseMode === 'livestock' ? '#FFFFFF' : '#D97706'}
                  />
                  <Text
                    style={[
                      styles.bothModeBtnText,
                      bothEnterpriseMode === 'livestock' && styles.bothModeBtnTextActive,
                    ]}
                  >
                    Livestock Offtake
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={[styles.label, { marginTop: Spacing.sm }]}>
            {isLivestock ? 'Associated Livestock Cycle' : 'Associated Season'}
          </Text>
          {farmSeasons.length === 0 ? (
            <View style={styles.noSeasonBanner}>
              <Text style={styles.noSeasonText}>
                {isLivestock
                  ? `Standard ${selectedFarm?.livestock_details?.animal_type || 'Livestock'} Production Cycle`
                  : 'No active season linked (standard parcel harvest)'}
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {farmSeasons.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.chip,
                    selectedSeasonId === s.id &&
                      (isLivestock ? styles.chipActiveLivestock : styles.chipActive),
                  ]}
                  onPress={() => setSelectedSeasonId(s.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedSeasonId === s.id && styles.chipTextActive,
                    ]}
                  >
                    {s.season_name} ({s.crop?.name || (isLivestock ? 'Livestock' : 'Crop')})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Card>

        {/* ========================================================= */}
        {/* SECTION 2: YIELD & OFFTAKE QUANTITY */}
        {/* ========================================================= */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>
            {isLivestock ? '2. Livestock Offtake & Yield Batch' : '2. Harvest Yield & Date'}
          </Text>

          {/* Animal Species & Offtake Type Selection (Livestock Only) */}
          {isLivestock && (
            <View style={{ marginBottom: Spacing.md }}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.label}>Animal Species / Product *</Text>
                <Badge label={selectedAnimalSpecies} variant="warning" size="sm" />
              </View>
              <View style={styles.speciesGrid}>
                {LIVESTOCK_SPECIES.map((s) => {
                  const isSelected = selectedAnimalSpecies === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.speciesCard, isSelected && styles.speciesCardActive]}
                      onPress={() => {
                        setSelectedAnimalSpecies(s.id);
                        if (s.defaultUnit) setUnit(s.defaultUnit);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.speciesEmoji}>{s.emoji}</Text>
                      <Text style={[styles.speciesText, isSelected && styles.speciesTextActive]}>
                        {s.label}
                      </Text>
                      {isSelected && (
                        <View style={styles.speciesCheckBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#D97706" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.label, { marginTop: Spacing.sm }]}>Offtake / Yield Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {LIVESTOCK_OFFTAKE_TYPES.map((t) => {
                  const isSelected = offtakeType === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.chip,
                        isSelected && styles.chipActiveLivestock,
                      ]}
                      onPress={() => {
                        setOfftakeType(t.id);
                        if (t.unit) setUnit(t.unit);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={t.icon as any}
                        size={13}
                        color={isSelected ? '#FFFFFF' : '#D97706'}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Quantity Input (Full width, clear, prominent) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {isLivestock ? 'Offtake Quantity / Head Count *' : 'Harvest Yield Quantity *'}
            </Text>
            <TextInput
              style={[styles.input, styles.quantityInput]}
              placeholder={isLivestock ? 'e.g. 25' : 'e.g. 2500'}
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={quantity}
              onChangeText={setQuantity}
            />
            {!isLivestock && Number(quantity) > 0 && toKg({ quantity: Number(quantity), unit }) && unit !== 'kg' ? (
              <Text style={styles.kgHint}>
                {`about ${toKg({ quantity: Number(quantity), unit })!.kg.toLocaleString()} kg${
                  toKg({ quantity: Number(quantity), unit })!.estimated ? ' (estimate: local cup and tin sizes vary)' : ''
                }`}
              </Text>
            ) : null}
          </View>

          {/* Full-width Unit Selection Grid */}
          <View style={styles.inputGroup}>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.label}>Measurement Unit *</Text>
              <Badge
                label={unit}
                variant={isLivestock ? 'warning' : 'success'}
                size="sm"
              />
            </View>
            <View style={styles.unitGrid}>
              {(isLivestock ? LIVESTOCK_UNITS : CROP_UNITS).map((u) => {
                const isSelected = unit === u;
                return (
                  <TouchableOpacity
                    key={u}
                    style={[
                      styles.unitTile,
                      isSelected &&
                        (isLivestock ? styles.unitTileActiveLivestock : styles.unitTileActive),
                    ]}
                    onPress={() => setUnit(u)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={
                        u.includes('head') || u.includes('animal')
                          ? 'paw'
                          : u.includes('crate')
                          ? 'grid-outline'
                          : u.includes('litre')
                          ? 'water-outline'
                          : u.includes('bag')
                          ? 'cube-outline'
                          : 'scale-outline'
                      }
                      size={14}
                      color={
                        isSelected
                          ? '#FFFFFF'
                          : isLivestock
                          ? '#D97706'
                          : Colors.primary
                      }
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.unitTileText,
                        isSelected && styles.unitTileTextActive,
                      ]}
                    >
                      {u}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color="#FFFFFF"
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{ marginTop: Spacing.xs }}>
            <DatePickerField
              label={isLivestock ? 'Offtake / Gathering Date *' : 'Harvest Date *'}
              value={harvestDate}
              onChange={setHarvestDate}
              helperText={
                isLivestock
                  ? 'Date animals were offtaken, sold, or eggs/milk gathered'
                  : 'Date this batch was reaped from the field'
              }
            />
          </View>

          {/* Gross Market / Sale Value for Real Farm Profit Tracking */}
          <View style={[styles.inputGroup, { marginTop: Spacing.md }]}>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.label}>Estimated / Market Sale Value ($ USD)</Text>
              <Badge label="Revenue & Profit" variant="success" size="sm" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="e.g. 600"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={totalValue}
              onChangeText={setTotalValue}
            />
            <Text style={styles.helperText}>
              Gross value/revenue from this harvest or offtake (used to calculate real farm profit & loss)
            </Text>
          </View>
        </Card>

        {/* ========================================================= */}
        {/* SECTION 3: STORAGE / HOLDING & OBSERVATIONS */}
        {/* ========================================================= */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>
            {isLivestock
              ? '3. Holding Facility & Livestock Health'
              : '3. Storage & Quality Observations'}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {isLivestock
                ? 'Holding Facility / Pen / Abattoir'
                : 'Storage Warehouse / Facility'}
            </Text>
            <TextInput
              style={styles.input}
              value={storageLocation}
              onChangeText={setStorageLocation}
              placeholder={
                isLivestock
                  ? 'e.g. Central Paddock / Abattoir Cold Room / Farm Pen'
                  : 'e.g. Nimba Cooperative Central Depot #2'
              }
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {isLivestock
                ? 'Livestock Condition & Health Observations'
                : 'Harvest Observations & Condition'}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={
                isLivestock
                  ? 'e.g. Active flock offtake, vaccinated, average live weight 22kg, tagged for traceability...'
                  : 'e.g. Sun-dried moisture checked with probe, packed in clean labeled 50kg bags, no mold...'
              }
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              value={observations}
              onChangeText={setObservations}
            />
          </View>

          <View style={styles.infoBanner}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={isLivestock ? '#D97706' : Colors.primary}
            />
            <Text style={styles.infoText}>
              Submitting registers the {isLivestock ? 'livestock offtake' : 'harvest batch'} with
              status <Text style={{ fontWeight: '700' }}>Submitted</Text>. Quality and veterinary
              officers will receive the batch for formal grading and verification.
            </Text>
          </View>
        </Card>

        <Button
          title={isLivestock ? 'Submit Livestock Offtake Batch' : 'Submit Harvest Batch'}
          onPress={handleSubmit}
          size="lg"
          loading={isSubmitting}
          icon={
            <Ionicons
              name={isLivestock ? 'paw' : 'shield-checkmark-outline'}
              size={20}
              color="#FFFFFF"
            />
          }
        />

        {/* Recent Harvest & Offtake Log Preview */}
        {harvests.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time-outline" size={18} color={Colors.text} />
                <Text style={styles.recentTitle}>Recent Harvest Log</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveTab('log')}>
                <Text style={styles.viewAllText}>See all ({harvests.length}) →</Text>
              </TouchableOpacity>
            </View>

            {harvests.slice(0, 3).map((item) => {
              const itemIsLivestock =
                item.crop?.category === 'Livestock Offtake' ||
                item.crop?.category === 'Livestock Cycle' ||
                item.crop?.category === 'Livestock' ||
                item.crop_id?.startsWith('livestock-') ||
                ['heads', 'animals', 'crates / trays', 'litres', 'kg (meat)'].includes(item.unit);
              const isApproved = item.status === 'approved';
              const isRejected = item.status === 'rejected';

              return (
                <Card
                  key={item.id}
                  style={styles.recentItemCard}
                  onPress={() => router.push(`/harvest/${item.id}` as any)}
                >
                  <View style={styles.recentTopRow}>
                    <View style={styles.recentRefWrap}>
                      <Text style={styles.recentRefText}>{item.batch_reference}</Text>
                      <Badge
                        label={itemIsLivestock ? 'Livestock' : 'Crop'}
                        variant={itemIsLivestock ? 'warning' : 'info'}
                        size="sm"
                      />
                    </View>
                    <Badge
                      label={item.status.replace('_', ' ')}
                      variant={isApproved ? 'success' : isRejected ? 'danger' : 'warning'}
                      size="sm"
                    />
                  </View>

                  <View style={styles.recentMetaRow}>
                    <Text style={styles.recentCropName}>
                      {itemIsLivestock ? '🐾 ' : '🌾 '}
                      {item.crop?.name || 'Harvest'}
                    </Text>
                    <Text style={styles.recentQty}>
                      {item.quantity.toLocaleString()} {item.unit}
                    </Text>
                  </View>

                  <View style={styles.recentBottomRow}>
                    <Text style={styles.recentDate}>{item.harvest_date}</Text>
                    {item.total_value ? (
                      <Text style={styles.recentValue}>
                        ${Number(item.total_value).toFixed(2)} USD
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
            <Text style={styles.statLabel}>TOTAL BATCHES</Text>
            <Text style={styles.statVal}>{harvests.length}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>CROPS / OFFTAKE</Text>
            <Text style={styles.statVal}>
              {cropHarvestCount} / {livestockHarvestCount}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL VALUE</Text>
            <Text style={[styles.statVal, { color: '#15803D' }]}>
              ${totalYieldValue > 0 ? totalYieldValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0'}
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
                All Batches ({harvests.length})
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
                Crops Harvest ({cropHarvestCount})
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
                Livestock Offtake ({livestockHarvestCount})
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

        {/* List of Harvest & Offtake Logs */}
        {filteredHarvests.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Harvest Records Found</Text>
            <Text style={styles.emptySub}>
              {logFilter === 'all'
                ? "You haven't recorded any harvest or livestock offtake batches yet. Use the 'Register' tab to log your first batch."
                : `No batches found under "${logFilter === 'crops' ? 'Crops Harvest' : 'Livestock Offtake'}".`}
            </Text>
            <Button
              title="+ Register First Batch"
              onPress={() => setActiveTab('register')}
              size="sm"
              style={{ marginTop: Spacing.sm }}
            />
          </Card>
        ) : (
          filteredHarvests.map((item) => {
            const itemIsLivestock =
              item.crop?.category === 'Livestock Offtake' ||
              item.crop?.category === 'Livestock Cycle' ||
              item.crop?.category === 'Livestock' ||
              item.crop_id?.startsWith('livestock-') ||
              ['heads', 'animals', 'crates / trays', 'litres', 'kg (meat)'].includes(item.unit);

            const farmObj = farmLookup.get(item.farm_id) || item.farm;
            const isApproved = item.status === 'approved';
            const isRejected = item.status === 'rejected';

            return (
              <Card
                key={item.id}
                style={styles.logBatchCard}
                onPress={() => router.push(`/harvest/${item.id}` as any)}
              >
                {/* Header: Batch Reference & Badges */}
                <View style={styles.logCardHeader}>
                  <View style={[styles.logRefBadge, itemIsLivestock && styles.logRefBadgeLivestock]}>
                    <Ionicons
                      name={itemIsLivestock ? 'paw' : 'leaf'}
                      size={14}
                      color={itemIsLivestock ? '#D97706' : Colors.primary}
                    />
                    <Text style={[styles.logRefText, itemIsLivestock && styles.logRefTextLivestock]}>
                      {item.batch_reference}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Badge
                      label={itemIsLivestock ? 'Livestock' : 'Crop'}
                      variant={itemIsLivestock ? 'warning' : 'info'}
                      size="sm"
                    />
                    <Badge
                      label={item.status.replace('_', ' ')}
                      variant={isApproved ? 'success' : isRejected ? 'danger' : 'warning'}
                      size="sm"
                    />
                  </View>
                </View>

                {/* Title & Farm Details */}
                <View style={styles.logTitleBlock}>
                  <Text style={styles.logBatchTitle}>
                    {itemIsLivestock ? '🐾 ' : '🌾 '}
                    {item.crop?.name || (itemIsLivestock ? 'Livestock Batch' : 'Crop Harvest')}
                    {item.crop_variety_id && item.crop_variety_id !== 'Standard Variety'
                      ? ` (${item.crop_variety_id})`
                      : ''}
                  </Text>
                  <Text style={styles.logFarmSubtitle}>
                    {farmObj?.name || 'Farm Parcel'}
                    {farmObj?.county ? ` • ${farmObj.district}, ${farmObj.county}` : ''}
                  </Text>
                </View>

                {/* 4-Item Grid */}
                <View style={styles.logMetaGrid}>
                  <View style={styles.logMetaItem}>
                    <Text style={styles.logMetaLabel}>QUANTITY / YIELD</Text>
                    <Text style={styles.logMetaValue}>
                      {item.quantity.toLocaleString()} {item.unit}
                    </Text>
                  </View>

                  <View style={styles.logMetaItem}>
                    <Text style={styles.logMetaLabel}>HARVEST DATE</Text>
                    <Text style={styles.logMetaValue}>{item.harvest_date}</Text>
                  </View>

                  <View style={styles.logMetaItem}>
                    <Text style={styles.logMetaLabel}>EST. MARKET VALUE</Text>
                    <Text style={[styles.logMetaValue, item.total_value ? { color: '#15803D' } : {}]}>
                      {item.total_value
                        ? `$${Number(item.total_value).toFixed(2)} USD`
                        : 'Not Specified'}
                    </Text>
                  </View>

                  <View style={styles.logMetaItem}>
                    <Text style={styles.logMetaLabel}>STORAGE / FACILITY</Text>
                    <Text style={styles.logMetaValue} numberOfLines={1}>
                      {item.storage_location ? item.storage_location.split(',')[0] : 'Farm Holding'}
                    </Text>
                  </View>
                </View>

                {/* Observations if present */}
                {item.observations ? (
                  <View style={styles.logNotesBox}>
                    <Ionicons
                      name="chatbox-ellipses-outline"
                      size={13}
                      color={Colors.textMuted}
                      style={{ marginTop: 2, marginRight: 5 }}
                    />
                    <Text style={styles.logNotesText} numberOfLines={2}>
                      {item.observations}
                    </Text>
                  </View>
                ) : null}

                {/* Card Actions Footer */}
                <View style={styles.logCardFooter}>
                  <TouchableOpacity
                    style={styles.logActionBtn}
                    onPress={() => router.push(`/harvest/${item.id}` as any)}
                  >
                    <Ionicons name="qr-code-outline" size={15} color={Colors.primary} />
                    <Text style={styles.logActionBtnText}>View QR Passport</Text>
                  </TouchableOpacity>

                  <View style={styles.logTraceabilityPill}>
                    <Ionicons name="shield-checkmark" size={13} color="#15803D" />
                    <Text style={styles.logTraceabilityText}>Traceable Batch</Text>
                  </View>
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
  kgHint: { marginTop: 6, fontSize: 13, color: Colors.textMuted },
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
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
    fontWeight: '700',
  },
  // Auto-detection banner
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
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  detectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  detectionIconWrapLivestock: {
    backgroundColor: '#FDE68A',
  },
  detectionTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  detectionTitleLivestock: {
    color: '#B45309',
  },
  detectionSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  detectionSubtitleLivestock: {
    color: '#92400E',
  },
  // Integrated Farm mode switcher
  bothModeToggleWrap: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  bothModeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6,
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
    borderRadius: Radius.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
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
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  bothModeBtnTextActive: {
    color: '#FFFFFF',
  },
  noSeasonBanner: {
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  noSeasonText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  unitRow: {
    flexDirection: 'row',
  },
  unitChip: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.md,
    marginRight: 4,
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
  },
  infoText: {
    fontSize: Typography.sizes.xs,
    color: Colors.primaryDark,
    flex: 1,
    lineHeight: 16,
  },
  helperText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 15,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  quantityInput: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 12,
  },
  // Animal Species Grid
  speciesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 2,
    marginBottom: Spacing.xs,
  },
  speciesCard: {
    flex: 1,
    minWidth: '17%',
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  speciesCardActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
    borderWidth: 2,
  },
  speciesEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  speciesText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  speciesTextActive: {
    color: '#92400E',
  },
  speciesCheckBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  // Full-width Measurement Unit Grid
  unitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 4,
  },
  unitTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
  },
  unitTileActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  unitTileActiveLivestock: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  unitTileText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    color: Colors.text,
  },
  unitTileTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
  // Recent Harvest Section Styles
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
  recentRefWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentRefText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  recentMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recentCropName: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  recentQty: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  recentBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  recentValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  // Harvest Log Tab Styles
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
  logBatchCard: {
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
  logRefBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    gap: 4,
  },
  logRefBadgeLivestock: {
    backgroundColor: '#FEF3C7',
  },
  logRefText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.primaryDark,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  logRefTextLivestock: {
    color: '#92400E',
  },
  logTitleBlock: {
    marginBottom: Spacing.xs,
  },
  logBatchTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  logFarmSubtitle: {
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
  logNotesBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    borderRadius: Radius.sm,
    marginTop: 4,
    marginBottom: Spacing.xs,
  },
  logNotesText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },
  logCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  logActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: Radius.sm,
  },
  logActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  logTraceabilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logTraceabilityText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#15803D',
  },
});
