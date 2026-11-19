'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  QrCode,
  Download,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getHarvestBatches, getCrops } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { HarvestBatch, Crop } from '@/types/database';

export default function HarvestsPage() {
  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [cropFilter, setCropFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [h, c] = await Promise.all([getHarvestBatches(), getCrops()]);
        setHarvests(h);
        setCrops(c);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredHarvests = harvests.filter((h) => {
    const matchesSearch =
      h.batch_reference.toLowerCase().includes(search.toLowerCase()) ||
      h.farmer?.full_name.toLowerCase().includes(search.toLowerCase()) ||
      h.farm?.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || h.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesCrop = cropFilter === 'All' || h.crop_id === cropFilter;
    return matchesSearch && matchesStatus && matchesCrop;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-800 uppercase tracking-wider">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        );
      case 'under_inspection':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 uppercase tracking-wider">
            <Clock className="h-3 w-3" />
            Under Inspection
          </span>
        );
      case 'pending_inspection':
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wider">
            <Clock className="h-3 w-3" />
            Pending Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Harvest Batches & Production Registry
            </h1>
            <p className="text-sm text-slate-500">
              Track mobile-submitted harvest lots, physical warehouse locations, and quality certification.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              Export Harvest Ledger
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by batch reference (e.g. CRP-2026-RICE-000001), farmer, or parcel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-slate-50 py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#15803D] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#15803D] focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="pending_inspection">Pending Inspection</option>
              <option value="under_inspection">Under Inspection</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#15803D] focus:outline-none"
            >
              <option value="All">All Commodities</option>
              {crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Harvest Table */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E2E8F0] bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3.5 px-4">Batch Reference</th>
                  <th className="py-3.5 px-4">Commodity</th>
                  <th className="py-3.5 px-4">Producer & Farm</th>
                  <th className="py-3.5 px-4">Quantity</th>
                  <th className="py-3.5 px-4">Harvest Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Loading batches...
                    </td>
                  </tr>
                ) : filteredHarvests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No harvest batches found matching query.
                    </td>
                  </tr>
                ) : (
                  filteredHarvests.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900">{h.batch_reference}</div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                          <QrCode className="h-3 w-3" />
                          <span>QR Passport Active</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800">{h.crop?.name}</span>
                        <div className="text-[11px] text-slate-400">{h.crop?.category}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{h.farmer?.full_name}</div>
                        <div className="text-[11px] text-slate-400">{h.farm?.name}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 text-sm">
                          {h.quantity.toLocaleString()}
                        </span>{' '}
                        <span className="text-slate-500 font-normal">{h.unit}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {formatDate(h.harvest_date)}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(h.status)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/harvests/${h.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-semibold text-[#15803D] hover:bg-[#DCFCE7] transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Inspect Batch
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
