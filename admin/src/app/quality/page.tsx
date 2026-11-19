'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  FileCheck,
  UserCheck,
  Eye,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getQualityInspections, getHarvestBatches } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { QualityInspection, HarvestBatch } from '@/types/database';

export default function QualityManagementPage() {
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [harvests, setHarvests] = useState<HarvestBatch[]>([]);
  const [gradeFilter, setGradeFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [q, h] = await Promise.all([getQualityInspections(), getHarvestBatches()]);
        setInspections(q);
        setHarvests(h);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const pendingBatches = harvests.filter(
    (h) => h.status === 'submitted' || h.status === 'pending_inspection' || h.status === 'under_inspection'
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              National Quality Management & Grading Bureau
            </h1>
            <p className="text-sm text-slate-500">
              Verify laboratory & visual standards, assign field inspectors, and enforce national agricultural grading.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/quality/assignments"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#15803D] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#14532D]"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Assign Inspectors ({pendingBatches.length})
            </Link>
          </div>
        </div>

        {/* Quality Metrics Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Completed Inspections</span>
              <FileCheck className="h-4 w-4 text-[#15803D]" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{inspections.length}</div>
            <div className="text-[11px] text-slate-400 mt-1">Verified lab records</div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Awaiting Inspection</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-amber-700">{pendingBatches.length}</div>
            <div className="text-[11px] text-slate-400 mt-1">Queued for grading</div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Grade A Certified</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-800">
              {inspections.filter((i) => i.final_grade === 'grade_a').length}
            </div>
            <div className="text-[11px] text-emerald-700 mt-1">Export quality benchmark</div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">National Standards</span>
              <Sliders className="h-4 w-4 text-slate-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">4 Active</div>
            <div className="text-[11px] text-slate-400 mt-1">Rice, Cassava, Cocoa, Pepper</div>
          </div>
        </div>

        {/* Inspection Ledger */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#E2E8F0] p-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Quality Inspection Decisions</h2>
            <span className="text-xs text-slate-500">Ministry of Agriculture Standard Operating Procedure</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E2E8F0] bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3 px-4">Harvest Batch Reference</th>
                  <th className="py-3 px-4">Commodity</th>
                  <th className="py-3 px-4">Assigned Inspector</th>
                  <th className="py-3 px-4">Inspection Date</th>
                  <th className="py-3 px-4">Assigned Grade</th>
                  <th className="py-3 px-4">Evaluation Observations</th>
                  <th className="py-3 px-4 text-right">Certificate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {inspections.map((qi) => (
                  <tr key={qi.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {qi.batch?.batch_reference}
                    </td>
                    <td className="py-3.5 px-4 font-semibold">{qi.batch?.crop?.name}</td>
                    <td className="py-3.5 px-4 text-slate-600">Inspector J. Kollie</td>
                    <td className="py-3.5 px-4 text-slate-500">{formatDate(qi.inspection_date)}</td>
                    <td className="py-3.5 px-4">
                      <span className="rounded-full bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 text-[11px] uppercase tracking-wider">
                        {qi.final_grade.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-sm truncate text-slate-600">
                      {qi.observations}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => alert(`Certificate of Quality Inspection:\nBatch: ${qi.batch?.batch_reference}\nGrade: ${qi.final_grade.toUpperCase()}\nStatus: APPROVED FOR COMMERCIAL DISTRIBUTION`)}
                        className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] px-2 py-1 text-xs font-semibold text-[#15803D] hover:bg-emerald-50"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        Verify
                      </button>
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
