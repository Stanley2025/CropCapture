import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../src/constants/theme';
import { localDb, generateUUID } from '../src/services/storage/localDatabase';
import { buildExpenseRecord, estimateHarvestRevenue } from '../src/shared/farmRecords';
import { useAppStore } from '../src/store/useAppStore';
import { InputRecord, ExpenseRecord, Farm, HarvestBatch } from '../src/types/database';
import { Header } from '../src/components/Header';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { Badge } from '../src/components/Badge';
import { DatePickerField } from '../src/components/DatePickerField';
import { LAND_PREPARATION_OPERATIONS } from './activity/record';

// ============================================================================
// ENTERPRISE CATEGORIES: CROPS vs. LIVESTOCK vs. ALL
// ============================================================================
const CROPS_INPUT_CATEGORIES = [
  'Seeds & Seedlings',
  'Fertilizers & Nutrients',
  'Crop Protection',
  'Herbicides',
  'Tools & Implements',
  'Equipment & Machinery',
  'Other Crop Materials',
];

const LIVESTOCK_INPUT_CATEGORIES = [
  'Animal Feed & Nutrition',
  'Veterinary & Vaccines',
  'Livestock Mineral Licks & Supplements',
  'Livestock Housing Materials',
  'Tools & Implements',
  'Equipment & Machinery',
  'Other Livestock Materials',
];

const ALL_INPUT_CATEGORIES = [
  'Seeds & Seedlings',
  'Fertilizers & Nutrients',
  'Crop Protection',
  'Herbicides',
  'Animal Feed & Nutrition',
  'Veterinary & Vaccines',
  'Livestock Mineral Licks & Supplements',
  'Livestock Housing Materials',
  'Tools & Implements',
  'Equipment & Machinery',
  'Other Agricultural Materials',
];

const CROP_ONLY_INPUT_CATEGORIES = new Set([
  'Seeds & Seedlings',
  'Fertilizers & Nutrients',
  'Crop Protection',
  'Herbicides',
  'Seeds',
  'Fertilizers',
  'Pesticides',
  'Other Crop Materials',
]);

const LIVESTOCK_ONLY_INPUT_CATEGORIES = new Set([
  'Animal Feed & Nutrition',
  'Veterinary & Vaccines',
  'Livestock Mineral Licks & Supplements',
  'Livestock Housing Materials',
  'Other Livestock Materials',
]);

const CROPS_EXPENSE_CATEGORIES = [
  'Labour & Wages',
  'Land Preparation',
  'Seeds & Seedlings',
  'Fertilizer Application',
  'Pest & Weed Control',
  'Equipment Rental',
  'Transportation & Haulage',
  'Storage & Processing',
  'Irrigation & Water',
  'Other Crop Operations',
];

const LIVESTOCK_EXPENSE_CATEGORIES = [
  'Animal Feed & Care',
  'Veterinary Services',
  'Herd / Flock Vaccination',
  'Labour & Wages (Herd Management)',
  'Livestock Housing & Pen Maintenance',
  'Pasture & Grazing Maintenance',
  'Equipment Rental',
  'Transportation & Haulage',
  'Other Livestock Operations',
];

const ALL_EXPENSE_CATEGORIES = [
  'Labour & Wages',
  'Land Preparation',
  'Seeds & Seedlings',
  'Fertilizer Application',
  'Pest & Weed Control',
  'Animal Feed & Care',
  'Veterinary Services',
  'Herd / Flock Vaccination',
  'Livestock Housing & Pen Maintenance',
  'Pasture & Grazing Maintenance',
  'Equipment Rental',
  'Transportation & Haulage',
  'Storage & Processing',
  'Irrigation & Water',
  'Other Operations',
];

const CROP_ONLY_EXPENSE_CATEGORIES = new Set([
  'Land Preparation',
  'Land preparation',
  'Seeds & Seedlings',
  'Seeds',
  'Fertilizer Application',
  'Fertilizer',
  'Pest & Weed Control',
  'Pesticides',
  'Irrigation & Water',
  'Irrigation',
  'Other Crop Operations',
]);

const LIVESTOCK_ONLY_EXPENSE_CATEGORIES = new Set([
  'Animal Feed & Care',
  'Veterinary Services',
  'Herd / Flock Vaccination',
  'Livestock Housing & Pen Maintenance',
  'Pasture & Grazing Maintenance',
  'Labour & Wages (Herd Management)',
  'Other Livestock Operations',
]);

export default function InputsExpensesScreen() {
  const router = useRouter();
  const { currentRole, currentFarmer, refreshPendingSyncCount } = useAppStore();

  const [activeTab, setActiveTab] = useState<'inputs' | 'expenses'>('inputs');
  const [inputs, setInputs] = useState<InputRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Global Context Filter State (Farm and Year)
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>('all');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('all');
  const [yearDropdownVisible, setYearDropdownVisible] = useState(false);

  // Input / Inventory Form State
  const [inputFarmId, setInputFarmId] = useState<string>('');
  const [inputName, setInputName] = useState('');
  const [inputCat, setInputCat] = useState('Seeds & Seedlings');
  const [inputQty, setInputQty] = useState('');
  const [inputUnit, setInputUnit] = useState('kg');
  const [inputCost, setInputCost] = useState('');
  const [inputCurrency, setInputCurrency] = useState<'USD' | 'LRD'>('USD');
  const [inputSupplier, setInputSupplier] = useState('');
  const [inputPurchaseDate, setInputPurchaseDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [inputNotes, setInputNotes] = useState('');

  // Expense Form State
  const [expenseFarmId, setExpenseFarmId] = useState<string>('');
  const [expenseCat, setExpenseCat] = useState('Labour & Wages');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState<'USD' | 'LRD'>('USD');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      let [inp, exp, f, h] = await Promise.all([
        localDb.getInputs(),
        localDb.getExpenses(),
        localDb.getFarms(),
        localDb.getHarvests(),
      ]);

      if (currentRole === 'farmer' && currentFarmer?.id) {
        f = f.filter((farm) => farm.farmer_id === currentFarmer.id);
        const myFarmIds = new Set(f.map((farm) => farm.id));
        inp = inp.filter((item) => myFarmIds.has(item.farm_id));
        exp = exp.filter((item) => myFarmIds.has(item.farm_id));
        h = h.filter((item) => myFarmIds.has(item.farm_id) || item.farmer_id === currentFarmer.id);
      }

      setInputs(inp);
      setExpenses(exp);
      setFarms(f);
      setHarvests(h);

      // Default the quick-add farm picker to the first farm if available
      if (f.length > 0) {
        setInputFarmId((prev) => {
          const chosen = prev || f[0].id;
          const chosenFarm = f.find((fm) => fm.id === chosen);
          if (chosenFarm?.farming_type === 'livestock') {
            setInputCat('Animal Feed & Nutrition');
          } else if (chosenFarm?.farming_type === 'crops') {
            setInputCat('Seeds & Seedlings');
          }
          return chosen;
        });

        setExpenseFarmId((prev) => {
          const chosen = prev || f[0].id;
          const chosenFarm = f.find((fm) => fm.id === chosen);
          if (chosenFarm?.farming_type === 'livestock') {
            setExpenseCat('Animal Feed & Care');
          } else if (chosenFarm?.farming_type === 'crops') {
            setExpenseCat('Labour & Wages');
          }
          return chosen;
        });
      }
    } catch (e) {
      console.error('Failed to load inputs and expenses:', e);
    }
  }, [currentRole, currentFarmer?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await useAppStore.getState().pullRemoteChanges();
    await loadData();
    setRefreshing(false);
  };

  // Discover all distinct years from inputs, expenses, and defaults
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    const currentYr = new Date().getFullYear().toString();
    years.add(currentYr);
    years.add('2025');
    years.add('2024');

    inputs.forEach((i) => {
      const yr = i.purchase_date?.substring(0, 4);
      if (yr) years.add(yr);
    });
    expenses.forEach((e) => {
      const yr = e.expense_date?.substring(0, 4);
      if (yr) years.add(yr);
    });

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [inputs, expenses]);

  // Farm lookup map
  const farmMap = useMemo(() => {
    const map = new Map<string, Farm>();
    farms.forEach((f) => map.set(f.id, f));
    return map;
  }, [farms]);

  // When top farm filter changes, sync quick-add farm selector and adapt categories
  const handleFarmFilterChange = (farmId: string) => {
    setSelectedFarmFilter(farmId);
    if (farmId !== 'all') {
      setInputFarmId(farmId);
      setExpenseFarmId(farmId);

      const target = farmMap.get(farmId);
      if (target?.farming_type === 'livestock') {
        setInputCat('Animal Feed & Nutrition');
        setExpenseCat('Animal Feed & Care');
      } else if (target?.farming_type === 'crops') {
        setInputCat('Seeds & Seedlings');
        setExpenseCat('Labour & Wages');
      }
    }
  };

  // When farmer selects a farm in the Input form
  const handleSelectInputFarm = (farmId: string) => {
    setInputFarmId(farmId);
    const target = farmMap.get(farmId);
    if (target?.farming_type === 'livestock') {
      if (CROP_ONLY_INPUT_CATEGORIES.has(inputCat) || !LIVESTOCK_INPUT_CATEGORIES.includes(inputCat)) {
        setInputCat('Animal Feed & Nutrition');
      }
    } else if (target?.farming_type === 'crops') {
      if (LIVESTOCK_ONLY_INPUT_CATEGORIES.has(inputCat) || !CROPS_INPUT_CATEGORIES.includes(inputCat)) {
        setInputCat('Seeds & Seedlings');
      }
    }
  };

  // When farmer selects a farm in the Expense form
  const handleSelectExpenseFarm = (farmId: string) => {
    setExpenseFarmId(farmId);
    const target = farmMap.get(farmId);
    if (target?.farming_type === 'livestock') {
      if (CROP_ONLY_EXPENSE_CATEGORIES.has(expenseCat) || !LIVESTOCK_EXPENSE_CATEGORIES.includes(expenseCat)) {
        setExpenseCat('Animal Feed & Care');
      }
    } else if (target?.farming_type === 'crops') {
      if (LIVESTOCK_ONLY_EXPENSE_CATEGORIES.has(expenseCat) || !CROPS_EXPENSE_CATEGORIES.includes(expenseCat)) {
        setExpenseCat('Labour & Wages');
      }
    }
  };

  // When top year filter changes, optionally update the date pickers for quick logging
  const handleYearFilterChange = (yr: string) => {
    setSelectedYearFilter(yr);
    if (yr !== 'all') {
      const currentYr = new Date().getFullYear().toString();
      if (yr === currentYr) {
        const today = new Date().toISOString().split('T')[0];
        setInputPurchaseDate(today);
        setExpenseDate(today);
      } else {
        const defaultPastDate = `${yr}-06-01`;
        setInputPurchaseDate(defaultPastDate);
        setExpenseDate(defaultPastDate);
      }
    }
  };

  // Selected farm details for the active input and expense forms
  const activeInputFarm = farmMap.get(inputFarmId);
  const activeExpenseFarm = farmMap.get(expenseFarmId);

  // Dynamic Categories available based on selected farm's enterprise type
  const availableInputCategories = useMemo(() => {
    if (activeInputFarm?.farming_type === 'livestock') {
      return LIVESTOCK_INPUT_CATEGORIES;
    } else if (activeInputFarm?.farming_type === 'crops') {
      return CROPS_INPUT_CATEGORIES;
    }
    return ALL_INPUT_CATEGORIES;
  }, [activeInputFarm]);

  const availableExpenseCategories = useMemo(() => {
    if (activeExpenseFarm?.farming_type === 'livestock') {
      return LIVESTOCK_EXPENSE_CATEGORIES;
    } else if (activeExpenseFarm?.farming_type === 'crops') {
      return CROPS_EXPENSE_CATEGORIES;
    }
    return ALL_EXPENSE_CATEGORIES;
  }, [activeExpenseFarm]);

  // Strict Enterprise-Filtered lists:
  // When a livestock farm is selected -> NO crops data, only livestock data!
  // When a crops farm is selected -> NO livestock data, only crops data!
  const filteredInputs = useMemo(() => {
    return inputs.filter((i) => {
      const matchFarm = selectedFarmFilter === 'all' || i.farm_id === selectedFarmFilter;
      const yr = i.purchase_date?.substring(0, 4);
      const matchYear = selectedYearFilter === 'all' || yr === selectedYearFilter;
      if (!matchFarm || !matchYear) return false;

      // Strict Enterprise Isolation:
      if (selectedFarmFilter !== 'all') {
        const targetFarm = farmMap.get(selectedFarmFilter);
        if (targetFarm?.farming_type === 'livestock') {
          // Do not bring crops data
          if (CROP_ONLY_INPUT_CATEGORIES.has(i.category)) return false;
        } else if (targetFarm?.farming_type === 'crops') {
          // Do not bring livestock data
          if (LIVESTOCK_ONLY_INPUT_CATEGORIES.has(i.category)) return false;
        }
      }
      return true;
    });
  }, [inputs, selectedFarmFilter, selectedYearFilter, farmMap]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchFarm = selectedFarmFilter === 'all' || e.farm_id === selectedFarmFilter;
      const yr = e.expense_date?.substring(0, 4);
      const matchYear = selectedYearFilter === 'all' || yr === selectedYearFilter;
      if (!matchFarm || !matchYear) return false;

      // Strict Enterprise Isolation:
      if (selectedFarmFilter !== 'all') {
        const targetFarm = farmMap.get(selectedFarmFilter);
        if (targetFarm?.farming_type === 'livestock') {
          // Do not bring crops data
          if (CROP_ONLY_EXPENSE_CATEGORIES.has(e.category)) return false;
        } else if (targetFarm?.farming_type === 'crops') {
          // Do not bring livestock data
          if (LIVESTOCK_ONLY_EXPENSE_CATEGORIES.has(e.category)) return false;
        }
      }
      return true;
    });
  }, [expenses, selectedFarmFilter, selectedYearFilter, farmMap]);

  // Dual currency summaries
  const totalInputsUSD = filteredInputs
    .filter((i) => i.currency !== 'LRD')
    .reduce((acc, i) => acc + (Number(i.cost) || 0), 0);
  const totalInputsLRD = filteredInputs
    .filter((i) => i.currency === 'LRD')
    .reduce((acc, i) => acc + (Number(i.cost) || 0), 0);

  const totalExpensesUSD = filteredExpenses
    .filter((e) => e.currency !== 'LRD')
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const totalExpensesLRD = filteredExpenses
    .filter((e) => e.currency === 'LRD')
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  // Real Farm Profit & Loss Calculation: Amount Spent vs Harvest Got vs Net Profit
  const farmProfitSummary = useMemo(() => {
    // 1. Amount spent on the selected farm and production year (inputs + expenses in USD)
    const spentUSD = totalInputsUSD + totalExpensesUSD;

    // 2. Amount got from harvest for this farm and production year
    const filteredHarvests = harvests.filter((item) => {
      if (selectedFarmFilter !== 'all' && item.farm_id !== selectedFarmFilter) {
        return false;
      }
      if (selectedYearFilter !== 'all') {
        const itemYear = (item.harvest_date || item.created_at || '').substring(0, 4);
        if (itemYear !== selectedYearFilter) {
          return false;
        }
      }
      return true;
    });

    const totalHarvestRevenue = estimateHarvestRevenue(filteredHarvests);

    const netProfit = totalHarvestRevenue - spentUSD;
    const isProfitable = netProfit >= 0;

    return {
      totalSpent: spentUSD,
      totalHarvestRevenue,
      netProfit,
      isProfitable,
      harvestCount: filteredHarvests.length,
      hasData: spentUSD > 0 || totalHarvestRevenue > 0,
    };
  }, [
    totalInputsUSD,
    totalExpensesUSD,
    harvests,
    selectedFarmFilter,
    selectedYearFilter,
  ]);

  // Submit Handler: Add Input / Inventory
  const handleAddInput = async () => {
    if (!inputFarmId) {
      Alert.alert('Farm Required', 'Please select a farm parcel for this input inventory.');
      return;
    }
    if (!inputName.trim() || !inputQty.trim() || !inputCost.trim()) {
      Alert.alert('Incomplete Form', 'Please enter input item name, quantity, and total cost.');
      return;
    }
    if (isNaN(Number(inputQty)) || Number(inputQty) <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid positive quantity.');
      return;
    }
    if (isNaN(Number(inputCost)) || Number(inputCost) < 0) {
      Alert.alert('Invalid Cost', 'Please enter a valid cost amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetFarm = farmMap.get(inputFarmId);
      const record: InputRecord = {
        id: generateUUID(),
        farm_id: inputFarmId,
        name: inputName.trim(),
        category: inputCat,
        quantity: parseFloat(inputQty),
        unit: inputUnit.trim() || 'units',
        purchase_date: inputPurchaseDate,
        supplier: inputSupplier.trim() || 'Local Agrodealer',
        cost: parseFloat(inputCost),
        currency: inputCurrency,
        notes:
          inputNotes.trim() ||
          `Procured for ${targetFarm?.name || 'farm'} (${inputCat.toLowerCase()}).`,
        created_at: new Date().toISOString(),
      };

      await localDb.saveInput(record, true);
      await refreshPendingSyncCount();

      setInputName('');
      setInputQty('');
      setInputCost('');
      setInputSupplier('');
      setInputNotes('');
      await loadData();

      Alert.alert(
        'Inventory Recorded!',
        `Saved "${record.name}" to inventory for ${targetFarm?.name || 'selected farm'}.`
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save input record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Handler: Add Expense
  const handleAddExpense = async () => {
    if (!expenseFarmId) {
      Alert.alert('Farm Required', 'Please select a farm parcel for this operating expense.');
      return;
    }
    if (!expenseAmount.trim() || isNaN(Number(expenseAmount)) || Number(expenseAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid expense amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetFarm = farmMap.get(expenseFarmId);
      const record: ExpenseRecord = {
        ...buildExpenseRecord({
          farmId: expenseFarmId,
          category: expenseCat,
          amount: parseFloat(expenseAmount),
          currency: expenseCurrency,
          expenseDate,
          description:
            expenseDesc.trim() ||
            `${expenseCat} operations on ${targetFarm?.name || 'farm'}.`,
        }),
        currency: expenseCurrency,
      };

      await localDb.saveExpense(record, true);
      await refreshPendingSyncCount();

      setExpenseAmount('');
      setExpenseDesc('');
      await loadData();

      Alert.alert(
        'Expense Logged!',
        `Recorded ${record.currency} ${record.amount} for ${record.category} on ${targetFarm?.name || 'farm'}.`
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save expense record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Inputs & Costs"
        subtitle="Agri-inventory, procurement & cost tracking"
        showBack
      />
      <OfflineBanner />

      {/* ========================================================= */}
      {/* GLOBAL SELECTORS: YEAR & FARM FILTER BAR */}
      {/* ========================================================= */}
      <View style={styles.filterSection}>
        {/* Year Filter Dropdown Selector */}
        <View style={styles.filterGroup}>
          <View style={styles.filterHeaderRow}>
            <Ionicons name="calendar-outline" size={14} color={Colors.primaryDark} />
            <Text style={styles.filterLabel}>PRODUCTION YEAR:</Text>
            {selectedYearFilter !== 'all' && (
              <Badge label={`Year ${selectedYearFilter}`} variant="info" size="sm" />
            )}
          </View>
          <TouchableOpacity
            style={styles.yearDropdownSelectBox}
            onPress={() => setYearDropdownVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.yearDropdownSelectLeft}>
              <Ionicons name="calendar" size={16} color={Colors.primary} />
              <Text style={styles.yearDropdownSelectText}>
                {selectedYearFilter === 'all'
                  ? 'All Production Years'
                  : `Production Year ${selectedYearFilter}`}
              </Text>
            </View>
            <View style={styles.yearDropdownSelectRight}>
              <Text style={styles.yearDropdownBadgeText}>Change</Text>
              <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Year Dropdown Modal */}
        <Modal
          visible={yearDropdownVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setYearDropdownVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setYearDropdownVisible(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="calendar" size={20} color={Colors.primary} />
                  <Text style={styles.modalTitle}>Select Production Year</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setYearDropdownVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color={Colors.text} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.modalYearItem,
                  selectedYearFilter === 'all' && styles.modalYearItemActive,
                ]}
                onPress={() => {
                  handleYearFilterChange('all');
                  setYearDropdownVisible(false);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={selectedYearFilter === 'all' ? Colors.primary : Colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.modalYearText,
                      selectedYearFilter === 'all' && styles.modalYearTextActive,
                    ]}
                  >
                    All Production Years (Consolidated)
                  </Text>
                </View>
                {selectedYearFilter === 'all' && (
                  <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>

              {availableYears.map((yr) => {
                const isSelected = selectedYearFilter === yr;
                return (
                  <TouchableOpacity
                    key={yr}
                    style={[styles.modalYearItem, isSelected && styles.modalYearItemActive]}
                    onPress={() => {
                      handleYearFilterChange(yr);
                      setYearDropdownVisible(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons
                        name="calendar"
                        size={18}
                        color={isSelected ? Colors.primary : Colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.modalYearText,
                          isSelected && styles.modalYearTextActive,
                        ]}
                      >
                        Production Year {yr}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Farm Filter Selector */}
        <View style={[styles.filterGroup, { marginTop: Spacing.xs }]}>
          <View style={styles.filterHeaderRow}>
            <Ionicons name="business-outline" size={14} color={Colors.primaryDark} />
            <Text style={styles.filterLabel}>SELECT FARM PARCEL:</Text>
            <Badge
              label={
                selectedFarmFilter === 'all'
                  ? `${farms.length} Farms`
                  : farmMap.get(selectedFarmFilter)?.name || 'Parcel'
              }
              variant={
                farmMap.get(selectedFarmFilter)?.farming_type === 'livestock'
                  ? 'warning'
                  : 'success'
              }
              size="sm"
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}
          >
            <TouchableOpacity
              style={[
                styles.farmFilterChip,
                selectedFarmFilter === 'all' && styles.farmFilterChipActive,
              ]}
              onPress={() => handleFarmFilterChange('all')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="grid"
                size={13}
                color={selectedFarmFilter === 'all' ? '#FFFFFF' : Colors.primary}
              />
              <Text
                style={[
                  styles.farmFilterChipText,
                  selectedFarmFilter === 'all' && styles.farmFilterChipTextActive,
                ]}
              >
                All Farms ({farms.length})
              </Text>
            </TouchableOpacity>

            {farms.map((f) => {
              const isSelected = selectedFarmFilter === f.id;
              const isLivestock = f.farming_type === 'livestock';
              const isBoth = f.farming_type === 'both';
              const farmIcon = isLivestock ? 'paw' : isBoth ? 'layers' : 'leaf';
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.farmFilterChip,
                    isSelected &&
                      (isLivestock
                        ? styles.farmFilterChipActiveLivestock
                        : styles.farmFilterChipActive),
                  ]}
                  onPress={() => handleFarmFilterChange(f.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={farmIcon as any}
                    size={13}
                    color={
                      isSelected
                        ? '#FFFFFF'
                        : isLivestock
                        ? '#D97706'
                        : Colors.primary
                    }
                  />
                  <Text
                    style={[
                      styles.farmFilterChipText,
                      isSelected && styles.farmFilterChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {f.name}
                  </Text>
                  <Text
                    style={[
                      styles.farmFilterChipSub,
                      isSelected && styles.farmFilterChipSubActive,
                    ]}
                  >
                    ({isLivestock ? 'Livestock' : isBoth ? 'Both' : 'Crops'})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'inputs' && styles.tabBtnActive]}
          onPress={() => setActiveTab('inputs')}
        >
          <Ionicons
            name="cart-outline"
            size={16}
            color={activeTab === 'inputs' ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'inputs' && styles.tabTextActive]}>
            Inputs & Inventory ({filteredInputs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'expenses' && styles.tabBtnActive]}
          onPress={() => setActiveTab('expenses')}
        >
          <Ionicons
            name="cash-outline"
            size={16}
            color={activeTab === 'expenses' ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>
            Farm Expenses ({filteredExpenses.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Real Farm Profit & Loss Highlight (Spent vs Harvested vs Net Profit) */}
        <Card
          style={[
            styles.farmProfitCard,
            farmProfitSummary.hasData
              ? farmProfitSummary.isProfitable
                ? styles.farmProfitCardProfitable
                : styles.farmProfitCardLoss
              : styles.farmProfitCardEmpty,
          ]}
        >
          <View style={styles.farmProfitHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name={
                  !farmProfitSummary.hasData
                    ? 'calculator-outline'
                    : farmProfitSummary.isProfitable
                    ? 'trending-up'
                    : 'trending-down'
                }
                size={18}
                color={
                  !farmProfitSummary.hasData
                    ? Colors.textMuted
                    : farmProfitSummary.isProfitable
                    ? '#15803D'
                    : '#DC2626'
                }
              />
              <Text style={styles.farmProfitTitle}>
                {selectedFarmFilter === 'all'
                  ? 'Consolidated Farm Profit & Loss'
                  : `${farmMap.get(selectedFarmFilter)?.name || 'Farm'} Profit & Loss`}
              </Text>
            </View>
            <Badge
              label={
                !farmProfitSummary.hasData
                  ? 'No Financials'
                  : farmProfitSummary.isProfitable
                  ? `+$${farmProfitSummary.netProfit.toLocaleString()} Net Profit`
                  : `-$${Math.abs(farmProfitSummary.netProfit).toLocaleString()} Net Deficit`
              }
              variant={
                !farmProfitSummary.hasData
                  ? 'default'
                  : farmProfitSummary.isProfitable
                  ? 'success'
                  : 'danger'
              }
            />
          </View>

          <View style={styles.farmProfitGrid}>
            <View style={styles.farmProfitColumn}>
              <Text style={styles.farmProfitColLabel}>AMOUNT SPENT</Text>
              <Text style={styles.farmProfitColSpent}>
                ${farmProfitSummary.totalSpent.toLocaleString()} USD
              </Text>
              <Text style={styles.farmProfitColSub}>inputs & operations</Text>
            </View>

            <View style={styles.farmProfitColDivider} />

            <View style={styles.farmProfitColumn}>
              <Text style={styles.farmProfitColLabel}>GOT FROM HARVEST</Text>
              <Text style={styles.farmProfitColHarvest}>
                ${farmProfitSummary.totalHarvestRevenue.toLocaleString()} USD
              </Text>
              <Text style={styles.farmProfitColSub}>
                {farmProfitSummary.harvestCount} harvest batch(es)
              </Text>
            </View>

            <View style={styles.farmProfitColDivider} />

            <View style={styles.farmProfitColumn}>
              <Text style={styles.farmProfitColLabel}>NET PROFIT</Text>
              <Text
                style={[
                  styles.farmProfitColProfit,
                  farmProfitSummary.isProfitable
                    ? styles.farmProfitColProfitPos
                    : styles.farmProfitColProfitNeg,
                ]}
              >
                {farmProfitSummary.netProfit >= 0 ? '+' : ''}$
                {farmProfitSummary.netProfit.toLocaleString()} USD
              </Text>
              <Text style={styles.farmProfitColSub}>
                {farmProfitSummary.isProfitable ? 'Profitable return' : 'Operating deficit'}
              </Text>
            </View>
          </View>

          <View style={styles.farmProfitFormulaBox}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.farmProfitFormulaText}>
              Calculation: Harvest Got (${farmProfitSummary.totalHarvestRevenue.toLocaleString()}) - Amount Spent (${farmProfitSummary.totalSpent.toLocaleString()}) = Net Profit ({farmProfitSummary.netProfit >= 0 ? '+' : ''}${farmProfitSummary.netProfit.toLocaleString()} USD)
            </Text>
          </View>
        </Card>

        {activeTab === 'inputs' ? (
          <>
            {/* Input & Inventory Financial Summary */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>
                    TOTAL INVENTORY EXPENDITURE (
                    {selectedYearFilter === 'all' ? 'ALL YEARS' : selectedYearFilter})
                  </Text>
                  <Text style={styles.summaryVal}>
                    ${totalInputsUSD.toLocaleString()} USD
                  </Text>
                  {totalInputsLRD > 0 && (
                    <Text style={styles.summarySubVal}>
                      + L${totalInputsLRD.toLocaleString()} LRD
                    </Text>
                  )}
                  <Text style={styles.summaryFarmContext}>
                    Parcel:{' '}
                    {selectedFarmFilter === 'all'
                      ? `Consolidated (${farms.length} Farms)`
                      : `${farmMap.get(selectedFarmFilter)?.name} (${
                          farmMap.get(selectedFarmFilter)?.farming_type === 'livestock'
                            ? 'Livestock only'
                            : farmMap.get(selectedFarmFilter)?.farming_type === 'both'
                            ? 'Crops & Livestock'
                            : 'Crops only'
                        })`}
                  </Text>
                </View>
                <Badge
                  label={`${filteredInputs.length} Items in Inventory`}
                  variant={
                    farmMap.get(selectedFarmFilter)?.farming_type === 'livestock'
                      ? 'warning'
                      : 'success'
                  }
                />
              </View>
            </Card>

            {/* Quick Add Input / Inventory Form */}
            <Card style={styles.formCard}>
              <View style={styles.formTitleRow}>
                <View
                  style={[
                    styles.formIconWrap,
                    activeInputFarm?.farming_type === 'livestock' && {
                      backgroundColor: '#FEF3C7',
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      activeInputFarm?.farming_type === 'livestock'
                        ? 'paw'
                        : 'cube-outline'
                    }
                    size={18}
                    color={
                      activeInputFarm?.farming_type === 'livestock'
                        ? '#D97706'
                        : Colors.primary
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formTitle}>
                    {activeInputFarm?.farming_type === 'livestock'
                      ? '+ Record Livestock Inventory & Materials'
                      : '+ Record Agricultural Input & Inventory'}
                  </Text>
                  <Text style={styles.formSubtitle}>
                    {activeInputFarm?.farming_type === 'livestock'
                      ? 'Capture animal feed, veterinary medicines, housing & equipment'
                      : 'Capture certified seeds, mineral fertilizers, crop protection & tools'}
                  </Text>
                </View>
              </View>

              {/* FARM SELECTION FOR INPUT */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Farm Parcel *</Text>
                <Text style={styles.helperText}>
                  Select farm parcel (enterprise filters categories automatically):
                </Text>
                {farms.length === 0 ? (
                  <View style={styles.noFarmBanner}>
                    <Text style={styles.noFarmText}>No registered farms found.</Text>
                    <TouchableOpacity
                      onPress={() => router.push('/farm/register' as any)}
                      style={styles.registerFarmBtn}
                    >
                      <Text style={styles.registerFarmBtnText}>Register Farm First</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.farmSelectRow}
                  >
                    {farms.map((f) => {
                      const isSelected = inputFarmId === f.id;
                      const isLivestock = f.farming_type === 'livestock';
                      const isBoth = f.farming_type === 'both';
                      const farmIcon = isLivestock ? 'paw' : isBoth ? 'layers' : 'leaf';
                      return (
                        <TouchableOpacity
                          key={f.id}
                          style={[
                            styles.farmSelectChip,
                            isSelected &&
                              (isLivestock
                                ? styles.farmSelectChipActiveLivestock
                                : styles.farmSelectChipActive),
                          ]}
                          onPress={() => handleSelectInputFarm(f.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={farmIcon as any}
                            size={14}
                            color={
                              isSelected
                                ? '#FFFFFF'
                                : isLivestock
                                ? '#D97706'
                                : Colors.primary
                            }
                          />
                          <View style={{ marginLeft: 6 }}>
                            <Text
                              style={[
                                styles.farmSelectChipTitle,
                                isSelected && styles.farmSelectChipTitleActive,
                              ]}
                            >
                              {f.name}
                            </Text>
                            <Text
                              style={[
                                styles.farmSelectChipSub,
                                isSelected && styles.farmSelectChipSubActive,
                              ]}
                            >
                              {f.size} {f.size_unit} • {isLivestock ? 'Livestock' : isBoth ? 'Both' : 'Crops'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              {/* ENTERPRISE ADAPTIVE NOTICE BANNER */}
              <View
                style={[
                  styles.enterpriseNoticeBanner,
                  activeInputFarm?.farming_type === 'livestock' &&
                    styles.enterpriseNoticeBannerLivestock,
                ]}
              >
                <Ionicons
                  name={
                    activeInputFarm?.farming_type === 'livestock'
                      ? 'paw'
                      : activeInputFarm?.farming_type === 'both'
                      ? 'layers'
                      : 'leaf'
                  }
                  size={14}
                  color={
                    activeInputFarm?.farming_type === 'livestock'
                      ? '#B45309'
                      : Colors.primaryDark
                  }
                />
                <Text
                  style={[
                    styles.enterpriseNoticeText,
                    activeInputFarm?.farming_type === 'livestock' &&
                      styles.enterpriseNoticeTextLivestock,
                  ]}
                >
                  {activeInputFarm?.farming_type === 'livestock'
                    ? 'LIVESTOCK FARM ACTIVE: Showing livestock inventory categories only. Crops data excluded.'
                    : activeInputFarm?.farming_type === 'crops'
                    ? 'CROPS FARM ACTIVE: Showing crops input categories only. Livestock data excluded.'
                    : 'INTEGRATED FARM: Both crop and livestock categories available.'}
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {activeInputFarm?.farming_type === 'livestock'
                    ? 'Livestock Item / Feed Name *'
                    : 'Input Item Name *'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    activeInputFarm?.farming_type === 'livestock'
                      ? 'e.g. Broiler Finisher Mash / Mineral Salt Lick / Dewormer'
                      : 'e.g. NPK 15-15-15 Compound Fertilizer / Rice Seed LAC 23'
                  }
                  placeholderTextColor={Colors.textMuted}
                  value={inputName}
                  onChangeText={setInputName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Category *</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipRow}
                >
                  {availableInputCategories.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.chip,
                        inputCat === c &&
                          (activeInputFarm?.farming_type === 'livestock'
                            ? styles.chipActiveLivestock
                            : styles.chipActive),
                      ]}
                      onPress={() => setInputCat(c)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          inputCat === c && styles.chipTextActive,
                        ]}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1.5, marginRight: Spacing.xs }]}>
                  <Text style={styles.label}>Quantity *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 10"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={inputQty}
                    onChangeText={setInputQty}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.xs }]}>
                  <Text style={styles.label}>Unit</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={
                      activeInputFarm?.farming_type === 'livestock'
                        ? 'bags / doses / kg'
                        : 'bags / kg / litres'
                    }
                    placeholderTextColor={Colors.textMuted}
                    value={inputUnit}
                    onChangeText={setInputUnit}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1.5, marginRight: Spacing.xs }]}>
                  <Text style={styles.label}>Total Cost *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 150"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={inputCost}
                    onChangeText={setInputCost}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.xs }]}>
                  <Text style={styles.label}>Currency</Text>
                  <View style={styles.currencyToggle}>
                    <TouchableOpacity
                      style={[
                        styles.currBtn,
                        inputCurrency === 'USD' && styles.currBtnActive,
                      ]}
                      onPress={() => setInputCurrency('USD')}
                    >
                      <Text
                        style={[
                          styles.currText,
                          inputCurrency === 'USD' && styles.currTextActive,
                        ]}
                      >
                        USD ($)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.currBtn,
                        inputCurrency === 'LRD' && styles.currBtnActive,
                      ]}
                      onPress={() => setInputCurrency('LRD')}
                    >
                      <Text
                        style={[
                          styles.currText,
                          inputCurrency === 'LRD' && styles.currTextActive,
                        ]}
                      >
                        LRD (L$)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Supplier / Store</Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    activeInputFarm?.farming_type === 'livestock'
                      ? 'e.g. Monrovia Feed Mills / Central Agrovet'
                      : 'e.g. Central Gbarnga Agrovet Depot'
                  }
                  placeholderTextColor={Colors.textMuted}
                  value={inputSupplier}
                  onChangeText={setInputSupplier}
                />
              </View>

              <DatePickerField
                label="Purchase Date (Sets Year)"
                value={inputPurchaseDate}
                onChange={setInputPurchaseDate}
                helperText="Date input was procured and added to farm inventory"
              />

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Storage Location / Notes</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Stored in dry store room, Shelf 2"
                  placeholderTextColor={Colors.textMuted}
                  value={inputNotes}
                  onChangeText={setInputNotes}
                />
              </View>

              <Button
                title={
                  activeInputFarm?.farming_type === 'livestock'
                    ? 'Save to Livestock Inventory'
                    : 'Save to Farm Inventory'
                }
                onPress={handleAddInput}
                size="md"
                loading={isSubmitting}
                icon={<Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />}
              />
            </Card>

            {/* Inputs & Inventory List */}
            <View style={styles.listSectionHeader}>
              <Text style={styles.listSectionTitle}>
                Procured Materials & Inventory History ({filteredInputs.length})
              </Text>
              <Text style={styles.listSectionSubtitle}>
                Filtered by {selectedYearFilter === 'all' ? 'All Years' : `Year ${selectedYearFilter}`}{' '}
                •{' '}
                {selectedFarmFilter === 'all'
                  ? 'All Farms'
                  : `${farmMap.get(selectedFarmFilter)?.name} (${
                      farmMap.get(selectedFarmFilter)?.farming_type === 'livestock'
                        ? 'Livestock only'
                        : farmMap.get(selectedFarmFilter)?.farming_type === 'both'
                        ? 'Both'
                        : 'Crops only'
                    })`}
              </Text>
            </View>

            {filteredInputs.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons
                  name={
                    farmMap.get(selectedFarmFilter)?.farming_type === 'livestock'
                      ? 'paw-outline'
                      : 'cart-outline'
                  }
                  size={36}
                  color={Colors.textMuted}
                />
                <Text style={styles.emptyTitle}>
                  {farmMap.get(selectedFarmFilter)?.farming_type === 'livestock'
                    ? 'No Livestock Inventory Found'
                    : 'No Inventory Records Found'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {farmMap.get(selectedFarmFilter)?.farming_type === 'livestock'
                    ? 'No livestock feed, veterinary medicines or materials recorded for this parcel.'
                    : 'No agricultural materials recorded for this farm or year selection.'}
                </Text>
              </Card>
            ) : (
              filteredInputs.map((i) => {
                const farm = farmMap.get(i.farm_id);
                const isLivestock = farm?.farming_type === 'livestock';
                return (
                  <Card key={i.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1, marginRight: Spacing.xs }}>
                        <Text style={styles.itemName}>{i.name}</Text>
                        <View style={styles.itemMetaRow}>
                          <View
                            style={[
                              styles.itemFarmBadge,
                              isLivestock && {
                                backgroundColor: '#FEF3C7',
                                borderColor: '#FDE68A',
                              },
                            ]}
                          >
                            <Ionicons
                              name={
                                isLivestock
                                  ? 'paw'
                                  : farm?.farming_type === 'both'
                                  ? 'layers'
                                  : 'leaf'
                              }
                              size={11}
                              color={isLivestock ? '#B45309' : Colors.primaryDark}
                            />
                            <Text
                              style={[
                                styles.itemFarmText,
                                isLivestock && { color: '#B45309' },
                              ]}
                            >
                              {farm?.name || 'Farm Parcel'}
                            </Text>
                          </View>
                          <Text style={styles.itemCategory}>{i.category}</Text>
                        </View>
                      </View>
                      <Text style={styles.itemCost}>
                        {i.currency === 'USD' ? '$' : 'L$'}
                        {Number(i.cost).toLocaleString()} {i.currency}
                      </Text>
                    </View>

                    <View style={styles.itemFooter}>
                      <View>
                        <Text style={styles.itemDate}>
                          📅 {i.purchase_date} • {i.quantity} {i.unit}
                        </Text>
                        {i.supplier ? (
                          <Text style={styles.itemSupplier}>Supplier: {i.supplier}</Text>
                        ) : null}
                      </View>
                      <Badge
                        label={isLivestock ? 'Livestock Stock' : 'In Inventory'}
                        variant={isLivestock ? 'warning' : 'info'}
                        size="sm"
                      />
                    </View>
                  </Card>
                );
              })
            )}
          </>
        ) : (
          <>
            {/* Expense Financial Summary */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>
                    TOTAL FARM EXPENSES (
                    {selectedYearFilter === 'all' ? 'ALL YEARS' : selectedYearFilter})
                  </Text>
                  <Text style={styles.summaryVal}>
                    ${totalExpensesUSD.toLocaleString()} USD
                  </Text>
                  {totalExpensesLRD > 0 && (
                    <Text style={styles.summarySubVal}>
                      + L${totalExpensesLRD.toLocaleString()} LRD
                    </Text>
                  )}
                  <Text style={styles.summaryFarmContext}>
                    Parcel:{' '}
                    {selectedFarmFilter === 'all'
                      ? `Consolidated (${farms.length} Farms)`
                      : `${farmMap.get(selectedFarmFilter)?.name} (${
                          farmMap.get(selectedFarmFilter)?.farming_type === 'livestock'
                            ? 'Livestock only'
                            : farmMap.get(selectedFarmFilter)?.farming_type === 'both'
                            ? 'Crops & Livestock'
                            : 'Crops only'
                        })`}
                  </Text>
                </View>
                <Badge
                  label={`${filteredExpenses.length} Expense Logs`}
                  variant="gold"
                />
              </View>
            </Card>

            {/* Quick Add Expense Form */}
            <Card style={styles.formCard}>
              <View style={styles.formTitleRow}>
                <View style={[styles.formIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="wallet-outline" size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formTitle}>
                    {activeExpenseFarm?.farming_type === 'livestock'
                      ? '+ Log Livestock Operating Expense'
                      : '+ Log Farm Operating Expense'}
                  </Text>
                  <Text style={styles.formSubtitle}>
                    {activeExpenseFarm?.farming_type === 'livestock'
                      ? 'Record veterinary fees, animal care, herd wages & pen maintenance'
                      : 'Record labor wages, land prep, machinery hire, transport & operational costs'}
                  </Text>
                </View>
              </View>

              {/* FARM SELECTION FOR EXPENSE */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Farm Parcel *</Text>
                <Text style={styles.helperText}>
                  Select farm parcel (enterprise filters categories automatically):
                </Text>
                {farms.length === 0 ? (
                  <View style={styles.noFarmBanner}>
                    <Text style={styles.noFarmText}>No registered farms found.</Text>
                    <TouchableOpacity
                      onPress={() => router.push('/farm/register' as any)}
                      style={styles.registerFarmBtn}
                    >
                      <Text style={styles.registerFarmBtnText}>Register Farm First</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.farmSelectRow}
                  >
                    {farms.map((f) => {
                      const isSelected = expenseFarmId === f.id;
                      const isLivestock = f.farming_type === 'livestock';
                      const isBoth = f.farming_type === 'both';
                      const farmIcon = isLivestock ? 'paw' : isBoth ? 'layers' : 'leaf';
                      return (
                        <TouchableOpacity
                          key={f.id}
                          style={[
                            styles.farmSelectChip,
                            isSelected &&
                              (isLivestock
                                ? styles.farmSelectChipActiveLivestock
                                : styles.farmSelectChipActive),
                          ]}
                          onPress={() => handleSelectExpenseFarm(f.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={farmIcon as any}
                            size={14}
                            color={
                              isSelected
                                ? '#FFFFFF'
                                : isLivestock
                                ? '#D97706'
                                : Colors.primary
                            }
                          />
                          <View style={{ marginLeft: 6 }}>
                            <Text
                              style={[
                                styles.farmSelectChipTitle,
                                isSelected && styles.farmSelectChipTitleActive,
                              ]}
                            >
                              {f.name}
                            </Text>
                            <Text
                              style={[
                                styles.farmSelectChipSub,
                                isSelected && styles.farmSelectChipSubActive,
                              ]}
                            >
                              {f.size} {f.size_unit} • {isLivestock ? 'Livestock' : isBoth ? 'Both' : 'Crops'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              {/* ENTERPRISE ADAPTIVE NOTICE BANNER */}
              <View
                style={[
                  styles.enterpriseNoticeBanner,
                  activeExpenseFarm?.farming_type === 'livestock' &&
                    styles.enterpriseNoticeBannerLivestock,
                ]}
              >
                <Ionicons
                  name={
                    activeExpenseFarm?.farming_type === 'livestock'
                      ? 'paw'
                      : activeExpenseFarm?.farming_type === 'both'
                      ? 'layers'
                      : 'leaf'
                  }
                  size={14}
                  color={
                    activeExpenseFarm?.farming_type === 'livestock'
                      ? '#B45309'
                      : Colors.primaryDark
                  }
                />
                <Text
                  style={[
                    styles.enterpriseNoticeText,
                    activeExpenseFarm?.farming_type === 'livestock' &&
                      styles.enterpriseNoticeTextLivestock,
                  ]}
                >
                  {activeExpenseFarm?.farming_type === 'livestock'
                    ? 'LIVESTOCK FARM ACTIVE: Showing livestock expense categories only. Crops operations excluded.'
                    : activeExpenseFarm?.farming_type === 'crops'
                    ? 'CROPS FARM ACTIVE: Showing crops operational expense categories only. Livestock operations excluded.'
                    : 'INTEGRATED FARM: Both crop and livestock expense categories available.'}
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Expense Category *</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipRow}
                >
                  {availableExpenseCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.chip,
                        expenseCat === cat &&
                          (activeExpenseFarm?.farming_type === 'livestock'
                            ? styles.chipActiveLivestock
                            : styles.chipActive),
                      ]}
                      onPress={() => setExpenseCat(cat)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.chipText, expenseCat === cat && styles.chipTextActive]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {expenseCat === 'Land Preparation' && (
                  <View style={{ marginTop: Spacing.xs }}>
                    <Text style={[styles.label, { fontSize: 11, marginBottom: 4 }]}>
                      SPECIFIC LAND PREPARATION TASK (OPTIONAL):
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                      {LAND_PREPARATION_OPERATIONS.map((op) => {
                        const isSelected = expenseDesc.includes(op);
                        return (
                          <TouchableOpacity
                            key={op}
                            style={[
                              styles.chip,
                              isSelected && styles.chipActive,
                            ]}
                            onPress={() => {
                              if (!expenseDesc.trim()) {
                                setExpenseDesc(`Land prep: ${op}`);
                              } else if (!expenseDesc.includes(op)) {
                                setExpenseDesc(`${expenseDesc}, ${op}`);
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                isSelected && styles.chipTextActive,
                              ]}
                            >
                              {op}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1.5, marginRight: Spacing.xs }]}>
                  <Text style={styles.label}>Amount *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 75"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={expenseAmount}
                    onChangeText={setExpenseAmount}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.xs }]}>
                  <Text style={styles.label}>Currency</Text>
                  <View style={styles.currencyToggle}>
                    <TouchableOpacity
                      style={[
                        styles.currBtn,
                        expenseCurrency === 'USD' && styles.currBtnActive,
                      ]}
                      onPress={() => setExpenseCurrency('USD')}
                    >
                      <Text
                        style={[
                          styles.currText,
                          expenseCurrency === 'USD' && styles.currTextActive,
                        ]}
                      >
                        USD ($)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.currBtn,
                        expenseCurrency === 'LRD' && styles.currBtnActive,
                      ]}
                      onPress={() => setExpenseCurrency('LRD')}
                    >
                      <Text
                        style={[
                          styles.currText,
                          expenseCurrency === 'LRD' && styles.currTextActive,
                        ]}
                      >
                        LRD (L$)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description / Operational Purpose</Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    activeExpenseFarm?.farming_type === 'livestock'
                      ? 'e.g. Routine vaccination and herd deworming by extension veterinarian...'
                      : 'e.g. Wages for 4 casual laborers during swamp weeding & bund repair...'
                  }
                  placeholderTextColor={Colors.textMuted}
                  value={expenseDesc}
                  onChangeText={setExpenseDesc}
                />
              </View>

              <DatePickerField
                label="Expense Date (Sets Year)"
                value={expenseDate}
                onChange={setExpenseDate}
                helperText="Date this operational expenditure occurred on the parcel"
              />

              <Button
                title={
                  activeExpenseFarm?.farming_type === 'livestock'
                    ? 'Log Livestock Expense'
                    : 'Log Farm Expense'
                }
                onPress={handleAddExpense}
                size="md"
                loading={isSubmitting}
                icon={<Ionicons name="wallet-outline" size={18} color="#FFFFFF" />}
              />
            </Card>

            {/* Expenses List */}
            <View style={styles.listSectionHeader}>
              <Text style={styles.listSectionTitle}>
                Operational Expenses History ({filteredExpenses.length})
              </Text>
              <Text style={styles.listSectionSubtitle}>
                Filtered by {selectedYearFilter === 'all' ? 'All Years' : `Year ${selectedYearFilter}`}{' '}
                •{' '}
                {selectedFarmFilter === 'all'
                  ? 'All Farms'
                  : `${farmMap.get(selectedFarmFilter)?.name} (${
                      farmMap.get(selectedFarmFilter)?.farming_type === 'livestock'
                        ? 'Livestock only'
                        : farmMap.get(selectedFarmFilter)?.farming_type === 'both'
                        ? 'Both'
                        : 'Crops only'
                    })`}
              </Text>
            </View>

            {filteredExpenses.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons
                  name={
                    farmMap.get(selectedFarmFilter)?.farming_type === 'livestock'
                      ? 'paw-outline'
                      : 'cash-outline'
                  }
                  size={36}
                  color={Colors.textMuted}
                />
                <Text style={styles.emptyTitle}>
                  {farmMap.get(selectedFarmFilter)?.farming_type === 'livestock'
                    ? 'No Livestock Expenses Recorded'
                    : 'No Expenses Recorded'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {farmMap.get(selectedFarmFilter)?.farming_type === 'livestock'
                    ? 'No livestock operational costs logged for this parcel.'
                    : 'No operating costs logged for this farm parcel and year selection.'}
                </Text>
              </Card>
            ) : (
              filteredExpenses.map((e) => {
                const farm = farmMap.get(e.farm_id);
                const isLivestock = farm?.farming_type === 'livestock';
                return (
                  <Card key={e.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1, marginRight: Spacing.xs }}>
                        <Text style={styles.itemName}>{e.category}</Text>
                        <View style={styles.itemMetaRow}>
                          <View
                            style={[
                              styles.itemFarmBadge,
                              isLivestock && {
                                backgroundColor: '#FEF3C7',
                                borderColor: '#FDE68A',
                              },
                            ]}
                          >
                            <Ionicons
                              name={
                                isLivestock
                                  ? 'paw'
                                  : farm?.farming_type === 'both'
                                  ? 'layers'
                                  : 'leaf'
                              }
                              size={11}
                              color={isLivestock ? '#B45309' : Colors.primaryDark}
                            />
                            <Text
                              style={[
                                styles.itemFarmText,
                                isLivestock && { color: '#B45309' },
                              ]}
                            >
                              {farm?.name || 'Farm Parcel'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.itemSub}>{e.description}</Text>
                      </View>
                      <Text style={styles.expenseCost}>
                        {e.currency === 'USD' ? '$' : 'L$'}
                        {Number(e.amount).toLocaleString()} {e.currency}
                      </Text>
                    </View>
                    <View style={styles.itemFooter}>
                      <Text style={styles.itemDate}>📅 {e.expense_date}</Text>
                      <Badge
                        label={isLivestock ? 'Livestock Operation' : 'Operational'}
                        variant={isLivestock ? 'warning' : 'default'}
                        size="sm"
                      />
                    </View>
                  </Card>
                );
              })
            )}
          </>
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
  // Filter Section: Year & Farm Selector Bar
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  filterGroup: {
    marginBottom: 2,
  },
  yearDropdownSelectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.xs,
  },
  yearDropdownSelectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  yearDropdownSelectText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  yearDropdownSelectRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  yearDropdownBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalYearItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderRadius: Radius.md,
  },
  modalYearItemActive: {
    backgroundColor: '#F0FDF4',
  },
  modalYearText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  modalYearTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  filterScrollView: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  farmFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 6,
  },
  farmFilterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  farmFilterChipActiveLivestock: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  farmFilterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
    maxWidth: 140,
  },
  farmFilterChipTextActive: {
    color: '#FFFFFF',
  },
  farmFilterChipSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  farmFilterChipSubActive: {
    color: '#FEF3C7',
  },
  // Enterprise Notice Banner
  enterpriseNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: Spacing.sm,
  },
  enterpriseNoticeBannerLivestock: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  enterpriseNoticeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
    flex: 1,
  },
  enterpriseNoticeTextLivestock: {
    color: '#B45309',
  },
  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  // Summary Card
  summaryCard: {
    marginBottom: Spacing.md,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  summaryVal: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
    marginTop: 2,
  },
  summarySubVal: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: '#059669',
    marginTop: 2,
  },
  summaryFarmContext: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },
  // Forms
  formCard: {
    marginBottom: Spacing.md,
  },
  formTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  formIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  formTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  formSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  inputGroup: {
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
  },
  label: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  helperText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: Typography.sizes.sm,
    color: Colors.text,
  },
  // Farm Select chips in form
  farmSelectRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  farmSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: Spacing.xs,
  },
  farmSelectChipActive: {
    backgroundColor: '#F0FDF4',
    borderColor: Colors.primary,
  },
  farmSelectChipActiveLivestock: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  farmSelectChipTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  farmSelectChipTitleActive: {
    color: Colors.primaryDark,
  },
  farmSelectChipSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  farmSelectChipSubActive: {
    color: Colors.primary,
  },
  noFarmBanner: {
    padding: Spacing.md,
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  noFarmText: {
    fontSize: Typography.sizes.xs,
    color: Colors.danger,
    marginBottom: 6,
  },
  registerFarmBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  registerFarmBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  // Chips
  chipRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  chip: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    marginRight: Spacing.xs,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipActiveLivestock: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  chipText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  currencyToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  currBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  currBtnActive: {
    backgroundColor: Colors.primary,
  },
  currText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  currTextActive: {
    color: '#FFFFFF',
  },
  // History Lists
  listSectionHeader: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  listSectionTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  listSectionSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  itemCard: {
    marginBottom: Spacing.xs,
    padding: Spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  itemFarmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.sm,
  },
  itemFarmText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  itemCategory: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  itemSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 3,
  },
  itemCost: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  expenseCost: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.danger,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
  },
  itemDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  itemSupplier: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
    lineHeight: 16,
  },
  // Real Farm Profit & Loss Highlight Styles
  farmProfitCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
  },
  farmProfitCardProfitable: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  farmProfitCardLoss: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  farmProfitCardEmpty: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  farmProfitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  farmProfitTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  farmProfitGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  farmProfitColumn: {
    flex: 1,
    alignItems: 'center',
  },
  farmProfitColDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
  farmProfitColLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  farmProfitColSpent: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: '#DC2626',
  },
  farmProfitColHarvest: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: '#0284C7',
  },
  farmProfitColProfit: {
    fontSize: Typography.sizes.xs,
    fontWeight: '800',
  },
  farmProfitColProfitPos: {
    color: '#15803D',
  },
  farmProfitColProfitNeg: {
    color: '#DC2626',
  },
  farmProfitColSub: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2,
  },
  farmProfitFormulaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs + 2,
  },
  farmProfitFormulaText: {
    fontSize: 10,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 14,
  },
});
