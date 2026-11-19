'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Search,
  Filter,
  Eye,
  Layers,
  Sprout,
  Navigation,
  CheckCircle2,
  Droplets,
  Download,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getFarms } from '@/lib/api';
import { Farm } from '@/types/database';

export default function FarmsPage() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [search, setSearch] = useState('');
  const [countyFilter, setCountyFilter] = useState('All');
  const [irrigationFilter, setIrrigationFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getFarms();
        setFarms(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredFarms = farms.filter((farm) => {
    const matchesSearch =
      farm.name.toLowerCase().includes(search.toLowerCase()) ||
      farm.community.toLowerCase().includes(search.toLowerCase()) ||
      (farm.farmer && farm.farmer.full_name.toLowerCase().includes(search.toLowerCase()));
    const matchesCounty = countyFilter === 'All' || farm.county.toLowerCase() === countyFilter.toLowerCase();
    const matchesIrrigation =
      irrigationFilter === 'All' ||
      (irrigationFilter === 'Yes' && farm.irrigation) ||
      (irrigationFilter === 'No' && !farm.irrigation);
    return matchesSearch && matchesCounty && matchesIrrigation;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Farm Parcel Management & Cartography
            </h1>
            <p className="text-sm text-slate-500">
              Verified agricultural parcels, customary land tenure, and GPS geographic coordinates.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/maps"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Navigation className="h-3.5 w-3.5 text-[#15803D]" />
              Open Geographic Map View
            </Link>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search farm name, farmer owner, community..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-slate-50 py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#15803D] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={countyFilter}
              onChange={(e) => setCountyFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#15803D] focus:outline-none"
            >
              <option value="All">All Counties</option>
              <option value="Nimba">Nimba</option>
              <option value="Bong">Bong</option>
              <option value="Lofa">Lofa</option>
              <option value="Margibi">Margibi</option>
            </select>

            <select
              value={irrigationFilter}
              onChange={(e) => setIrrigationFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#15803D] focus:outline-none"
            >
              <option value="All">Irrigation: All</option>
              <option value="Yes">Irrigated</option>
              <option value="No">Rainfed</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E2E8F0] bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3.5 px-4">Farm Parcel</th>
                  <th className="py-3.5 px-4">Associated Farmer</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Size</th>
                  <th className="py-3.5 px-4">GPS Coordinates</th>
                  <th className="py-3.5 px-4">System</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Loading parcels...
                    </td>
                  </tr>
                ) : filteredFarms.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No farm parcels match filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredFarms.map((farm) => (
                    <tr key={farm.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{farm.name}</div>
                        <div className="text-[11px] text-slate-400">{farm.soil_type || 'Loam'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{farm.farmer?.full_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{farm.farmer?.farmer_id_code}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800">{farm.community}, {farm.district}</div>
                        <div className="text-[11px] text-slate-400">{farm.county} County</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#14532D] bg-[#DCFCE7] px-2 py-0.5 rounded text-[11px]">
                          {farm.size} {farm.size_unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {farm.latitude && farm.longitude ? (
                          <div className="font-mono text-[11px] text-slate-600">
                            {farm.latitude.toFixed(4)}°N, {Math.abs(farm.longitude).toFixed(4)}°W
                          </div>
                        ) : (
                          <span className="text-slate-400">No GPS lock</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {farm.irrigation ? (
                          <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium text-[11px]">
                            <Droplets className="h-3 w-3" />
                            Irrigated
                          </span>
                        ) : (
                          <span className="text-slate-500">Rainfed</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/farms/${farm.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-semibold text-[#15803D] hover:bg-[#DCFCE7] transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
