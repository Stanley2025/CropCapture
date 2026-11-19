'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Users,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Layers,
  Package,
  ExternalLink,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getCooperatives, getFarmers } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Cooperative, Farmer } from '@/types/database';

export default function CooperativeDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [coop, setCoop] = useState<Cooperative | null>(null);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const [coops, allFarmers] = await Promise.all([
          getCooperatives(),
          getFarmers(),
        ]);
        const currentCoop = coops.find((c) => c.id === id) || coops[0];
        setCoop(currentCoop);
        setFarmers(allFarmers.filter((f) => f.cooperative_id === currentCoop?.id));
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

  if (!coop) {
    return (
      <AdminLayout>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
          Cooperative record not found.
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <Link
            href="/cooperatives"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#15803D] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Cooperatives
          </Link>
        </div>

        {/* Header Card */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#DCFCE7] text-[#15803D] shadow-inner">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#1E293B]">{coop.name}</h1>
                <p className="text-sm text-[#64748B]">
                  Registration Code: <span className="font-mono font-semibold text-[#1E293B]">{coop.code || coop.registration_number || coop.id.substring(0, 8)}</span>
                </p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-[#15803D] border border-emerald-200">
              {(coop.status || 'Active').toUpperCase()}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#E2E8F0] pt-6 sm:grid-cols-4">
            <div>
              <span className="text-xs font-medium text-[#64748B]">County / District</span>
              <p className="mt-1 font-semibold text-[#1E293B]">
                {coop.county}, {coop.district || 'Main District'}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-[#64748B]">Affiliated Members</span>
              <p className="mt-1 text-lg font-bold text-[#15803D]">{coop.member_count ?? farmers.length} Farmers</p>
            </div>
            <div>
              <span className="text-xs font-medium text-[#64748B]">Contact Phone</span>
              <p className="mt-1 font-semibold text-[#1E293B]">{coop.contact_phone || 'None'}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-[#64748B]">Official Email</span>
              <p className="mt-1 font-semibold text-[#1E293B]">{coop.contact_email || 'info@agritrack.gov.lr'}</p>
            </div>
          </div>
        </div>

        {/* Member Farmers Table */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#E2E8F0] px-6 py-4">
            <h2 className="text-base font-bold text-[#1E293B]">Registered Member Farmers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B]">
                <tr>
                  <th className="px-6 py-3 font-semibold">Farmer ID</th>
                  <th className="px-6 py-3 font-semibold">Full Name</th>
                  <th className="px-6 py-3 font-semibold">Community</th>
                  <th className="px-6 py-3 font-semibold">Phone</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {farmers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-6 text-center text-[#64748B]">
                      No farmers affiliated to this cooperative yet.
                    </td>
                  </tr>
                ) : (
                  farmers.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono font-bold text-[#1E293B]">
                        {f.farmer_id_code || f.id_number || f.id.substring(0, 8)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-[#1E293B]">{f.full_name}</td>
                      <td className="px-6 py-4 text-[#64748B]">{f.community}</td>
                      <td className="px-6 py-4 text-[#64748B]">{f.phone_number || f.phone || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-[#15803D]">
                          {(f.status || 'Active').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/farmers/${f.id}`}
                          className="font-semibold text-[#15803D] hover:underline"
                        >
                          View Passport
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
