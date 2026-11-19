'use client';

import React from 'react';
import { ShieldCheck, Check, X, Lock, Users, ShieldAlert } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';

interface PermissionMatrixRow {
  module: string;
  superAdmin: boolean;
  agriAdmin: boolean;
  farmerOfficer: boolean;
  qualityManager: boolean;
  extensionCoord: boolean;
  coopAdmin: boolean;
  reportViewer: boolean;
}

const PERMISSION_ROWS: PermissionMatrixRow[] = [
  { module: 'Farmer Registry (View)', superAdmin: true, agriAdmin: true, farmerOfficer: true, qualityManager: true, extensionCoord: true, coopAdmin: true, reportViewer: true },
  { module: 'Farmer Registry (Create / Edit)', superAdmin: true, agriAdmin: true, farmerOfficer: true, qualityManager: false, extensionCoord: true, coopAdmin: false, reportViewer: false },
  { module: 'Farm Cadastral & GPS Updates', superAdmin: true, agriAdmin: true, farmerOfficer: true, qualityManager: false, extensionCoord: true, coopAdmin: false, reportViewer: false },
  { module: 'Crop & Variety Management', superAdmin: true, agriAdmin: true, farmerOfficer: false, qualityManager: false, extensionCoord: false, coopAdmin: false, reportViewer: false },
  { module: 'Harvest Batches (View & Trace)', superAdmin: true, agriAdmin: true, farmerOfficer: true, qualityManager: true, extensionCoord: true, coopAdmin: true, reportViewer: true },
  { module: 'Quality Inspection (Perform & Decide)', superAdmin: true, agriAdmin: true, farmerOfficer: false, qualityManager: true, extensionCoord: false, coopAdmin: false, reportViewer: false },
  { module: 'Issue Digital Traceability Passes', superAdmin: true, agriAdmin: true, farmerOfficer: false, qualityManager: true, extensionCoord: false, coopAdmin: false, reportViewer: false },
  { module: 'Cooperative Registry Management', superAdmin: true, agriAdmin: true, farmerOfficer: false, qualityManager: false, extensionCoord: false, coopAdmin: true, reportViewer: false },
  { module: 'Field Extension Logs & Visits', superAdmin: true, agriAdmin: true, farmerOfficer: false, qualityManager: false, extensionCoord: true, coopAdmin: false, reportViewer: false },
  { module: 'System Users & Role Grants', superAdmin: true, agriAdmin: false, farmerOfficer: false, qualityManager: false, extensionCoord: false, coopAdmin: false, reportViewer: false },
  { module: 'Audit Log & Security Trail Inspection', superAdmin: true, agriAdmin: true, farmerOfficer: false, qualityManager: false, extensionCoord: false, coopAdmin: false, reportViewer: false },
  { module: 'Regulatory Reports Export (CSV / PDF)', superAdmin: true, agriAdmin: true, farmerOfficer: true, qualityManager: true, extensionCoord: true, coopAdmin: true, reportViewer: true },
];

export default function RolesPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Role-Based Access Control (RBAC) Matrix
          </h1>
          <p className="text-sm text-[#64748B]">
            Granular administrative and field staff permission configurations enforced via PostgreSQL Row-Level Security (RLS).
          </p>
        </div>

        {/* Roles Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-5 shadow-sm">
            <span className="inline-flex rounded-md bg-purple-100 p-2 text-purple-700">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-sm font-bold text-purple-900">Super Administrator</h2>
            <p className="mt-1 text-xs text-purple-700">
              Unrestricted national access, system configuration, RBAC delegation, and master cryptographic key management.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
            <span className="inline-flex rounded-md bg-[#DCFCE7] p-2 text-[#15803D]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-sm font-bold text-emerald-950">Agricultural Admin</h2>
            <p className="mt-1 text-xs text-emerald-800">
              Ministry of Agriculture oversight, crop standards, production analytics, and national harvest approvals.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
            <span className="inline-flex rounded-md bg-blue-100 p-2 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-sm font-bold text-blue-950">Quality Inspector</h2>
            <p className="mt-1 text-xs text-blue-800">
              Batch grading, lab moisture and foreign matter assessments, lot disposition, and digital certification.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
            <span className="inline-flex rounded-md bg-amber-100 p-2 text-amber-700">
              <Users className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-sm font-bold text-amber-950">Extension Coordinator</h2>
            <p className="mt-1 text-xs text-amber-800">
              County and district agent coordination, training programs, field visit validation, and farmer assistance.
            </p>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#E2E8F0] bg-slate-50/50 px-6 py-4">
            <h3 className="text-sm font-bold text-[#1E293B]">Permission Enforcement Table</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B]">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">System Capability</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Super Admin</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Agri Admin</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Farmer Officer</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Quality Mgr</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Ext Coord</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Co-op Admin</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Viewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {PERMISSION_ROWS.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-semibold text-[#1E293B]">{row.module}</td>
                    <td className="px-4 py-3 text-center">{renderCheck(row.superAdmin)}</td>
                    <td className="px-4 py-3 text-center">{renderCheck(row.agriAdmin)}</td>
                    <td className="px-4 py-3 text-center">{renderCheck(row.farmerOfficer)}</td>
                    <td className="px-4 py-3 text-center">{renderCheck(row.qualityManager)}</td>
                    <td className="px-4 py-3 text-center">{renderCheck(row.extensionCoord)}</td>
                    <td className="px-4 py-3 text-center">{renderCheck(row.coopAdmin)}</td>
                    <td className="px-4 py-3 text-center">{renderCheck(row.reportViewer)}</td>
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

function renderCheck(allowed: boolean) {
  if (allowed) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D]">
        <Check className="h-3.5 w-3.5 stroke-[3]" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-300">
      <X className="h-3.5 w-3.5 stroke-[2]" />
    </span>
  );
}
