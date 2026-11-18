import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { useAppStore } from '../../src/store/useAppStore';
import { HarvestBatch, QualityInspection, Farm } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';

export default function HarvestDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentRole, setRole } = useAppStore();

  const [harvest, setHarvest] = useState<HarvestBatch | null>(null);
  const [farm, setFarm] = useState<Farm | null>(null);
  const [inspection, setInspection] = useState<QualityInspection | null>(null);

  const loadBatch = useCallback(async () => {
    if (!id) return;
    try {
      const [allHarvests, allFarms, allInspections] = await Promise.all([
        localDb.getHarvests(),
        localDb.getFarms(),
        localDb.getInspections(),
      ]);

      const foundHarvest = allHarvests.find((h) => h.id === id);
      if (foundHarvest) {
        setHarvest(foundHarvest);
        const foundFarm = allFarms.find((f) => f.id === foundHarvest.farm_id);
        setFarm(foundFarm || null);

        const foundInsp = allInspections.find((i) => i.batch_id === foundHarvest.id);
        setInspection(foundInsp || null);
      }
    } catch (e) {
      console.error('Error loading batch:', e);
    }
  }, [id]);

  useEffect(() => {
    loadBatch();
  }, [loadBatch]);

  if (!harvest) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Harvest Batch" showBack />
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Harvest batch not found.</Text>
          <Button title="Back to Harvests" onPress={() => router.back()} size="sm" />
        </View>
      </SafeAreaView>
    );
  }

  const publicVerificationUrl = `https://cropcapture.app/verify/${harvest.qr_token}`;

  const handleShare = async () => {
    try {
      await Share.share({
        title: `CropCapture Batch ${harvest.batch_reference}`,
        message: `CropCapture Verified Batch Passport\nBatch: ${harvest.batch_reference}\nCrop: ${harvest.crop?.name || 'Produce'} (${harvest.crop_variety_id})\nQuantity: ${harvest.quantity} ${harvest.unit}\nStatus: ${harvest.status.toUpperCase()}\n\nVerify public record: ${publicVerificationUrl}`,
      });
    } catch (e: any) {
      console.warn('Share error:', e);
    }
  };

  const handleInspectorShortcut = () => {
    setRole('quality_inspector');
    router.push(`/inspector/inspect/${harvest.id}` as any);
  };

  const isApproved = harvest.status === 'approved';
  const isRejected = harvest.status === 'rejected';

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={harvest.batch_reference}
        subtitle="Batch specification & QR passport"
        showBack
        rightAction={
          <TouchableOpacity onPress={handleShare} style={styles.shareIconBtn}>
            <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* QR Code Passport Hero */}
        <Card style={styles.qrCard}>
          <View style={styles.qrHeaderRow}>
            <View>
              <Text style={styles.passportLabel}>OFFICIAL QR PASSPORT</Text>
              <Text style={styles.batchRefText}>{harvest.batch_reference}</Text>
            </View>
            <Badge
              label={harvest.status.replace('_', ' ')}
              variant={isApproved ? 'success' : isRejected ? 'danger' : 'warning'}
            />
          </View>

          <View style={styles.qrWrapper}>
            <View style={styles.qrFrame}>
              <QRCode
                value={publicVerificationUrl}
                size={180}
                color={Colors.primaryDark}
                backgroundColor="#FFFFFF"
              />
            </View>
            <Text style={styles.qrTokenText}>Security Token: {harvest.qr_token}</Text>
          </View>

          <View style={styles.passportActions}>
            <Button
              title="Open Public Verification Page"
              onPress={() => router.push(`/traceability/${harvest.qr_token}` as any)}
              size="md"
              icon={<Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />}
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        {/* Quality Inspection Status Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Quality Inspection Status</Text>
            {inspection ? (
              <Badge
                label={inspection.final_grade.replace('_', ' ').toUpperCase()}
                variant={inspection.final_grade === 'grade_a' ? 'success' : 'gold'}
              />
            ) : (
              <Badge label="Awaiting Inspection" variant="warning" />
            )}
          </View>

          {inspection ? (
            <View style={styles.inspectionBody}>
              <Text style={styles.decisionStatus}>
                Decision: <Text style={{ fontWeight: '700', color: Colors.primaryDark }}>APPROVED FOR COMMERCE</Text>
              </Text>
              <Text style={styles.inspectionDate}>
                Inspected on {new Date(inspection.inspection_date).toLocaleDateString()} by Official Quality Officer
              </Text>
              {inspection.observations ? (
                <View style={styles.obsBox}>
                  <Text style={styles.obsLabel}>Inspector Field Report:</Text>
                  <Text style={styles.obsText}>{inspection.observations}</Text>
                </View>
              ) : null}

              {inspection.results && inspection.results.length > 0 && (
                <View style={styles.resultsGrid}>
                  {inspection.results.map((r, idx) => (
                    <View key={idx} style={styles.resultItem}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                      <Text style={styles.resultText}>
                        {r.measured_value} — {r.notes}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.uninspectedBox}>
              <Ionicons name="time-outline" size={24} color={Colors.warning} />
              <Text style={styles.uninspectedText}>
                This harvest batch has been submitted and is in the inspector queue. A certified quality inspector will measure moisture, purity, and grade standard before issuance.
              </Text>

              {/* Hackathon MVP workflow shortcut */}
              <TouchableOpacity
                style={styles.inspectorShortcutBtn}
                onPress={handleInspectorShortcut}
              >
                <Ionicons name="shield-checkmark-outline" size={16} color="#FFFFFF" />
                <Text style={styles.inspectorShortcutText}>
                  Complete Inspection Form as Inspector
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* Batch Specification Details */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Batch Specifications</Text>

          <View style={styles.specGrid}>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Crop Category</Text>
              <Text style={styles.specValue}>{harvest.crop?.name || 'Produce'}</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Crop Variety</Text>
              <Text style={styles.specValue}>{harvest.crop_variety_id || 'Standard Variety'}</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Harvest Yield</Text>
              <Text style={styles.specValue}>
                {harvest.quantity.toLocaleString()} {harvest.unit}
              </Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Harvest Date</Text>
              <Text style={styles.specValue}>{harvest.harvest_date}</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Farm Parcel</Text>
              <Text style={styles.specValue}>{farm?.name || 'Registered Farm'}</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Origin Location</Text>
              <Text style={styles.specValue}>
                {farm?.community || 'Gbehley'}, {farm?.county || 'Nimba'} County
              </Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Storage Facility</Text>
              <Text style={styles.specValue}>{harvest.storage_location || 'Warehouse'}</Text>
            </View>
          </View>

          {harvest.observations ? (
            <View style={styles.farmerObsBox}>
              <Text style={styles.obsLabel}>Farmer Harvest Notes:</Text>
              <Text style={styles.farmerObsText}>{harvest.observations}</Text>
            </View>
          ) : null}
        </Card>

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
  notFoundContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  notFoundText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.md,
    marginBottom: Spacing.md,
  },
  shareIconBtn: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.full,
  },
  qrCard: {
    marginBottom: Spacing.md,
    alignItems: 'center',
    padding: Spacing.lg,
  },
  qrHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
  },
  passportLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1,
  },
  batchRefText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
    marginTop: 2,
  },
  qrWrapper: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  qrFrame: {
    padding: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  qrTokenText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: Spacing.sm,
  },
  passportActions: {
    width: '100%',
    marginTop: Spacing.sm,
  },
  sectionCard: {
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  inspectionBody: {
    paddingVertical: Spacing.xs,
  },
  decisionStatus: {
    fontSize: Typography.sizes.sm,
    color: Colors.text,
    marginBottom: 2,
  },
  inspectionDate: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  obsBox: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginBottom: Spacing.sm,
  },
  obsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  obsText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text,
    lineHeight: 18,
  },
  resultsGrid: {
    gap: 4,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text,
  },
  uninspectedBox: {
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  uninspectedText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginVertical: Spacing.sm,
  },
  inspectorShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
  },
  inspectorShortcutText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
  },
  specGrid: {
    gap: Spacing.xs,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  specLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  specValue: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  farmerObsBox: {
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  farmerObsText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text,
    lineHeight: 18,
  },
});
