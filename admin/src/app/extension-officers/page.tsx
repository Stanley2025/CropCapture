'use client';

import React from 'react';
import { Compass, Users, MapPin, Phone, CheckCircle2, Calendar, Navigation } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';

const MOCK_OFFICERS = [
  {
    id: 'ext-01',
    name: 'Kebbeh Flomo',
    code: 'EXT-LR-0042',
    county: 'Nimba County',
    district: 'Sanniquellie-Mahn',
    phone: '+231-77-512-9901',
    assignedFarmers: 42,
    completedVisits: 18,
    activeAdvisories: 4,
    status: 'active',
  },
  {
    id: 'ext-02',
    name: 'Moses K. Zondo',
    code: 'EXT-LR-0048',
    county: 'Bong County',
    district: 'Suakoko & Jorquelleh',
    phone: '+231-88-612-4433',
    assignedFarmers: 35,
    completedVisits: 14,
    activeAdvisories: 2,
    status: 'active',
  },
  {
    id: 'ext-03',
    name: 'Helena B. Cole',
    code: 'EXT-LR-0055',
    county: 'Lofa County',
    district: 'Voinjama & Foya',
    phone: '+231-77-802-1144',
    assignedFarmers: 29,
    completedVisits: 12,
    activeAdvisories: 3,
    status: 'active',
  },
];

export default function ExtensionOfficersPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Agricultural Extension Officers & Field Agents
          </h1>
          <p className="text-sm text-slate-500">
            Monitor assigned agricultural agents, agronomic advisory dispatch, and smallholder farm parcel visits.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {MOCK_OFFICERS.map((officer) => (
            <div key={officer.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-800 font-bold">
                  <Compass className="h-6 w-6" />
                </div>
                <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                  {officer.code}
                </span>
              </div>

              <h3 className="mt-4 text-base font-bold text-slate-900">{officer.name}</h3>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {officer.district}, {officer.county}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                {officer.phone}
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-sm font-bold text-slate-900">{officer.assignedFarmers}</div>
                  <div className="text-[10px] text-slate-500">Farmers</div>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2">
                  <div className="text-sm font-bold text-emerald-800">{officer.completedVisits}</div>
                  <div className="text-[10px] text-emerald-700">Visits</div>
                </div>
                <div className="rounded-lg bg-amber-50 p-2">
                  <div className="text-sm font-bold text-amber-800">{officer.activeAdvisories}</div>
                  <div className="text-[10px] text-amber-700">Advisories</div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Active in Field
                </span>
                <span className="font-bold text-[#15803D] hover:underline cursor-pointer">
                  View Visits →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
