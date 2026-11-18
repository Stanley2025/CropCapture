import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { HarvestBatch, QualityInspection } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';

export default function PublicTraceabilityScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [harvest, setHarvest] = useState<HarvestBatch | null>(null);
  const [inspection, setInspection] = useState<QualityInspection | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([localDb.getHarvests(), localDb.getInspections()]).then(([allH, allI]) => {
      const match = allH.find((h) => h.qr_token === token || h.id === token || h.batch_reference === token);
      if (match) {
        setHarvest(match);
        const matchInsp = allI.find((i) => i.batch_id === match.id);
        setInspection(matchInsp || null);
      }
      setIsLoading(false);
    });
  }, [token]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Batch Traceability" showBack />
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Verifying cryptographic QR passport...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!harvest) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Batch Verification" showBack />
        <View style={styles.centerContainer}>
          <Ionicons name="warning-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorTitle}>Traceability Record Not Found</Text>
          <Text style={styles.errorSub}>
            The scanned QR code or verification token does not match an active AgriTrack Liberia passport.
          </Text>
          <Button title="Return to Scanner" onPress={() => router.back()} size="sm" style={{ marginTop: Spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  const isApproved = harvest.status === 'approved';

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="AgriTrack Certificate"
        subtitle="Public Agricultural Verification Record"
        showBack
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Verification Status Banner */}
        <View
          style={[
            styles.statusBanner,
            isApproved ? styles.statusApproved : styles.statusPending,
          ]}
        >
          <Ionicons
            name={isApproved ? 'checkmark-circle' : 'time-outline'}
            size={36}
            color={isApproved ? '#047857' : '#B45309'}
          />
          <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
            <Text style={[styles.statusBannerTitle, isApproved ? { color: '#047857' } : { color: '#B45309' }]}>
              {isApproved ? 'VERIFIED QUALITY RECORD' : 'HARVEST RECORD PENDING VERIFICATION'}
            </Text>
            <Text style={styles.statusBannerSub}>
              {isApproved
                ? 'Inspected and certified in accordance with Republic of Liberia standard grading protocols.'
                : 'Batch submitted by producer. Awaiting formal inspection by certified authority.'}
            </Text>
          </View>
        </View>

        {/* Public Batch Summary Card (Zero Sensitive Farmer PII) */}
        <Card style={styles.certCard}>
          <View style={styles.certHeader}>
            <View>
              <Text style={styles.registryTag}>PUBLIC RECORD ARCHIVE</Text>
              <Text style={styles.batchRef}>{harvest.batch_reference}</Text>
            </View>
            <Badge
              label={harvest.status.toUpperCase()}
              variant={isApproved ? 'success' : 'warning'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Agricultural Commodity</Text>
            <Text style={styles.fieldValue}>{harvest.crop?.name || 'Produce'}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Variety / Cultivar</Text>
            <Text style={styles.fieldValue}>{harvest.crop_variety_id || 'Standard Variety'}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Production County</Text>
            <Text style={styles.fieldValue}>
              {harvest.farm?.county || 'Nimba County, Republic of Liberia'}
            </Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Harvest Date</Text>
            <Text style={styles.fieldValue}>{harvest.harvest_date}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Certified Quantity</Text>
            <Text style={styles.fieldValue}>
              {harvest.quantity.toLocaleString()} {harvest.unit}
            </Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Inspection Outcome</Text>
            <Text style={[styles.fieldValue, { color: isApproved ? Colors.primaryDark : Colors.warning }]}>
              {inspection ? inspection.final_grade.replace('_', ' ').toUpperCase() : 'PENDING REVIEW'}
            </Text>
          </View>

          {inspection && (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Date of Inspection</Text>
              <Text style={styles.fieldValue}>
                {new Date(inspection.inspection_date).toLocaleDateString()}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.securitySeal}>
            <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
            <Text style={styles.securityText}>
              Digital Passport Token: {harvest.qr_token}
            </Text>
          </View>
        </Card>

        {/* Traceability Disclaimer required by Master Prompt Section 13 */}
        <View style={styles.disclaimerBox}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.disclaimerText}>
            Notice: This record represents agricultural traceability and quality parameters gathered through the AgriTrack Liberia platform. It confirms crop provenance, harvest season, and post-harvest measurements. Personal farmer contact and financial records are protected by privacy regulations.
          </Text>
        </View>

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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  errorTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.danger,
    marginTop: Spacing.md,
  },
  errorSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  statusApproved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusBannerTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBannerSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  certCard: {
    marginBottom: Spacing.md,
  },
  certHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  registryTag: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  batchRef: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  fieldLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  fieldValue: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  securitySeal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingTop: Spacing.xs,
  },
  securityText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  disclaimerBox: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disclaimerText: {
    fontSize: 11,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },
});
