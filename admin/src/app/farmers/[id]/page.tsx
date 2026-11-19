'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Building2,
  Package,
  Layers,
  ClipboardList,
  Coins,
  ShieldCheck,
  Compass,
  Edit,
  ExternalLink,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import {
  getFarmerById,
  getFarmsByFarmerId,
  getHarvestBatchesByFarmerId,
  getFarmActivitiesByFarmerId,
  getQualityInspections,
} from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Farmer, Farm, HarvestBatch, FarmActivity, InputRecord, QualityInspection } from '@/types/database';

export default function FarmerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [inputs, setInputs] = useState<InputRecord[]>([]);
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [activeTab, setActiveTab] = useState<'farms' | 'activities' | 'harvests' | 'inputs' | 'inspections'>('farms');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const [farmerData, farmsData, harvestsData, activitiesData, allInspections] = await Promise.all([
          getFarmerById(id),
          getFarmsByFarmerId(id),
          getHarvestBatchesByFarmerId(id),
          getFarmActivitiesByFarmerId(id),
          getQualityInspections(),
        ]);

        setFarmer(farmerData);
        setFarms(farmsData);
        setHarvests(harvestsData);
        setActivities(activitiesData);
        setInspections(allInspections.filter((q) => q.batch?.farmer_id === id));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="py-12 text-center text-slate-500">Loading farmer passport profile...</div>
      </AdminLayout>
    );
  }

  if (!farmer) {
    return (
      <AdminLayout>
        <div className="py-12 text-center">
          <p className="text-base font-bold text-slate-700">Farmer Record Not Found</p>
          <Link href="/farmers" className="mt-2 inline-block text-xs font-semibold text-[#15803D]">
            ← Return to Farmer Directory
          </Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Back Link */}
        <Link
          href="/farmers"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Farmer Directory
        </Link>

        {/* Farmer Header Identity Banner */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#DCFCE7] text-2xl font-black text-[#15803D] shadow-inner">
                {farmer.full_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-extrabold text-slate-900">{farmer.full_name}</h1>
                  <span className="font-mono text-xs font-bold bg-[#DCFCE7] text-[#14532D] px-2.5 py-0.5 rounded">
                    {farmer.farmer_id_code}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {farmer.community}, {farmer.district}, {farmer.county} County
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {farmer.phone_number}
                  </span>
                  {farmer.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      {farmer.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-100">
                Verified Smallholder
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-4 text-center">
            <div>
              <div className="text-xl font-black text-slate-900">{farms.length}</div>
              <div className="text-xs text-slate-500">Registered Farms</div>
            </div>
            <div>
              <div className="text-xl font-black text-slate-900">
                {farms.reduce((a, b) => a + Number(b.size), 0).toFixed(1)} ac
              </div>
              <div className="text-xs text-slate-500">Total Acreage</div>
            </div>
            <div>
              <div className="text-xl font-black text-slate-900">{harvests.length}</div>
              <div className="text-xs text-slate-500">Harvest Batches</div>
            </div>
            <div>
              <div className="text-xl font-black text-emerald-700">{activities.length}</div>
              <div className="text-xs text-slate-500">Logged Field Operations</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E2E8F0] text-xs font-bold">
          <button
            onClick={() => setActiveTab('farms')}
            className={`border-b-2 py-3 px-4 transition ${
              activeTab === 'farms'
                ? 'border-[#15803D] text-[#15803D]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Registered Farms ({farms.length})
          </button>
          <button
            onClick={() => setActiveTab('activities')}
            className={`border-b-2 py-3 px-4 transition ${
              activeTab === 'activities'
                ? 'border-[#15803D] text-[#15803D]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Field Operations ({activities.length})
          </button>
          <button
            onClick={() => setActiveTab('harvests')}
            className={`border-b-2 py-3 px-4 transition ${
              activeTab === 'harvests'
                ? 'border-[#15803D] text-[#15803D]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Harvest Batches ({harvests.length})
          </button>
          <button
            onClick={() => setActiveTab('inspections')}
            className={`border-b-2 py-3 px-4 transition ${
              activeTab === 'inspections'
                ? 'border-[#15803D] text-[#15803D]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Quality Inspections ({inspections.length})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'farms' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {farms.map((f) => (
              <div key={f.id} className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{f.name}</h3>
                    <p className="text-xs text-slate-500">{f.community}, {f.district}</p>
                  </div>
                  <span className="rounded bg-[#DCFCE7] px-2.5 py-0.5 text-xs font-bold text-[#14532D]">
                    {f.size} {f.size_unit}
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-600 line-clamp-2">{f.description || 'Verified agricultural parcel.'}</p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>Soil: {f.soil_type || 'Loam'}</span>
                  <Link href={`/farms/${f.id}`} className="font-bold text-[#15803D] hover:underline">
                    View Parcel →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E2E8F0] bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3 px-4">Operation</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Labor</th>
                  <th className="py-3 px-4 text-right">Cost (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {activities.map((a) => (
                  <tr key={a.id}>
                    <td className="py-3 px-4 font-bold text-slate-900">{a.activity_type}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(a.activity_date)}</td>
                    <td className="py-3 px-4 max-w-xs truncate">{a.description || '—'}</td>
                    <td className="py-3 px-4">{a.labor_count} workers</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-800">
                      ${a.cost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'harvests' && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E2E8F0] bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3 px-4">Batch Reference</th>
                  <th className="py-3 px-4">Commodity</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Harvest Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {harvests.map((h) => (
                  <tr key={h.id}>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{h.batch_reference}</td>
                    <td className="py-3 px-4">{h.crop?.name}</td>
                    <td className="py-3 px-4 font-bold">{h.quantity.toLocaleString()} {h.unit}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(h.harvest_date)}</td>
                    <td className="py-3 px-4">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        {h.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/harvests/${h.id}`} className="font-bold text-[#15803D] hover:underline">
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'inspections' && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            {inspections.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">No inspections recorded for this farmer yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {inspections.map((q) => (
                  <div key={q.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">
                        Batch: {q.batch?.batch_reference}
                      </div>
                      <div className="text-slate-500 mt-1">{q.observations}</div>
                    </div>
                    <span className="rounded bg-emerald-100 text-emerald-800 font-bold px-2 py-1 text-[11px]">
                      {q.final_grade.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
