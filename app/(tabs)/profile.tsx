import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Map,
  Cloud,
  Bell,
  Globe,
  HelpCircle,
  LogOut,
  ChevronRight,
  Camera,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Colors,
  FontFamily,
  Spacing,
  Typography,
  Shadows,
} from '../../src/constants/theme';
import { useAppStore } from '../../src/store/useAppStore';
import { localDb } from '../../src/services/storage/localDatabase';
import { StatsCard } from '../../src/components';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    currentFarmer,
    currentUserProfile,
    currentRole,
    pendingSyncCount,
    logout,
    updateProfilePhoto,
  } = useAppStore();

  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [stats, setStats] = useState({ farmsCount: 2, activitiesCount: 3, harvestsCount: 1 });

  useEffect(() => {
    async function loadStats() {
      try {
        const [f, a, h] = await Promise.all([
          localDb.getFarms(),
          localDb.getActivities(),
          localDb.getHarvests(),
        ]);
        const farmerFarms = currentFarmer?.id
          ? f.filter((x) => x.farmer_id === currentFarmer.id)
          : f;
        const mine = <T extends { farmer_id?: string }>(rows: T[]) =>
          currentFarmer?.id ? rows.filter((x) => x.farmer_id === currentFarmer.id) : rows;
        setStats({
          farmsCount: farmerFarms.length,
          activitiesCount: mine(a).length,
          harvestsCount: mine(h).length,
        });
      } catch (e) {
        console.warn('Failed to load profile stats:', e);
      }
    }
    loadStats();
  }, [currentFarmer?.id]);

  const photoUri = currentUserProfile?.avatar_url || currentFarmer?.photo_url;
  const fullName = currentUserProfile?.full_name || currentFarmer?.full_name || 'Farmer';
  const farmerCode = currentFarmer?.farmer_id_code || 'Not set';
  // Only what is really known: the location comes from the farmer's first registered farm.
  const locationStr =
    [currentUserProfile?.district || currentFarmer?.district, currentUserProfile?.county || currentFarmer?.county]
      .filter((x) => x && String(x).trim())
      .join(', ') || 'Register a farm to set your location';
  const roleName = currentRole.charAt(0).toUpperCase() + currentRole.slice(1).replace('_', ' ');

  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'EG';

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
      'Are you sure you want to remove your profile photo and reset to initials?',
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

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of FarmTori?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/login' as any);
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Curved Green Header */}
        <View style={[styles.headerCurve, { paddingTop: Math.max(insets.top, 16) + 12 }]}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Circular Avatar Overlapping Green Header */}
        <View style={styles.avatarOverlapContainer}>
          <TouchableOpacity
            style={styles.avatarBubble}
            onPress={() => setPhotoModalVisible(true)}
            activeOpacity={0.85}
            accessibilityLabel="Profile photo"
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitials}>{initials}</Text>
            )}
            <View style={styles.cameraIconBadge}>
              <Camera size={14} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Farmer Name & Details */}
        <View style={styles.farmerDetailsSection}>
          <Text style={styles.farmerName}>{fullName}</Text>
          <Text style={styles.farmerSubtitle}>
            {roleName} • {farmerCode} • {locationStr}
          </Text>
        </View>

        {/* 3-Column Stats Card */}
        <View style={styles.statsCardWrapper}>
          <StatsCard
            stats={[
              {
                value: stats.farmsCount,
                label: 'Farms',
                onPress: () => router.push('/farms' as any),
              },
              {
                value: stats.activitiesCount,
                label: 'Activities',
                onPress: () => router.push('/activities' as any),
              },
              {
                value: stats.harvestsCount,
                label: 'Harvest',
                onPress: () => router.push('/harvests' as any),
              },
            ]}
          />
        </View>

        {/* Settings / Options List Card */}
        <View style={styles.listCardWrapper}>
          <View style={styles.listCard}>
            {/* Row 1: My farms */}
            <TouchableOpacity
              style={styles.listRow}
              onPress={() => router.push('/farms' as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.listIconBubble, { backgroundColor: Colors.tintSoft }]}>
                <Map size={20} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.listRowTitle}>My farms</Text>
              <Text style={styles.listRowValue}>{stats.farmsCount}</Text>
              <ChevronRight size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Row 2: Sync center */}
            <TouchableOpacity
              style={styles.listRow}
              onPress={() => router.push('/sync-center' as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.listIconBubble, { backgroundColor: Colors.tintSoft }]}>
                <Cloud size={20} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.listRowTitle}>Sync center</Text>
              <Text style={styles.listRowValue}>
                {pendingSyncCount > 0 ? `${pendingSyncCount} waiting` : 'Synced'}
              </Text>
              <ChevronRight size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Row 3: Weather alerts */}
            <TouchableOpacity
              style={styles.listRow}
              onPress={() => router.push('/weather/alerts' as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.listIconBubble, { backgroundColor: Colors.tintSoft }]}>
                <Bell size={20} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.listRowTitle}>Weather alerts</Text>
              <Text style={styles.listRowValue}>1 new</Text>
              <ChevronRight size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Row 4: Language */}
            <TouchableOpacity
              style={styles.listRow}
              onPress={() => Alert.alert('Language', 'Current language: English (Liberia)')}
              activeOpacity={0.7}
            >
              <View style={[styles.listIconBubble, { backgroundColor: Colors.tintSoft }]}>
                <Globe size={20} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.listRowTitle}>Language</Text>
              <Text style={styles.listRowValue}>English</Text>
              <ChevronRight size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Row 5: Help and support */}
            <TouchableOpacity
              style={styles.listRow}
              onPress={() =>
                Alert.alert(
                  'Help & Support',
                  'Ministry of Agriculture Farmer Helpline: 4455\nLocal Extension Officer: Emmanuel Nimba Office\nFarmTori Offline Support: active.'
                )
              }
              activeOpacity={0.7}
            >
              <View style={[styles.listIconBubble, { backgroundColor: Colors.tintSoft }]}>
                <HelpCircle size={20} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.listRowTitle}>Help and support</Text>
              <ChevronRight size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Row 6: Log out */}
            <TouchableOpacity
              style={styles.listRow}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <View style={[styles.listIconBubble, { backgroundColor: Colors.dangerBg }]}>
                <LogOut size={20} color={Colors.danger} strokeWidth={2.2} />
              </View>
              <Text style={[styles.listRowTitle, { color: Colors.danger }]}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Profile Photo Modal */}
      <Modal
        visible={photoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Profile Photo</Text>
            <Text style={styles.modalSub}>
              Take a new photo or select one from your gallery.
            </Text>

            {isProcessingPhoto ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 20 }} />
            ) : (
              <View style={styles.modalOptions}>
                <TouchableOpacity style={styles.modalOptionBtn} onPress={handleTakePhoto}>
                  <Camera size={20} color={Colors.primary} />
                  <Text style={styles.modalOptionText}>Take photo</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalOptionBtn} onPress={handlePickFromGallery}>
                  <ImageIcon size={20} color={Colors.primary} />
                  <Text style={styles.modalOptionText}>Choose from gallery</Text>
                </TouchableOpacity>

                {photoUri && (
                  <TouchableOpacity style={styles.modalOptionBtn} onPress={handleRemovePhoto}>
                    <Trash2 size={20} color={Colors.danger} />
                    <Text style={[styles.modalOptionText, { color: Colors.danger }]}>
                      Remove photo
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setPhotoModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerCurve: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 64,
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  avatarOverlapContainer: {
    alignItems: 'center',
    marginTop: -48,
    marginBottom: 12,
  },
  avatarBubble: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Shadows.card,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarInitials: {
    fontFamily: FontFamily.extraBold,
    fontSize: 32,
    color: Colors.primaryDark,
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmerDetailsSection: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  farmerName: {
    fontFamily: FontFamily.extraBold,
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  farmerSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  statsCardWrapper: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  listCardWrapper: {
    paddingHorizontal: Spacing.xl,
  },
  listCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 4,
    ...Shadows.card,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  listIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRowTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.sizes.base,
    color: Colors.text,
    flex: 1,
  },
  listRowValue: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    marginRight: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 24,
    ...Shadows.card,
  },
  modalTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    color: Colors.text,
    marginBottom: 4,
  },
  modalSub: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    marginBottom: 20,
  },
  modalOptions: {
    gap: 12,
    marginBottom: 16,
  },
  modalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  modalOptionText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: Colors.text,
  },
  modalCancelBtn: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: Colors.textMuted,
  },
});
