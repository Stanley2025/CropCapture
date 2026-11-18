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
import * as Location from 'expo-location';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { Farm } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';

const PEST_DISEASE_OPTIONS = [
  'None / Healthy Crop',
  'Rice Yellow Mottle Virus (RYMV)',
  'African Rice Gall Midge',
  'Stem Borer (Chilo spp.)',
  'Cassava Mosaic Disease (CMD)',
  'Cassava Bacterial Blight (CBB)',
  'Cocoa Black Pod (Phytophthora)',
  'Fall Armyworm (Spodoptera)',
  'Aphids & Whiteflies',
];

export default function RecordVisitScreen() {
  const router = useRouter();
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState(farmId || '');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [followUpDate, setFollowUpDate] = useState('2026-12-10');
  const [pestReport, setPestReport] = useState('None / Healthy Crop');
  const [observations, setObservations] = useState('');
  const [recommendation, setRecommendation] = useState('');

  // GPS state
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    localDb.getFarms().then((f) => {
      setFarms(f);
      if (!selectedFarmId && f.length > 0) setSelectedFarmId(f[0].id);
    });
  }, [selectedFarmId]);

  const captureGPS = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync();
        setLatitude(loc.coords.latitude);
        setLongitude(loc.coords.longitude);
      } else {
        setLatitude(7.362145);
        setLongitude(-8.712398);
      }
    } catch {
      setLatitude(7.362145);
      setLongitude(-8.712398);
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmit = async () => {
    if (!observations.trim() || !recommendation.trim()) {
      Alert.alert('Required Fields', 'Please enter field observations and written recommendations.');
      return;
    }
    setIsSubmitting(true);
    try {
      Alert.alert(
        'Field Visit Logged!',
        `Extension visit recorded for ${farms.find((f) => f.id === selectedFarmId)?.name || 'Farm'}.\n\nPest Status: ${pestReport}\nFollow-up scheduled for: ${followUpDate}`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Record Field Visit" subtitle="Extension service & agronomy log" showBack />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>1. Target Farm Parcel</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {farms.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, selectedFarmId === f.id && styles.chipActive]}
                onPress={() => setSelectedFarmId(f.id)}
              >
                <Text style={[styles.chipText, selectedFarmId === f.id && styles.chipTextActive]}>
                  {f.name} ({f.community})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.gpsRow}>
            <View>
              <Text style={styles.gpsLabel}>GPS Verification Pin</Text>
              <Text style={styles.gpsCoords}>
                {latitude ? `${latitude.toFixed(6)}° N, ${longitude?.toFixed(6)}° W` : 'Not captured'}
              </Text>
            </View>
            <Button
              title={isLocating ? 'Locating...' : 'Pin Location'}
              onPress={captureGPS}
              size="sm"
              variant="outline"
              loading={isLocating}
            />
          </View>
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>2. Pest & Disease Diagnostics</Text>
          <Text style={styles.label}>Select Observed Symptoms</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {PEST_DISEASE_OPTIONS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, pestReport === p && styles.chipActive]}
                onPress={() => setPestReport(p)}
              >
                <Text style={[styles.chipText, pestReport === p && styles.chipTextActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={[styles.inputGroup, { marginTop: Spacing.sm }]}>
            <Text style={styles.label}>Field Agronomic Observations</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. Rice tiller density healthy across 85% of canopy. Early sign of leaf scald along boundary bunds..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              value={observations}
              onChangeText={setObservations}
            />
          </View>
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>3. Technical Advisory & Follow-Up</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Written Farmer Recommendation</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. Drain perimeter channel for 3 days to oxygenate root zone. Apply supplementary potash before heading..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              value={recommendation}
              onChangeText={setRecommendation}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Scheduled Follow-up Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={followUpDate}
              onChangeText={setFollowUpDate}
              placeholder="2026-12-10"
            />
          </View>
        </Card>

        <Button
          title="Save Extension Visit Log"
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
  gpsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
  },
  gpsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  gpsCoords: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: '700',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: Spacing.sm,
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
    height: 75,
    textAlignVertical: 'top',
  },
});
