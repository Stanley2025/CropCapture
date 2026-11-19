'use client';

import React, { useState, useEffect } from 'react';
import { Sprout, Search, Plus, Calendar, Layers, CheckCircle2 } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getCrops, getSeasons } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Crop, FarmSeason } from '@/types/database';

export default function CropsAndSeasonsPage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [seasons, setSeasons] = useState<FarmSeason[]>([]);
  const [activeTab, setActiveTab] = useState<'crops' | 'seasons'>('crops');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [c, s] = await Promise.all([getCrops(), getSeasons()]);
        setCrops(c);
        setSeasons(s);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Crops & Agricultural Seasons
          </h1>
          <p className="text-sm text-slate-500">
            National commodity catalogue, certified varietal specifications, and seasonal cropping windows.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-[#E2E8F0] text-xs font-bold">
          <button
            onClick={() => setActiveTab('crops')}
            className={`border-b-2 py-3 px-4 transition ${
              activeTab === 'crops'
                ? 'border-[#15803D] text-[#15803D]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Commodity Catalogue ({crops.length})
          </button>
          <button
            onClick={() => setActiveTab('seasons')}
            className={`border-b-2 py-3 px-4 transition ${
              activeTab === 'seasons'
                ? 'border-[#15803D] text-[#15803D]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Active Cropping Seasons ({seasons.length})
          </button>
        </div>

        {activeTab === 'crops' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {crops.map((crop) => (
              <div key={crop.id} className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#DCFCE7] text-[#15803D]">
                      <Sprout className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{crop.name}</h3>
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {crop.code}
                      </span>
                    </div>
                  </div>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                    Active
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-600 line-clamp-2">{crop.description}</p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                  <span>Category: {crop.category}</span>
                  <span>Unit: {crop.default_unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'seasons' && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E2E8F0] bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3.5 px-4">Season Designation</th>
                  <th className="py-3.5 px-4">Commodity</th>
                  <th className="py-3.5 px-4">Farm Parcel</th>
                  <th className="py-3.5 px-4">Planting Date</th>
                  <th className="py-3.5 px-4">Cultivated Area</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {seasons.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{s.season_name}</td>
                    <td className="py-3.5 px-4">{s.crop?.name}</td>
                    <td className="py-3.5 px-4 text-slate-600">{s.farm?.name}</td>
                    <td className="py-3.5 px-4 text-slate-500">{formatDate(s.planting_date)}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{s.cultivated_area} acres</td>
                    <td className="py-3.5 px-4">
                      <span className="rounded-full bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 text-[10px] uppercase">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
