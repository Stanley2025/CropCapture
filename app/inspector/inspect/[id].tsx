import React, { useState, useEffect } from 'react';
import { KeyboardAwareScrollView } from '../../../src/components/KeyboardAwareScrollView';
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
import { Colors, Radius, Spacing, Typography } from '../../../src/constants/theme';
import { localDb, generateUUID } from '../../../src/services/storage/localDatabase';
import { useAppStore } from '../../../src/store/useAppStore';
import { HarvestBatch, QualityInspection, QualityGrade } from '../../../src/types/database';
import { Header } from '../../../src/components/Header';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { Badge } from '../../../src/components/Badge';

export default function ConductInspectionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUserProfile, refreshPendingSyncCount } = useAppStore();

  const [harvest, setHarvest] = useState<HarvestBatch | null>(null);

  // Crop-specific inspection fields (defaulting to Rice template)
  const [moisture, setMoisture] = useState('12.4');
  const [foreignMatter, setForeignMatter] = useState('0.5');
  const [damagedGrains, setDamagedGrains] = useState('1.0');
  const [grainAppearance, setGrainAppearance] = useState('Good / Uniform');
  const [pestInfestation, setPestInfestation] = useState('None');
  const [odour, setOdour] = useState('Natural / Clean');
  const [observations, setObservations] = useState(
    'Batch meets export moisture standard (under 14.0%). Foreign matter and chalkiness within acceptable limits.'
  );

  const [decision, setDecision] = useState<'approved' | 'rejected' | 'requires_reinspection'>('approved');
  const [calculatedGrade, setCalculatedGrade] = useState<QualityGrade>('grade_a');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    localDb.getHarvests().then((all) => {
      const found = all.find((h) => h.id === id);
      if (found) setHarvest(found);
    });
  }, [id]);

  // Recalculate grade whenever parameters change
  useEffect(() => {
    const moistNum = parseFloat(moisture) || 12;
    const foreignNum = parseFloat(foreignMatter) || 0;
    const damagedNum = parseFloat(damagedGrains) || 0;

    if (moistNum > 15.0 || foreignNum > 3.0 || damagedNum > 5.0 || pestInfestation === 'Active') {
      setCalculatedGrade('rejected');
      setDecision('rejected');
    } else if (moistNum <= 13.0 && foreignNum <= 1.0 && damagedNum <= 2.0 && pestInfestation === 'None') {
      setCalculatedGrade('grade_a');
      setDecision('approved');
    } else if (moistNum <= 14.5 && foreignNum <= 2.0 && damagedNum <= 4.0) {
      setCalculatedGrade('grade_b');
      setDecision('approved');
    } else {
      setCalculatedGrade('grade_c');
      setDecision('requires_reinspection');
    }
  }, [moisture, foreignMatter, damagedGrains, pestInfestation]);

  if (!harvest) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Quality Inspection" showBack />
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Harvest batch not found.</Text>
          <Button title="Back" onPress={() => router.back()} size="sm" />
        </View>
      </SafeAreaView>
    );
  }

  const handleSubmitInspection = async () => {
    setIsSubmitting(true);
    try {
      const inspectionId = generateUUID();
      const newInspection: QualityInspection = {
        id: inspectionId,
        batch_id: harvest.id,
        inspector_id: currentUserProfile.id,
        template_id: '22222222-2222-2222-2222-222222222201',
        inspection_date: new Date().toISOString(),
        final_grade: calculatedGrade,
        decision_status: decision,
        observations: observations.trim(),
        report_url: `https://agritrack.lr/reports/inspection-${harvest.batch_reference}.pdf`,
        sync_status: 'waiting_to_sync',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        results: [
          {
            id: generateUUID(),
            inspection_id: inspectionId,
            parameter_id: 'p1',
            measured_value: `${moisture}%`,
            notes: 'Handheld calibrated moisture test',
            passes: parseFloat(moisture) <= 14.0,
          },
          {
            id: generateUUID(),
            inspection_id: inspectionId,
            parameter_id: 'p2',
            measured_value: `${foreignMatter}%`,
            notes: 'Sieve & balance assessment',
            passes: parseFloat(foreignMatter) <= 1.5,
          },
          {
            id: generateUUID(),
            inspection_id: inspectionId,
            parameter_id: 'p3',
            measured_value: `${damagedGrains}%`,
            notes: '100-grain sample inspection',
            passes: parseFloat(damagedGrains) <= 3.0,
          },
          {
            id: generateUUID(),
            inspection_id: inspectionId,
            parameter_id: 'p4',
            measured_value: pestInfestation,
            notes: 'Visual & trap check',
            passes: pestInfestation === 'None',
          },
        ],
      };

      // Save inspection record
      await localDb.saveInspection(newInspection, true);

      // Update harvest batch status to approved or rejected
      const updatedHarvest: HarvestBatch = {
        ...harvest,
        status: decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'requires_reinspection',
        updated_at: new Date().toISOString(),
      };
      await localDb.saveHarvest(updatedHarvest, true);
      await refreshPendingSyncCount();

      Alert.alert(
        'Inspection Certified!',
        `Batch ${harvest.batch_reference} has been finalized.\n\nDecision: ${decision.toUpperCase()}\nGrade: ${calculatedGrade.toUpperCase()}\n\nThe QR verification passport is now live and updated on public traceability records.`,
        [
          {
            text: 'View Certified Batch',
            onPress: () => router.replace(`/harvest/${harvest.id}` as any),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Inspection Error', e?.message || 'Could not record inspection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Quality Inspection"
        subtitle={`Batch: ${harvest.batch_reference}`}
        showBack
      />

      <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Batch Summary Pill */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.summaryRef}>{harvest.batch_reference}</Text>
              <Text style={styles.summaryCrop}>
                {harvest.crop?.name || 'Produce'} ({harvest.crop_variety_id || 'Standard Variety'})
              </Text>
            </View>
            <Badge label={`${harvest.quantity} ${harvest.unit}`} variant="gold" />
          </View>
          <Text style={styles.summaryStorage}>
            Storage: {harvest.storage_location || 'Central Depot'} • Harvested {harvest.harvest_date}
          </Text>
        </Card>

        {/* Dynamic Crop Template Parameters (National Liberia Rice Standard) */}
        <Card style={styles.formCard}>
          <View style={styles.templateHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                {harvest.crop?.name || 'Crop'} Quality Template
              </Text>
              <Text style={styles.templateSub}>National Standards Verification Protocol (v1.0)</Text>
            </View>
            <Badge label="Official Spec" variant="info" size="sm" />
          </View>

          {/* Moisture Content */}
          <View style={styles.paramGroup}>
            <View style={styles.paramTop}>
              <Text style={styles.paramLabel}>1. Moisture Content (%)</Text>
              <Text style={styles.benchmark}>Standard: 10.0% – 14.0%</Text>
            </View>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={moisture}
              onChangeText={setMoisture}
              placeholder="e.g. 12.4"
            />
          </View>

          {/* Foreign Matter */}
          <View style={styles.paramGroup}>
            <View style={styles.paramTop}>
              <Text style={styles.paramLabel}>2. Foreign Matter & Chaff (%)</Text>
              <Text style={styles.benchmark}>Max: 1.5%</Text>
            </View>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={foreignMatter}
              onChangeText={setForeignMatter}
              placeholder="e.g. 0.5"
            />
          </View>

          {/* Damaged Grains */}
          <View style={styles.paramGroup}>
            <View style={styles.paramTop}>
              <Text style={styles.paramLabel}>3. Damaged / Chalky Grains (%)</Text>
              <Text style={styles.benchmark}>Max: 3.0%</Text>
            </View>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={damagedGrains}
              onChangeText={setDamagedGrains}
              placeholder="e.g. 1.0"
            />
          </View>

          {/* Pest Infestation */}
          <View style={styles.paramGroup}>
            <Text style={styles.paramLabel}>4. Pest Infestation (Weevils/Moths)</Text>
            <View style={styles.chipRow}>
              {['None', 'Trace (<0.1%)', 'Active'].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.chip, pestInfestation === opt && styles.chipActive]}
                  onPress={() => setPestInfestation(opt)}
                >
                  <Text style={[styles.chipText, pestInfestation === opt && styles.chipTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Odour Assessment */}
          <View style={styles.paramGroup}>
            <Text style={styles.paramLabel}>5. Odour Assessment</Text>
            <View style={styles.chipRow}>
              {['Natural / Clean', 'Musty / Damp', 'Chemical / Off-flavor'].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.chip, odour === opt && styles.chipActive]}
                  onPress={() => setOdour(opt)}
                >
                  <Text style={[styles.chipText, odour === opt && styles.chipTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>

        {/* Calculated Grade & Decision */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Automated Grade Determination</Text>
          <View style={styles.gradeBox}>
            <Text style={styles.gradeSub}>Recommended Grade Based on Measured Thresholds:</Text>
            <View style={styles.gradeBadgeRow}>
              <Badge
                label={calculatedGrade.replace('_', ' ').toUpperCase()}
                variant={calculatedGrade === 'grade_a' ? 'success' : calculatedGrade === 'rejected' ? 'danger' : 'gold'}
                size="md"
              />
              <Text style={styles.gradeExplanation}>
                {calculatedGrade === 'grade_a'
                  ? 'Premium Grade — Certified for commercial distribution & export.'
                  : calculatedGrade === 'grade_b'
                  ? 'Standard Commercial Grade — Suitable for general domestic market.'
                  : calculatedGrade === 'grade_c'
                  ? 'Substandard — Requires re-drying or additional cleaning.'
                  : 'Rejected — Exceeds allowable moisture or contamination tolerance.'}
              </Text>
            </View>
          </View>

          <Text style={[styles.paramLabel, { marginTop: Spacing.md }]}>Final Inspector Decision</Text>
          <View style={styles.decisionRow}>
            {(['approved', 'requires_reinspection', 'rejected'] as const).map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.decisionBtn,
                  decision === d && (d === 'approved' ? styles.btnApproved : d === 'rejected' ? styles.btnRejected : styles.btnReinspect),
                ]}
                onPress={() => setDecision(d)}
              >
                <Text
                  style={[
                    styles.decisionText,
                    decision === d && styles.decisionTextActive,
                  ]}
                >
                  {d === 'approved' ? 'Approve' : d === 'rejected' ? 'Reject' : 'Re-inspect'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.paramGroup, { marginTop: Spacing.md }]}>
            <Text style={styles.paramLabel}>Inspector Field Observations & Justification</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              numberOfLines={3}
              value={observations}
              onChangeText={setObservations}
              placeholder="Enter technical observations, warehouse conditions, and equipment calibration..."
            />
          </View>
        </Card>

        <Button
          title="Certify & Sign Inspection Decision"
          onPress={handleSubmitInspection}
          size="lg"
          loading={isSubmitting}
          icon={<Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />}
        />

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
  notFoundContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  notFoundText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.md,
    marginBottom: Spacing.md,
  },
  summaryCard: {
    marginBottom: Spacing.md,
    backgroundColor: '#F8FAFC',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  summaryRef: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
  },
  summaryCrop: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  summaryStorage: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  formCard: {
    marginBottom: Spacing.md,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  templateSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  paramGroup: {
    marginBottom: Spacing.md,
  },
  paramTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  paramLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
    textTransform: 'uppercase',
  },
  benchmark: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '600',
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 4,
  },
  chip: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
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
  gradeBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginVertical: Spacing.xs,
  },
  gradeSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  gradeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  gradeExplanation: {
    fontSize: 11,
    color: Colors.primaryDark,
    flex: 1,
    lineHeight: 16,
  },
  decisionRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: 4,
  },
  decisionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
  },
  btnApproved: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  btnRejected: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  btnReinspect: {
    backgroundColor: Colors.warning,
    borderColor: Colors.warning,
  },
  decisionText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  decisionTextActive: {
    color: '#FFFFFF',
  },
});
