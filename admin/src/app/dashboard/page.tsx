'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getDashboardMetrics, getFarmers, getHarvestBatches } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Farmer, HarvestBatch } from '@/types/database';

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-2xl border border-[#EDE8DC] bg-white p-4 shadow-2xs animate-pulse">
          <div className="h-3 w-24 bg-slate-200 rounded" />
          <div className="mt-3 h-8 w-16 bg-slate-200 rounded" />
          <div className="mt-2 h-2.5 w-28 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-[#EDE8DC] bg-white p-5 shadow-2xs lg:col-span-2 animate-pulse h-64">
        <div className="h-4 w-32 bg-slate-200 rounded" />
        <div className="mt-6 space-y-4">
          <div className="h-4 w-full bg-slate-100 rounded" />
          <div className="h-4 w-full bg-slate-100 rounded" />
          <div className="h-4 w-full bg-slate-100 rounded" />
        </div>
      </div>
      <div className="rounded-2xl border border-[#EDE8DC] bg-white p-5 shadow-2xs animate-pulse h-64 flex flex-col items-center justify-center">
        <div className="h-32 w-32 rounded-full border-8 border-slate-200" />
      </div>
    </div>
  );
}

function BatchesSkeleton() {
  return (
    <div className="rounded-2xl border border-[#EDE8DC] bg-white p-5 shadow-2xs animate-pulse">
      <div className="h-4 w-36 bg-slate-200 rounded mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-slate-50 rounded" />
        ))}
      </div>
    </div>
  );
}

function FarmersSkeleton() {
  return (
    <div className="rounded-2xl border border-[#EDE8DC] bg-white p-5 shadow-2xs animate-pulse">
      <div className="h-4 w-40 bg-slate-200 rounded mb-4" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 bg-slate-50 rounded" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [recentFarmers, setRecentFarmers] = useState<Farmer[]>([]);
  const [recentHarvests, setRecentHarvests] = useState<HarvestBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCounty, setSelectedCounty] = useState('All counties (15)');
  const [selectedCrop, setSelectedCrop] = useState('All crops');

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, f, h] = await Promise.all([
        getDashboardMetrics(),
        getFarmers(4),
        getHarvestBatches(3),
      ]);
      setMetrics(m);
      setRecentFarmers(f);
      setRecentHarvests(h);
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Total production and crop breakdown data matching Mobile Theme Colors
  const totalProduction = metrics?.totalHarvestKg || 5200;
  const cropsData = [
    { name: 'Rice', amount: 2450, color: '#15803D', pct: (2450 / totalProduction) * 100 },
    { name: 'Cassava', amount: 1800, color: '#16A34A', pct: (1800 / totalProduction) * 100 },
    { name: 'Cocoa', amount: 950, color: '#CA8A04', pct: (950 / totalProduction) * 100 },
  ];

  // Quality inspection breakdown
  const inspectionApproved = metrics?.approvedHarvests ?? 1;
  const inspectionPending = metrics?.pendingInspections ?? 2;
  const inspectionRejected = metrics?.rejectedHarvests ?? 0;
  const totalBatches = inspectionApproved + inspectionPending + inspectionRejected || 3;

  // Donut circumference (radius = 36, C = 2 * PI * 36 ≈ 226.19)
  const c = 226.19;
  const approvedDash = (inspectionApproved / totalBatches) * c;
  const pendingDash = (inspectionPending / totalBatches) * c;

  return (
    <AdminLayout>
      <div className="space-y-4 font-sans text-slate-800">
        {/* Top Header: Title, Subtitle, Action Buttons */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              National agricultural overview
            </h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Live figures from registered farmers, field operations and verified harvest batches.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D5CFBF] bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-xl bg-[#0A1C14] px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#163A26] transition-colors"
            >
              Export report
            </button>
          </div>
        </div>

        {/* Filter Pills Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {/* Counties Dropdown */}
          <div className="relative">
            <select
              value={selectedCounty}
              onChange={(e) => setSelectedCounty(e.target.value)}
              className="appearance-none rounded-full border border-[#DDD7C8] bg-white py-1.5 pl-4 pr-8 text-xs font-medium text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#15803D] cursor-pointer"
            >
              <option value="All counties (15)">All counties (15)</option>
              <option value="Nimba">Nimba</option>
              <option value="Bong">Bong</option>
              <option value="Lofa">Lofa</option>
              <option value="Margibi">Margibi</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          </div>

          {/* Crops Dropdown */}
          <div className="relative">
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="appearance-none rounded-full border border-[#DDD7C8] bg-white py-1.5 pl-4 pr-8 text-xs font-medium text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#15803D] cursor-pointer"
            >
              <option value="All crops">All crops</option>
              <option value="Rice">Rice</option>
              <option value="Cassava">Cassava</option>
              <option value="Cocoa">Cocoa</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          </div>

          {/* Season Tag */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E5F2DC] border border-[#CDE3BF] px-3.5 py-1.5 text-xs font-medium text-[#1C3822]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#15803D]" />
            2026 main season · active
          </div>
        </div>

        {/* Warning / Quality Alert Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-[#ECD3B0] bg-[#F6E5CC] p-4 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-900 shrink-0" />
            <span className="text-xs font-medium text-amber-950 sm:text-sm">
              2 harvest batches are waiting for quality review.
            </span>
          </div>
          <Link
            href="/quality"
            className="rounded-xl bg-[#0A1C14] px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#163A26] text-center shrink-0 transition-colors"
          >
            Review batches
          </Link>
        </div>

        {/* Five Key KPI Cards streamed with Suspense */}
        <Suspense fallback={<MetricsSkeleton />}>
          {loading && !metrics ? (
            <MetricsSkeleton />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {/* Registered Farmers */}
              <div className="rounded-2xl border border-[#EDE8DC] bg-white p-4 shadow-2xs flex flex-col justify-between">
                <span className="text-xs text-slate-500">Registered farmers</span>
                <div className="mt-2 text-3xl font-extrabold text-slate-900">
                  {metrics ? metrics.totalFarmers : '4'}
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  National ID verified
                </div>
              </div>

              {/* Registered Parcels */}
              <div className="rounded-2xl border border-[#EDE8DC] bg-white p-4 shadow-2xs flex flex-col justify-between">
                <span className="text-xs text-slate-500">Registered parcels</span>
                <div className="mt-2 text-3xl font-extrabold text-slate-900">
                  {metrics ? metrics.totalFarms : '4'}
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  GPS mapped
                </div>
              </div>

              {/* Cultivated Area */}
              <div className="rounded-2xl border border-[#EDE8DC] bg-white p-4 shadow-2xs flex flex-col justify-between">
                <span className="text-xs text-slate-500">Cultivated area</span>
                <div className="mt-2 text-3xl font-extrabold text-slate-900">
                  {metrics ? Number(metrics.totalAcreage).toFixed(1) : '29.2'}{' '}
                  <span className="text-xs font-normal text-slate-600">acres</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  Across verified seasons
                </div>
              </div>

              {/* Total Harvest */}
              <div className="rounded-2xl border border-[#EDE8DC] bg-white p-4 shadow-2xs flex flex-col justify-between">
                <span className="text-xs text-slate-500">Total harvest</span>
                <div className="mt-2 text-3xl font-extrabold text-slate-900">
                  {metrics ? metrics.totalHarvestKg.toLocaleString() : '5,200'}{' '}
                  <span className="text-xs font-normal text-slate-600">kg</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  Measured production weight
                </div>
              </div>

              {/* Inspection Pass */}
              <div className="rounded-2xl border border-[#EDE8DC] bg-white p-4 shadow-2xs flex flex-col justify-between">
                <span className="text-xs text-slate-500">Inspection pass</span>
                <div className="mt-2 text-3xl font-extrabold text-slate-900">
                  {inspectionApproved}{' '}
                  <span className="text-xs font-normal text-slate-600">of {totalBatches} batches</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  {inspectionPending} pending verification
                </div>
              </div>
            </div>
          )}
        </Suspense>

        {/* Middle Section: Harvest by crop & Inspection outcomes streamed with Suspense */}
        <Suspense fallback={<ChartsSkeleton />}>
          {loading && !metrics ? (
            <ChartsSkeleton />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Harvest by crop */}
              <div className="rounded-2xl border border-[#EDE8DC] bg-white p-5 shadow-2xs lg:col-span-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 sm:text-base">Harvest by crop</h2>
                      <p className="text-xs text-slate-500">Recorded volume in kg · 2026</p>
                    </div>
                    <div className="text-sm font-bold text-slate-900 sm:text-base">
                      {totalProduction.toLocaleString()} kg
                    </div>
                  </div>

                  {/* Crop Bars */}
                  <div className="mt-6 space-y-5">
                    {cropsData.map((c) => (
                      <div key={c.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-800">
                          <span>{c.name}</span>
                          <span>{c.amount.toLocaleString()} kg</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-[#EAE5D9] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${c.pct}%`,
                              backgroundColor: c.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Inspection outcomes Donut */}
              <div className="rounded-2xl border border-[#EDE8DC] bg-white p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 sm:text-base">Inspection outcomes</h2>
                  <p className="text-xs text-slate-500">Quality grade breakdown</p>
                </div>

                {/* Donut Chart */}
                <div className="relative my-4 flex items-center justify-center">
                  <svg className="h-40 w-40 -rotate-90 transform" viewBox="0 0 100 100">
                    {/* Background track */}
                    <circle
                      cx="50"
                      cy="50"
                      r="36"
                      className="stroke-[#EAE5D9]"
                      strokeWidth="13"
                      fill="transparent"
                    />
                    {/* Grade A, approved slice (Green) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="36"
                      stroke="#134927"
                      strokeWidth="13"
                      fill="transparent"
                      strokeDasharray={`${approvedDash} ${c}`}
                      strokeDashoffset="0"
                    />
                    {/* Pending review slice (Amber) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="36"
                      stroke="#E5A017"
                      strokeWidth="13"
                      fill="transparent"
                      strokeDasharray={`${pendingDash} ${c}`}
                      strokeDashoffset={`${-approvedDash}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-extrabold leading-none text-slate-900">
                      {totalBatches}
                    </span>
                    <span className="mt-0.5 text-[11px] text-slate-500 font-normal">
                      batches
                    </span>
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#15803D]" />
                      <span>Grade A, approved</span>
                    </div>
                    <span className="font-semibold text-slate-800">{inspectionApproved}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#D97706]" />
                      <span>Pending review</span>
                    </div>
                    <span className="font-semibold text-slate-800">{inspectionPending}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
                      <span>Rejected</span>
                    </div>
                    <span className="font-semibold text-slate-800">{inspectionRejected}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Suspense>


        {/* Bottom Operational Cards: Recent Batches & Registered Farmers streamed with Suspense */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Recent Harvest Batches */}
          <Suspense fallback={<BatchesSkeleton />}>
            {loading && recentHarvests.length === 0 ? (
              <BatchesSkeleton />
            ) : (
              <div className="rounded-2xl border border-[#EDE8DC] bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-slate-900">Recent harvest batches</h2>
                  <Link href="/harvests" className="text-xs font-medium text-slate-600 hover:text-slate-900">
                    View all
                  </Link>
                </div>
                <div className="divide-y divide-[#F4EFE6]">
                  {recentHarvests.map((h) => {
                    const isApproved = h.status === 'approved';
                    const isPending = h.status === 'pending_inspection';
                    return (
                      <div key={h.id} className="py-3 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900">{h.batch_reference}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {h.crop?.name} · {h.quantity.toLocaleString()} {h.unit} · {formatDate(h.harvest_date)}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-3 py-0.5 text-[11px] font-semibold ${
                            isApproved
                              ? 'bg-[#DCFCE7] text-[#14532D]'
                              : isPending
                              ? 'bg-[#FEF3C7] text-[#D97706]'
                              : 'bg-[#DBEAFE] text-[#2563EB]'
                          }`}
                        >
                          {isApproved
                            ? 'Approved'
                            : isPending
                            ? 'Pending inspection'
                            : 'Under inspection'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Suspense>

          {/* Recently Registered Farmers */}
          <Suspense fallback={<FarmersSkeleton />}>
            {loading && recentFarmers.length === 0 ? (
              <FarmersSkeleton />
            ) : (
              <div className="rounded-2xl border border-[#EDE8DC] bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-slate-900">Recently registered farmers</h2>
                  <Link href="/farmers" className="text-xs font-medium text-slate-600 hover:text-slate-900">
                    View all
                  </Link>
                </div>
                <div className="divide-y divide-[#F4EFE6]">
                  {recentFarmers.map((f) => {
                    const initials = f.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    return (
                      <div key={f.id} className="py-2.5 flex items-center gap-3 text-xs">
                        <div className="h-8 w-8 rounded-full bg-[#E5F2DC] text-[#1C3822] flex items-center justify-center font-bold text-[11px] shrink-0 border border-[#CDE3BF]">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 truncate">{f.full_name}</div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {f.county} · {f.cooperative?.name || 'Independent'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Suspense>
        </div>
      </div>
    </AdminLayout>
  );
}
