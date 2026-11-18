import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/useAppStore';
import { Header } from '../../src/components/Header';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';

export default function ProfileScreen() {
  const router = useRouter();
  const { currentFarmer, currentUserProfile, currentRole, pendingSyncCount, isOfflineMode, toggleOfflineMode, logout } =
    useAppStore();

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={currentRole === 'farmer' ? 'Farmer Profile' : 'Staff Profile'}
        subtitle="Identification & account settings"
      />
      <OfflineBanner />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Profile Identity Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={36} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={styles.farmerName}>{currentUserProfile.full_name || currentFarmer.full_name}</Text>
              <Text style={styles.farmerLocation}>
                {currentUserProfile.community || currentFarmer.community}, {currentUserProfile.county || currentFarmer.county}
              </Text>
              <View style={styles.idBadgeRow}>
                <Badge
                  label={
                    currentRole === 'farmer'
                      ? currentFarmer.farmer_id_code
                      : currentRole === 'extension_officer'
                      ? 'EXT-LR-0042'
                      : currentRole === 'quality_inspector'
                      ? 'INSP-LR-0019'
                      : 'COOP-MGR-003'
                  }
                  variant="gold"
                  size="sm"
                />
                <Badge label={currentRole.replace('_', ' ').toUpperCase()} variant="success" size="sm" />
              </View>
            </View>
          </View>
        </Card>

        {/* Cooperative Membership Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="people-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Cooperative Affiliation</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Cooperative Name</Text>
            <Text style={styles.fieldValue}>Nimba Farmers Multipurpose Cooperative</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Member Code</Text>
            <Text style={styles.fieldValue}>NFMC-01-0082</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Central Warehouse</Text>
            <Text style={styles.fieldValue}>Sanniquellie-Mahn Regional Depot</Text>
          </View>
        </Card>

        {/* Assigned Role Workspace */}
        {(currentRole === 'quality_inspector' || currentRole === 'extension_officer') && (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="shield-outline" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Assigned Role Workspace</Text>
            </View>

            {currentRole === 'quality_inspector' && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => router.push('/inspector' as any)}
              >
                <View style={styles.actionLeft}>
                  <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
                  <View>
                    <Text style={styles.actionTitle}>Inspector Workspace</Text>
                    <Text style={styles.actionSub}>Conduct formal grading & certificate issuance</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}

            {currentRole === 'extension_officer' && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => router.push('/extension' as any)}
              >
                <View style={styles.actionLeft}>
                  <Ionicons name="navigate" size={20} color={Colors.primary} />
                  <View>
                    <Text style={styles.actionTitle}>Extension Officer Workspace</Text>
                    <Text style={styles.actionSub}>Monitor assigned parcels & issue advisories</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* System & Offline Data Tools */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="settings-outline" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Data Tools & Synchronization</Text>
          </View>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/splash' as any)}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="images-outline" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.actionTitle}>App Story & Visual Tour</Text>
                <Text style={styles.actionSub}>View the 4-part illustrated harvest walkthrough</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/sync-center' as any)}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="cloud-done-outline" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.actionTitle}>Offline Synchronization Center</Text>
                <Text style={styles.actionSub}>
                  {pendingSyncCount > 0 ? `${pendingSyncCount} record(s) queued` : 'Local SQLite synchronized'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/inputs-expenses' as any)}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.actionTitle}>Inputs & Operating Expenses</Text>
                <Text style={styles.actionSub}>USD and LRD cost ledgers</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/reports' as any)}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="bar-chart-outline" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.actionTitle}>Production Reports & Analytics</Text>
                <Text style={styles.actionSub}>Exportable seasonal summaries</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={toggleOfflineMode}
          >
            <View style={styles.actionLeft}>
              <Ionicons
                name={isOfflineMode ? 'cloud-offline' : 'cloud-done'}
                size={20}
                color={isOfflineMode ? Colors.warning : Colors.accent}
              />
              <View>
                <Text style={styles.actionTitle}>
                  {isOfflineMode ? 'Disable Forced Offline Mode' : 'Enable Forced Offline Mode'}
                </Text>
                <Text style={styles.actionSub}>
                  {isOfflineMode ? 'Currently operating offline' : 'Currently operating with online sync'}
                </Text>
              </View>
            </View>
            <Badge label={isOfflineMode ? 'OFFLINE' : 'ONLINE'} variant={isOfflineMode ? 'warning' : 'success'} size="sm" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionRow, { borderBottomWidth: 0 }]}
            onPress={() => {
              Alert.alert('Sign Out', 'Are you sure you want to log out of CropCapture?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: async () => {
                    await logout();
                    router.replace('/login');
                  },
                },
              ]);
            }}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
              <View>
                <Text style={[styles.actionTitle, { color: Colors.danger }]}>Sign Out</Text>
                <Text style={styles.actionSub}>Log out and return to Login</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.danger} />
          </TouchableOpacity>
        </Card>

        {/* Application About & Build Info */}
        <View style={styles.aboutBox}>
          <Text style={styles.aboutTitle}>CropCapture Mobile App</Text>
          <Text style={styles.aboutTagline}>Every Farm Recorded. Every Harvest Measured. Every Quality Verified.</Text>
          <Text style={styles.aboutVersion}>Version 1.0.0 • React Native Expo • Offline-First Engine</Text>
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
  profileCard: {
    marginBottom: Spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  farmerName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  farmerLocation: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  idBadgeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: 6,
  },
  sectionCard: {
    marginBottom: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  fieldDesc: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceAlt,
  },
  fieldLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  fieldValue: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  actionTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  actionSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  aboutBox: {
    alignItems: 'center',
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  aboutTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  aboutTagline: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 2,
  },
  aboutVersion: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
