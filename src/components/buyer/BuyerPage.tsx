import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { t, StringKey } from '../../i18n/en';
import type { BuyerView } from '../../shared/harvestPhotos';

const TAG_KEY: Record<string, StringKey> = { bags: 'tagBags', grain: 'tagGrain', heap: 'tagHeap', field: 'tagField', other: 'tagOther' };

/**
 * What a buyer sees for a harvest. Used for the farmer's "See what buyers see" preview and when a buyer
 * scans the code inside the app. The public web page /b/{code} shows the same facts in the same order.
 */
export const BuyerPage: React.FC<{ view: BuyerView; ownCopy?: boolean }> = ({ view, ownCopy = false }) => {
  const weight = view.quantity === null ? null : `${Number(view.quantity).toLocaleString()} ${view.unit || 'kg'}`;
  const grownIn = [view.district, view.county].filter(Boolean).join(', ');
  const facts: Array<[string, string | null]> = [
    [t('buyerBatchId'), view.batchId],
    [t('buyerWeight'), weight],
    [t('buyerHarvestDate'), view.harvestDate],
    [t('buyerGrownIn'), grownIn || null],
    [t('buyerFarmer'), view.farmer],
  ];

  return (
    <View>
      {view.photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
          {view.photos.map((p) => (
            <View key={p.id} style={styles.slide}>
              {p.url ? (
                <Image source={{ uri: p.url }} style={styles.photo} accessibilityLabel={t('photoOfProduct')} />
              ) : (
                <View style={[styles.photo, styles.missing]}>
                  <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
                  <Text style={styles.missingText}>{t('buyerPhotoMissing')}</Text>
                </View>
              )}
              <View style={styles.tagChip}>
                <Text style={styles.tagText}>{t(TAG_KEY[p.tag] || 'tagOther')}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.noPhotos}>
          <Ionicons name="camera-outline" size={26} color={Colors.textMuted} />
          <Text style={styles.noPhotosText}>{t('buyerNoPhotos')}</Text>
        </View>
      )}

      <View style={styles.titleRow}>
        <Text style={styles.title}>{[view.crop, view.variety].filter(Boolean).join(' · ') || t('buyerTitle')}</Text>
        {view.approved ? (
          <View style={styles.approved}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.primaryDark} />
            <Text style={styles.approvedText}>{t('statusApproved')}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        {facts
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <View key={label} style={styles.factRow}>
              <Text style={styles.factLabel}>{label}</Text>
              <Text style={styles.factValue}>{value}</Text>
            </View>
          ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('buyerHowGrown')}</Text>
        {view.activities.length === 0 ? (
          <Text style={styles.muted}>{t('buyerNoActivities')}</Text>
        ) : (
          view.activities.map((a, i) => (
            <View key={`${a.date}-${i}`} style={styles.activity} accessible accessibilityLabel={`${a.date}. ${a.type}`}>
              <View style={styles.dot} />
              <Text style={styles.activityDate}>{a.date}</Text>
              <Text style={styles.activityType}>{a.type}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.note}>{t('buyerNote')}</Text>
      {ownCopy ? <Text style={styles.note}>{t('buyerOwnCopy')}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  carousel: { gap: Spacing.sm, paddingVertical: Spacing.sm },
  slide: { width: 280 },
  photo: { width: 280, height: 220, borderRadius: Radius.lg, backgroundColor: Colors.tint },
  missing: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  missingText: { fontSize: 13, color: Colors.textMuted },
  tagChip: { position: 'absolute', left: 10, bottom: 10, backgroundColor: Colors.primaryDark, borderRadius: 999, paddingHorizontal: 12, minHeight: 28, justifyContent: 'center' },
  tagText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  noPhotos: { alignItems: 'center', justifyContent: 'center', gap: 6, height: 150, borderRadius: Radius.lg, backgroundColor: Colors.tint, marginVertical: Spacing.sm },
  noPhotosText: { fontSize: 14, color: Colors.textMuted },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: Spacing.sm },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, flexShrink: 1 },
  approved: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.tint, borderRadius: 999, paddingHorizontal: 12, minHeight: 32 },
  approvedText: { fontSize: 13, fontWeight: '800', color: Colors.primaryDark },
  card: { backgroundColor: Colors.card, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginTop: Spacing.md },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
  factLabel: { fontSize: 14, color: Colors.textMuted },
  factValue: { fontSize: 14, fontWeight: '700', color: Colors.text, flexShrink: 1, textAlign: 'right' },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  muted: { fontSize: 14, color: Colors.textMuted },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.primary },
  activityDate: { fontSize: 13, color: Colors.textMuted, width: 86 },
  activityType: { fontSize: 15, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  note: { fontSize: 13, color: Colors.textMuted, marginTop: Spacing.md, lineHeight: 19 },
});
