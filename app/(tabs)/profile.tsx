import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/useAppStore';
import { Header } from '../../src/components/Header';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';

export default function ProfileScreen() {
  const router = useRouter();
  const {
    currentFarmer,
    currentUserProfile,
    currentRole,
    pendingSyncCount,
    isOfflineMode,
    toggleOfflineMode,
    logout,
    updateProfilePhoto,
  } = useAppStore();

  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  const photoUri = currentUserProfile.avatar_url || currentFarmer.photo_url;

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please grant camera permissions to take a photo for your profile.'
        );
        return;
      }
      setIsProcessingPhoto(true);
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await updateProfilePhoto(result.assets[0].uri);
        Alert.alert('Photo Saved', 'Your farmer profile photo has been updated.');
      }
    } catch (e: any) {
      Alert.alert('Camera Error', e?.message || 'Could not capture photo.');
    } finally {
      setIsProcessingPhoto(false);
      setPhotoModalVisible(false);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Gallery Permission Required',
          'Please grant media library permissions to choose a profile photo.'
        );
        return;
      }
      setIsProcessingPhoto(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await updateProfilePhoto(result.assets[0].uri);
        Alert.alert('Photo Saved', 'Your farmer profile photo has been updated.');
      }
    } catch (e: any) {
      Alert.alert('Gallery Error', e?.message || 'Could not select photo.');
    } finally {
      setIsProcessingPhoto(false);
      setPhotoModalVisible(false);
    }
  };

  const handleRemovePhoto = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo and reset to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await updateProfilePhoto(null);
            setPhotoModalVisible(false);
          },
        },
      ]
    );
  };

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
            <TouchableOpacity
              style={styles.avatarTouchable}
              onPress={() => setPhotoModalVisible(true)}
              activeOpacity={0.8}
              accessibilityLabel="Tap to change profile photo"
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Ionicons name="person" size={38} color={Colors.primary} />
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={12} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

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

              <TouchableOpacity
                style={styles.photoActionBtn}
                onPress={() => setPhotoModalVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={13} color={Colors.primary} />
                <Text style={styles.photoActionText}>
                  {photoUri ? 'Change Photo' : '+ Add Farmer Photo'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        {/* Farmer Photo & Digital Identity Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="id-card-outline" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Farmer Identity & Digital Passport</Text>
          </View>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => setPhotoModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.actionLeft}>
              <View style={styles.miniPhotoThumb}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.miniThumbImage} />
                ) : (
                  <Ionicons name="camera-outline" size={18} color={Colors.primary} />
                )}
              </View>
              <View>
                <Text style={styles.actionTitle}>Profile Portrait</Text>
                <Text style={styles.actionSub}>
                  {photoUri
                    ? 'Custom photo verified • Tap to update'
                    : 'No portrait set • Tap to take or choose photo'}
                </Text>
              </View>
            </View>
            <Badge
              label={photoUri ? 'ATTACHED' : 'ADD PHOTO'}
              variant={photoUri ? 'success' : 'warning'}
              size="sm"
            />
          </TouchableOpacity>
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

      {/* Photo Picker Modal */}
      <Modal
        visible={photoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPhotoModalVisible(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profile Photo</Text>
              <TouchableOpacity
                onPress={() => setPhotoModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Take a new photo or select from your device gallery to personalize your farmer profile passport.
            </Text>

            {isProcessingPhoto ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Saving profile photo...</Text>
              </View>
            ) : (
              <View style={styles.modalOptions}>
                <TouchableOpacity
                  style={styles.modalOptionRow}
                  onPress={handleTakePhoto}
                  activeOpacity={0.7}
                >
                  <View style={[styles.modalOptionIcon, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="camera" size={22} color="#15803D" />
                  </View>
                  <View style={styles.modalOptionTextWrapper}>
                    <Text style={styles.modalOptionTitle}>Take Photo with Camera</Text>
                    <Text style={styles.modalOptionDesc}>Use camera to capture portrait</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalOptionRow, !photoUri && { borderBottomWidth: 0 }]}
                  onPress={handlePickFromGallery}
                  activeOpacity={0.7}
                >
                  <View style={[styles.modalOptionIcon, { backgroundColor: '#E0F2FE' }]}>
                    <Ionicons name="images" size={22} color="#0369A1" />
                  </View>
                  <View style={styles.modalOptionTextWrapper}>
                    <Text style={styles.modalOptionTitle}>Choose from Photo Gallery</Text>
                    <Text style={styles.modalOptionDesc}>Pick an image from your device</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                {photoUri ? (
                  <TouchableOpacity
                    style={[styles.modalOptionRow, { borderBottomWidth: 0 }]}
                    onPress={handleRemovePhoto}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.modalOptionIcon, { backgroundColor: '#FEE2E2' }]}>
                      <Ionicons name="trash-outline" size={20} color="#B91C1C" />
                    </View>
                    <View style={styles.modalOptionTextWrapper}>
                      <Text style={[styles.modalOptionTitle, { color: '#B91C1C' }]}>
                        Remove Photo
                      </Text>
                      <Text style={styles.modalOptionDesc}>Reset avatar to default icon</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setPhotoModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  avatarTouchable: {
    position: 'relative',
    width: 72,
    height: 72,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: Colors.surfaceAlt,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
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
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  photoActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
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
  miniPhotoThumb: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  miniThumbImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
  /* Modal Sheet Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  modalOptions: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  modalOptionTextWrapper: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalOptionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: Spacing.sm,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  cancelBtn: {
    marginTop: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
