'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardList, Search, Filter, Calendar, Users, MapPin, Download } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getFarmActivities } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { FarmActivity } from '@/types/database';

export default function FarmRecordsPage() {
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getFarmActivities();
        setActivities(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = activities.filter((act) => {
    const matchesSearch =
      act.activity_type.toLowerCase().includes(search.toLowerCase()) ||
      (act.description && act.description.toLowerCase().includes(search.toLowerCase())) ||
      (act.farmer && act.farmer.full_name.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === 'All' || act.activity_type.toLowerCase() === typeFilter.toLowerCase();
    return matchesSearch && matchesType;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Digital Farm Records & Field Ledger
            </h1>
            <p className="text-sm text-slate-500">
              Audit trail of agronomic field operations: land preparation, planting, fertilizer application, and crop protection.
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Export Audit Ledger
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search operation, farmer, farm parcel, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-slate-50 py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#15803D] focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#15803D] focus:outline-none"
          >
            <option value="All">All Classifications</option>
            <option value="Land preparation">Land Preparation</option>
            <option value="Planting">Planting</option>
            <option value="Fertilizer application">Fertilizer Application</option>
            <option value="Weeding">Weeding</option>
            <option value="Pest management">Pest Management</option>
            <option value="Irrigation">Irrigation</option>
          </select>
        </div>

        {/* Operations Table */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E2E8F0] bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3.5 px-4">Operation</th>
                  <th className="py-3.5 px-4">Farmer & Farm Parcel</th>
                  <th className="py-3.5 px-4">Date Performed</th>
                  <th className="py-3.5 px-4">Observation Notes</th>
                  <th className="py-3.5 px-4">Labor</th>
                  <th className="py-3.5 px-4 text-right">Cost (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900">{item.activity_type}</span>
                      <div className="text-[10px] text-emerald-700 font-semibold uppercase">Verified Mobile Entry</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{item.farmer?.full_name}</div>
                      <div className="text-[11px] text-slate-400">{item.farm?.name}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{formatDate(item.activity_date)}</td>
                    <td className="py-3.5 px-4 max-w-sm text-slate-600 truncate">{item.description}</td>
                    <td className="py-3.5 px-4">{item.labor_count} workers</td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-800">${item.cost}</td>
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
