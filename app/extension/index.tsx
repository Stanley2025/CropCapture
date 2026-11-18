import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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

export default function ExtensionOfficerDashboard() {
  const router = useRouter();
  const [farms, setFarms] = useState<Farm[]>([]);

  useEffect(() => {
    localDb.getFarms().then(setFarms);
  }, []);

  const visits = [
    {
      id: 'v1',
      farmer: 'Emmanuel Gaye',
      farm: 'Gbehley Swamp Farm',
      date: '2026-10-18',
      topic: 'Panicle Blast & Drainage Inspection',
      recommendation: 'Maintain shallow water level in plots 2 and 4 to mitigate fungal neck rot.',
      status: 'Completed',
    },
    {
      id: 'v2',
      farmer: 'Emmanuel Gaye',
      farm: 'Zolowee Upland Valley',
      date: '2026-11-25',
      topic: 'Pre-harvest Cassava Tuber Sampling',
      recommendation: 'Scheduled follow-up with CARI root crop extension guidelines.',
      status: 'Upcoming',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Extension Officer"
        subtitle="Ministry of Agriculture • Field Registry"
        showBack
      />
      <OfflineBanner />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Officer Profile Card */}
        <Card style={styles.officerCard}>
          <View style={styles.topRow}>
            <View>
              <Text style={styles.deptText}>COUNTY EXTENSION SERVICE</Text>
              <Text style={styles.officerName}>Officer Kebbeh Flomo</Text>
              <Text style={styles.jurisdiction}>Nimba & Bong Agricultural Districts</Text>
            </View>
            <Badge label="Active Agent" variant="success" />
          </View>

          <Button
            title="+ Log New Farm Field Visit"
            onPress={() => router.push('/extension/visit' as any)}
            size="md"
            icon={<Ionicons name="navigate-outline" size={18} color="#FFFFFF" />}
            style={{ marginTop: Spacing.md }}
          />
        </Card>

        {/* Assigned Farms Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assigned Farmer Parcels ({farms.length})</Text>
          <Text style={styles.sectionSub}>Farms under regular agronomic monitoring</Text>
        </View>

        {farms.map((f) => (
          <Card key={f.id} style={styles.farmItem}>
            <View style={styles.farmItemHeader}>
              <View>
                <Text style={styles.farmName}>{f.name}</Text>
                <Text style={styles.farmLoc}>
                  {f.community}, {f.district} • {f.size} {f.size_unit}
                </Text>
              </View>
              <Badge label={f.ownership_type || 'Customary'} variant="default" size="sm" />
            </View>
            <View style={styles.farmActionRow}>
              <Text style={styles.gpsCoord}>
                GPS: {f.latitude?.toFixed(4)}° N, {f.longitude?.toFixed(4)}° W
              </Text>
              <TouchableOpacity
                style={styles.visitShortcut}
                onPress={() => router.push(`/extension/visit?farmId=${f.id}` as any)}
              >
                <Ionicons name="clipboard-outline" size={14} color={Colors.primary} />
                <Text style={styles.visitShortcutText}>Log Visit</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}

        {/* Field Visits & Pest Log */}
        <View style={[styles.sectionHeader, { marginTop: Spacing.lg }]}>
          <Text style={styles.sectionTitle}>Field Visits & Pest Observations</Text>
          <Text style={styles.sectionSub}>Recent advisories issued to producers</Text>
        </View>

        {visits.map((v) => (
          <Card key={v.id} style={styles.visitCard}>
            <View style={styles.visitTop}>
              <View>
                <Text style={styles.visitFarm}>{v.farm}</Text>
                <Text style={styles.visitTopic}>{v.topic}</Text>
              </View>
              <Badge
                label={v.status}
                variant={v.status === 'Completed' ? 'success' : 'warning'}
                size="sm"
              />
            </View>
            <View style={styles.recBox}>
              <Text style={styles.recLabel}>Technical Advisory:</Text>
              <Text style={styles.recText}>{v.recommendation}</Text>
            </View>
            <Text style={styles.visitDate}>
              <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} /> {v.date}
            </Text>
          </Card>
        ))}

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
  officerCard: {
    marginBottom: Spacing.md,
    backgroundColor: '#F8FAFC',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  deptText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1,
  },
  officerName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
    marginTop: 2,
  },
  jurisdiction: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionHeader: {
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  sectionSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  farmItem: {
    marginBottom: Spacing.xs,
    padding: Spacing.sm,
  },
  farmItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  farmName: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  farmLoc: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  farmActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
  },
  gpsCoord: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  visitShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  visitShortcutText: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  visitCard: {
    marginBottom: Spacing.xs,
  },
  visitTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  visitFarm: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  visitTopic: {
    fontSize: Typography.sizes.xs,
    color: Colors.primaryDark,
    marginTop: 1,
  },
  recBox: {
    backgroundColor: '#F0FDF4',
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginVertical: Spacing.xs,
  },
  recLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginBottom: 2,
  },
  recText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text,
    lineHeight: 18,
  },
  visitDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
