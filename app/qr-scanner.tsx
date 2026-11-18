import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../src/constants/theme';
import { Header } from '../src/components/Header';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { localDb } from '../src/services/storage/localDatabase';

export default function QRScannerScreen() {
  const router = useRouter();
  const [manualToken, setManualToken] = useState('');
  const [recentBatches, setRecentBatches] = useState<Array<{ ref: string; token: string; crop: string }>>([]);

  React.useEffect(() => {
    localDb.getHarvests().then((all) => {
      setRecentBatches(
        all.slice(0, 3).map((h) => ({
          ref: h.batch_reference,
          token: h.qr_token,
          crop: h.crop?.name || 'Produce',
        }))
      );
    });
  }, []);

  const handleVerify = (tokenToVerify?: string) => {
    const raw = tokenToVerify || manualToken.trim();
    if (!raw) {
      Alert.alert('Input Required', 'Please enter a batch reference or QR verification token.');
      return;
    }

    // Extract token if user pasted full URL (e.g. https://agritrack.lr/verify/xyz)
    const cleaned = raw.includes('/verify/') ? raw.split('/verify/')[1] : raw;
    router.push(`/traceability/${cleaned}` as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Scan QR Passport" subtitle="Batch provenance & quality inspection" showBack />

      <View style={styles.container}>
        {/* Camera Viewfinder Mockup */}
        <View style={styles.viewfinderContainer}>
          <View style={styles.cameraFrame}>
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
            <Ionicons name="qr-code-outline" size={80} color="rgba(255,255,255,0.7)" />
            <Text style={styles.frameInstructions}>
              Align AgriTrack QR passport code inside this frame
            </Text>
          </View>
        </View>

        {/* Manual Token Fallback */}
        <Card style={styles.inputCard}>
          <Text style={styles.inputTitle}>Manual Batch Reference or Token</Text>
          <Text style={styles.inputSub}>
            If lighting or camera lens is obstructed, type or paste the batch identifier.
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="e.g. AGR-2026-RICE-000001"
              placeholderTextColor={Colors.textMuted}
              value={manualToken}
              onChangeText={setManualToken}
              autoCapitalize="characters"
            />
            <Button
              title="Verify"
              onPress={() => handleVerify()}
              size="sm"
              style={{ marginLeft: Spacing.xs }}
            />
          </View>

          {recentBatches.length > 0 && (
            <View style={styles.quickList}>
              <Text style={styles.quickLabel}>Registered Batches on Device:</Text>
              {recentBatches.map((b) => (
                <TouchableOpacity
                  key={b.ref}
                  style={styles.quickItem}
                  onPress={() => handleVerify(b.token)}
                >
                  <Ionicons name="document-text-outline" size={14} color={Colors.primary} />
                  <Text style={styles.quickItemText}>
                    {b.ref} ({b.crop})
                  </Text>
                  <Ionicons name="chevron-forward" size={12} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>
      </View>
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
    padding: Spacing.md,
  },
  viewfinderContainer: {
    height: 260,
    backgroundColor: '#0F172A',
    borderRadius: Radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  cameraFrame: {
    width: 200,
    height: 200,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    padding: Spacing.md,
  },
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: Colors.primaryLight,
  },
  cornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.primaryLight,
  },
  cornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: Colors.primaryLight,
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.primaryLight,
  },
  frameInstructions: {
    color: '#CBD5E1',
    fontSize: 10,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  inputCard: {
    padding: Spacing.lg,
  },
  inputTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  inputSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: Typography.sizes.sm,
    color: Colors.text,
  },
  quickList: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  quickLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  quickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceAlt,
  },
  quickItemText: {
    fontSize: Typography.sizes.xs,
    color: Colors.primaryDark,
    fontWeight: '600',
    flex: 1,
  },
});
