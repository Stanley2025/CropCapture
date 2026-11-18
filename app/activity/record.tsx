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
import { Farm, FarmSeason, FarmActivity } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { DatePickerField } from '../../src/components/DatePickerField';

const ACTIVITY_TYPES = [
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
  'Other activity',
];

export default function RecordActivityScreen() {
  const router = useRouter();
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const { currentFarmer, currentUserProfile, refreshPendingSyncCount } = useAppStore();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [seasons, setSeasons] = useState<FarmSeason[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>(farmId || '');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [activityType, setActivityType] = useState('Land preparation');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [cost, setCost] = useState('');
  const [laborCount, setLaborCount] = useState('2');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([localDb.getFarms(), localDb.getSeasons()]).then(([f, s]) => {
      setFarms(f);
      setSeasons(s);
      if (!selectedFarmId && f.length > 0) {
        setSelectedFarmId(f[0].id);
      }
    });
  }, [selectedFarmId]);

  const availableSeasons = seasons.filter((s) => s.farm_id === selectedFarmId);

  const handleSubmit = async () => {
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

      Alert.alert(
        'Activity Recorded!',
        `"${newActivity.activity_type}" was saved to device and added to the sync queue.`,
        [
          {
            text: 'View Activities',
            onPress: () => router.replace('/activities' as any),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to record activity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Record Activity" subtitle="Log field operations & agronomy" showBack />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* 1. Select Farm and Season */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>1. Target Parcel & Season</Text>
          <Text style={styles.label}>Select Farm Parcel *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {farms.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, selectedFarmId === f.id && styles.chipActive]}
                onPress={() => {
                  setSelectedFarmId(f.id);
                  setSelectedSeasonId('');
                }}
              >
                <Text style={[styles.chipText, selectedFarmId === f.id && styles.chipTextActive]}>
                  {f.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {availableSeasons.length > 0 && (
            <>
              <Text style={[styles.label, { marginTop: Spacing.sm }]}>Associated Season (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {availableSeasons.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.chip, selectedSeasonId === s.id && styles.chipActive]}
                    onPress={() => setSelectedSeasonId(s.id === selectedSeasonId ? '' : s.id)}
                  >
                    <Text style={[styles.chipText, selectedSeasonId === s.id && styles.chipTextActive]}>
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
          <Text style={styles.sectionTitle}>2. Activity Details</Text>
          <Text style={styles.label}>Activity Classification *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {ACTIVITY_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.chip, activityType === type && styles.chipActive]}
                onPress={() => setActivityType(type)}
              >
                <Text style={[styles.chipText, activityType === type && styles.chipTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ marginTop: Spacing.sm }}>
            <DatePickerField
              label="Activity Date"
              value={activityDate}
              onChange={setActivityDate}
              helperText="Tap to choose date from calendar"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description & Field Observations *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. Cleared perimeter drainage ditch and applied compound NPK fertilizer along rice bunds..."
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
          <Text style={styles.sectionTitle}>3. Material, Labor & Cost</Text>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1.5, marginRight: Spacing.xs }]}>
              <Text style={styles.label}>Material Quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 50"
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.xs }]}>
              <Text style={styles.label}>Unit</Text>
              <TextInput
                style={styles.input}
                placeholder="kg / bags / liters"
                value={unit}
                onChangeText={setUnit}
              />
            </View>
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
                placeholder="e.g. 3"
                keyboardType="numeric"
                value={laborCount}
                onChangeText={setLaborCount}
              />
            </View>
          </View>
        </Card>

        <Button
          title="Save Activity Record"
          onPress={handleSubmit}
          size="lg"
          loading={isSubmitting}
          icon={<Ionicons name="checkmark-done" size={20} color="#FFFFFF" />}
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
});
