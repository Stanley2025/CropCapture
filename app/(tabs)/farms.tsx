import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { localDb } from '../../src/services/storage/localDatabase';
import { Farm } from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { useAppStore } from '../../src/store/useAppStore';

export default function FarmsListScreen() {
  const router = useRouter();
  const { currentRole, currentFarmer } = useAppStore();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadFarms = useCallback(async () => {
    try {
      const data = await localDb.getFarms();
      const filtered =
        currentRole === 'farmer' && currentFarmer?.id
          ? data.filter((f) => f.farmer_id === currentFarmer.id)
          : data;
      setFarms(filtered);
    } catch (e) {
      console.error('Error loading farms:', e);
    }
  }, [currentRole, currentFarmer?.id]);

  useEffect(() => {
    loadFarms();
  }, [loadFarms]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFarms();
    setRefreshing(false);
  };

  const renderFarmItem = ({ item }: { item: Farm }) => (
    <Card
      style={styles.farmCard}
      onPress={() => router.push(`/farm/${item.id}` as any)}
    >
      <View style={styles.topRow}>
        <View style={styles.nameSection}>
          <Text style={styles.farmName}>{item.name}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={14} color={Colors.primary} />
            <Text style={styles.locationText}>
              {item.community}, {item.district}, {item.county}
            </Text>
          </View>
          <View style={styles.registrationRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.registrationText}>
              Reg: {item.registration_date || item.created_at?.split('T')[0] || '2026'} (Year {(item.registration_date || item.created_at || '2026').split('-')[0]})
            </Text>
          </View>
        </View>
        <Badge
          label={`${item.size} ${item.size_unit}`}
          variant="gold"
          size="md"
        />
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {item.description || 'No specific farm description provided.'}
      </Text>

      <View style={styles.featuresRow}>
        {item.farming_type && (
          <View
            style={[
              styles.featurePill,
              {
                backgroundColor:
                  item.farming_type === 'crops'
                    ? '#DCFCE7'
                    : item.farming_type === 'livestock'
                    ? '#FEF3C7'
                    : '#E0E7FF',
              },
            ]}
          >
            <Ionicons
              name={
                item.farming_type === 'crops'
                  ? 'leaf'
                  : item.farming_type === 'livestock'
                  ? 'paw'
                  : 'grid'
              }
              size={13}
              color={
                item.farming_type === 'crops'
                  ? '#15803D'
                  : item.farming_type === 'livestock'
                  ? '#B45309'
                  : '#4338CA'
              }
            />
            <Text
              style={[
                styles.featureText,
                {
                  color:
                    item.farming_type === 'crops'
                      ? '#15803D'
                      : item.farming_type === 'livestock'
                      ? '#B45309'
                      : '#4338CA',
                  fontWeight: '700',
                  textTransform: 'capitalize',
                },
              ]}
            >
              {item.farming_type === 'both' ? 'Crops & Livestock' : item.farming_type}
            </Text>
          </View>
        )}
        <View style={styles.featurePill}>
          <Ionicons
            name={item.irrigation ? 'water' : 'water-outline'}
            size={14}
            color={item.irrigation ? '#0284C7' : Colors.textMuted}
          />
          <Text style={[styles.featureText, item.irrigation && { color: '#0284C7' }]}>
            {item.irrigation ? 'Irrigated' : 'Rainfed'}
          </Text>
        </View>

        {item.soil_type && (
          <View style={styles.featurePill}>
            <Ionicons name="earth" size={14} color={Colors.textMuted} />
            <Text style={styles.featureText}>{item.soil_type}</Text>
          </View>
        )}

        {item.latitude && item.longitude && (
          <View style={styles.featurePill}>
            <Ionicons name="navigate-circle" size={14} color={Colors.primary} />
            <Text style={styles.featureText}>GPS Tagged</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.ownershipText}>
          Tenure: <Text style={{ fontWeight: '700' }}>{item.ownership_type || 'Customary'}</Text>
        </Text>
        <View style={styles.viewDetailsRow}>
          <Text style={styles.viewDetailsText}>View Farm</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={
          currentRole === 'extension_officer'
            ? 'Assigned Parcels'
            : currentRole === 'quality_inspector'
            ? 'Production Parcels'
            : currentRole === 'cooperative_manager'
            ? 'Cooperative Land'
            : 'My Farms'
        }
        subtitle={
          currentRole === 'extension_officer'
            ? 'Supervised community farm boundaries & GPS'
            : currentRole === 'quality_inspector'
            ? 'Traceability origin & soil classification'
            : 'Parcels, GPS boundaries & soil types'
        }
      />
      <OfflineBanner />

      <View style={styles.container}>
        <View style={styles.topBar}>
          <Text style={styles.counterText}>
            {farms.length} Registered {farms.length === 1 ? 'Farm' : 'Farms'}
          </Text>
          {currentRole === 'farmer' && (
            <Button
              title="+ Register Farm"
              size="sm"
              onPress={() => router.push('/farm/register' as any)}
            />
          )}
        </View>

        <FlatList
          data={farms}
          keyExtractor={(item) => item.id}
          renderItem={renderFarmItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="map-outline" size={32} color={Colors.primary} />}
              title="No Farms Registered Yet"
              description="Register your agricultural parcels with size, location, and GPS coordinates."
              actionTitle="Register First Farm"
              onAction={() => router.push('/farm/register' as any)}
            />
          }
        />
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
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  counterText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  farmCard: {
    marginBottom: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  nameSection: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  farmName: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  registrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  registrationText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  description: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    lineHeight: 18,
    marginVertical: Spacing.xs,
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginVertical: Spacing.xs,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  featureText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  ownershipText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsText: {
    fontSize: Typography.sizes.xs,
    color: Colors.primary,
    fontWeight: '700',
  },
});
