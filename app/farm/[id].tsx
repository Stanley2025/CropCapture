import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { Farm, FarmSeason, FarmActivity, HarvestBatch } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';

export default function FarmDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [farm, setFarm] = useState<Farm | null>(null);
  const [seasons, setSeasons] = useState<FarmSeason[]>([]);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);

  const loadFarmData = useCallback(async () => {
    if (!id) return;
    try {
      const allFarms = await localDb.getFarms();
      const current = allFarms.find((f) => f.id === id);
      setFarm(current || null);

      const [allSeasons, allActivities, allHarvests] = await Promise.all([
        localDb.getSeasons(),
        localDb.getActivities(),
        localDb.getHarvests(),
      ]);

      setSeasons(allSeasons.filter((s) => s.farm_id === id));
      setActivities(allActivities.filter((a) => a.farm_id === id));
      setHarvests(allHarvests.filter((h) => h.farm_id === id));
    } catch (e) {
      console.error('Failed to load farm details:', e);
    }
  }, [id]);

  useEffect(() => {
    loadFarmData();
  }, [loadFarmData]);

  if (!farm) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Farm Details" showBack />
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Farm record not found.</Text>
          <Button title="Back to Farms" onPress={() => router.back()} size="sm" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title={farm.name} subtitle={`${farm.community}, ${farm.county}`} showBack />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Main Parcel Overview Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.parcelTitle}>{farm.name}</Text>
              <Text style={styles.parcelLocation}>
                {farm.community}, {farm.district}, {farm.county} County
              </Text>
            </View>
            <Badge label={`${farm.size} ${farm.size_unit}`} variant="gold" />
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>TENURE</Text>
              <Text style={styles.metricValue}>{farm.ownership_type || 'Customary'}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>WATER SUPPLY</Text>
              <Text style={styles.metricValue}>{farm.irrigation ? 'Irrigated' : 'Rainfed'}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>SOIL TYPE</Text>
              <Text style={styles.metricValue}>{farm.soil_type || 'Loam'}</Text>
            </View>
          </View>

          {/* GPS Coordinates & Interactive Map Representation */}
          <View style={styles.gpsBanner}>
            <View style={styles.gpsLeft}>
              <Ionicons name="navigate-circle" size={24} color={Colors.primary} />
              <View style={{ marginLeft: Spacing.sm }}>
                <Text style={styles.gpsTitle}>Verified GPS Geolocation</Text>
                <Text style={styles.gpsCoordText}>
                  {farm.latitude ? `${farm.latitude.toFixed(6)}° N, ${farm.longitude?.toFixed(6)}° W` : 'Not Tagged'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.openMapBtn}
              onPress={() =>
                Alert.alert(
                  'GPS Geolocation Coordinates',
                  `Farm Latitude: ${farm.latitude || 7.362145}\nFarm Longitude: ${farm.longitude || -8.712398}\n\nBoundary points registered with County Agricultural Registry.`
                )
              }
            >
              <Ionicons name="map-outline" size={16} color={Colors.primaryDark} />
              <Text style={styles.openMapText}>Map Pin</Text>
            </TouchableOpacity>
          </View>

          {farm.description ? (
            <Text style={styles.farmDesc}>{farm.description}</Text>
          ) : null}
        </Card>

        {/* Action Shortcuts */}
        <View style={styles.actionRow}>
          <Button
            title="+ New Season"
            onPress={() => router.push(`/season/create?farmId=${farm.id}` as any)}
            size="sm"
            style={{ flex: 1, marginRight: Spacing.xs }}
          />
          <Button
            title="+ Record Activity"
            onPress={() => router.push(`/activity/record?farmId=${farm.id}` as any)}
            variant="outline"
            size="sm"
            style={{ flex: 1, marginLeft: Spacing.xs }}
          />
        </View>

        {/* Crop Seasons on this Farm */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Crop Seasons ({seasons.length})</Text>
        </View>

        {seasons.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="leaf-outline" size={32} color={Colors.primary} />}
            title="No Seasons on this Farm"
            description="Create a crop season to track planting, expected harvests, and input costs."
            actionTitle="Create First Season"
            onAction={() => router.push(`/season/create?farmId=${farm.id}` as any)}
          />
        ) : (
          seasons.map((season) => (
            <Card key={season.id} style={styles.seasonCard}>
              <View style={styles.seasonHeader}>
                <View>
                  <Text style={styles.seasonName}>{season.season_name}</Text>
                  <Text style={styles.cropVariety}>
                    {season.crop?.name || 'Crop'} ({season.crop_variety_id || 'Standard Variety'})
                  </Text>
                </View>
                <Badge
                  label={season.status}
                  variant={season.status === 'harvesting' ? 'gold' : season.status === 'active' ? 'success' : 'default'}
                />
              </View>
              <View style={styles.seasonDatesRow}>
                <Text style={styles.seasonDateText}>
                  Planting: <Text style={{ fontWeight: '700' }}>{season.planting_date}</Text>
                </Text>
                {season.expected_harvest_date && (
                  <Text style={styles.seasonDateText}>
                    Harvest: <Text style={{ fontWeight: '700' }}>{season.expected_harvest_date}</Text>
                  </Text>
                )}
                <Text style={styles.seasonDateText}>
                  Area: <Text style={{ fontWeight: '700' }}>{season.cultivated_area} acres</Text>
                </Text>
              </View>
            </Card>
          ))
        )}

        {/* Activities on this Farm */}
        <View style={[styles.sectionHeaderRow, { marginTop: Spacing.lg }]}>
          <Text style={styles.sectionTitle}>Recent Field Operations ({activities.length})</Text>
        </View>

        {activities.length === 0 ? (
          <Card style={styles.emptySmallCard}>
            <Text style={styles.emptyText}>No activities logged yet for this parcel.</Text>
          </Card>
        ) : (
          activities.map((act) => (
            <Card key={act.id} style={styles.activityItem}>
              <View style={styles.activityTop}>
                <Text style={styles.activityType}>{act.activity_type}</Text>
                <Text style={styles.activityDate}>{act.activity_date}</Text>
              </View>
              {act.description && <Text style={styles.activityDesc}>{act.description}</Text>}
              <View style={styles.activityBottom}>
                {act.cost > 0 && <Text style={styles.costText}>Cost: ${act.cost} USD</Text>}
                <Badge
                  label={act.sync_status === 'synced' ? 'Synced' : 'Saved locally'}
                  variant={act.sync_status === 'synced' ? 'success' : 'warning'}
                  size="sm"
                />
              </View>
            </Card>
          ))
        )}

        {/* Harvest Batches on this Farm */}
        <View style={[styles.sectionHeaderRow, { marginTop: Spacing.lg }]}>
          <Text style={styles.sectionTitle}>Harvest Records ({harvests.length})</Text>
        </View>

        {harvests.length === 0 ? (
          <Card style={styles.emptySmallCard}>
            <Text style={styles.emptyText}>No harvest batches registered for this farm yet.</Text>
          </Card>
        ) : (
          harvests.map((h) => (
            <Card
              key={h.id}
              style={styles.harvestItem}
              onPress={() => router.push(`/harvest/${h.id}` as any)}
            >
              <View style={styles.activityTop}>
                <Text style={styles.batchRef}>{h.batch_reference}</Text>
                <Badge
                  label={h.status.replace('_', ' ')}
                  variant={h.status === 'approved' ? 'success' : 'warning'}
                  size="sm"
                />
              </View>
              <Text style={styles.harvestYield}>
                {h.quantity} {h.unit} • Harvested {h.harvest_date}
              </Text>
            </Card>
          ))
        )}

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
  notFoundContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  notFoundText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.md,
    marginBottom: Spacing.md,
  },
  heroCard: {
    marginBottom: Spacing.md,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  parcelTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  parcelLocation: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  gpsBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  gpsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  gpsCoordText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  openMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.md,
  },
  openMapText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  farmDesc: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  sectionHeaderRow: {
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  seasonCard: {
    marginBottom: Spacing.sm,
  },
  seasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  seasonName: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  cropVariety: {
    fontSize: Typography.sizes.xs,
    color: Colors.primaryDark,
    marginTop: 1,
  },
  seasonDatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
  },
  seasonDateText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  emptySmallCard: {
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  activityItem: {
    marginBottom: Spacing.xs,
    padding: Spacing.sm,
  },
  activityTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityType: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  activityDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  activityDesc: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  activityBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  costText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  harvestItem: {
    marginBottom: Spacing.xs,
    padding: Spacing.sm,
  },
  batchRef: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  harvestYield: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
