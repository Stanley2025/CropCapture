import React, { useState, useEffect, useMemo } from 'react';
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

export const CROP_ACTIVITY_TYPES = [
  'Land preparation',
  'Planting',
  'Fertilizer application',
  'Pesticide application',
  'Weeding',
  'Irrigation',
  'Pest management',
  'Disease management',
  'Pruning',
  'Field inspection',
  'Harvest preparation',
  'Other crop activity',
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logFilterCategory, setLogFilterCategory] = useState('All');

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
    if (!description.trim()) {
      Alert.alert('Description Required', 'Please provide notes or details for this activity.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newActivity: FarmActivity = {
        id: generateUUID(),
        farmer_id: currentFarmer.id,
        farm_id: selectedFarmId,
        season_id: selectedSeasonId || null,
        activity_type: activityType,
        activity_date: activityDate,
        description: description.trim(),
        quantity: quantity ? parseFloat(quantity) : null,
        unit: quantity ? unit : null,
        cost: cost ? parseFloat(cost) : 0,
        labor_count: laborCount ? parseInt(laborCount, 10) : 1,
        photo_url: null,
        recorded_by: currentUserProfile.id,
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
      setQuantity('');
      setCost('');

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
    return a.activity_type.toLowerCase() === logFilterCategory.toLowerCase();
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

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

                {/* 2. Activity Type & Date */}
                <Card style={styles.formCard}>
                  <Text style={styles.sectionTitle}>
                    {isLivestock ? '2. Livestock Operation & Details' : '2. Agronomic Activity & Details'}
                  </Text>
                  <Text style={styles.label}>
                    {isLivestock ? 'Livestock Operation Classification *' : 'Activity Classification *'}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipRow}
                  >
                    {currentActivityTypes.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.chip,
                          activityType === type &&
                            (isLivestock ? styles.chipActiveLivestock : styles.chipActive),
                        ]}
                        onPress={() => setActivityType(type)}
                      >
                        <Ionicons
                          name={isLivestock ? 'paw-outline' : 'leaf-outline'}
                          size={12}
                          color={
                            activityType === type
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
                            activityType === type && styles.chipTextActive,
                          ]}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View style={{ marginTop: Spacing.sm }}>
                    <DatePickerField
                      label={isLivestock ? 'Operation Date' : 'Activity Date'}
                      value={activityDate}
                      onChange={setActivityDate}
                      helperText="Tap to choose date from calendar"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      {isLivestock ? 'Description & Husbandry Observations *' : 'Description & Field Observations *'}
                    </Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder={
                        isLivestock
                          ? 'e.g. Administered PPR and anthrax vaccines to 25 goats, disinfected pens, provided supplementary minerals and checked water troughs...'
                          : 'e.g. Cleared perimeter drainage ditch and applied compound NPK fertilizer along rice bunds...'
                      }
                      placeholderTextColor={Colors.textMuted}
                      multiline
                      numberOfLines={3}
                      value={description}
                      onChangeText={setDescription}
                    />
                  </View>
                </Card>

                {/* 3. Quantities, Labor & Cost */}
                <Card style={styles.formCard}>
                  <Text style={styles.sectionTitle}>
                    {isLivestock ? '3. Animals / Feed, Labor & Cost' : '3. Material, Labor & Cost'}
                  </Text>

                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1.3, marginRight: Spacing.xs }]}>
                      <Text style={styles.label}>
                        {isLivestock ? 'Animals / Quantity' : 'Material Quantity'}
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder={isLivestock ? 'e.g. 25' : 'e.g. 50'}
                        keyboardType="numeric"
                        value={quantity}
                        onChangeText={setQuantity}
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1.1, marginLeft: Spacing.xs }]}>
                      <Text style={styles.label}>Unit</Text>
                      <TextInput
                        style={styles.input}
                        placeholder={isLivestock ? 'heads / doses / bales' : 'kg / bags / liters'}
                        value={unit}
                        onChangeText={setUnit}
                      />
                    </View>
                  </View>

                  {/* Quick Unit Selector */}
                  <View style={{ marginBottom: Spacing.sm }}>
                    <Text style={[styles.label, { fontSize: 10, marginBottom: 4 }]}>QUICK UNIT SELECTOR:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                      {currentUnits.map((u) => (
                        <TouchableOpacity
                          key={u}
                          style={[
                            styles.unitChip,
                            unit === u &&
                              (isLivestock ? styles.unitChipActiveLivestock : styles.unitChipActive),
                          ]}
                          onPress={() => setUnit(u)}
                        >
                          <Text
                            style={[
                              styles.unitChipText,
                              unit === u && styles.unitChipTextActive,
                            ]}
                          >
                            {u}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.xs }]}>
                      <Text style={styles.label}>Cost (USD)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 45"
                        keyboardType="numeric"
                        value={cost}
                        onChangeText={setCost}
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.xs }]}>
                      <Text style={styles.label}>Labor Workers</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 2"
                        keyboardType="numeric"
                        value={laborCount}
                        onChangeText={setLaborCount}
                      />
                    </View>
                  </View>
                </Card>

                <Button
                  title={isLivestock ? 'Save Livestock Record' : 'Save Activity Record'}
                  onPress={handleSubmit}
                  size="lg"
                  loading={isSubmitting}
                  icon={<Ionicons name="checkmark-done" size={20} color="#FFFFFF" />}
                />
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
                    <Card key={act.id} style={styles.logCardCompact}>
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
                      <View style={styles.logMetaRow}>
                        <Text style={styles.logFarmText}>
                          📍 {farmLookup.get(act.farm_id) || 'Registered Farm'}
                        </Text>
                        {act.cost ? <Text style={styles.logCostText}>${act.cost}</Text> : null}
                      </View>
                    </Card>
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
              {['All', ...currentActivityTypes].map((cat) => (
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
                  <Card key={act.id} style={styles.logCard}>
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
              );
            })
          )}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
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
});
