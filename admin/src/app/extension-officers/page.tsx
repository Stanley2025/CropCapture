'use client';

import React, { useState, useEffect } from 'react';
import { Compass, Users, MapPin, Phone, RefreshCw } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getProfiles } from '@/lib/api';
import { Profile } from '@/types/database';

export default function ExtensionOfficersPage() {
  const [officers, setOfficers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOfficers = async () => {
    setLoading(true);
    try {
      const profiles = await getProfiles();
      const extOfficers = profiles.filter((p) => p.role === 'extension_officer');
      setOfficers(extOfficers);
    } catch (e) {
      console.warn('Failed to load extension officers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOfficers();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Agricultural Extension Officers & Field Agents
            </h1>
            <p className="text-sm text-slate-500">
              Live records of extension officers deployed across counties and cooperatives.
            </p>
          </div>
          <button
            onClick={loadOfficers}
            disabled={loading}
            className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-2xl border border-slate-200 bg-white p-6 animate-pulse" />
            ))}
          </div>
        ) : officers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <Compass className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Extension Officers Registered</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Extension officers created in the system or registered via the mobile application will automatically appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {officers.map((officer) => (
              <div key={officer.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-800 font-bold">
                    <Compass className="h-6 w-6" />
                  </div>
                  <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                    EXTENSION
                  </span>
                </div>

                <h3 className="mt-4 text-base font-bold text-slate-900">{officer.full_name}</h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {officer.district || 'Central District'}, {officer.county || 'Nimba'}
                </div>
                {officer.phone && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {officer.phone}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
