'use client';

import React, { useState, useEffect } from 'react';
import { Coins, Search, Filter, Download, DollarSign, Wallet } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getInputs } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { InputRecord } from '@/types/database';

export default function InputsAndExpensesPage() {
  const [inputs, setInputs] = useState<InputRecord[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getInputs();
        setInputs(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalExpenseUSD = inputs.reduce((acc, i) => acc + (Number(i.cost) || 0), 0);

  const filtered = inputs.filter((inp) => {
    const matchesSearch =
      inp.name.toLowerCase().includes(search.toLowerCase()) ||
      (inp.supplier && inp.supplier.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = categoryFilter === 'All' || inp.category.toLowerCase() === categoryFilter.toLowerCase();
    return matchesSearch && matchesCat;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Agricultural Inputs & Operating Expenses
            </h1>
            <p className="text-sm text-slate-500">
              Review certified foundation seeds, mineral fertilizers, crop protection purchases, and farm cost ledgers.
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

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Total Recorded Costs</span>
              <DollarSign className="h-4 w-4 text-emerald-700" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              ${totalExpenseUSD.toLocaleString()} USD
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Across active 2026 seasons</div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Input Items Purchased</span>
              <Coins className="h-4 w-4 text-amber-700" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{inputs.length}</div>
            <div className="text-[11px] text-slate-400 mt-1">Certified seeds & fertilizers</div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Accepted Currencies</span>
              <Wallet className="h-4 w-4 text-blue-700" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">USD & LRD</div>
            <div className="text-[11px] text-slate-400 mt-1">Dual-currency agricultural ledger</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search input name, supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-slate-50 py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#15803D] focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#15803D] focus:outline-none"
          >
            <option value="All">All Categories</option>
            <option value="Seeds">Seeds</option>
            <option value="Fertilizers">Fertilizers</option>
            <option value="Pesticides">Pesticides</option>
            <option value="Herbicides">Herbicides</option>
            <option value="Tools">Tools</option>
          </select>
        </div>

        {/* Inputs Table */}
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
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-3.5 px-4">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{item.farm?.name}</td>
                    <td className="py-3.5 px-4 font-semibold">{item.quantity} {item.unit}</td>
                    <td className="py-3.5 px-4 text-slate-500">{item.supplier || 'Local Supplier'}</td>
                    <td className="py-3.5 px-4 text-slate-500">{formatDate(item.purchase_date)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-800">
                      ${item.cost} {item.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
