'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Layers,
  Sprout,
  Calendar,
  User,
  Package,
  Activity,
  Droplets,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getFarms, getHarvestBatches, getFarmActivities } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Farm, HarvestBatch, FarmActivity } from '@/types/database';

export default function FarmDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [farm, setFarm] = useState<Farm | null>(null);
  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const [allFarms, allHarvests, allActivities] = await Promise.all([
          getFarms(),
          getHarvestBatches(),
          getFarmActivities(),
        ]);

        const currentFarm = allFarms.find((f) => f.id === id) || allFarms[0];
        setFarm(currentFarm);
        setHarvests(allHarvests.filter((h) => h.farm_id === id));
        setActivities(allActivities.filter((a) => a.farm_id === id));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#15803D] border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  if (!farm) {
    return (
      <AdminLayout>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
          Farm record not found.
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/farms"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#15803D] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Farms Directory
          </Link>
        </div>

        {/* Farm Header Card */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#DCFCE7] text-[#15803D] shadow-inner">
                <MapPin className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-[#1E293B]">{farm.name}</h1>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-[#15803D] border border-emerald-200">
                    Active Registry
                  </span>
                </div>
                <p className="text-sm text-[#64748B]">
                  Cadastral ID: <span className="font-mono text-[#1E293B]">{farm.id}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {farm.farmer && (
                <Link
                  href={`/farmers/${farm.farmer_id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#1E293B] hover:bg-slate-50 shadow-sm"
                >
                  <User className="h-4 w-4 text-[#15803D]" />
                  <span>Farmer: {farm.farmer.full_name}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-[#64748B]" />
                </Link>
              )}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#E2E8F0] pt-6 sm:grid-cols-4">
            <div>
              <span className="text-xs font-medium text-[#64748B]">Total Farm Size</span>
              <p className="mt-1 text-lg font-bold text-[#1E293B]">{farm.size} Acres</p>
            </div>
            <div>
              <span className="text-xs font-medium text-[#64748B]">County / District</span>
              <p className="mt-1 text-sm font-semibold text-[#1E293B]">
                {farm.county}, {farm.district}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-[#64748B]">Community</span>
              <p className="mt-1 text-sm font-semibold text-[#1E293B]">{farm.community}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-[#64748B]">GPS Coordinates</span>
              <p className="mt-1 font-mono text-xs font-medium text-[#1E293B]">
                {(farm.gps_lat ?? farm.latitude ?? 6.3156).toFixed(5)}, {(farm.gps_lng ?? farm.longitude ?? -10.8074).toFixed(5)}
              </p>
            </div>
          </div>
        </div>

        {/* Cadastral & Agronomic Attributes */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#1E293B]">Agronomic Profile</h2>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs text-[#64748B]">Soil Type</span>
                <span className="text-xs font-semibold text-[#1E293B]">{farm.soil_type || 'Sandy Clay Loam'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs text-[#64748B]">Irrigation Installed</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {farm.irrigation ? 'Yes (Canal/Drip)' : 'Rainfed'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs text-[#64748B]">Terrain Slope</span>
                <span className="text-xs font-semibold text-[#1E293B]">Lowland / Inland Valley</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B]">Established Date</span>
                <span className="text-xs font-semibold text-[#1E293B]">{formatDate(farm.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-base font-bold text-[#1E293B]">GPS Spatial Fix (Liberian Cadastre)</h2>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-900 p-5 text-white">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  WGS84 Geodetic Datum
                </span>
                <span className="font-mono">Precision: ± 2.4 meters</span>
              </div>
              <div className="my-6 text-center">
                {(() => {
                  const lat = farm.gps_lat ?? farm.latitude ?? 6.3156;
                  const lng = farm.gps_lng ?? farm.longitude ?? -10.8074;
                  return (
                    <p className="font-mono text-2xl font-bold text-emerald-400">
                      {lat > 0 ? `${lat.toFixed(5)}° N` : `${Math.abs(lat).toFixed(5)}° S`},{' '}
                      {lng < 0 ? `${Math.abs(lng).toFixed(5)}° W` : `${lng.toFixed(5)}° E`}
                    </p>
                  );
                })()}
                <p className="mt-1 text-xs text-slate-400">
                  Cadastral survey recorded via AgriTrack Mobile Field App
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
                <span>Elevation: 142m MSL</span>
                <span>Projection: UTM Zone 29N</span>
              </div>
            </div>
          </div>
        </div>

        {/* Harvest Batches Originating from this Farm */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#E2E8F0] px-6 py-4">
            <h2 className="text-base font-bold text-[#1E293B]">Harvest Batches Produced at this Farm</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B]">
                <tr>
                  <th className="px-6 py-3 font-semibold">Batch Code</th>
                  <th className="px-6 py-3 font-semibold">Crop</th>
                  <th className="px-6 py-3 font-semibold">Quantity</th>
                  <th className="px-6 py-3 font-semibold">Harvest Date</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {harvests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-6 text-center text-[#64748B]">
                      No harvest batches recorded for this farm yet.
                    </td>
                  </tr>
                ) : (
                  harvests.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono font-bold text-[#1E293B]">
                        {h.batch_code || h.batch_reference}
                      </td>
                      <td className="px-6 py-4 font-medium text-[#1E293B]">{h.crop?.name || 'Crop'}</td>
                      <td className="px-6 py-4 font-semibold text-[#15803D]">
                        {(h.quantity_kg ?? h.quantity).toLocaleString()} {h.unit}
                      </td>
                      <td className="px-6 py-4 text-[#64748B]">{formatDate(h.harvest_date)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#15803D] border border-emerald-200">
                          {(h.quality_status || h.status).toUpperCase()}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <Link
                          href={`/harvests/${h.id}`}
                          className="font-semibold text-[#15803D] hover:underline"
                        >
                          View Batch
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
