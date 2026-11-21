import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ScrollView, Switch } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { useAppStore } from '../../src/store/useAppStore';
import {
  captureHarvestPhoto,
  removeHarvestPhoto,
  retryHarvestPhoto,
  setHarvestPhotoTag,
  uploadPendingHarvestPhotos,
  getAllowMobileData,
  setAllowMobileData,
  currentNetwork,
  PhotoSource,
} from '../../src/services/photos/harvestPhotoService';
import { HarvestBatch, HarvestPhoto } from '../../src/types/database';
import { t, StringKey } from '../../src/i18n/en';
import { MAX_PHOTOS_PER_HARVEST, PHOTO_TAGS, PhotoTag, photoStatusKey, canAddPhoto, Network } from '../../src/shared/harvestPhotos';

const TAG_KEY: Record<PhotoTag, StringKey> = { bags: 'tagBags', grain: 'tagGrain', heap: 'tagHeap', field: 'tagField', other: 'tagOther' };
const STATUS_KEY: Record<string, StringKey> = {
  uploaded: 'statusUploaded',
  uploading: 'statusUploading',
  failed: 'statusFailed',
  waitingWifi: 'statusWaitingWifi',
  waiting: 'statusWaiting',
};
const STATUS_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  uploaded: 'checkmark-circle',
  uploading: 'cloud-upload-outline',
  failed: 'alert-circle',
  waitingWifi: 'wifi-outline',
  waiting: 'time-outline',
};

export default function HarvestPhotosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isOfflineMode } = useAppStore();
  const [harvest, setHarvest] = useState<HarvestBatch | null>(null);
  const [photos, setPhotos] = useState<HarvestPhoto[]>([]);
  const [nextTag, setNextTag] = useState<PhotoTag>('other');
  const [tagOpen, setTagOpen] = useState<string | null>(null);
  const [mobileData, setMobileData] = useState(false);
  const [network, setNetwork] = useState<Network | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setHarvest((await localDb.getHarvests()).find((h) => h.id === id) || null);
    setPhotos(await localDb.getHarvestPhotos(id));
    setMobileData(await getAllowMobileData());
    setNetwork(await currentNetwork());
    setLoaded(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
      // pictures taken without a connection are sent as soon as this screen is opened on a good connection
      uploadPendingHarvestPhotos(isOfflineMode).then((n) => { if (n > 0) load(); });
    }, [load, isOfflineMode])
  );

  // photos that are still uploading change status on their own: look again shortly
  useEffect(() => {
    if (!photos.some((p) => p.upload_status === 'uploading')) return;
    const timer = setTimeout(load, 2500);
    return () => clearTimeout(timer);
  }, [photos, load]);

  const add = async (source: PhotoSource) => {
    if (!harvest) return;
    const result = await captureHarvestPhoto(harvest, source, isOfflineMode, nextTag);
    await load();
    if (result.ok) return;
    if (result.reason === 'permission') Alert.alert(t('photoPermissionTitle'), t(source === 'camera' ? 'photoPermissionCamera' : 'photoPermissionLibrary'));
    else if (result.reason === 'limit') Alert.alert(t('harvestPhotosTitle'), t('photoLimit', { count: MAX_PHOTOS_PER_HARVEST }));
    else if (result.reason === 'too_large') Alert.alert(t('harvestPhotosTitle'), t('photoTooLarge'));
    else if (result.reason === 'error') Alert.alert(t('harvestPhotosTitle'), t('photoFailed'));
  };

  const confirmDelete = (photo: HarvestPhoto) =>
    Alert.alert(t('photoDeleteTitle'), t('photoDeleteAsk'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: t('photoDelete'),
        style: 'destructive',
        onPress: async () => {
          await removeHarvestPhoto(photo);
          await load();
        },
      },
    ]);

  const toggleMobileData = async (value: boolean) => {
    setMobileData(value);
    await setAllowMobileData(value);
    uploadPendingHarvestPhotos(isOfflineMode).then(() => load());
  };

  if (loaded && !harvest) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.muted}>{t('harvestNotFound')}</Text>
      </View>
    );
  }

  const full = !canAddPhoto(photos);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 6 }]}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('harvestPhotosTitle')}</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.noteRow}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.primaryDark} />
          <Text style={styles.note}>{t('photosBuyersNote')}</Text>
        </View>
        <Text style={styles.count}>{t('photosCount', { count: photos.length, max: MAX_PHOTOS_PER_HARVEST })}</Text>

        <View style={styles.grid}>
          {photos.map((p) => {
            const status = photoStatusKey(p, { wifiOnly: !mobileData, network });
            return (
              <View key={p.id} style={styles.cell}>
                <Image source={{ uri: p.local_uri || undefined }} style={styles.image} accessibilityLabel={t('photoOfProduct')} />
                <TouchableOpacity
                  style={styles.tagChip}
                  onPress={() => setTagOpen(tagOpen === p.id ? null : p.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('tagChange')}: ${t(TAG_KEY[p.tag] || 'tagOther')}`}
                >
                  <Text style={styles.tagChipText}>{t(TAG_KEY[p.tag] || 'tagOther')}</Text>
                </TouchableOpacity>
                {tagOpen === p.id ? (
                  <View style={styles.tagRow}>
                    {PHOTO_TAGS.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={[styles.pick, p.tag === tag && styles.pickActive]}
                        onPress={async () => {
                          setTagOpen(null);
                          await setHarvestPhotoTag(p, tag);
                          await load();
                        }}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.pickText, p.tag === tag && styles.pickTextActive]}>{t(TAG_KEY[tag])}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                <View style={styles.statusRow}>
                  <Ionicons name={STATUS_ICON[status]} size={15} color={status === 'failed' ? Colors.danger : status === 'uploaded' ? Colors.primary : Colors.textMuted} />
                  <Text style={[styles.status, status === 'failed' && { color: Colors.danger }]}>{t(STATUS_KEY[status])}</Text>
                </View>
                <View style={styles.actions}>
                  {status === 'failed' ? (
                    <TouchableOpacity style={styles.smallBtn} onPress={() => retryHarvestPhoto(p, isOfflineMode).then(load)} accessibilityRole="button">
                      <Ionicons name="refresh" size={16} color={Colors.primary} />
                      <Text style={styles.smallBtnText}>{t('photoRetry')}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.smallBtn} onPress={() => confirmDelete(p)} accessibilityRole="button" accessibilityLabel={t('photoDelete')}>
                    <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                    <Text style={[styles.smallBtnText, { color: Colors.danger }]}>{t('photoDelete')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          {!full ? (
            <TouchableOpacity style={[styles.cell, styles.addTile]} onPress={() => add('camera')} accessibilityRole="button" accessibilityLabel={t('photoAddTile')}>
              <Ionicons name="add-circle-outline" size={34} color={Colors.primary} />
              <Text style={styles.addText}>{t('photoAddTile')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {!full ? (
          <>
            <Text style={styles.label}>{t('tagForNext')}</Text>
            <View style={styles.tagRow}>
              {PHOTO_TAGS.map((tag) => (
                <TouchableOpacity key={tag} style={[styles.pick, nextTag === tag && styles.pickActive]} onPress={() => setNextTag(tag)} accessibilityRole="button">
                  <Text style={[styles.pickText, nextTag === tag && styles.pickTextActive]}>{t(TAG_KEY[tag])}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.buttons}>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => add('camera')} accessibilityRole="button">
                <Ionicons name="camera" size={20} color="#FFFFFF" />
                <Text style={styles.btnPrimaryText}>{t('photoTake')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => add('library')} accessibilityRole="button">
                <Ionicons name="images-outline" size={20} color={Colors.primary} />
                <Text style={styles.btnOutlineText}>{t('photoGallery')}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text style={styles.muted}>{t('photoLimit', { count: MAX_PHOTOS_PER_HARVEST })}</Text>
        )}

        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>{t('photoMobileData')}</Text>
            <Text style={styles.muted}>{t('photoMobileDataHelp')}</Text>
          </View>
          <Switch value={mobileData} onValueChange={toggleMobileData} trackColor={{ true: Colors.primary }} accessibilityLabel={t('photoMobileData')} />
        </View>

        <TouchableOpacity
          style={[styles.btn, styles.btnOutline, { marginTop: Spacing.lg }]}
          onPress={() => router.push(`/traceability/${harvest?.public_code || harvest?.id}?preview=1` as any)}
          accessibilityRole="button"
        >
          <Ionicons name="eye-outline" size={20} color={Colors.primary} />
          <Text style={styles.btnOutlineText}>{t('seeBuyerView')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.tint, borderRadius: Radius.lg, padding: Spacing.md },
  note: { flex: 1, fontSize: 14, color: Colors.primaryDark, lineHeight: 20 },
  count: { fontSize: 13, color: Colors.textMuted, marginTop: Spacing.md, marginBottom: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  cell: { width: '47.5%' },
  image: { width: '100%', aspectRatio: 1, borderRadius: Radius.lg, backgroundColor: Colors.tint },
  tagChip: { position: 'absolute', left: 8, top: 8, minHeight: 44, minWidth: 44, justifyContent: 'center', backgroundColor: Colors.primaryDark, borderRadius: 999, paddingHorizontal: 12 },
  tagChipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pick: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  pickActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pickText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  pickTextActive: { color: '#FFFFFF' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  status: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingRight: 8 },
  smallBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  addTile: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.primary, backgroundColor: Colors.card },
  addText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  label: { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: Spacing.lg },
  buttons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  btn: { flex: 1, minHeight: 48, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnPrimary: { backgroundColor: Colors.primary },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  btnOutline: { borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.card },
  btnOutlineText: { color: Colors.primary, fontWeight: '800', fontSize: 15 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: Spacing.xl, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md },
  settingTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  muted: { fontSize: 13, color: Colors.textMuted, marginTop: 4, lineHeight: 18 },
});
