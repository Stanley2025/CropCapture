'use client';

import React, { useState, useEffect } from 'react';
import { Navigation, MapPin, Calendar, RefreshCw } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getFarmActivities } from '@/lib/api';
import { FarmActivity } from '@/types/database';

export default function FieldVisitsPage() {
  const [visits, setVisits] = useState<FarmActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVisits = async () => {
    setLoading(true);
    try {
      const activities = await getFarmActivities();
      const inspectionsAndVisits = activities.filter(
        (a) =>
          a.activity_type.toLowerCase().includes('inspect') ||
          a.activity_type.toLowerCase().includes('visit')
      );
      setVisits(inspectionsAndVisits);
    } catch (e) {
      console.warn('Failed to load field visits:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVisits();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Extension Field Visits & Agronomic Observations
            </h1>
            <p className="text-sm text-slate-500">
              Live field reports, agronomic advisories, and inspections logged from mobile applications.
            </p>
          </div>
          <button
            onClick={loadVisits}
            disabled={loading}
            className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E2E8F0] bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3.5 px-4">Activity / Type</th>
                  <th className="py-3.5 px-4">Farmer & Farm Parcel</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Field Notes</th>
                  <th className="py-3.5 px-4 text-right">Sync Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Loading field visits...
                    </td>
                  </tr>
                ) : visits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      No field visits or inspections recorded yet. Field operations logged in the mobile app will appear here.
                    </td>
                  </tr>
                ) : (
                  visits.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{v.activity_type}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{v.farmer?.full_name || 'Registered Farmer'}</div>
                        <div className="text-[11px] text-slate-400">{v.farm?.name || 'Farm Parcel'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{v.activity_date}</td>
                      <td className="py-3.5 px-4 max-w-xs text-slate-600 truncate">{v.description}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="rounded-full bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 text-[10px] uppercase">
                          {v.sync_status || 'synced'}
                        </span>
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
