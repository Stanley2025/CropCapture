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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../src/constants/theme';
import { localDb, generateUUID } from '../src/services/storage/localDatabase';
import { useAppStore } from '../src/store/useAppStore';
import { InputRecord, ExpenseRecord, Farm } from '../src/types/database';
import { Header } from '../src/components/Header';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { Badge } from '../src/components/Badge';
import { DatePickerField } from '../src/components/DatePickerField';

const INPUT_CATEGORIES = [
  'Seeds & Seedlings',
  'Fertilizers & Nutrients',
  'Crop Protection',
  'Herbicides',
  'Animal Feed & Nutrition',
  'Veterinary & Vaccines',
  'Tools & Implements',
  'Equipment & Machinery',
  'Other Agricultural Materials',
];

const EXPENSE_CATEGORIES = [
  'Labour & Wages',
  'Land Preparation',
  'Seeds & Seedlings',
  'Fertilizer Application',
  'Pest & Weed Control',
  'Animal Feed & Care',
  'Veterinary Services',
  'Equipment Rental',
  'Transportation & Haulage',
  'Storage & Processing',
  'Irrigation & Water',
  'Other Operations',
];

export default function InputsExpensesScreen() {
  const router = useRouter();
  const { currentRole, currentFarmer, refreshPendingSyncCount } = useAppStore();

  const [activeTab, setActiveTab] = useState<'inputs' | 'expenses'>('inputs');
  const [inputs, setInputs] = useState<InputRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Global Context Filter State (Farm and Year)
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>('all');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('all');

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
      let [inp, exp, f] = await Promise.all([
        localDb.getInputs(),
        localDb.getExpenses(),
        localDb.getFarms(),
      ]);

      if (currentRole === 'farmer' && currentFarmer?.id) {
        f = f.filter((farm) => farm.farmer_id === currentFarmer.id);
        const myFarmIds = new Set(f.map((farm) => farm.id));
        inp = inp.filter((item) => myFarmIds.has(item.farm_id));
        exp = exp.filter((item) => myFarmIds.has(item.farm_id));
      }

      setInputs(inp);
      setExpenses(exp);
      setFarms(f);

      // Default the quick-add farm picker to the first farm if available
      if (f.length > 0) {
        setInputFarmId((prev) => (prev ? prev : f[0].id));
        setExpenseFarmId((prev) => (prev ? prev : f[0].id));
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

  // When top farm filter changes, sync quick-add farm selector
  const handleFarmFilterChange = (farmId: string) => {
    setSelectedFarmFilter(farmId);
    if (farmId !== 'all') {
      setInputFarmId(farmId);
      setExpenseFarmId(farmId);
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

  // Filtered lists based on selected farm and year
  const filteredInputs = useMemo(() => {
    return inputs.filter((i) => {
      const matchFarm = selectedFarmFilter === 'all' || i.farm_id === selectedFarmFilter;
      const yr = i.purchase_date?.substring(0, 4);
      const matchYear = selectedYearFilter === 'all' || yr === selectedYearFilter;
      return matchFarm && matchYear;
    });
  }, [inputs, selectedFarmFilter, selectedYearFilter]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchFarm = selectedFarmFilter === 'all' || e.farm_id === selectedFarmFilter;
      const yr = e.expense_date?.substring(0, 4);
      const matchYear = selectedYearFilter === 'all' || yr === selectedYearFilter;
      return matchFarm && matchYear;
    });
  }, [expenses, selectedFarmFilter, selectedYearFilter]);

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
        id: generateUUID(),
        farm_id: expenseFarmId,
        category: expenseCat,
        amount: parseFloat(expenseAmount),
        currency: expenseCurrency,
        expense_date: expenseDate,
        description:
          expenseDesc.trim() ||
          `${expenseCat} operations on ${targetFarm?.name || 'farm'}.`,
        created_at: new Date().toISOString(),
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
        {/* Year Filter Selector */}
        <View style={styles.filterGroup}>
          <View style={styles.filterHeaderRow}>
            <Ionicons name="calendar-outline" size={14} color={Colors.primaryDark} />
            <Text style={styles.filterLabel}>PRODUCTION YEAR:</Text>
            {selectedYearFilter !== 'all' && (
              <Badge label={`Year ${selectedYearFilter}`} variant="info" size="sm" />
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedYearFilter === 'all' && styles.filterChipActive,
              ]}
              onPress={() => handleYearFilterChange('all')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedYearFilter === 'all' && styles.filterChipTextActive,
                ]}
              >
                All Years
              </Text>
            </TouchableOpacity>
            {availableYears.map((yr) => (
              <TouchableOpacity
                key={yr}
                style={[
                  styles.filterChip,
                  selectedYearFilter === yr && styles.filterChipActive,
                ]}
                onPress={() => handleYearFilterChange(yr)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedYearFilter === yr && styles.filterChipTextActive,
                  ]}
                >
                  {yr}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

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
              variant="success"
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
              const farmIcon =
                f.farming_type === 'livestock'
                  ? 'paw'
                  : f.farming_type === 'both'
                  ? 'layers'
                  : 'leaf';
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.farmFilterChip, isSelected && styles.farmFilterChipActive]}
                  onPress={() => handleFarmFilterChange(f.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={farmIcon as any}
                    size={13}
                    color={isSelected ? '#FFFFFF' : Colors.primary}
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
                    ({f.size} {f.size_unit})
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
                      : farmMap.get(selectedFarmFilter)?.name || 'Selected Farm'}
                  </Text>
                </View>
                <Badge
                  label={`${filteredInputs.length} Items in Inventory`}
                  variant="success"
                />
              </View>
            </Card>

            {/* Quick Add Input / Inventory Form */}
            <Card style={styles.formCard}>
              <View style={styles.formTitleRow}>
                <View style={styles.formIconWrap}>
                  <Ionicons name="cube-outline" size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formTitle}>+ Record Agricultural Input & Inventory</Text>
                  <Text style={styles.formSubtitle}>
                    Capture fertilizers, certified seeds, tools, feeds & inventory stock
                  </Text>
                </View>
              </View>

              {/* FARM SELECTION FOR INPUT */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Farm Parcel *</Text>
                <Text style={styles.helperText}>Select which farm this input inventory belongs to:</Text>
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
                      const farmType = f.farming_type || 'crops';
                      return (
                        <TouchableOpacity
                          key={f.id}
                          style={[
                            styles.farmSelectChip,
                            isSelected && styles.farmSelectChipActive,
                          ]}
                          onPress={() => setInputFarmId(f.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={
                              farmType === 'livestock'
                                ? 'paw'
                                : farmType === 'both'
                                ? 'layers'
                                : 'leaf'
                            }
                            size={14}
                            color={isSelected ? '#FFFFFF' : Colors.primary}
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
                              {f.size} {f.size_unit} • {farmType}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Input Item Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. NPK 15-15-15 Compound Fertilizer"
                  placeholderTextColor={Colors.textMuted}
                  value={inputName}
                  onChangeText={setInputName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipRow}
                >
                  {INPUT_CATEGORIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chip, inputCat === c && styles.chipActive]}
                      onPress={() => setInputCat(c)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, inputCat === c && styles.chipTextActive]}>
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
                    placeholder="e.g. 5"
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
                    placeholder="bags / kg / doses"
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
                  placeholder="e.g. Central Gbarnga Agrovet Depot"
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
                title="Save to Farm Inventory"
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
                • {selectedFarmFilter === 'all' ? 'All Farms' : farmMap.get(selectedFarmFilter)?.name}
              </Text>
            </View>

            {filteredInputs.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="cart-outline" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Inventory Records Found</Text>
                <Text style={styles.emptySubtitle}>
                  No agricultural materials recorded for this farm or year selection. Use the form above to log materials.
                </Text>
              </Card>
            ) : (
              filteredInputs.map((i) => {
                const farm = farmMap.get(i.farm_id);
                return (
                  <Card key={i.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1, marginRight: Spacing.xs }}>
                        <Text style={styles.itemName}>{i.name}</Text>
                        <View style={styles.itemMetaRow}>
                          <View style={styles.itemFarmBadge}>
                            <Ionicons
                              name={
                                farm?.farming_type === 'livestock'
                                  ? 'paw'
                                  : farm?.farming_type === 'both'
                                  ? 'layers'
                                  : 'leaf'
                              }
                              size={11}
                              color={Colors.primaryDark}
                            />
                            <Text style={styles.itemFarmText}>
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
                      <Badge label="In Inventory" variant="info" size="sm" />
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
                      : farmMap.get(selectedFarmFilter)?.name || 'Selected Farm'}
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
                  <Text style={styles.formTitle}>+ Log Farm Operating Expense</Text>
                  <Text style={styles.formSubtitle}>
                    Record labor wages, machinery hire, transport & operational costs
                  </Text>
                </View>
              </View>

              {/* FARM SELECTION FOR EXPENSE */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Farm Parcel *</Text>
                <Text style={styles.helperText}>Select which farm parcel incurred this expense:</Text>
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
                      const farmType = f.farming_type || 'crops';
                      return (
                        <TouchableOpacity
                          key={f.id}
                          style={[
                            styles.farmSelectChip,
                            isSelected && styles.farmSelectChipActive,
                          ]}
                          onPress={() => setExpenseFarmId(f.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={
                              farmType === 'livestock'
                                ? 'paw'
                                : farmType === 'both'
                                ? 'layers'
                                : 'leaf'
                            }
                            size={14}
                            color={isSelected ? '#FFFFFF' : Colors.primary}
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
                              {f.size} {f.size_unit} • {farmType}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Expense Category *</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipRow}
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, expenseCat === cat && styles.chipActive]}
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
                  placeholder="e.g. Wages for 4 casual laborers during weeding..."
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
                title="Log Farm Expense"
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
                • {selectedFarmFilter === 'all' ? 'All Farms' : farmMap.get(selectedFarmFilter)?.name}
              </Text>
            </View>

            {filteredExpenses.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="cash-outline" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Expenses Recorded</Text>
                <Text style={styles.emptySubtitle}>
                  No operating costs logged for this farm parcel and year selection.
                </Text>
              </Card>
            ) : (
              filteredExpenses.map((e) => {
                const farm = farmMap.get(e.farm_id);
                return (
                  <Card key={e.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1, marginRight: Spacing.xs }}>
                        <Text style={styles.itemName}>{e.category}</Text>
                        <View style={styles.itemMetaRow}>
                          <View style={styles.itemFarmBadge}>
                            <Ionicons
                              name={
                                farm?.farming_type === 'livestock'
                                  ? 'paw'
                                  : farm?.farming_type === 'both'
                                  ? 'layers'
                                  : 'leaf'
                              }
                              size={11}
                              color={Colors.primaryDark}
                            />
                            <Text style={styles.itemFarmText}>
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
                      <Badge label="Operational" variant="default" size="sm" />
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
    color: '#E0F2FE',
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
});
