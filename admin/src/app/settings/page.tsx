'use client';

import React, { useState } from 'react';
import {
  Sliders,
  Database,
  Shield,
  Layers,
  Save,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  Scale,
  Building,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    platformName: 'AgriTrack Liberia',
    tagline: 'Every Farm Recorded. Every Harvest Measured. Every Quality Verified.',
    maxRiceMoisture: 13.0,
    maxCocoaMoisture: 7.5,
    maxCoffeeMoisture: 12.0,
    syncConflictPolicy: 'latest_timestamp_wins',
    storageBucket: 'agritrack-public',
    enforceGPSPrecision: true,
    maxGPSVarianceMeters: 5.0,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
              System Configuration & National Reference Standards
            </h1>
            <p className="text-sm text-[#64748B]">
              Configure Ministry commodity quality thresholds, storage bucket policies, and sync resolution parameters.
            </p>
          </div>
          {saved && (
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-[#15803D] border border-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              Settings Saved Successfully
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Commodity Standards */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Scale className="h-5 w-5 text-[#15803D]" />
              <h2 className="text-sm font-bold text-[#1E293B]">National Agricultural Commodity Quality Thresholds</h2>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-[#1E293B]">
                  Max Allowable Rice Moisture (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.maxRiceMoisture}
                  onChange={(e) => setSettings({ ...settings, maxRiceMoisture: parseFloat(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] p-2.5 text-xs font-medium text-[#1E293B] focus:border-[#15803D] focus:outline-none"
                />
                <span className="text-[11px] text-[#64748B]">CARI Baseline: 13.0%</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#1E293B]">
                  Max Allowable Cocoa Moisture (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.maxCocoaMoisture}
                  onChange={(e) => setSettings({ ...settings, maxCocoaMoisture: parseFloat(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] p-2.5 text-xs font-medium text-[#1E293B] focus:border-[#15803D] focus:outline-none"
                />
                <span className="text-[11px] text-[#64748B]">Export Grade A: &le; 7.5%</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#1E293B]">
                  Max Allowable Coffee Moisture (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.maxCoffeeMoisture}
                  onChange={(e) => setSettings({ ...settings, maxCoffeeMoisture: parseFloat(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] p-2.5 text-xs font-medium text-[#1E293B] focus:border-[#15803D] focus:outline-none"
                />
                <span className="text-[11px] text-[#64748B]">Standard: &le; 12.0%</span>
              </div>
            </div>
          </div>

          {/* Offline Sync & Conflict Resolution */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <RefreshCw className="h-5 w-5 text-[#15803D]" />
              <h2 className="text-sm font-bold text-[#1E293B]">Field Node Offline Sync & Conflict Policy</h2>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-[#1E293B]">
                  Distributed Conflict Resolution Strategy
                </label>
                <select
                  value={settings.syncConflictPolicy}
                  onChange={(e) => setSettings({ ...settings, syncConflictPolicy: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] p-2.5 text-xs font-medium text-[#1E293B] focus:border-[#15803D] focus:outline-none"
                >
                  <option value="latest_timestamp_wins">Latest Timestamp Wins (CRDT LWW)</option>
                  <option value="server_wins">Central Server Authority Wins</option>
                  <option value="manual_review">Flag for Manual Administrative Review</option>
                </select>
                <span className="text-[11px] text-[#64748B]">Enforced during mobile app batch synchronization.</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#1E293B]">
                  Maximum GPS Fix Variance (Meters)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.maxGPSVarianceMeters}
                  onChange={(e) => setSettings({ ...settings, maxGPSVarianceMeters: parseFloat(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] p-2.5 text-xs font-medium text-[#1E293B] focus:border-[#15803D] focus:outline-none"
                />
                <span className="text-[11px] text-[#64748B]">Rejects cadastral boundary points with precision &gt; 5.0m.</span>
              </div>
            </div>
          </div>

          {/* Storage & Supabase Cloud */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <HardDrive className="h-5 w-5 text-[#15803D]" />
              <h2 className="text-sm font-bold text-[#1E293B]">Supabase Storage & Assets Configuration</h2>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[#64748B]">Target Storage Bucket</span>
                <span className="font-mono font-semibold text-[#1E293B]">{settings.storageBucket}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[#64748B]">Farmer Avatar Path</span>
                <span className="font-mono text-[#1E293B]">avatars/{"{farmer_id}"}.jpg</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[#64748B]">Farm Cadastral Evidence Path</span>
                <span className="font-mono text-[#1E293B]">farms/{"{farm_id}"}/boundary.geojson</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Batch Traceability Certificates</span>
                <span className="font-mono text-[#1E293B]">certificates/{"{batch_code}"}.pdf</span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#15803D] px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#14532D] transition-colors"
            >
              <Save className="h-4 w-4" />
              Save Platform Configuration
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
