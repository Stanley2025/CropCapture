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
  ArrowUpDown,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getInputs, getExpenses, getFarms } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { InputRecord, ExpenseRecord, Farm } from '@/types/database';

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

  // Filtered Inputs
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

      return matchesSearch && matchesCat && matchesFarm && matchesYear;
    });
  }, [inputs, search, categoryFilter, selectedFarmId, selectedYear]);

  // Filtered Expenses
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

      return matchesSearch && matchesCat && matchesFarm && matchesYear;
    });
  }, [expenses, search, categoryFilter, selectedFarmId, selectedYear]);

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
              Review certified foundation seeds, mineral fertilizers, crop protection purchases, and farm cost ledgers by year and farm parcel.
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
              Farm Parcel
            </label>
            <div className="relative">
              <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-emerald-700" />
              <select
                value={selectedFarmId}
                onChange={(e) => setSelectedFarmId(e.target.value)}
                className="w-full rounded-lg border border-emerald-200 bg-white py-2 pl-9 pr-4 text-xs font-semibold text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="All">All Farm Parcels ({farms.length})</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.county || 'Liberia'}) • {f.size} {f.size_unit}
                  </option>
                ))}
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
                  <>
                    <option value="Seeds">Seeds & Seedlings</option>
                    <option value="Fertilizers">Fertilizers</option>
                    <option value="Pesticides">Pesticides</option>
                    <option value="Herbicides">Herbicides</option>
                    <option value="Tools">Tools</option>
                    <option value="Equipment">Equipment</option>
                  </>
                ) : (
                  <>
                    <option value="Labour">Labour & Wages</option>
                    <option value="Land preparation">Land Preparation</option>
                    <option value="Fertilizer">Fertilizer Application</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Equipment rental">Equipment Rental</option>
                  </>
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
                : `${farmMap.get(selectedFarmId)?.size || 0} ${farmMap.get(selectedFarmId)?.size_unit || 'acres'} in ${farmMap.get(selectedFarmId)?.county || 'Liberia'}`}
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
                        No input records match the selected year and farm filters.
                      </td>
                    </tr>
                  ) : (
                    filteredInputs.map((item) => {
                      const farmName = item.farm?.name || farmMap.get(item.farm_id)?.name || 'Parcel';
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{item.name}</td>
                          <td className="py-3.5 px-4">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
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
                        No farm expenses match the selected year and farm filters.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => {
                      const farmName = exp.farm?.name || farmMap.get(exp.farm_id)?.name || 'Parcel';
                      return (
                        <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
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
