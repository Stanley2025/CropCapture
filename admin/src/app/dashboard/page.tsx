'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  MapPin,
  Layers,
  Calendar,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  Compass,
  ArrowUpRight,
  TrendingUp,
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getDashboardMetrics, getFarmers, getFarms, getHarvestBatches, getQualityInspections } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Farmer, Farm, HarvestBatch, QualityInspection } from '@/types/database';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [recentFarmers, setRecentFarmers] = useState<Farmer[]>([]);
  const [recentHarvests, setRecentHarvests] = useState<HarvestBatch[]>([]);
  const [recentInspections, setRecentInspections] = useState<QualityInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCounty, setSelectedCounty] = useState('All');
  const [selectedCrop, setSelectedCrop] = useState('All');

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, f, h, q] = await Promise.all([
        getDashboardMetrics(),
        getFarmers(),
        getHarvestBatches(),
        getQualityInspections(),
      ]);
      setMetrics(m);
      setRecentFarmers(f.slice(0, 5));
      setRecentHarvests(h.slice(0, 5));
      setRecentInspections(q.slice(0, 5));
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Visual Analytics Datasets
  const CROP_PRODUCTION_DATA = [
    { crop: 'Rice', production: 2450, acreage: 4.5, fill: '#15803D' },
    { crop: 'Cassava', production: 1800, acreage: 3.2, fill: '#16A34A' },
    { crop: 'Cocoa', production: 950, acreage: 12.5, fill: '#854D0E' },
    { crop: 'Maize', production: 620, acreage: 2.0, fill: '#EAB308' },
    { crop: 'Pepper', production: 310, acreage: 1.0, fill: '#DC2626' },
  ];

  const COUNTY_PRODUCTION_DATA = [
    { county: 'Nimba', farmers: 420, production: 4250 },
    { county: 'Bong', farmers: 310, production: 2900 },
    { county: 'Lofa', farmers: 280, production: 3400 },
    { county: 'Margibi', farmers: 190, production: 1650 },
    { county: 'Grand Bassa', farmers: 140, production: 1200 },
  ];

  const QUALITY_PIE_DATA = [
    { name: 'Grade A (Approved)', value: metrics?.approvedHarvests || 1, color: '#15803D' },
    { name: 'Pending Review', value: metrics?.pendingInspections || 1, color: '#EAB308' },
    { name: 'Rejected', value: metrics?.rejectedHarvests || 0, color: '#DC2626' },
  ];

  const HARVEST_TIMELINE_DATA = [
    { month: 'Jun', quantity: 450 },
    { month: 'Jul', quantity: 980 },
    { month: 'Aug', quantity: 1450 },
    { month: 'Sep', quantity: 2800 },
    { month: 'Oct', quantity: 5200 },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Title & Filter Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              National Agricultural Overview
            </h1>
            <p className="text-sm text-slate-500">
              Live statistics from registered farmers, field operations, and verified harvest batches across Liberia.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#15803D] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#14532D]"
            >
              <Download className="h-3.5 w-3.5" />
              Export Report
            </button>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Filter className="h-4 w-4 text-[#15803D]" />
            Filters:
          </div>

          <select
            value={selectedCounty}
            onChange={(e) => setSelectedCounty(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#15803D] focus:outline-none"
          >
            <option value="All">All Counties (15)</option>
            <option value="Nimba">Nimba County</option>
            <option value="Bong">Bong County</option>
            <option value="Lofa">Lofa County</option>
            <option value="Margibi">Margibi County</option>
            <option value="Grand Bassa">Grand Bassa County</option>
          </select>

          <select
            value={selectedCrop}
            onChange={(e) => setSelectedCrop(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#15803D] focus:outline-none"
          >
            <option value="All">All Crops</option>
            <option value="Rice">Rice (Suakoko 8 / LAC 23)</option>
            <option value="Cassava">Cassava (CARICASS 1)</option>
            <option value="Cocoa">Cocoa (Forastero Hybrid)</option>
            <option value="Maize">Maize (DMR-ESR-Y)</option>
            <option value="Pepper">Hot Pepper</option>
          </select>

          <span className="text-xs text-slate-400">|</span>
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
            2026 Main Season Active
          </span>
        </div>

        {/* Primary Metric KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Registered Farmers</span>
              <div className="rounded-lg bg-[#DCFCE7] p-2 text-[#15803D]">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-extrabold text-slate-900">
              {metrics ? metrics.totalFarmers.toLocaleString() : '—'}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
              <TrendingUp className="h-3 w-3" />
              <span>National ID verified</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Registered Parcels</span>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <MapPin className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-extrabold text-slate-900">
              {metrics ? metrics.totalFarms.toLocaleString() : '—'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              GPS mapped parcels
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Cultivated Area</span>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-extrabold text-slate-900">
              {metrics ? `${Number(metrics.totalAcreage).toFixed(1)}` : '—'}{' '}
              <span className="text-xs font-normal text-slate-500">Acres</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Across verified seasons
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Total Harvest</span>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-700">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-extrabold text-slate-900">
              {metrics ? `${metrics.totalHarvestKg.toLocaleString()}` : '—'}{' '}
              <span className="text-xs font-normal text-slate-500">kg</span>
            </div>
            <div className="mt-1 text-[11px] text-amber-700 font-medium">
              Measured production weight
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Inspection Pass</span>
              <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#15803D]">
              {metrics && metrics.approvedHarvests > 0 ? `${metrics.approvedHarvests}` : '0'}{' '}
              <span className="text-xs font-normal text-slate-500">Batches</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {metrics ? `${metrics.pendingInspections} pending verification` : '—'}
            </div>
          </div>
        </div>

        {/* Secondary Workflow Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-sm">
            <div className="rounded-lg bg-amber-100 p-2.5 text-amber-800">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">{metrics?.pendingInspections || 0}</div>
              <div className="text-xs text-slate-500">Pending Quality Review</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-sm">
            <div className="rounded-lg bg-emerald-100 p-2.5 text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">{metrics?.approvedHarvests || 0}</div>
              <div className="text-xs text-slate-500">Grade A Certified</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-sm">
            <div className="rounded-lg bg-purple-100 p-2.5 text-purple-800">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">{metrics?.totalCooperatives || 0}</div>
              <div className="text-xs text-slate-500">Registered Cooperatives</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-sm">
            <div className="rounded-lg bg-sky-100 p-2.5 text-sky-800">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">{metrics?.activeExtensionOfficers || 0}</div>
              <div className="text-xs text-slate-500">Extension Field Agents</div>
            </div>
          </div>
        </div>

        {/* Analytics Charts Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Crop Production Breakdown */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Crop Production Output</h2>
                <p className="text-xs text-slate-500">Harvest volume recorded per commodity (kg)</p>
              </div>
              <span className="text-xs font-semibold text-[#15803D] bg-emerald-50 px-2.5 py-1 rounded-full">
                Liberia 2026
              </span>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={CROP_PRODUCTION_DATA}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="crop" stroke="#64748B" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={12} tickLine={false} unit=" kg" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    cursor={{ fill: 'rgba(21, 128, 61, 0.05)' }}
                  />
                  <Bar dataKey="production" name="Production (kg)" radius={[6, 6, 0, 0]} fill="#15803D" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quality Grade Distribution */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">Inspection Outcomes</h2>
              <p className="text-xs text-slate-500">Certified quality grade breakdown</p>
            </div>
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={QUALITY_PIE_DATA}
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {QUALITY_PIE_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
              {QUALITY_PIE_DATA.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Secondary Charts: County Production & Timeline */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* County Regional Output */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">Production by County</h2>
            <p className="text-xs text-slate-500 mb-4">Total recorded harvest output across administrative counties</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={COUNTY_PRODUCTION_DATA} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" stroke="#64748B" fontSize={11} unit=" kg" />
                  <YAxis dataKey="county" type="category" stroke="#64748B" fontSize={12} tickLine={false} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Bar dataKey="production" fill="#14532D" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Harvest Timeline */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">Harvest Quantities Over Time</h2>
            <p className="text-xs text-slate-500 mb-4">Seasonal aggregation curve (kg per month)</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={HARVEST_TIMELINE_DATA}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="month" stroke="#64748B" fontSize={12} />
                  <YAxis stroke="#64748B" fontSize={12} unit=" kg" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Line type="monotone" dataKey="quantity" stroke="#15803D" strokeWidth={3} dot={{ r: 4, fill: '#15803D' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Live Operational Tables */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Harvest Submissions */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Recent Harvest Batches</h2>
              <Link href="/harvests" className="text-xs font-semibold text-[#15803D] hover:underline">
                View all batches →
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recentHarvests.map((h) => (
                <div key={h.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{h.batch_reference}</div>
                    <div className="text-slate-500">
                      {h.crop?.name} • {h.quantity.toLocaleString()} {h.unit} • {formatDate(h.harvest_date)}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      h.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : h.status === 'rejected'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {h.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Farmer Registrations */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Recently Registered Farmers</h2>
              <Link href="/farmers" className="text-xs font-semibold text-[#15803D] hover:underline">
                View all farmers →
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recentFarmers.map((f) => (
                <div key={f.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{f.full_name}</div>
                    <div className="text-slate-500">
                      ID: {f.farmer_id_code} • {f.community}, {f.county}
                    </div>
                  </div>
                  <span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                    {f.cooperative?.name || 'Independent'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
