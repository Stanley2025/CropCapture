import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { localDb } from '../../services/storage/localDatabase';
import { captureHarvestPhoto, removeHarvestPhoto, uploadPendingHarvestPhotos, PhotoSource } from '../../services/photos/harvestPhotoService';
import { HarvestBatch, HarvestPhoto } from '../../types/database';
import { t } from '../../i18n/en';
import { MAX_PHOTOS_PER_HARVEST } from '../../shared/harvestPhotos';

interface Props {
  harvest: Pick<HarvestBatch, 'id' | 'farm_id'>;
  offline?: boolean;
}

/**
 * "Photos for buyers": the farmer takes pictures of the harvested product. Buyers who scan the harvest's
 * QR passport can see them. Each picture shows whether it has reached the server yet.
 */
export const HarvestPhotos: React.FC<Props> = ({ harvest, offline = false }) => {
  const [photos, setPhotos] = useState<HarvestPhoto[]>([]);

  const load = useCallback(async () => {
    setPhotos(await localDb.getHarvestPhotos(harvest.id));
  }, [harvest.id]);

  useEffect(() => {
    load();
    // pictures taken without a connection are sent as soon as this screen is opened online
    uploadPendingHarvestPhotos(offline).then((n) => {
      if (n > 0) load();
    });
  }, [load, offline]);

  const add = async (source: PhotoSource) => {
    const result = await captureHarvestPhoto(harvest, source, offline);
    if (result.ok) {
      await load();
    } else if (result.reason === 'permission') {
      Alert.alert(t('photoPermissionTitle'), t(source === 'camera' ? 'photoPermissionCamera' : 'photoPermissionLibrary'));
    } else if (result.reason === 'limit') {
      Alert.alert(t('photosForBuyers'), t('photoLimit', { count: MAX_PHOTOS_PER_HARVEST }));
    } else if (result.reason === 'error') {
      Alert.alert(t('photosForBuyers'), t('photoFailed'));
    }
  };

  const remove = (photo: HarvestPhoto) =>
    Alert.alert(t('photoRemoveTitle'), t('photoRemoveAsk'), [
      { text: t('close'), style: 'cancel' },
      {
        text: t('photoRemove'),
        style: 'destructive',
        onPress: async () => {
          await removeHarvestPhoto(photo);
          await load();
        },
      },
    ]);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="camera-outline" size={20} color={Colors.primaryDark} />
        <Text style={styles.title}>{t('photosForBuyers')}</Text>
      </View>
      <Text style={styles.help}>{t('photosForBuyersHelp')}</Text>

      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {photos.map((p) => (
            <View key={p.id} style={styles.item}>
              <Image source={{ uri: p.local_uri || p.public_url || undefined }} style={styles.image} accessibilityLabel={t('photoOfProduct')} />
              <View style={styles.statusRow}>
                <Ionicons name={p.uploaded ? 'checkmark-circle' : 'time-outline'} size={14} color={p.uploaded ? Colors.primary : Colors.textMuted} />
                <Text style={styles.status}>{p.uploaded ? t('photoShared') : t('photoWaiting')}</Text>
              </View>
              <TouchableOpacity style={styles.removeBtn} onPress={() => remove(p)} accessibilityRole="button" accessibilityLabel={t('photoRemove')}>
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                <Text style={styles.removeText}>{t('photoRemove')}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.none}>{t('photoNone')}</Text>
      )}

      <View style={styles.buttons}>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => add('camera')} accessibilityRole="button" accessibilityLabel={t('photoTake')}>
          <Ionicons name="camera" size={20} color="#FFFFFF" />
          <Text style={styles.btnPrimaryText}>{t('photoTake')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => add('library')} accessibilityRole="button" accessibilityLabel={t('photoChoose')}>
          <Ionicons name="images-outline" size={20} color={Colors.primary} />
          <Text style={styles.btnOutlineText}>{t('photoChoose')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginTop: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  help: { fontSize: 13, color: Colors.textMuted, marginTop: 4, lineHeight: 18 },
  none: { fontSize: 14, color: Colors.textMuted, marginTop: Spacing.md },
  strip: { gap: Spacing.sm, paddingVertical: Spacing.md },
  item: { width: 132 },
  image: { width: 132, height: 132, borderRadius: Radius.lg, backgroundColor: Colors.tint },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  status: { fontSize: 12, color: Colors.textMuted },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  removeText: { fontSize: 13, fontWeight: '700', color: Colors.danger },
  buttons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  btn: { flex: 1, minHeight: 48, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnPrimary: { backgroundColor: Colors.primary },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  btnOutline: { borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.card },
  btnOutlineText: { color: Colors.primary, fontWeight: '800', fontSize: 15 },
});
