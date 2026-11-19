'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, UserCheck, Shield, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getHarvestBatches } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { HarvestBatch } from '@/types/database';

const AVAILABLE_INSPECTORS = [
  { id: 'p-insp-001', name: 'Jonathan K. Kollie', code: 'INSP-LR-0019', county: 'Nimba & Bong' },
  { id: 'p-insp-002', name: 'Beatrice M. Toe', code: 'INSP-LR-0024', county: 'Lofa County' },
  { id: 'p-insp-003', name: 'Gabriel T. Freeman', code: 'INSP-LR-0031', county: 'Margibi & Montserrado' },
];

export default function InspectorAssignmentsPage() {
  const [batches, setBatches] = useState<HarvestBatch[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getHarvestBatches();
        setBatches(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleAssign = (batchId: string, inspectorId: string) => {
    setAssignments((prev) => ({ ...prev, [batchId]: inspectorId }));
    const inspector = AVAILABLE_INSPECTORS.find((i) => i.id === inspectorId);
    setSuccessMsg(`Inspector ${inspector?.name} successfully assigned to batch.`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Link
          href="/quality"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quality Bureau
        </Link>

        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Inspector Assignment Command
          </h1>
          <p className="text-sm text-slate-500">
            Dispatch authorized quality inspectors to smallholder warehouses for physical sampling and grading.
          </p>
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-[#15803D]" />
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Batches Queue */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-base font-bold text-slate-900 mb-4">Harvest Batches Requiring Inspection</h2>
            <div className="divide-y divide-slate-100">
              {batches.map((batch) => {
                const assignedInspectorId = assignments[batch.id];
                const assignedInspector = AVAILABLE_INSPECTORS.find((i) => i.id === assignedInspectorId);

                return (
                  <div key={batch.id} className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs">
                    <div>
                      <div className="font-mono font-bold text-slate-900">{batch.batch_reference}</div>
                      <div className="text-slate-600 mt-1">
                        Commodity: <span className="font-semibold text-slate-900">{batch.crop?.name}</span> ({batch.quantity} {batch.unit})
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        Producer: {batch.farmer?.full_name} • Storage: {batch.storage_location || 'Central Depot'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={assignedInspectorId || ''}
                        onChange={(e) => handleAssign(batch.id, e.target.value)}
                        className="rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-[#15803D] focus:outline-none"
                      >
                        <option value="">Select Inspector...</option>
                        {AVAILABLE_INSPECTORS.map((insp) => (
                          <option key={insp.id} value={insp.id}>
                            {insp.name} ({insp.code})
                          </option>
                        ))}
                      </select>

                      {assignedInspector && (
                        <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-1 text-[10px] font-bold uppercase">
                          Dispatched
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Available Quality Inspectors Pool */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-3">Available Inspectors</h2>
            <div className="space-y-3">
              {AVAILABLE_INSPECTORS.map((insp) => (
                <div key={insp.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{insp.name}</span>
                    <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                      {insp.code}
                    </span>
                  </div>
                  <div className="text-slate-500 mt-1">Jurisdiction: {insp.county}</div>
                  <div className="mt-2 flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Available for dispatch
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
