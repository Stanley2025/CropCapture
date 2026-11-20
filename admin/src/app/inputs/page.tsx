'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Coins,
  Search,
  Filter,
  Download,
  DollarSign,
  Wallet,
  Calendar,
  Building2,
  Package,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getInputs, getExpenses, getFarms } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { InputRecord, ExpenseRecord, Farm } from '@/types/database';

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

export default function InputsAndExpensesPage() {
  const [activeTab, setActiveTab] = useState<'inputs' | 'expenses'>('inputs');
  const [inputs, setInputs] = useState<InputRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedFarmId, setSelectedFarmId] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [inputsData, expensesData, farmsData] = await Promise.all([
          getInputs(),
          getExpenses(),
          getFarms(),
        ]);
        setInputs(inputsData);
        setExpenses(expensesData);
        setFarms(farmsData);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Compute available years from inputs, expenses, and farms
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

  const activeFarm = selectedFarmId !== 'All' ? farmMap.get(selectedFarmId) : null;

  // Filtered Inputs with Enterprise Isolation
  const filteredInputs = useMemo(() => {
    return inputs.filter((inp) => {
      const matchesSearch =
        inp.name.toLowerCase().includes(search.toLowerCase()) ||
        (inp.supplier && inp.supplier.toLowerCase().includes(search.toLowerCase()));
      const matchesCat =
        categoryFilter === 'All' || inp.category.toLowerCase() === categoryFilter.toLowerCase();
      const matchesFarm = selectedFarmId === 'All' || inp.farm_id === selectedFarmId;
      const yr = inp.purchase_date?.substring(0, 4);
      const matchesYear = selectedYear === 'All' || yr === selectedYear;

      if (!matchesSearch || !matchesCat || !matchesFarm || !matchesYear) return false;

      // Strict Enterprise Isolation:
      if (selectedFarmId !== 'All') {
        const farm = farmMap.get(selectedFarmId);
        if (farm?.farming_type === 'livestock') {
          // Do not bring crops data
          if (CROP_ONLY_INPUT_CATEGORIES.has(inp.category)) return false;
        } else if (farm?.farming_type === 'crops') {
          // Do not bring livestock data
          if (LIVESTOCK_ONLY_INPUT_CATEGORIES.has(inp.category)) return false;
        }
      }

      return true;
    });
  }, [inputs, search, categoryFilter, selectedFarmId, selectedYear, farmMap]);

  // Filtered Expenses with Enterprise Isolation
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchesSearch =
        exp.category.toLowerCase().includes(search.toLowerCase()) ||
        (exp.description && exp.description.toLowerCase().includes(search.toLowerCase()));
      const matchesCat =
        categoryFilter === 'All' || exp.category.toLowerCase() === categoryFilter.toLowerCase();
      const matchesFarm = selectedFarmId === 'All' || exp.farm_id === selectedFarmId;
      const yr = exp.expense_date?.substring(0, 4);
      const matchesYear = selectedYear === 'All' || yr === selectedYear;

      if (!matchesSearch || !matchesCat || !matchesFarm || !matchesYear) return false;

      // Strict Enterprise Isolation:
      if (selectedFarmId !== 'All') {
        const farm = farmMap.get(selectedFarmId);
        if (farm?.farming_type === 'livestock') {
          // Do not bring crops data
          if (CROP_ONLY_EXPENSE_CATEGORIES.has(exp.category)) return false;
        } else if (farm?.farming_type === 'crops') {
          // Do not bring livestock data
          if (LIVESTOCK_ONLY_EXPENSE_CATEGORIES.has(exp.category)) return false;
        }
      }

      return true;
    });
  }, [expenses, search, categoryFilter, selectedFarmId, selectedYear, farmMap]);

  // Financial aggregates
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Agricultural Inputs & Operating Expenses
            </h1>
            <p className="text-sm text-slate-500">
              Review certified foundation seeds, mineral fertilizers, livestock feeds, veterinary supplies, and operating cost ledgers by farm and year.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              Export Financial Ledger
            </button>
          </div>
        </div>

        {/* Global Filter Bar: Year & Farm Selection */}
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm sm:grid-cols-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-900 mb-1">
              Production Year
            </label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-emerald-700" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full rounded-lg border border-emerald-200 bg-white py-2 pl-9 pr-4 text-xs font-semibold text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="All">All Production Years</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Production Year {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-900 mb-1">
              Farm Parcel (Enterprise Isolation)
            </label>
            <div className="relative">
              <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-emerald-700" />
              <select
                value={selectedFarmId}
                onChange={(e) => {
                  setSelectedFarmId(e.target.value);
                  setCategoryFilter('All');
                }}
                className="w-full rounded-lg border border-emerald-200 bg-white py-2 pl-9 pr-4 text-xs font-semibold text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="All">All Farm Parcels ({farms.length})</option>
                {farms.map((f) => {
                  const ent = f.farming_type === 'livestock' ? 'Livestock only' : f.farming_type === 'both' ? 'Both' : 'Crops only';
                  return (
                    <option key={f.id} value={f.id}>
                      {f.name} [{ent}] • {f.size} {f.size_unit} ({f.county || 'Liberia'})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-900 mb-1">
              Category
            </label>
            <div className="relative">
              <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-emerald-700" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-lg border border-emerald-200 bg-white py-2 pl-9 pr-4 text-xs font-semibold text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="All">All Categories</option>
                {activeTab === 'inputs' ? (
                  activeFarm?.farming_type === 'livestock' ? (
                    <>
                      <option value="Animal Feed & Nutrition">Animal Feed & Nutrition</option>
                      <option value="Veterinary & Vaccines">Veterinary & Vaccines</option>
                      <option value="Livestock Housing Materials">Housing Materials</option>
                      <option value="Tools & Implements">Tools & Implements</option>
                      <option value="Equipment & Machinery">Equipment</option>
                    </>
                  ) : activeFarm?.farming_type === 'crops' ? (
                    <>
                      <option value="Seeds & Seedlings">Seeds & Seedlings</option>
                      <option value="Fertilizers & Nutrients">Fertilizers & Nutrients</option>
                      <option value="Crop Protection">Crop Protection</option>
                      <option value="Herbicides">Herbicides</option>
                      <option value="Tools & Implements">Tools & Implements</option>
                    </>
                  ) : (
                    <>
                      <option value="Seeds & Seedlings">Seeds & Seedlings</option>
                      <option value="Fertilizers & Nutrients">Fertilizers & Nutrients</option>
                      <option value="Animal Feed & Nutrition">Animal Feed & Nutrition</option>
                      <option value="Veterinary & Vaccines">Veterinary & Vaccines</option>
                      <option value="Tools & Implements">Tools & Implements</option>
                    </>
                  )
                ) : (
                  activeFarm?.farming_type === 'livestock' ? (
                    <>
                      <option value="Animal Feed & Care">Animal Feed & Care</option>
                      <option value="Veterinary Services">Veterinary Services</option>
                      <option value="Herd / Flock Vaccination">Herd Vaccination</option>
                      <option value="Labour & Wages (Herd Management)">Labour & Wages</option>
                      <option value="Livestock Housing & Pen Maintenance">Housing & Pen Maintenance</option>
                    </>
                  ) : activeFarm?.farming_type === 'crops' ? (
                    <>
                      <option value="Labour & Wages">Labour & Wages</option>
                      <option value="Land Preparation">Land Preparation</option>
                      <option value="Fertilizer Application">Fertilizer Application</option>
                      <option value="Pest & Weed Control">Pest & Weed Control</option>
                      <option value="Irrigation & Water">Irrigation</option>
                    </>
                  ) : (
                    <>
                      <option value="Labour & Wages">Labour & Wages</option>
                      <option value="Land Preparation">Land Preparation</option>
                      <option value="Animal Feed & Care">Animal Feed & Care</option>
                      <option value="Veterinary Services">Veterinary Services</option>
                      <option value="Transportation & Haulage">Transportation</option>
                    </>
                  )
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-900 mb-1">
              Search Text
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={activeTab === 'inputs' ? 'Search item, supplier...' : 'Search description...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-emerald-200 bg-white py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Enterprise Notice Banner in Admin */}
        {activeFarm && (
          <div
            className={`flex items-center gap-2 rounded-xl p-3 border text-xs font-semibold ${
              activeFarm.farming_type === 'livestock'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : activeFarm.farming_type === 'crops'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <span className="font-bold">
              {activeFarm.farming_type === 'livestock'
                ? '🐐 LIVESTOCK FARM SELECTED:'
                : activeFarm.farming_type === 'crops'
                ? '🌾 CROPS FARM SELECTED:'
                : '🌱 INTEGRATED FARM SELECTED:'}
            </span>
            <span>
              {activeFarm.farming_type === 'livestock'
                ? 'Excluding all crops data. Displaying livestock feeds, medicines, and herd expenses only.'
                : activeFarm.farming_type === 'crops'
                ? 'Excluding all livestock data. Displaying seeds, fertilizers, and crop expenses only.'
                : 'Displaying both crop and livestock records for this parcel.'}
            </span>
          </div>
        )}

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Input Inventory (USD)</span>
              <DollarSign className="h-4 w-4 text-emerald-700" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              ${totalInputsUSD.toLocaleString()} USD
            </div>
            {totalInputsLRD > 0 && (
              <div className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                + {totalInputsLRD.toLocaleString()} LRD
              </div>
            )}
            <div className="text-[11px] text-slate-400 mt-1">
              {filteredInputs.length} items • {selectedYear === 'All' ? 'All Years' : selectedYear}
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Farm Expenses (USD)</span>
              <Coins className="h-4 w-4 text-amber-700" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              ${totalExpensesUSD.toLocaleString()} USD
            </div>
            {totalExpensesLRD > 0 && (
              <div className="text-[11px] font-semibold text-amber-700 mt-0.5">
                + {totalExpensesLRD.toLocaleString()} LRD
              </div>
            )}
            <div className="text-[11px] text-slate-400 mt-1">
              {filteredExpenses.length} logs • {selectedYear === 'All' ? 'All Years' : selectedYear}
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Active Parcel</span>
              <Building2 className="h-4 w-4 text-blue-700" />
            </div>
            <div className="mt-2 text-lg font-black text-slate-900 truncate">
              {selectedFarmId === 'All'
                ? `All Farms (${farms.length})`
                : farmMap.get(selectedFarmId)?.name || 'Selected Parcel'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {selectedFarmId === 'All'
                ? 'Consolidated farm view'
                : `${farmMap.get(selectedFarmId)?.farming_type === 'livestock' ? 'Livestock only' : farmMap.get(selectedFarmId)?.farming_type === 'both' ? 'Both' : 'Crops only'} • ${farmMap.get(selectedFarmId)?.size || 0} ${farmMap.get(selectedFarmId)?.size_unit || 'acres'}`}
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Dual Currency</span>
              <Wallet className="h-4 w-4 text-purple-700" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">USD & LRD</div>
            <div className="text-[11px] text-slate-400 mt-1">Dual-currency agricultural ledger</div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => {
              setActiveTab('inputs');
              setCategoryFilter('All');
            }}
            className={`flex items-center gap-2 border-b-2 py-3 px-5 text-sm font-bold transition-colors ${
              activeTab === 'inputs'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Package className="h-4 w-4" />
            Inputs & Materials Inventory ({filteredInputs.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('expenses');
              setCategoryFilter('All');
            }}
            className={`flex items-center gap-2 border-b-2 py-3 px-5 text-sm font-bold transition-colors ${
              activeTab === 'expenses'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Coins className="h-4 w-4" />
            Farm Operating Expenses ({filteredExpenses.length})
          </button>
        </div>

        {/* Tab 1: Inputs Table */}
        {activeTab === 'inputs' ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E2E8F0] bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="py-3.5 px-4">Item Name</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Farm Parcel</th>
                    <th className="py-3.5 px-4">Quantity</th>
                    <th className="py-3.5 px-4">Supplier</th>
                    <th className="py-3.5 px-4">Purchase Date</th>
                    <th className="py-3.5 px-4 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredInputs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                        No input records match the selected farm and year filters.
                      </td>
                    </tr>
                  ) : (
                    filteredInputs.map((item) => {
                      const farm = item.farm || farmMap.get(item.farm_id);
                      const farmName = farm?.name || 'Parcel';
                      const isLivestock = farm?.farming_type === 'livestock';
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{item.name}</td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                                isLivestock
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {item.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                              <Building2 className="h-3 w-3 text-slate-400" />
                              {farmName}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">{item.supplier || 'Local Supplier'}</td>
                          <td className="py-3.5 px-4 text-slate-500">{formatDate(item.purchase_date)}</td>
                          <td className="py-3.5 px-4 text-right font-bold text-emerald-800">
                            {item.currency === 'USD' ? '$' : 'L$'}
                            {Number(item.cost).toLocaleString()} {item.currency}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Tab 2: Expenses Table */
          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E2E8F0] bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="py-3.5 px-4">Expense Category</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">Farm Parcel</th>
                    <th className="py-3.5 px-4">Expense Date</th>
                    <th className="py-3.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                        No farm expenses match the selected farm and year filters.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => {
                      const farm = exp.farm || farmMap.get(exp.farm_id);
                      const farmName = farm?.name || 'Parcel';
                      const isLivestock = farm?.farming_type === 'livestock';
                      return (
                        <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <span
                              className={`rounded px-2 py-0.5 text-[11px] font-bold border ${
                                isLivestock
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800">{exp.description || '—'}</td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                              <Building2 className="h-3 w-3 text-slate-400" />
                              {farmName}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">{formatDate(exp.expense_date)}</td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                            {exp.currency === 'USD' ? '$' : 'L$'}
                            {Number(exp.amount).toLocaleString()} {exp.currency}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
