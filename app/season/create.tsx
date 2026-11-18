import React, { useState, useEffect } from 'react';
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
import { useAppStore } from '../../src/store/useAppStore';
import { Farm, FarmSeason } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';

const CROPS = [
  { id: '11111111-1111-1111-1111-111111111101', name: 'Rice', code: 'RICE', varieties: ['Suakoko 8', 'LAC 23', 'Nerica L-19'] },
  { id: '11111111-1111-1111-1111-111111111102', name: 'Cassava', code: 'CASS', varieties: ['CARICASS 1', 'TMS 30572', 'Bassa Girl'] },
  { id: '11111111-1111-1111-1111-111111111103', name: 'Maize', code: 'MAIZ', varieties: ['DMR-ESR-Y', 'Western Yellow'] },
  { id: '11111111-1111-1111-1111-111111111104', name: 'Cocoa', code: 'COCO', varieties: ['Forastero Hybrid', 'Trinitario Elite'] },
  { id: '11111111-1111-1111-1111-111111111105', name: 'Coffee', code: 'COFF', varieties: ['Liberica Indigenous', 'Robusta'] },
  { id: '11111111-1111-1111-1111-111111111106', name: 'Pepper', code: 'PEPP', varieties: ['Scotch Bonnet', 'Habanero', 'Local Birdseye'] },
  { id: '11111111-1111-1111-1111-111111111107', name: 'Plantain', code: 'PLAN', varieties: ['Giant False Horn', 'French Plantain'] },
  { id: '11111111-1111-1111-1111-111111111108', name: 'Sweet Potato', code: 'SPOT', varieties: ['Orange-Fleshed (OFSP)', 'White Local'] },
  { id: '11111111-1111-1111-1111-111111111109', name: 'Vegetables', code: 'VEG', varieties: ['Bitterball', 'Okra', 'Water Greens'] },
  { id: '11111111-1111-1111-1111-111111111110', name: 'Oil Palm', code: 'PALM', varieties: ['Tenera Hybrid', 'Dura'] },
];

export default function CreateSeasonScreen() {
  const router = useRouter();
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const { refreshPendingSyncCount } = useAppStore();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>(farmId || '');
  const [selectedCrop, setSelectedCrop] = useState(CROPS[0]);
  const [selectedVariety, setSelectedVariety] = useState(CROPS[0].varieties[0]);
  const [seasonName, setSeasonName] = useState('2026 Main Cropping Cycle');
  const [plantingDate, setPlantingDate] = useState(new Date().toISOString().split('T')[0]);
  const [harvestDate, setHarvestDate] = useState('2026-11-30');
  const [cultivatedArea, setCultivatedArea] = useState('3.5');
  const [seedQuantity, setSeedQuantity] = useState('120');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    localDb.getFarms().then((f) => {
      setFarms(f);
      if (!selectedFarmId && f.length > 0) {
        setSelectedFarmId(f[0].id);
      }
    });
  }, [selectedFarmId]);

  const handleCropChange = (crop: typeof CROPS[0]) => {
    setSelectedCrop(crop);
    setSelectedVariety(crop.varieties[0]);
    setSeasonName(`2026 ${crop.name} Season`);
  };

  const handleSubmit = async () => {
    if (!selectedFarmId) {
      Alert.alert('Farm Required', 'Please select a farm parcel for this season.');
      return;
    }
    if (!cultivatedArea || isNaN(Number(cultivatedArea)) || Number(cultivatedArea) <= 0) {
      Alert.alert('Invalid Area', 'Please enter a valid cultivated acreage.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newSeason: FarmSeason = {
        id: generateUUID(),
        farm_id: selectedFarmId,
        crop_id: selectedCrop.id,
        crop_variety_id: selectedVariety,
        season_name: seasonName.trim(),
        planting_date: plantingDate,
        expected_harvest_date: harvestDate,
        cultivated_area: parseFloat(cultivatedArea),
        seed_quantity: seedQuantity ? parseFloat(seedQuantity) : null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        crop: {
          id: selectedCrop.id,
          name: selectedCrop.name,
          code: selectedCrop.code,
          category: 'Cereal / Cash Crop',
          default_unit: 'kg',
          is_active: true,
        },
      };

      await localDb.saveSeason(newSeason, true);
      await refreshPendingSyncCount();

      Alert.alert(
        'Season Activated!',
        `"${newSeason.season_name}" is now active on your farm parcel.`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
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
      <Header title="New Crop Season" subtitle="Plan planting & expected harvest" showBack />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>1. Farm Parcel</Text>
          <Text style={styles.label}>Select Registered Farm</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {farms.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, selectedFarmId === f.id && styles.chipActive]}
                onPress={() => setSelectedFarmId(f.id)}
              >
                <Text style={[styles.chipText, selectedFarmId === f.id && styles.chipTextActive]}>
                  {f.name} ({f.size} {f.size_unit})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>2. Crop Selection</Text>
          <Text style={styles.label}>Crop Catalogue</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {CROPS.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, selectedCrop.id === c.id && styles.chipActive]}
                onPress={() => handleCropChange(c)}
              >
                <Text style={[styles.chipText, selectedCrop.id === c.id && styles.chipTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { marginTop: Spacing.sm }]}>Crop Variety</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {selectedCrop.varieties.map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.chip, selectedVariety === v && styles.chipActive]}
                onPress={() => setSelectedVariety(v)}
              >
                <Text style={[styles.chipText, selectedVariety === v && styles.chipTextActive]}>
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
              placeholder="e.g. 2026 Suakoko 8 Main Season"
            />
          </View>
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>3. Planting Schedule & Cultivation</Text>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.xs }]}>
              <Text style={styles.label}>Planting Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={plantingDate}
                onChangeText={setPlantingDate}
                placeholder="2026-06-15"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.xs }]}>
              <Text style={styles.label}>Expected Harvest</Text>
              <TextInput
                style={styles.input}
                value={harvestDate}
                onChangeText={setHarvestDate}
                placeholder="2026-10-30"
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.xs }]}>
              <Text style={styles.label}>Cultivated Area (Acres)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={cultivatedArea}
                onChangeText={setCultivatedArea}
                placeholder="3.5"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.xs }]}>
              <Text style={styles.label}>Seed Quantity (kg)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={seedQuantity}
                onChangeText={setSeedQuantity}
                placeholder="120"
              />
            </View>
          </View>
        </Card>

        <Button
          title="Activate Crop Season"
          onPress={handleSubmit}
          size="lg"
          loading={isSubmitting}
          icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
        />

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
});
