'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Search, MapPin, Phone, Users, Sprout, ArrowRight } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getCooperatives, getFarmers, getFarms } from '@/lib/api';
import { Cooperative, Farmer, Farm } from '@/types/database';

export default function CooperativesPage() {
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [c, f, fm] = await Promise.all([getCooperatives(), getFarmers(), getFarms()]);
        setCooperatives(c);
        setFarmers(f);
        setFarms(fm);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const getMemberCount = (coopId: string) => {
    return farmers.filter((f) => f.cooperative_id === coopId).length;
  };

  const filtered = cooperatives.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.county.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Agricultural Cooperatives & Farmer Unions
          </h1>
          <p className="text-sm text-slate-500">
            Certified smallholder producer cooperatives, central regional depots, and aggregated production hubs.
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search cooperative by name, code (e.g. NFMC-01), county..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#15803D] focus:outline-none shadow-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((coop) => {
            const memberCount = getMemberCount(coop.id);
            return (
              <div key={coop.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm hover:border-[#15803D] transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#DCFCE7] text-[#15803D]">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                    {coop.code}
                  </span>
                </div>

                <h3 className="mt-4 text-base font-bold text-slate-900">{coop.name}</h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {coop.district ? `${coop.district}, ` : ''}{coop.county} County
                </div>

                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Union Leader:</span>
                    <span className="font-semibold text-slate-800">{coop.contact_person || 'Executive Committee'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Phone Hotline:</span>
                    <span className="font-mono">{coop.contact_phone || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Central Warehouse:</span>
                    <span className="font-semibold text-emerald-800">{coop.address || 'Regional Depot'}</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-1 text-xs font-bold text-[#14532D]">
                    <Users className="h-4 w-4 text-[#15803D]" />
                    <span>{memberCount > 0 ? `${memberCount} Member Farmers` : 'Affiliated Members'}</span>
                  </div>
                  <span className="text-xs font-bold text-[#15803D] flex items-center gap-1 hover:underline">
                    View Registry <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
