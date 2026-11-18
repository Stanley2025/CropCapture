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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { localDb, generateUUID, generateBatchReference } from '../../src/services/storage/localDatabase';
import { useAppStore } from '../../src/store/useAppStore';
import { Farm, FarmSeason, HarvestBatch } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { DatePickerField } from '../../src/components/DatePickerField';

const UNITS = ['kg', 'tonnes', '50kg bags', 'bunches'];

export default function RegisterHarvestScreen() {
  const router = useRouter();
  const { currentFarmer, refreshPendingSyncCount } = useAppStore();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [seasons, setSeasons] = useState<FarmSeason[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedSeasonId, setSelectedSeasonId] = useState('');

  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split('T')[0]);
  const [storageLocation, setStorageLocation] = useState('Central Cooperative Warehouse, Sanniquellie');
  const [observations, setObservations] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([localDb.getFarms(), localDb.getSeasons()]).then(([f, s]) => {
      setFarms(f);
      setSeasons(s);
      if (f.length > 0) setSelectedFarmId(f[0].id);
      if (s.length > 0) setSelectedSeasonId(s[0].id);
    });
  }, []);

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);
  const selectedFarm = farms.find((f) => f.id === selectedFarmId);

  const handleSubmit = async () => {
    if (!selectedFarmId) {
      Alert.alert('Farm Required', 'Please select a registered farm.');
      return;
    }
    if (!quantity.trim() || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid harvest yield amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cropCode = selectedSeason?.crop?.code || 'CROP';
      const batchReference = generateBatchReference(cropCode);
      const randomToken = `cropcapture_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const newHarvest: HarvestBatch = {
        id: generateUUID(),
        batch_reference: batchReference,
        farmer_id: currentFarmer.id,
        farm_id: selectedFarmId,
        season_id: selectedSeasonId || null,
        crop_id: selectedSeason?.crop_id || '11111111-1111-1111-1111-111111111101',
        crop_variety_id: selectedSeason?.crop_variety_id || 'Standard Variety',
        harvest_date: harvestDate,
        quantity: parseFloat(quantity),
        unit,
        storage_location: storageLocation.trim(),
        photo_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
        observations: observations.trim() || 'Harvest gathered and bagged in dry condition.',
        status: 'submitted',
        qr_token: randomToken,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        crop: selectedSeason?.crop || {
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

      Alert.alert(
        'Harvest Batch Registered!',
        `Assigned Batch Reference:\n\n${newHarvest.batch_reference}\n\nStatus: Submitted for Quality Inspection. A unique QR verification passport has been generated.`,
        [
          {
            text: 'View Batch & QR',
            onPress: () => router.replace(`/harvest/${newHarvest.id}` as any),
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
      <Header title="Register Harvest" subtitle="Assign unique batch reference & QR" showBack />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>1. Farm & Crop Season</Text>
          <Text style={styles.label}>Select Farm Parcel *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {farms.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, selectedFarmId === f.id && styles.chipActive]}
                onPress={() => setSelectedFarmId(f.id)}
              >
                <Text style={[styles.chipText, selectedFarmId === f.id && styles.chipTextActive]}>
                  {f.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { marginTop: Spacing.sm }]}>Associated Season</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {seasons.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.chip, selectedSeasonId === s.id && styles.chipActive]}
                onPress={() => setSelectedSeasonId(s.id)}
              >
                <Text style={[styles.chipText, selectedSeasonId === s.id && styles.chipTextActive]}>
                  {s.season_name} ({s.crop?.name || 'Crop'})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>2. Harvest Yield & Date</Text>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1.5, marginRight: Spacing.xs }]}>
              <Text style={styles.label}>Quantity Harvested *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2500"
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.xs }]}>
              <Text style={styles.label}>Unit</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitRow}>
                {UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitChip, unit === u && styles.unitChipActive]}
                    onPress={() => setUnit(u)}
                  >
                    <Text style={[styles.unitChipText, unit === u && styles.unitChipTextActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={{ marginTop: Spacing.sm }}>
            <DatePickerField
              label="Harvest Date"
              value={harvestDate}
              onChange={setHarvestDate}
              helperText="Date this batch was reaped from the field"
            />
          </View>
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>3. Storage & Quality Observations</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Storage Warehouse / Facility</Text>
            <TextInput
              style={styles.input}
              value={storageLocation}
              onChangeText={setStorageLocation}
              placeholder="e.g. Nimba Cooperative Central Depot #2"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Harvest Observations & Condition</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. Sun-dried moisture checked with handheld probe, packed in clean labeled 50kg bags, no signs of mold or pest damage..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              value={observations}
              onChangeText={setObservations}
            />
          </View>

          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.infoText}>
              Submitting registers the harvest with status <Text style={{ fontWeight: '700' }}>Submitted</Text>. Quality inspectors will receive the batch for formal grading.
            </Text>
          </View>
        </Card>

        <Button
          title="Submit Harvest Batch"
          onPress={handleSubmit}
          size="lg"
          loading={isSubmitting}
          icon={<Ionicons name="shield-checkmark-outline" size={20} color="#FFFFFF" />}
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
    paddingVertical: 6,
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
  unitChipText: {
    fontSize: 11,
    color: Colors.text,
    fontWeight: '600',
  },
  unitChipTextActive: {
    color: '#FFFFFF',
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
});
