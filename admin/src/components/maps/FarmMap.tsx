'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Layers, ExternalLink } from 'lucide-react';
import { MOCK_FARMS } from '@/lib/mockData';
import { Farm } from '@/types/database';

export default function FarmMap() {
  const [selectedFarm, setSelectedFarm] = useState<Farm>(MOCK_FARMS[0]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Map Display Container */}
      <div className="relative rounded-2xl border border-[#E2E8F0] bg-slate-900 overflow-hidden shadow-sm lg:col-span-2 h-[550px] flex flex-col justify-between p-6 text-white">
        {/* Background Visual Cartography */}
        <div className="absolute inset-0 bg-[radial-gradient(#15803D_1px,transparent_1px)] [background-size:32px_32px] opacity-20" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-lg bg-slate-900/80 backdrop-blur px-3 py-1.5 border border-slate-700 text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Liberia National GPS Coordinates (WGS84)</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Zoom: 7.2 | Center: Monrovia / Nimba</span>
        </div>

        {/* Pin Points on Map Layout */}
        <div className="relative z-10 my-auto flex flex-wrap items-center justify-around gap-6">
          {MOCK_FARMS.map((farm) => {
            const isSelected = selectedFarm.id === farm.id;
            return (
              <button
                key={farm.id}
                onClick={() => setSelectedFarm(farm)}
                className={`group flex items-center gap-2.5 rounded-xl border p-3.5 transition-all text-left shadow-lg ${
                  isSelected
                    ? 'border-[#22C55E] bg-[#14532D] ring-2 ring-[#22C55E]/40'
                    : 'border-slate-700 bg-slate-800/90 hover:border-slate-500'
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    isSelected ? 'bg-[#22C55E] text-[#052E16]' : 'bg-slate-700 text-emerald-400'
                  }`}
                >
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{farm.name}</div>
                  <div className="text-[11px] text-slate-300">
                    {farm.county} • {farm.size} acres
                  </div>
                  {farm.latitude && farm.longitude && (
                    <div className="font-mono text-[10px] text-emerald-400 mt-0.5">
                      {farm.latitude.toFixed(4)}°N, {Math.abs(farm.longitude).toFixed(4)}°W
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800 pt-3">
          <span>Cartographic projection: EPSG:4326</span>
          <span>4 Verified Parcels Selected</span>
        </div>
      </div>

      {/* Selected Farm Information Card */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="rounded bg-[#DCFCE7] px-2.5 py-0.5 text-xs font-bold text-[#14532D]">
              {selectedFarm.county} County
            </span>
            <span className="font-mono text-xs font-bold text-slate-500">
              {selectedFarm.size} {selectedFarm.size_unit}
            </span>
          </div>

          <h2 className="mt-4 text-xl font-bold text-slate-900">{selectedFarm.name}</h2>
          <p className="text-xs text-slate-500 mt-1">
            Community: {selectedFarm.community}, {selectedFarm.district} District
          </p>

          <p className="mt-4 text-xs text-slate-600 leading-relaxed">
            {selectedFarm.description}
          </p>

          <div className="mt-6 space-y-3 border-t border-slate-100 pt-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Land Tenure:</span>
              <span className="font-semibold text-slate-800">{selectedFarm.ownership_type}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Soil Classification:</span>
              <span className="font-semibold text-slate-800">{selectedFarm.soil_type}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Irrigation Structure:</span>
              <span className="font-semibold text-emerald-700">
                {selectedFarm.irrigation ? 'Yes (Canal / Bunded)' : 'No (Rainfed)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Latitude / Longitude:</span>
              <span className="font-mono text-slate-700 font-semibold">
                {selectedFarm.latitude}°N, {selectedFarm.longitude}°W
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${selectedFarm.latitude},${selectedFarm.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#15803D] py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#14532D]"
          >
            <span>Open in Satellite Maps</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
