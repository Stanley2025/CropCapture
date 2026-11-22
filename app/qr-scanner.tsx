import React, { useState, useEffect, useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { KeyboardAwareScrollView } from '../src/components/KeyboardAwareScrollView';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, QrCode, Search, ArrowRight } from 'lucide-react-native';
import {
  Colors,
  FontFamily,
  Spacing,
  Typography,
  Shadows,
} from '../src/constants/theme';
import { localDb } from '../src/services/storage/localDatabase';
import { parseScanned } from '../src/shared/buyerLink';

export default function QRScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [manualToken, setManualToken] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const justScanned = useRef(false);

  // The camera reads the QR code by itself: one code opens one page (not once per camera frame).
  const onScanned = ({ data }: { data: string }) => {
    if (justScanned.current || !data) return;
    justScanned.current = true;
    handleVerify(data);
    setTimeout(() => {
      justScanned.current = false;
    }, 3000);
  };
  const [recentBatches, setRecentBatches] = useState<Array<{ ref: string; token: string; crop: string }>>([]);

  useEffect(() => {
    localDb.getHarvests().then((all) => {
      setRecentBatches(
        all.slice(0, 3).map((h) => ({
          ref: h.batch_reference,
          token: h.public_code || h.qr_token,
          crop: h.crop?.name || 'Produce',
        }))
      );
    });
  }, []);

  const handleVerify = (tokenToVerify?: string) => {
    const raw = tokenToVerify || manualToken.trim();
    if (!raw) {
      Alert.alert('Input Required', 'Please enter a batch reference or the code from the QR link.');
      return;
    }
    // a buyer link (/b/{code}), an older /verify/ link, or a code or batch reference typed by hand
    router.push(`/traceability/${encodeURIComponent(parseScanned(raw).value)}` as any);
  };

  return (
    <View style={styles.root}>
      {/* Top Header */}
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
            <Text style={styles.headerTitle}>Scan QR passport</Text>
            <Text style={styles.headerSub}>See a harvest's photos and farm activity</Text>
          </View>
        </View>
      </View>

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Scanner Viewfinder Box */}
        <View style={styles.viewfinderCard}>
          <View style={styles.cameraBox}>
            {permission?.granted ? (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={onScanned}
                accessibilityLabel="Camera for scanning a harvest QR code"
              />
            ) : null}
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
            {permission?.granted ? (
              <Text style={styles.viewfinderHint}>Align QR code within frame</Text>
            ) : (
              <>
                <QrCode size={72} color="rgba(255,255,255,0.7)" strokeWidth={1.5} />
                <TouchableOpacity style={styles.verifyBtn} onPress={requestPermission} activeOpacity={0.85} accessibilityRole="button">
                  <Text style={styles.verifyBtnText}>Allow the camera to scan</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Manual Code Input Card */}
        <View style={styles.manualCard}>
          <Text style={styles.manualCardTitle}>Enter a batch ID or code</Text>
          <Text style={styles.manualCardSub}>
            If camera scanning is unavailable in low light or offline.
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Batch ID or the code from the QR link"
              placeholderTextColor={Colors.textMuted}
              value={manualToken}
              onChangeText={setManualToken}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={styles.verifyBtn}
            onPress={() => handleVerify()}
            activeOpacity={0.85}
          >
            <Text style={styles.verifyBtnText}>Open harvest details</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Batches List */}
        {recentBatches.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentSectionTitle}>Recent batches</Text>
            <View style={styles.recentCard}>
              {recentBatches.map((b, idx) => {
                const isLast = idx === recentBatches.length - 1;
                return (
                  <TouchableOpacity
                    key={b.ref}
                    style={[styles.recentRow, !isLast && styles.recentRowDivider]}
                    onPress={() => handleVerify(b.token)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recentRef}>{b.ref}</Text>
                      <Text style={styles.recentCrop}>{b.crop} • Batch</Text>
                    </View>
                    <ArrowRight size={18} color={Colors.primary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
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
  viewfinderCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    ...Shadows.card,
  },
  cameraBox: {
    width: 220,
    height: 220,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  cornerTL: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 24,
    height: 24,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderColor: Colors.lime,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderColor: Colors.lime,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 24,
    height: 24,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderColor: Colors.lime,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 24,
    height: 24,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderColor: Colors.lime,
    borderBottomRightRadius: 6,
  },
  viewfinderHint: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: '#DDF0D8',
    marginTop: 14,
  },
  manualCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    marginBottom: 20,
    ...Shadows.card,
  },
  manualCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 4,
  },
  manualCardSub: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginBottom: 16,
  },
  inputRow: {
    marginBottom: 14,
  },
  textInput: {
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 16,
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: Colors.text,
  },
  verifyBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  recentSection: {
    marginBottom: 20,
  },
  recentSectionTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 17,
    color: Colors.text,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  recentCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    ...Shadows.card,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  recentRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  recentRef: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: Colors.text,
  },
  recentCrop: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
