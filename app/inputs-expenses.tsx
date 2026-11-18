import React, { useState, useEffect, useCallback } from 'react';
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
  'Seeds',
  'Fertilizers',
  'Pesticides',
  'Herbicides',
  'Tools',
  'Equipment',
  'Other agricultural materials',
];

const EXPENSE_CATEGORIES = [
  'Labour',
  'Land preparation',
  'Seeds',
  'Fertilizer',
  'Pesticides',
  'Transportation',
  'Equipment rental',
  'Storage',
  'Irrigation',
  'Other',
];

export default function InputsExpensesScreen() {
  const router = useRouter();
  const { refreshPendingSyncCount } = useAppStore();

  const [activeTab, setActiveTab] = useState<'inputs' | 'expenses'>('inputs');
  const [inputs, setInputs] = useState<InputRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // New Input Form State
  const [inputName, setInputName] = useState('');
  const [inputCat, setInputCat] = useState('Seeds');
  const [inputQty, setInputQty] = useState('');
  const [inputUnit, setInputUnit] = useState('kg');
  const [inputCost, setInputCost] = useState('');
  const [inputSupplier, setInputSupplier] = useState('');
  const [inputPurchaseDate, setInputPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFarmId, setSelectedFarmId] = useState('');

  // New Expense Form State
  const [expenseCat, setExpenseCat] = useState('Labour');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'LRD'>('USD');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [inp, exp, f] = await Promise.all([
        localDb.getInputs(),
        localDb.getExpenses(),
        localDb.getFarms(),
      ]);
      setInputs(inp);
      setExpenses(exp);
      setFarms(f);
      if (f.length > 0 && !selectedFarmId) setSelectedFarmId(f[0].id);
    } catch (e) {
      console.error('Failed to load inputs and expenses:', e);
    }
  }, [selectedFarmId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAddInput = async () => {
    if (!inputName.trim() || !inputQty.trim() || !inputCost.trim()) {
      Alert.alert('Incomplete Form', 'Please enter input name, quantity, and cost.');
      return;
    }
    setIsSubmitting(true);
    try {
      const record: InputRecord = {
        id: generateUUID(),
        farm_id: selectedFarmId || (farms[0]?.id ?? 'default-farm'),
        name: inputName.trim(),
        category: inputCat,
        quantity: parseFloat(inputQty),
        unit: inputUnit,
        purchase_date: inputPurchaseDate,
        supplier: inputSupplier.trim() || 'Local Agrodealer',
        cost: parseFloat(inputCost),
        currency,
        notes: `Purchased for ${inputCat.toLowerCase()} management.`,
        created_at: new Date().toISOString(),
      };
      await localDb.saveInput(record, true);
      await refreshPendingSyncCount();
      setInputName('');
      setInputQty('');
      setInputCost('');
      setInputSupplier('');
      await loadData();
      Alert.alert('Input Recorded', `Saved "${record.name}" to farm input inventory.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save input record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddExpense = async () => {
    if (!expenseAmount.trim() || isNaN(Number(expenseAmount))) {
      Alert.alert('Incomplete Form', 'Please enter a valid expense amount.');
      return;
    }
    setIsSubmitting(true);
    try {
      const record: ExpenseRecord = {
        id: generateUUID(),
        farm_id: selectedFarmId || (farms[0]?.id ?? 'default-farm'),
        category: expenseCat,
        amount: parseFloat(expenseAmount),
        currency,
        expense_date: expenseDate,
        description: expenseDesc.trim() || `${expenseCat} operation`,
        created_at: new Date().toISOString(),
      };
      await localDb.saveExpense(record, true);
      await refreshPendingSyncCount();
      setExpenseAmount('');
      setExpenseDesc('');
      await loadData();
      Alert.alert('Expense Logged', `Recorded ${record.currency} ${record.amount} for ${record.category}.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save expense record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalInputsCost = inputs.reduce((acc, i) => acc + (Number(i.cost) || 0), 0);
  const totalExpensesUSD = expenses
    .filter((e) => e.currency === 'USD')
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const totalExpensesLRD = expenses
    .filter((e) => e.currency === 'LRD')
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Inputs & Expenses"
        subtitle="Agri-materials, procurement & cost tracking"
        showBack
      />
      <OfflineBanner />

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
            Inputs Inventory ({inputs.length})
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
            Farm Expenses ({expenses.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {activeTab === 'inputs' ? (
          <>
            {/* Input Financial Summary */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryLabel}>TOTAL INPUT EXPENDITURE</Text>
                  <Text style={styles.summaryVal}>${totalInputsCost.toLocaleString()} USD</Text>
                </View>
                <Badge label={`${inputs.length} Items Purchased`} variant="success" />
              </View>
            </Card>

            {/* Quick Add Input Form */}
            <Card style={styles.formCard}>
              <Text style={styles.formTitle}>+ Record New Agricultural Input</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Input Item Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. NPK 15-15-15 Compound Fertilizer"
                  value={inputName}
                  onChangeText={setInputName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {INPUT_CATEGORIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chip, inputCat === c && styles.chipActive]}
                      onPress={() => setInputCat(c)}
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
                    placeholder="e.g. 3"
                    keyboardType="numeric"
                    value={inputQty}
                    onChangeText={setInputQty}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.xs }]}>
                  <Text style={styles.label}>Unit</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="bags / kg"
                    value={inputUnit}
                    onChangeText={setInputUnit}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1.5, marginRight: Spacing.xs }]}>
                  <Text style={styles.label}>Total Cost (USD) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 110"
                    keyboardType="numeric"
                    value={inputCost}
                    onChangeText={setInputCost}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.xs }]}>
                  <Text style={styles.label}>Supplier / Store</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Gbarnga Agro"
                    value={inputSupplier}
                    onChangeText={setInputSupplier}
                  />
                </View>
              </View>

              <DatePickerField
                label="Purchase Date"
                value={inputPurchaseDate}
                onChange={setInputPurchaseDate}
                helperText="Date input was procured"
              />

              <Button
                title="Save Input Record"
                onPress={handleAddInput}
                size="md"
                loading={isSubmitting}
                icon={<Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />}
              />
            </Card>

            {/* Inputs List */}
            <Text style={styles.listSectionTitle}>Procured Materials History</Text>
            {inputs.map((i) => (
              <Card key={i.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View>
                    <Text style={styles.itemName}>{i.name}</Text>
                    <Text style={styles.itemSub}>
                      {i.category} • Supplier: {i.supplier || 'Local Depot'}
                    </Text>
                  </View>
                  <Text style={styles.itemCost}>
                    ${i.cost} {i.currency}
                  </Text>
                </View>
                <View style={styles.itemFooter}>
                  <Text style={styles.itemDate}>
                    {i.purchase_date} • {i.quantity} {i.unit}
                  </Text>
                  <Badge label="In Inventory" variant="info" size="sm" />
                </View>
              </Card>
            ))}
          </>
        ) : (
          <>
            {/* Expense Financial Summary */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryLabel}>TOTAL FARM EXPENSES</Text>
                  <Text style={styles.summaryVal}>${totalExpensesUSD.toLocaleString()} USD</Text>
                  {totalExpensesLRD > 0 && (
                    <Text style={styles.summarySubVal}>+ {totalExpensesLRD.toLocaleString()} LRD</Text>
                  )}
                </View>
                <Badge label={`${expenses.length} Expense Logs`} variant="gold" />
              </View>
            </Card>

            {/* Quick Add Expense Form */}
            <Card style={styles.formCard}>
              <Text style={styles.formTitle}>+ Log Farm Operating Expense</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Expense Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, expenseCat === cat && styles.chipActive]}
                      onPress={() => setExpenseCat(cat)}
                    >
                      <Text style={[styles.chipText, expenseCat === cat && styles.chipTextActive]}>
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
                    placeholder="e.g. 65"
                    keyboardType="numeric"
                    value={expenseAmount}
                    onChangeText={setExpenseAmount}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.xs }]}>
                  <Text style={styles.label}>Currency</Text>
                  <View style={styles.currencyToggle}>
                    <TouchableOpacity
                      style={[styles.currBtn, currency === 'USD' && styles.currBtnActive]}
                      onPress={() => setCurrency('USD')}
                    >
                      <Text style={[styles.currText, currency === 'USD' && styles.currTextActive]}>
                        USD
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.currBtn, currency === 'LRD' && styles.currBtnActive]}
                      onPress={() => setCurrency('LRD')}
                    >
                      <Text style={[styles.currText, currency === 'LRD' && styles.currTextActive]}>
                        LRD
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description / Purpose</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Daily wages for 5 workers during swamp weeding..."
                  value={expenseDesc}
                  onChangeText={setExpenseDesc}
                />
              </View>

              <DatePickerField
                label="Expense Date"
                value={expenseDate}
                onChange={setExpenseDate}
                helperText="Date this operational expenditure occurred"
              />

              <Button
                title="Log Expense"
                onPress={handleAddExpense}
                size="md"
                loading={isSubmitting}
                icon={<Ionicons name="wallet-outline" size={18} color="#FFFFFF" />}
              />
            </Card>

            {/* Expenses List */}
            <Text style={styles.listSectionTitle}>Operational Expenses History</Text>
            {expenses.map((e) => (
              <Card key={e.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View>
                    <Text style={styles.itemName}>{e.category}</Text>
                    <Text style={styles.itemSub}>{e.description}</Text>
                  </View>
                  <Text style={styles.expenseCost}>
                    ${e.amount} {e.currency}
                  </Text>
                </View>
                <View style={styles.itemFooter}>
                  <Text style={styles.itemDate}>{e.expense_date}</Text>
                  <Badge label="Operational" variant="default" size="sm" />
                </View>
              </Card>
            ))}
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
    color: Colors.textMuted,
    marginTop: 2,
  },
  formCard: {
    marginBottom: Spacing.md,
  },
  formTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
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
  listSectionTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
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
  itemSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 1,
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
});
