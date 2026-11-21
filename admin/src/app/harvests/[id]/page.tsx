'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  Download,
  Calendar,
  User,
  MapPin,
  Sprout,
  Scale,
  Award,
  FileCheck2,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { HarvestPhotosPanel } from '@/components/harvest/HarvestPhotosPanel';
import { getHarvestBatches, getQualityInspections } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { HarvestBatch, QualityInspection } from '@/types/database';

export default function HarvestDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [harvest, setHarvest] = useState<HarvestBatch | null>(null);
  const [inspection, setInspection] = useState<QualityInspection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const [batches, inspections] = await Promise.all([
          getHarvestBatches(),
          getQualityInspections(),
        ]);
        const currentBatch = batches.find((b) => b.id === id);
        setHarvest(currentBatch || null);
        const relatedInspection = inspections.find((i) => i.batch_id === currentBatch?.id);
        setInspection(relatedInspection || null);
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

  if (!harvest) {
    return (
      <AdminLayout>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
          Harvest batch record not found.
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/harvests"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#15803D] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Harvest Batches
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#1E293B] shadow-sm hover:bg-slate-50"
          >
            <Printer className="h-4 w-4 text-[#15803D]" />
            Print Batch Certificate
          </button>
        </div>

        {/* Batch Hero Card */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#DCFCE7] text-[#15803D] shadow-inner">
                <Package className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-mono text-2xl font-bold text-[#1E293B]">
                    {harvest.batch_code || harvest.batch_reference}
                  </h1>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      (harvest.quality_status || harvest.status) === 'approved'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : (harvest.quality_status || harvest.status) === 'rejected'
                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {(harvest.quality_status || harvest.status).toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-[#64748B]">
                  National Crop Registry • Lot {harvest.id.substring(0, 8)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white p-2 border border-slate-200 shadow-sm">
                <QrCode className="h-12 w-12 text-slate-800" />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Digital Pass ID
                </span>
                <p className="font-mono text-xs font-bold text-slate-800">
                  LIB-AGRI-{harvest.batch_code || harvest.batch_reference}
                </p>
                <span className="text-[11px] text-emerald-700">Cryptographically Signed</span>
              </div>
            </div>
          </div>

          {/* Quick Details Bar */}
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#E2E8F0] pt-6 sm:grid-cols-4">
            <div>
              <span className="text-xs font-medium text-[#64748B]">Crop & Variety</span>
              <p className="mt-1 font-semibold text-[#1E293B]">
                {harvest.crop?.name || 'Crop'} ({harvest.variety?.name || harvest.crop?.variety || 'Standard'})
              </p>
            </div>

            <div>
              <span className="text-xs font-medium text-[#64748B]">Measured Weight</span>
              <p className="mt-1 text-lg font-bold text-[#15803D]">
                {(harvest.quantity_kg ?? harvest.quantity).toLocaleString()} {harvest.unit}
              </p>
            </div>

            <div>
              <span className="text-xs font-medium text-[#64748B]">Harvest Date</span>
              <p className="mt-1 font-semibold text-[#1E293B]">{formatDate(harvest.harvest_date)}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-[#64748B]">Storage Location</span>
              <p className="mt-1 font-semibold text-[#1E293B]">{harvest.storage_location || 'Central Warehouse'}</p>
            </div>
          </div>
        </div>

        {/* Origin & Custody Chain */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Provenance Card */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <Sprout className="h-4 w-4 text-[#15803D]" />
              Origin & Provenance
            </h2>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs text-[#64748B]">Producing Farmer</span>
                <Link
                  href={`/farmers/${harvest.farmer_id}`}
                  className="text-xs font-bold text-[#15803D] hover:underline"
                >
                  {harvest.farmer?.full_name || 'Farmer Record'}
                </Link>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs text-[#64748B]">Source Farm</span>
                <Link
                  href={`/farms/${harvest.farm_id}`}
                  className="text-xs font-bold text-[#15803D] hover:underline"
                >
                  {harvest.farm?.name || 'Farm Plot'}
                </Link>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs text-[#64748B]">County / Community</span>
                <span className="text-xs font-semibold text-[#1E293B]">
                  {harvest.farm?.county || 'Nimba'}, {harvest.farm?.community || 'Sanniquellie'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B]">Field GPS Fix</span>
                <span className="font-mono text-xs text-[#1E293B]">
                  {harvest.farm?.gps_lat ? `${harvest.farm.gps_lat}, ${harvest.farm.gps_lng}` : 'WGS84 Recorded'}
                </span>
              </div>
            </div>
          </div>

          {/* Quality & Inspection Card */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#15803D]" />
              Quality Inspection Verification
            </h2>
            {inspection ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs text-[#64748B]">Assigned Grade</span>
                  <span className="inline-flex rounded-lg bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 text-xs">
                    {inspection.grade}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs text-[#64748B]">Moisture Content</span>
                  <span className="text-xs font-semibold text-[#1E293B]">{inspection.moisture_content}%</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs text-[#64748B]">Foreign Matter</span>
                  <span className="text-xs font-semibold text-[#1E293B]">{inspection.foreign_matter}%</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs text-[#64748B]">Inspection Date</span>
                  <span className="text-xs font-semibold text-[#1E293B]">{formatDate(inspection.inspection_date)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#64748B]">Decision</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {(inspection.status || inspection.decision_status || 'Approved').toUpperCase()}
                  </span>
                </div>

              </div>
            ) : (
              <div className="mt-8 text-center text-xs text-[#64748B]">
                <Clock className="mx-auto h-8 w-8 text-amber-500 mb-2" />
                This harvest batch is queued for field quality inspection.
              </div>
            )}
          </div>
        </div>

        <HarvestPhotosPanel harvestId={harvest.id} />
      </div>
    </AdminLayout>
  );
}
