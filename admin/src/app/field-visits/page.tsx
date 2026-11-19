'use client';

import React from 'react';
import { Navigation, MapPin, Calendar, User, CheckCircle2 } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';

const MOCK_VISITS = [
  {
    id: 'v-01',
    officer: 'Kebbeh Flomo',
    farmer: 'Sarah K. Cooper',
    farm: 'Gbehley Swamp Farm',
    date: '2026-08-04',
    observations: 'Tillering stage lowland rice. Recommended water level maintenance and second weeding along bunds.',
    recommendation: 'Clear irrigation feeder canal to maintain 5cm water depth.',
    status: 'completed',
  },
  {
    id: 'v-02',
    officer: 'Moses K. Zondo',
    farmer: 'Emmanuel B. Dennis',
    farm: 'Phebe Alluvial Fields',
    date: '2026-08-10',
    observations: 'Minor stem borer observed on edge plots. Advised botanical neem leaf extract application.',
    recommendation: 'Apply organic neem spray within 48 hours to prevent larva penetration.',
    status: 'completed',
  },
];

export default function FieldVisitsPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Extension Field Visits & Agronomic Observations
          </h1>
          <p className="text-sm text-slate-500">
            Field reports, pest and disease alerts, and technical recommendations issued to smallholder farmers.
          </p>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E2E8F0] bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3.5 px-4">Officer</th>
                  <th className="py-3.5 px-4">Farmer & Farm Parcel</th>
                  <th className="py-3.5 px-4">Visit Date</th>
                  <th className="py-3.5 px-4">Field Observations</th>
                  <th className="py-3.5 px-4">Technical Advisory</th>
                  <th className="py-3.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {MOCK_VISITS.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{v.officer}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{v.farmer}</div>
                      <div className="text-[11px] text-slate-400">{v.farm}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{v.date}</td>
                    <td className="py-3.5 px-4 max-w-xs text-slate-600 truncate">{v.observations}</td>
                    <td className="py-3.5 px-4 max-w-xs text-emerald-800 font-medium truncate">{v.recommendation}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="rounded-full bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 text-[10px] uppercase">
                        {v.status}
                      </span>
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
