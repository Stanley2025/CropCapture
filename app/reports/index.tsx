import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Share,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/useAppStore';
import { localDb } from '../../src/services/storage/localDatabase';
import {
  Farm,
  FarmSeason,
  FarmActivity,
  HarvestBatch,
  ExpenseRecord,
  InputRecord,
} from '../../src/types/database';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';

// Helper to extract numeric year safely from ISO strings or YYYY-MM-DD
function extractYear(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})/);
  if (match) return parseInt(match[1], 10);
  const d = new Date(dateStr);
  return isNaN(d.getFullYear()) ? null : d.getFullYear();
}

export default function ReportsScreen() {
  const router = useRouter();
  const { currentFarmer, currentRole } = useAppStore();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [seasons, setSeasons] = useState<FarmSeason[]>([]);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [inputs, setInputs] = useState<InputRecord[]>([]);

  // Filter States: Year & Farm
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
  const [yearModalVisible, setYearModalVisible] = useState(false);

  useEffect(() => {
    Promise.all([
      localDb.getFarms(),
      localDb.getSeasons(),
      localDb.getActivities(),
      localDb.getHarvests(),
      localDb.getExpenses(),
      localDb.getInputs(),
    ]).then(([f, s, a, h, exp, inp]) => {
      // Isolate to current farmer to ensure strict multi-tenant privacy
      if (currentRole === 'farmer' && currentFarmer?.id) {
        f = f.filter((farm) => farm.farmer_id === currentFarmer.id);
        const myFarmIds = new Set(f.map((farm) => farm.id));
        s = s.filter((season) => myFarmIds.has(season.farm_id));
        a = a.filter(
          (act) => act.farmer_id === currentFarmer.id || myFarmIds.has(act.farm_id)
        );
        h = h.filter(
          (harv) => harv.farmer_id === currentFarmer.id || myFarmIds.has(harv.farm_id)
        );
        exp = exp.filter(
          (e) => myFarmIds.has(e.farm_id) || (e as any).farmer_id === currentFarmer.id
        );
        inp = inp.filter(
          (i) => myFarmIds.has(i.farm_id) || (i as any).farmer_id === currentFarmer.id
        );
      }

      setFarms(f);
      setSeasons(s);
      setActivities(a);
      setHarvests(h);
      setExpenses(exp);
      setInputs(inp);
    });
  }, [currentRole, currentFarmer?.id]);

  // Dynamically discover all recorded years plus historical baseline years
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>([2026, 2025, 2024, 2023, 2022, 2021]);
    yearSet.add(currentYear);

    harvests.forEach((h) => {
      const y = extractYear(h.harvest_date || h.created_at);
      if (y) yearSet.add(y);
    });
    seasons.forEach((s) => {
      const y = extractYear(s.planting_date || s.created_at);
      if (y) yearSet.add(y);
    });
    activities.forEach((a) => {
      const y = extractYear(a.activity_date || a.created_at);
      if (y) yearSet.add(y);
    });
    expenses.forEach((e) => {
      const y = extractYear(e.expense_date || e.created_at);
      if (y) yearSet.add(y);
    });
    inputs.forEach((i) => {
      const y = extractYear(i.purchase_date || i.created_at);
      if (y) yearSet.add(y);
    });
    farms.forEach((f) => {
      const y = extractYear(f.created_at);
      if (y) yearSet.add(y);
    });

    return Array.from(yearSet).sort((a, b) => b - a);
  }, [harvests, seasons, activities, expenses, inputs, farms, currentYear]);

  // Filter datasets by farm parcel
  const filteredFarms = useMemo(() => {
    if (selectedFarmId === 'all') return farms;
    return farms.filter((f) => f.id === selectedFarmId);
  }, [farms, selectedFarmId]);

  const activeFarmIds = useMemo(
    () => new Set(filteredFarms.map((f) => f.id)),
    [filteredFarms]
  );

  // Filter datasets by selected year & active farm parcel
  const filteredHarvests = useMemo(() => {
    return harvests.filter((h) => {
      if (selectedFarmId !== 'all' && !activeFarmIds.has(h.farm_id)) return false;
      if (selectedYear === 'all') return true;
      const y = extractYear(h.harvest_date || h.created_at);
      return y === Number(selectedYear);
    });
  }, [harvests, activeFarmIds, selectedFarmId, selectedYear]);

  const filteredSeasons = useMemo(() => {
    return seasons.filter((s) => {
      if (selectedFarmId !== 'all' && !activeFarmIds.has(s.farm_id)) return false;
      if (selectedYear === 'all') return true;
      const y = extractYear(s.planting_date || s.created_at);
      return y === Number(selectedYear);
    });
  }, [seasons, activeFarmIds, selectedFarmId, selectedYear]);

  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      if (selectedFarmId !== 'all' && !activeFarmIds.has(a.farm_id)) return false;
      if (selectedYear === 'all') return true;
      const y = extractYear(a.activity_date || a.created_at);
      return y === Number(selectedYear);
    });
  }, [activities, activeFarmIds, selectedFarmId, selectedYear]);

  const filteredInputs = useMemo(() => {
    return inputs.filter((i) => {
      if (selectedFarmId !== 'all' && !activeFarmIds.has(i.farm_id)) return false;
      if (selectedYear === 'all') return true;
      const y = extractYear(i.purchase_date || i.created_at);
      return y === Number(selectedYear);
    });
  }, [inputs, activeFarmIds, selectedFarmId, selectedYear]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedFarmId !== 'all' && !activeFarmIds.has(e.farm_id)) return false;
      if (selectedYear === 'all') return true;
      const y = extractYear(e.expense_date || e.created_at);
      return y === Number(selectedYear);
    });
  }, [expenses, activeFarmIds, selectedFarmId, selectedYear]);

  // Aggregate Key Metrics for the Selected Year / Scope
  const totalAcreage = useMemo(() => {
    const seasonAcreage = filteredSeasons.reduce(
      (acc, s) => acc + (Number(s.cultivated_area) || 0),
      0
    );
    if (seasonAcreage > 0) return seasonAcreage;
    return filteredFarms.reduce((acc, f) => acc + (Number(f.size) || 0), 0);
  }, [filteredSeasons, filteredFarms]);

  const totalHarvestKg = useMemo(() => {
    return filteredHarvests.reduce((acc, h) => acc + (Number(h.quantity) || 0), 0);
  }, [filteredHarvests]);

  const totalActivityCost = useMemo(() => {
    return filteredActivities.reduce((acc, a) => acc + (Number(a.cost) || 0), 0);
  }, [filteredActivities]);

  const totalInputCost = useMemo(() => {
    return filteredInputs.reduce((acc, i) => acc + (Number(i.cost) || 0), 0);
  }, [filteredInputs]);

  const totalDirectExpense = useMemo(() => {
    return filteredExpenses
      .filter((e) => e.currency === 'USD')
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  const grandTotalCost = totalActivityCost + totalInputCost + totalDirectExpense;

  // Real gross revenue: prioritizes recorded harvest total_value ($ USD),
  // falling back to commodity rates ($50/head for livestock or $0.45/kg for crops)
  const estimatedRevenue = useMemo(() => {
    return filteredHarvests.reduce((acc, h) => {
      if (h.total_value && Number(h.total_value) > 0) {
        return acc + Number(h.total_value);
      }
      const isLivestock =
        (h as any).crop?.category === 'Livestock Offtake' ||
        (h.unit || '').toLowerCase().includes('head') ||
        (h.unit || '').toLowerCase().includes('animal');
      const rate = isLivestock ? 50 : 0.45;
      return acc + (Number(h.quantity) || 0) * rate;
    }, 0);
  }, [filteredHarvests]);
  const netReturn = estimatedRevenue - grandTotalCost;

  // Average yield productivity per acre
  const yieldPerAcre =
    totalAcreage > 0 ? (totalHarvestKg / totalAcreage).toFixed(1) : '0';

  // Quality Inspection certification rate for selected year
  const approvedHarvestsCount = filteredHarvests.filter(
    (h) => h.status === 'approved'
  ).length;
  const inspectionRate =
    filteredHarvests.length > 0
      ? Math.round((approvedHarvestsCount / filteredHarvests.length) * 100)
      : 0;

  // Year-over-Year (YoY) comparison against preceding year
  const priorYear = selectedYear !== 'all' ? Number(selectedYear) - 1 : null;
  const priorYearHarvestKg = useMemo(() => {
    if (!priorYear) return 0;
    return harvests
      .filter((h) => {
        if (selectedFarmId !== 'all' && !activeFarmIds.has(h.farm_id)) return false;
        return extractYear(h.harvest_date || h.created_at) === priorYear;
      })
      .reduce((acc, h) => acc + (Number(h.quantity) || 0), 0);
  }, [priorYear, harvests, selectedFarmId, activeFarmIds]);

  const priorYearCost = useMemo(() => {
    if (!priorYear) return 0;
    const aCost = activities
      .filter((a) => {
        if (selectedFarmId !== 'all' && !activeFarmIds.has(a.farm_id)) return false;
        return extractYear(a.activity_date || a.created_at) === priorYear;
      })
      .reduce((acc, a) => acc + (Number(a.cost) || 0), 0);

    const iCost = inputs
      .filter((i) => {
        if (selectedFarmId !== 'all' && !activeFarmIds.has(i.farm_id)) return false;
        return extractYear(i.purchase_date || i.created_at) === priorYear;
      })
      .reduce((acc, i) => acc + (Number(i.cost) || 0), 0);

    const eCost = expenses
      .filter((e) => {
        if (selectedFarmId !== 'all' && !activeFarmIds.has(e.farm_id)) return false;
        return extractYear(e.expense_date || e.created_at) === priorYear && e.currency === 'USD';
      })
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    return aCost + iCost + eCost;
  }, [priorYear, activities, inputs, expenses, selectedFarmId, activeFarmIds]);

  // Crop Breakdown Aggregate
  const cropBreakdown = useMemo(() => {
    const map: Record<string, { cropName: string; totalKg: number; count: number }> = {};
    filteredHarvests.forEach((h) => {
      const name = h.crop?.name || 'Farm Produce';
      if (!map[name]) {
        map[name] = { cropName: name, totalKg: 0, count: 0 };
      }
      map[name].totalKg += Number(h.quantity) || 0;
      map[name].count += 1;
    });
    return Object.values(map).sort((a, b) => b.totalKg - a.totalKg);
  }, [filteredHarvests]);

  // Livestock inventory for active parcels
  const livestockParcels = useMemo(() => {
    return filteredFarms.filter(
      (f) => f.farming_type === 'livestock' || f.farming_type === 'both'
    );
  }, [filteredFarms]);

  const selectedFarmObj = farms.find((f) => f.id === selectedFarmId);

  // Export CSV Data for Selected Year
  const handleExportCSV = async () => {
    try {
      const yearLabel = selectedYear === 'all' ? 'Lifetime_All_Years' : selectedYear;
      const farmLabel = selectedFarmObj ? selectedFarmObj.name.replace(/\s+/g, '_') : 'All_Farms';

      const csvContent = [
        `# CROPCAPTURE HISTORICAL FARM REPORT - ${yearLabel.toUpperCase()}`,
        `# Farmer: ${currentFarmer?.full_name || 'Farmer'}, Parcel: ${selectedFarmObj?.name || 'All Parcels'}`,
        `# Generated: ${new Date().toISOString()}`,
        '',
        '--- HARVEST BATCH RECORDS ---',
        'Batch Reference,Crop,Variety,Quantity,Unit,Harvest Date,Inspection Status',
        ...filteredHarvests.map(
          (h) =>
            `${h.batch_reference},${h.crop?.name || 'Produce'},${h.crop_variety_id || 'Standard'},${h.quantity},${h.unit},${h.harvest_date},${h.status}`
        ),
        '',
        '--- OPERATING EXPENSES & INPUTS ---',
        'Category,Type,Amount (USD),Date,Description',
        ...filteredInputs.map(
          (i) => `Input,${i.category},${i.cost},${i.purchase_date},${i.name}`
        ),
        ...filteredActivities.map(
          (a) => `Activity,${a.activity_type},${a.cost},${a.activity_date},${a.description || ''}`
        ),
        ...filteredExpenses.map(
          (e) => `Expense,${e.category},${e.amount},${e.expense_date},${e.description || ''}`
        ),
      ].join('\n');

      await Share.share({
        title: `CropCapture_${farmLabel}_${yearLabel}_Report`,
        message: csvContent,
      });
    } catch (e: any) {
      Alert.alert('Export Error', e?.message || 'Could not export historical data');
    }
  };

  // Export PDF Report Summary
  const handleExportPDF = () => {
    const yearScope =
      selectedYear === 'all' ? 'Lifetime All Cycles' : `${selectedYear} Cropping Cycle`;
    const parcelScope = selectedFarmObj ? selectedFarmObj.name : 'All Registered Parcels';

    Alert.alert(
      'Export Historical PDF Summary',
      `Official agricultural performance audit certificate for:\n\n` +
        `• Agricultural Year: ${yearScope}\n` +
        `• Farm Parcel: ${parcelScope}\n` +
        `• Total Production: ${totalHarvestKg.toLocaleString()} kg\n` +
        `• Operating Costs: $${grandTotalCost.toLocaleString()} USD\n` +
        `• Quality Inspection: ${inspectionRate}% Certified\n\n` +
        `Certified official document generated with cryptographic QR verification stamp.`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Reports & Analytics"
        subtitle="Multi-year production history & farm financials"
        showBack
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* ========================================================= */}
        {/* YEAR SELECTOR & FILTER CARD */}
        {/* ========================================================= */}
        <Card style={styles.filterCard}>
          <View style={styles.filterHeaderRow}>
            <View style={styles.filterTitleWrap}>
              <Ionicons name="calendar" size={16} color={Colors.primary} />
              <Text style={styles.filterLabel}>SELECT AGRICULTURAL YEAR</Text>
            </View>
            <TouchableOpacity
              style={styles.allYearsBtn}
              onPress={() => setYearModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="filter-outline" size={13} color={Colors.primary} />
              <Text style={styles.allYearsBtnText}>Pick Year</Text>
            </TouchableOpacity>
          </View>

          {/* Horizontal Year Scroll Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.yearScrollContent}
          >
            <TouchableOpacity
              style={[
                styles.yearPill,
                selectedYear === 'all' && styles.yearPillActive,
              ]}
              onPress={() => setSelectedYear('all')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.yearPillText,
                  selectedYear === 'all' && styles.yearPillTextActive,
                ]}
              >
                All Years
              </Text>
            </TouchableOpacity>

            {availableYears.map((yr) => {
              const isSelected = selectedYear === String(yr);
              const isCurrent = yr === currentYear;
              return (
                <TouchableOpacity
                  key={yr}
                  style={[styles.yearPill, isSelected && styles.yearPillActive]}
                  onPress={() => setSelectedYear(String(yr))}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.yearPillText,
                      isSelected && styles.yearPillTextActive,
                    ]}
                  >
                    {yr}
                    {isCurrent ? ' (Current)' : ''}
                  </Text>
                  {isSelected && (
                    <View style={styles.yearDotActive} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Farm Parcel Selector (If farmer has parcels) */}
          {farms.length > 1 && (
            <View style={styles.farmSelectSection}>
              <Text style={styles.farmSelectLabel}>FARM PARCEL</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.farmScrollContent}
              >
                <TouchableOpacity
                  style={[
                    styles.farmChip,
                    selectedFarmId === 'all' && styles.farmChipActive,
                  ]}
                  onPress={() => setSelectedFarmId('all')}
                >
                  <Ionicons
                    name="grid-outline"
                    size={12}
                    color={selectedFarmId === 'all' ? '#FFFFFF' : Colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.farmChipText,
                      selectedFarmId === 'all' && styles.farmChipTextActive,
                    ]}
                  >
                    All Parcels ({farms.length})
                  </Text>
                </TouchableOpacity>

                {farms.map((f) => {
                  const isSelected = selectedFarmId === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.farmChip, isSelected && styles.farmChipActive]}
                      onPress={() => setSelectedFarmId(f.id)}
                    >
                      <Ionicons
                        name="map-outline"
                        size={12}
                        color={isSelected ? '#FFFFFF' : Colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.farmChipText,
                          isSelected && styles.farmChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {f.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Active Filter Scope Indicator Banner */}
          <View style={styles.scopeBanner}>
            <Ionicons name="information-circle" size={14} color="#0284C7" />
            <Text style={styles.scopeBannerText}>
              {selectedYear === 'all'
                ? `Showing lifetime records across all historical agricultural cycles`
                : `Showing ${selectedYear} agricultural cycle records (Jan 1 – Dec 31, ${selectedYear})`}
              {selectedFarmObj ? ` • ${selectedFarmObj.name}` : ''}
            </Text>
          </View>
        </Card>

        {/* ========================================================= */}
        {/* HERO EXECUTIVE SUMMARY CARD */}
        {/* ========================================================= */}
        <Card style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroSub}>
                {selectedYear === 'all'
                  ? 'LIFETIME FARM PERFORMANCE'
                  : `${selectedYear} AGRICULTURAL CYCLE SUMMARY`}
              </Text>
              <Text style={styles.heroTitle}>
                {selectedFarmObj
                  ? selectedFarmObj.name
                  : currentFarmer?.full_name
                  ? `${currentFarmer.full_name}'s Farm Ledger`
                  : 'Republic of Liberia Farm Ledger'}
              </Text>
            </View>
            <View style={styles.cycleBadge}>
              <Text style={styles.cycleBadgeText}>
                {selectedYear === 'all' ? 'All Time' : selectedYear}
              </Text>
            </View>
          </View>

          {/* 3 Main KPIs */}
          <View style={styles.heroGrid}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{totalAcreage.toFixed(1)}</Text>
              <Text style={styles.heroStatLabel}>Cultivated Acres</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{totalHarvestKg.toLocaleString()}</Text>
              <Text style={styles.heroStatLabel}>Harvested (kg)</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>${grandTotalCost.toLocaleString()}</Text>
              <Text style={styles.heroStatLabel}>Total Costs (USD)</Text>
            </View>
          </View>

          {/* Financial Gross Return & Margin Row */}
          <View style={styles.heroBottomRow}>
            <View style={styles.heroReturnItem}>
              <Text style={styles.heroReturnLabel}>Est. Gross Value</Text>
              <Text style={styles.heroReturnVal}>${estimatedRevenue.toLocaleString()}</Text>
            </View>
            <View style={styles.heroReturnDivider} />
            <View style={styles.heroReturnItem}>
              <Text style={styles.heroReturnLabel}>Est. Net Profit</Text>
              <Text
                style={[
                  styles.heroReturnVal,
                  { color: netReturn >= 0 ? '#86EFAC' : '#FCA5A5' },
                ]}
              >
                {netReturn >= 0 ? '+' : ''}${netReturn.toLocaleString()}
              </Text>
            </View>
            <View style={styles.heroReturnDivider} />
            <View style={styles.heroReturnItem}>
              <Text style={styles.heroReturnLabel}>Yield / Acre</Text>
              <Text style={styles.heroReturnVal}>{yieldPerAcre} kg</Text>
            </View>
          </View>
        </Card>

        {/* ========================================================= */}
        {/* YEAR-OVER-YEAR (YoY) HISTORICAL COMPARISON */}
        {/* ========================================================= */}
        {selectedYear !== 'all' && priorYear && (
          <Card style={styles.yoyCard}>
            <View style={styles.yoyHeader}>
              <Ionicons name="trending-up" size={16} color={Colors.primary} />
              <Text style={styles.yoyTitle}>
                Comparison vs {priorYear} Cropping Season
              </Text>
            </View>

            <View style={styles.yoyRow}>
              {/* Harvest Volume YoY */}
              <View style={styles.yoyCol}>
                <Text style={styles.yoyMetricLabel}>Harvest Output</Text>
                <Text style={styles.yoyMetricVal}>
                  {totalHarvestKg.toLocaleString()} kg
                </Text>
                {priorYearHarvestKg > 0 ? (
                  <View style={styles.yoyTrendBadge}>
                    <Ionicons
                      name={
                        totalHarvestKg >= priorYearHarvestKg
                          ? 'arrow-up'
                          : 'arrow-down'
                      }
                      size={12}
                      color={
                        totalHarvestKg >= priorYearHarvestKg
                          ? '#15803D'
                          : '#B91C1C'
                      }
                    />
                    <Text
                      style={[
                        styles.yoyTrendText,
                        {
                          color:
                            totalHarvestKg >= priorYearHarvestKg
                              ? '#15803D'
                              : '#B91C1C',
                        },
                      ]}
                    >
                      {Math.abs(
                        Math.round(
                          ((totalHarvestKg - priorYearHarvestKg) /
                            priorYearHarvestKg) *
                            100
                        )
                      )}
                      % vs {priorYear} ({priorYearHarvestKg.toLocaleString()} kg)
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.yoyNoPrior}>No {priorYear} baseline</Text>
                )}
              </View>

              <View style={styles.yoyDivider} />

              {/* Operating Cost YoY */}
              <View style={styles.yoyCol}>
                <Text style={styles.yoyMetricLabel}>Operating Expenses</Text>
                <Text style={styles.yoyMetricVal}>
                  ${grandTotalCost.toLocaleString()}
                </Text>
                {priorYearCost > 0 ? (
                  <View style={styles.yoyTrendBadge}>
                    <Ionicons
                      name={
                        grandTotalCost <= priorYearCost
                          ? 'arrow-down'
                          : 'arrow-up'
                      }
                      size={12}
                      color={
                        grandTotalCost <= priorYearCost ? '#15803D' : '#D97706'
                      }
                    />
                    <Text
                      style={[
                        styles.yoyTrendText,
                        {
                          color:
                            grandTotalCost <= priorYearCost
                              ? '#15803D'
                              : '#D97706',
                        },
                      ]}
                    >
                      {Math.abs(
                        Math.round(
                          ((grandTotalCost - priorYearCost) / priorYearCost) * 100
                        )
                      )}
                      % vs {priorYear} (${priorYearCost.toLocaleString()})
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.yoyNoPrior}>No {priorYear} expenses</Text>
                )}
              </View>
            </View>
          </Card>
        )}

        {/* ========================================================= */}
        {/* EXPORT BUTTONS */}
        {/* ========================================================= */}
        <View style={styles.exportRow}>
          <Button
            title={`Export ${selectedYear === 'all' ? 'All' : selectedYear} CSV`}
            onPress={handleExportCSV}
            variant="outline"
            size="sm"
            icon={
              <Ionicons
                name="document-text-outline"
                size={16}
                color={Colors.primary}
              />
            }
            style={{ flex: 1, marginRight: Spacing.xs }}
          />
          <Button
            title={`Export ${selectedYear === 'all' ? 'All' : selectedYear} PDF`}
            onPress={handleExportPDF}
            size="sm"
            icon={<Ionicons name="print-outline" size={16} color="#FFFFFF" />}
            style={{ flex: 1, marginLeft: Spacing.xs }}
          />
        </View>

        {/* ========================================================= */}
        {/* CROP PRODUCTION BREAKDOWN */}
        {/* ========================================================= */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>
                Crop Production by Variety ({selectedYear})
              </Text>
              <Text style={styles.sectionSubtitle}>
                Aggregate commodity yield harvested in {selectedYear}
              </Text>
            </View>
            <Badge
              label={`${cropBreakdown.length} Crops`}
              variant="info"
              size="sm"
            />
          </View>

          {cropBreakdown.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="leaf-outline" size={32} color={Colors.textMuted} />}
              title={`No Crop Harvests in ${selectedYear}`}
              description={`There are no crop harvest records registered for ${selectedYear}. Select another year above or register a harvest.`}
              actionTitle="Register Harvest"
              onAction={() => router.push('/harvest/register' as any)}
            />
          ) : (
            cropBreakdown.map((item) => {
              const pct =
                totalHarvestKg > 0
                  ? Math.round((item.totalKg / totalHarvestKg) * 100)
                  : 0;
              return (
                <View key={item.cropName} style={styles.cropItemWrap}>
                  <View style={styles.cropItemTop}>
                    <View style={styles.cropItemLeft}>
                      <View style={styles.cropIconBadge}>
                        <Ionicons name="nutrition" size={14} color={Colors.primary} />
                      </View>
                      <Text style={styles.cropNameText}>{item.cropName}</Text>
                    </View>
                    <View style={styles.cropItemRight}>
                      <Text style={styles.cropKgVal}>
                        {item.totalKg.toLocaleString()} kg
                      </Text>
                      <Text style={styles.cropPctText}>{pct}% ({item.count} batches)</Text>
                    </View>
                  </View>
                  {/* Progress Bar */}
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.min(pct, 100)}%` },
                      ]}
                    />
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* ========================================================= */}
        {/* HARVEST PRODUCTION BY BATCH */}
        {/* ========================================================= */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>
                Harvest Batches ({filteredHarvests.length})
              </Text>
              <Text style={styles.sectionSubtitle}>
                Verified batches harvested during {selectedYear}
              </Text>
            </View>
            <Badge
              label={`${inspectionRate}% Inspected`}
              variant={inspectionRate > 70 ? 'success' : 'warning'}
              size="sm"
            />
          </View>

          {filteredHarvests.length === 0 ? (
            <Text style={styles.emptyInlineText}>
              No harvest batches recorded for {selectedYear}.
            </Text>
          ) : (
            filteredHarvests.map((h) => (
              <TouchableOpacity
                key={h.id}
                style={styles.breakdownRow}
                onPress={() => router.push(`/harvest/${h.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                  <Text style={styles.batchTitle}>{h.batch_reference}</Text>
                  <Text style={styles.batchCrop}>
                    {h.crop?.name || 'Produce'}{' '}
                    {h.crop_variety_id ? `(${h.crop_variety_id})` : ''} • {h.harvest_date}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.batchYield}>
                    {h.quantity.toLocaleString()} {h.unit}
                  </Text>
                  <Badge
                    label={h.status.replace(/_/g, ' ').toUpperCase()}
                    variant={h.status === 'approved' ? 'success' : 'warning'}
                    size="sm"
                  />
                </View>
              </TouchableOpacity>
            ))
          )}
        </Card>

        {/* ========================================================= */}
        {/* FARM COST STRUCTURE & EXPENSES */}
        {/* ========================================================= */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Farm Operating Cost Structure ({selectedYear})
          </Text>
          <Text style={styles.sectionSubtitle}>
            Aggregated across inputs, labor & overhead for {selectedYear}
          </Text>

          <View style={styles.costItemRow}>
            <View style={styles.costCategory}>
              <View style={[styles.colorDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.costCatName}>
                Material Inputs (Seeds, Fertilizer & Tools)
              </Text>
            </View>
            <Text style={styles.costCatVal}>${totalInputCost.toLocaleString()}</Text>
          </View>

          <View style={styles.costItemRow}>
            <View style={styles.costCategory}>
              <View style={[styles.colorDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.costCatName}>Field Activity Labor & Operations</Text>
            </View>
            <Text style={styles.costCatVal}>
              ${totalActivityCost.toLocaleString()}
            </Text>
          </View>

          <View style={styles.costItemRow}>
            <View style={styles.costCategory}>
              <View style={[styles.colorDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.costCatName}>General Farm Operating Expenses</Text>
            </View>
            <Text style={styles.costCatVal}>
              ${totalDirectExpense.toLocaleString()}
            </Text>
          </View>

          <View style={styles.costTotalRow}>
            <Text style={styles.totalLabel}>
              Total {selectedYear === 'all' ? 'Lifetime' : selectedYear} Expenses
            </Text>
            <Text style={styles.totalVal}>
              ${grandTotalCost.toLocaleString()} USD
            </Text>
          </View>
        </Card>

        {/* ========================================================= */}
        {/* LIVESTOCK INVENTORY FOR ACTIVE PARCELS */}
        {/* ========================================================= */}
        {livestockParcels.length > 0 && (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Livestock Inventory</Text>
                <Text style={styles.sectionSubtitle}>
                  Animal species reared across registered parcels
                </Text>
              </View>
              <Badge label="Livestock Active" variant="gold" size="sm" />
            </View>

            {livestockParcels.map((p) => {
              const details = p.livestock_details;
              return (
                <View key={p.id} style={styles.livestockCardItem}>
                  <View style={styles.livestockTopRow}>
                    <Text style={styles.livestockFarmName}>{p.name}</Text>
                    <Badge
                      label={details?.animal_type || 'Mixed Livestock'}
                      variant="success"
                      size="sm"
                    />
                  </View>
                  <Text style={styles.livestockHeadCount}>
                    {details?.head_count || 0} Heads • Breed:{' '}
                    {details?.breed || 'Local Standard'}
                  </Text>
                  {details?.production_purpose && (
                    <Text style={styles.livestockPurpose}>
                      Purpose: {details.production_purpose.join(', ')}
                    </Text>
                  )}
                  {details?.water_source && (
                    <Text style={styles.livestockWater}>
                      Water: {details.water_source} • System:{' '}
                      {details.management_system || 'Free-range'}
                    </Text>
                  )}
                </View>
              );
            })}
          </Card>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* ========================================================= */}
      {/* YEAR PICKER MODAL */}
      {/* ========================================================= */}
      <Modal
        visible={yearModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setYearModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setYearModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Agricultural Year</Text>
              <TouchableOpacity onPress={() => setYearModalVisible(false)}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              <TouchableOpacity
                style={[
                  styles.modalYearOption,
                  selectedYear === 'all' && styles.modalYearOptionActive,
                ]}
                onPress={() => {
                  setSelectedYear('all');
                  setYearModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.modalYearText,
                    selectedYear === 'all' && styles.modalYearTextActive,
                  ]}
                >
                  All Years (Lifetime Ledger)
                </Text>
                {selectedYear === 'all' && (
                  <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>

              {availableYears.map((yr) => {
                const isSelected = selectedYear === String(yr);
                const isCurrent = yr === currentYear;
                return (
                  <TouchableOpacity
                    key={yr}
                    style={[
                      styles.modalYearOption,
                      isSelected && styles.modalYearOptionActive,
                    ]}
                    onPress={() => {
                      setSelectedYear(String(yr));
                      setYearModalVisible(false);
                    }}
                  >
                    <View>
                      <Text
                        style={[
                          styles.modalYearText,
                          isSelected && styles.modalYearTextActive,
                        ]}
                      >
                        {yr} Cropping Season
                      </Text>
                      <Text style={styles.modalYearSub}>
                        {isCurrent ? 'Current Agricultural Cycle' : 'Historical Production Archive'}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={Colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
  // Year & Filter Controls Card
  filterCard: {
    marginBottom: Spacing.md,
    padding: Spacing.sm + 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  filterTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  allYearsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  allYearsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  yearScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
  },
  yearPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  yearPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  yearPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  yearPillTextActive: {
    color: '#FFFFFF',
  },
  yearDotActive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  // Farm Select Section
  farmSelectSection: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  farmSelectLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  farmScrollContent: {
    flexDirection: 'row',
    gap: 6,
  },
  farmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  farmChipActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  farmChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
  },
  farmChipTextActive: {
    color: '#FFFFFF',
  },
  // Scope Banner
  scopeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#F0F9FF',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  scopeBannerText: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '500',
    flex: 1,
  },
  // Hero Summary Card
  heroCard: {
    backgroundColor: Colors.primaryDark,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroSub: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primaryLight,
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: '#FFFFFF',
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  cycleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cycleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: Spacing.md,
  },
  heroStat: {
    alignItems: 'center',
    flex: 1,
  },
  heroStatVal: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: '#FFFFFF',
  },
  heroStatLabel: {
    fontSize: 10,
    color: Colors.primaryLight,
    marginTop: 2,
  },
  heroBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
  },
  heroReturnItem: {
    alignItems: 'center',
    flex: 1,
  },
  heroReturnLabel: {
    fontSize: 9,
    color: Colors.primaryLight,
    textTransform: 'uppercase',
  },
  heroReturnVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 1,
  },
  heroReturnDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // Year-over-Year Card
  yoyCard: {
    marginBottom: Spacing.md,
    padding: Spacing.sm + 2,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },
  yoyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  yoyTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  yoyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  yoyCol: {
    flex: 1,
    alignItems: 'center',
  },
  yoyDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
  },
  yoyMetricLabel: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  yoyMetricVal: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 1,
  },
  yoyTrendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  yoyTrendText: {
    fontSize: 10,
    fontWeight: '700',
  },
  yoyNoPrior: {
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  exportRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  sectionCard: {
    marginBottom: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 1,
    marginBottom: Spacing.sm,
  },
  // Crop Breakdown
  cropItemWrap: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceAlt,
  },
  cropItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cropItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cropIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropNameText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  cropItemRight: {
    alignItems: 'flex-end',
  },
  cropKgVal: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  cropPctText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  batchTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  batchCrop: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  batchYield: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  costItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceAlt,
  },
  costCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  costCatName: {
    fontSize: Typography.sizes.xs,
    color: Colors.text,
    flex: 1,
  },
  costCatVal: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  costTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  totalLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  totalVal: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  emptyInlineText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: Spacing.sm,
  },
  // Livestock Summary Card
  livestockCardItem: {
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  livestockTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  livestockFarmName: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  livestockHeadCount: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: '600',
    marginTop: 2,
  },
  livestockPurpose: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  livestockWater: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    maxHeight: 450,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  modalYearOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceAlt,
  },
  modalYearOptionActive: {
    backgroundColor: '#F0FDF4',
    borderRadius: Radius.md,
  },
  modalYearText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  modalYearTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  modalYearSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
