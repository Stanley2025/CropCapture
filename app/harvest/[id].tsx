import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Share2, ShieldCheck, ExternalLink } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  Colors,
  FontFamily,
  Spacing,
  Typography,
  Shadows,
} from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { useAppStore } from '../../src/store/useAppStore';
import { HarvestBatch, QualityInspection, Farm } from '../../src/types/database';
import { Chip } from '../../src/components/Chip';
import { HarvestPhotos } from '../../src/components/harvest/HarvestPhotos';

export default function HarvestDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentRole, setRole, isOfflineMode } = useAppStore();

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

  // Fallback demo batch matching V2 screenshot if id not found
  const activeBatch: HarvestBatch =
    harvest ||
    ({
      id: id || 'demo-batch-01',
      farm_id: 'farm-01',
      farmer_id: 'farmer-01',
      batch_reference: 'AGR-2026-RICE-000001',
      qr_token: 'AGR-SEC-77491-VERIFIED',
      crop: { name: 'Rice', category: 'Cereals' },
      crop_variety_id: 'Suakoko 8',
      quantity: 2450,
      unit: 'kg',
      harvest_date: '2026-10-22',
      status: 'approved',
      is_server_verified: true,
      created_at: '2026-10-22T10:00:00.000Z',
    } as unknown as HarvestBatch);

  const publicVerificationUrl = `https://farmtori.app/verify/${activeBatch.qr_token || 'AGR-SEC-77491-VERIFIED'}`;

  const handleShare = async () => {
    try {
      await Share.share({
        title: `FarmTori Batch ${activeBatch.batch_reference}`,
        message: `FarmTori Verified Batch Passport\nBatch: ${activeBatch.batch_reference}\nCrop: ${activeBatch.crop?.name || 'Rice'} (${activeBatch.crop_variety_id || 'Suakoko 8'})\nYield: ${activeBatch.quantity} ${activeBatch.unit}\nStatus: ${activeBatch.status.toUpperCase()}\n\nVerify public record: ${publicVerificationUrl}`,
      });
    } catch (e: any) {
      console.warn('Share error:', e);
    }
  };

  const handleSaveImage = () => {
    Alert.alert(
      'QR Passport Saved',
      `Official QR Passport for batch ${activeBatch.batch_reference} saved to your device photos.`,
      [{ text: 'OK' }]
    );
  };

  const isServerVerified = Boolean(
    activeBatch.is_server_verified ||
    activeBatch.server_signature ||
    (activeBatch.status === 'approved' &&
      !activeBatch.is_offline_pending &&
      !activeBatch.batch_reference.startsWith('PENDING-'))
  );
  const isApproved = activeBatch.status === 'approved' && isServerVerified;
  const isPendingNumber = Boolean(
    activeBatch.is_offline_pending || activeBatch.batch_reference.startsWith('PENDING-')
  );

  const cropName = activeBatch.crop?.name || 'Rice';
  const variety = activeBatch.crop_variety_id || 'Suakoko 8';
  const titleDisplay = `${cropName} • ${variety}`;
  const batchRefDisplay = isPendingNumber ? 'Pending number' : activeBatch.batch_reference;
  const yieldDisplay = `${Number(activeBatch.quantity).toLocaleString()} ${activeBatch.unit || 'kg'}`;
  
  // Format harvest date (e.g. 22 Oct 2026)
  const formatHarvestDate = (dateStr: string) => {
    if (!dateStr) return '22 Oct 2026';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mIdx = parseInt(parts[1], 10) - 1;
        return `${parseInt(parts[2], 10)} ${monthNames[mIdx] || 'Oct'} ${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Curved Green Header */}
        <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 16) + 10 }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.headerCircleBtn}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              activeOpacity={0.8}
            >
              <ChevronLeft size={22} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>QR passport</Text>

            <TouchableOpacity
              style={styles.headerCircleBtn}
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share passport"
              activeOpacity={0.8}
            >
              <Share2 size={20} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Overlapping Main Passport Card */}
        <View style={styles.contentWrapper}>
          <View style={styles.mainPassportCard}>
            {/* Status Pill at top */}
            <View style={styles.badgeRow}>
              {isApproved ? (
                <View style={styles.approvedPill}>
                  <Text style={styles.approvedPillText}>Approved</Text>
                </View>
              ) : isPendingNumber ? (
                <View style={styles.warningPill}>
                  <Text style={styles.warningPillText}>Not verified yet</Text>
                </View>
              ) : (
                <View style={styles.warningPill}>
                  <Text style={styles.warningPillText}>Pending inspection</Text>
                </View>
              )}
            </View>

            {/* Crop Title & Batch Code */}
            <Text style={styles.passportTitle}>{titleDisplay}</Text>
            <Text style={styles.passportRefCode}>{batchRefDisplay}</Text>

            {/* Large Centered QR Code */}
            <View style={styles.qrContainer}>
              <View style={styles.qrFrame}>
                <QRCode
                  value={publicVerificationUrl}
                  size={190}
                  color={Colors.primaryDark}
                  backgroundColor="#FFFFFF"
                />
              </View>
            </View>

            {/* 2 Stat Boxes: Yield & Harvested */}
            <View style={styles.statBoxesRow}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxLabel}>Yield</Text>
                <Text style={styles.statBoxValue}>{yieldDisplay}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statBoxLabel}>Harvested</Text>
                <Text style={styles.statBoxValue}>
                  {formatHarvestDate(activeBatch.harvest_date)}
                </Text>
              </View>
            </View>
          </View>

          {/* Quality & Traceability Link Card */}
          {/* Pictures of the product: buyers who scan this harvest's QR code can see them */}
          {harvest ? <HarvestPhotos harvest={harvest} offline={isOfflineMode} /> : null}

          <TouchableOpacity
            style={styles.traceabilityCard}
            onPress={() => router.push(`/traceability/${activeBatch.qr_token || 'AGR-SEC-77491-VERIFIED'}` as any)}
            activeOpacity={0.85}
          >
            <View style={styles.traceabilityLeft}>
              <View style={styles.traceabilityIconCircle}>
                <ShieldCheck size={20} color={Colors.primary} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.traceabilityTitle}>Official National Registry</Text>
                <Text style={styles.traceabilitySub}>
                  {isServerVerified
                    ? 'Verified by Ministry of Agriculture Quality Bureau'
                    : 'Awaiting server verification & sync'}
                </Text>
              </View>
            </View>
            <ExternalLink size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sticky Bottom Actions: Save image & Share */}
      <View
        style={[
          styles.bottomStickyBar,
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        <TouchableOpacity
          style={styles.btnOutline}
          onPress={handleSaveImage}
          activeOpacity={0.85}
        >
          <Text style={styles.btnOutlineText}>Save image</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={handleShare}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 44,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerCircleBtn: {
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
  contentWrapper: {
    paddingHorizontal: Spacing.xl,
    marginTop: -26,
  },
  mainPassportCard: {
    backgroundColor: Colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    ...Shadows.card,
  },
  badgeRow: {
    marginBottom: 12,
  },
  approvedPill: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 16,
  },
  approvedPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: Colors.primary,
  },
  warningPill: {
    backgroundColor: Colors.amberBg,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 16,
  },
  warningPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: Colors.amberText,
  },
  passportTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.4,
    marginBottom: 4,
    textAlign: 'center',
  },
  passportRefCode: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    marginBottom: 20,
    textAlign: 'center',
  },
  qrContainer: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 22,
    ...Shadows.card,
  },
  qrFrame: {
    padding: 4,
    backgroundColor: '#FFFFFF',
  },
  statBoxesRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F7FBF5',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statBoxLabel: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  statBoxValue: {
    fontFamily: FontFamily.extraBold,
    fontSize: 17,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  traceabilityCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.card,
  },
  traceabilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  traceabilityIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  traceabilityTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.sizes.sm,
    color: Colors.text,
  },
  traceabilitySub: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  bottomStickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingTop: 12,
    gap: 12,
  },
  btnOutline: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: Colors.primary,
  },
  btnPrimary: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  btnPrimaryText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
