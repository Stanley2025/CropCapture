import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ShieldCheck,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react-native';
import {
  Colors,
  FontFamily,
  Spacing,
  Typography,
  Shadows,
} from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { HarvestBatch, QualityInspection } from '../../src/types/database';

export default function PublicTraceabilityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [harvest, setHarvest] = useState<HarvestBatch | null>(null);
  const [inspection, setInspection] = useState<QualityInspection | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([localDb.getHarvests(), localDb.getInspections()]).then(([allH, allI]) => {
      const match = allH.find(
        (h) => h.qr_token === token || h.id === token || h.batch_reference === token
      );
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
      <View style={[styles.root, styles.centerBox]}>
        <Text style={styles.loadingText}>Verifying QR passport...</Text>
      </View>
    );
  }

  if (!harvest) {
    return (
      <View style={[styles.root, styles.centerBox]}>
        <AlertCircle size={44} color={Colors.danger} />
        <Text style={styles.errorTitle}>Traceability Record Not Found</Text>
        <Text style={styles.errorSub}>
          The scanned QR token does not match an active CropCapture passport.
        </Text>
        <TouchableOpacity style={styles.returnBtn} onPress={() => router.back()}>
          <Text style={styles.returnBtnText}>Return to scanner</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isServerVerified = Boolean(
    harvest.is_server_verified ||
    harvest.server_signature ||
    (harvest.status === 'approved' &&
      !harvest.is_offline_pending &&
      !harvest.batch_reference.startsWith('PENDING-'))
  );
  const isApproved = harvest.status === 'approved' && isServerVerified;
  const isUnsynced = Boolean(
    harvest.is_offline_pending || harvest.batch_reference.startsWith('PENDING-')
  );

  return (
    <View style={styles.root}>
      {/* Curved Green Header */}
      <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 16) + 10 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={22} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
          <View style={{ flex: 1, paddingLeft: 12 }}>
            <Text style={styles.headerTitle}>CropCapture certificate</Text>
            <Text style={styles.headerSub}>Public agricultural verification record</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Banner Card */}
        <View
          style={[
            styles.statusBanner,
            isApproved
              ? styles.statusBannerApproved
              : isUnsynced
              ? styles.statusBannerDanger
              : styles.statusBannerWarning,
          ]}
        >
          {isApproved ? (
            <ShieldCheck size={28} color="#047857" strokeWidth={2.4} />
          ) : isUnsynced ? (
            <AlertCircle size={28} color={Colors.danger} strokeWidth={2.4} />
          ) : (
            <Clock size={28} color={Colors.amber} strokeWidth={2.4} />
          )}
          <View style={{ flex: 1, paddingLeft: 12 }}>
            <Text
              style={[
                styles.statusBannerTitle,
                isApproved
                  ? { color: '#047857' }
                  : isUnsynced
                  ? { color: Colors.danger }
                  : { color: Colors.amberText },
              ]}
            >
              {isApproved
                ? 'VERIFIED QUALITY RECORD'
                : isUnsynced
                ? 'NOT VERIFIED YET (UNSYNCED BATCH)'
                : 'HARVEST RECORD PENDING VERIFICATION'}
            </Text>
            <Text style={styles.statusBannerSub}>
              {isApproved
                ? 'Inspected and certified in accordance with Republic of Liberia standard grading protocols.'
                : isUnsynced
                ? 'This harvest batch was created offline on a mobile device and has not yet synced to the national cloud registry. Official certification cannot be validated until synchronized.'
                : 'Batch submitted by producer. Awaiting formal inspection by certified authority.'}
            </Text>
          </View>
        </View>

        {/* Certificate Details Card */}
        <View style={styles.certCard}>
          <View style={styles.certCardHeader}>
            <View>
              <Text style={styles.registryTag}>
                {isUnsynced ? 'LOCAL OFFLINE RECORD' : 'PUBLIC RECORD ARCHIVE'}
              </Text>
              <Text style={styles.batchRef}>
                {isUnsynced ? 'Pending number' : harvest.batch_reference}
              </Text>
            </View>
            <View
              style={
                isApproved
                  ? styles.pillApproved
                  : isUnsynced
                  ? styles.pillDanger
                  : styles.pillWarning
              }
            >
              <Text
                style={
                  isApproved
                    ? styles.pillApprovedText
                    : isUnsynced
                    ? styles.pillDangerText
                    : styles.pillWarningText
                }
              >
                {isApproved ? 'VERIFIED' : isUnsynced ? 'NOT VERIFIED YET' : 'PENDING'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Agricultural Commodity</Text>
            <Text style={styles.specValue}>{harvest.crop?.name || 'Produce'}</Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Variety / Cultivar</Text>
            <Text style={styles.specValue}>{harvest.crop_variety_id || 'Suakoko 8'}</Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Production County</Text>
            <Text style={styles.specValue}>Nimba County, Republic of Liberia</Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Harvest Date</Text>
            <Text style={styles.specValue}>{harvest.harvest_date}</Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>
              {isApproved ? 'Certified Quantity' : 'Reported Quantity'}
            </Text>
            <Text style={styles.specValue}>
              {Number(harvest.quantity).toLocaleString()} {harvest.unit}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Quality Grade</Text>
            <Text style={[styles.specValue, { fontFamily: FontFamily.extraBold, color: isApproved ? Colors.primary : Colors.amberText }]}>
              {inspection ? inspection.final_grade.replace('_', ' ').toUpperCase() : isApproved ? 'GRADE A' : 'PENDING INSPECTION'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  errorTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: Colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  errorSub: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  returnBtn: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  headerContainer: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: '#DDF0D8',
    marginTop: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.xl,
    paddingBottom: 40,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    ...Shadows.card,
  },
  statusBannerApproved: {
    backgroundColor: '#E4F4DF',
    borderColor: '#C9DBC4',
  },
  statusBannerWarning: {
    backgroundColor: Colors.amberBg,
    borderColor: '#FDE68A',
  },
  statusBannerDanger: {
    backgroundColor: Colors.dangerBg,
    borderColor: '#FCA5A5',
  },
  statusBannerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 14,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  statusBannerSub: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.xs,
    color: Colors.text,
    lineHeight: 18,
  },
  certCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    ...Shadows.card,
  },
  certCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  registryTag: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  batchRef: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    color: Colors.text,
  },
  pillApproved: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillApprovedText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.primary,
  },
  pillWarning: {
    backgroundColor: Colors.amberBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillWarningText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.amberText,
  },
  pillDanger: {
    backgroundColor: Colors.dangerBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillDangerText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.danger,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  specLabel: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  specValue: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.sizes.sm,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
});
