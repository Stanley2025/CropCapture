'use client';

import React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import FarmMap from '@/components/maps/FarmMap';
import { Map, Layers, Navigation, Info } from 'lucide-react';

export default function MapsPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
              Geographic Farm Map & Cadastral Boundaries
            </h1>
            <p className="text-sm text-[#64748B]">
              WGS84 GPS coordinate mapping and spatial distribution across Liberia's 15 counties.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#1E293B] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Cadastral Stream
            </span>
          </div>
        </div>

        {/* Informational banner */}
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-[#DCFCE7]/40 p-4 text-xs text-emerald-950">
          <Info className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" />
          <div>
            <span className="font-semibold text-emerald-900">National Cadastral Layer: </span>
            Coordinates recorded in field surveys via the mobile application (NMEA-0183 & High-Precision GPS)
            are displayed below. Coordinates adhere strictly to Liberia's territorial boundary and the WGS84 ellipsoid.
          </div>
        </div>

        {/* Map Component */}
        <FarmMap />
      </div>
    </AdminLayout>
  );
}
