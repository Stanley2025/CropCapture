'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Filter,
  Plus,
  Eye,
  Building2,
  Phone,
  MapPin,
  Calendar,
  CheckCircle2,
  Download,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  X,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getFarmers, getCooperatives, updateFarmerStatus } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Farmer, Cooperative } from '@/types/database';
import { StatusToggle } from '@/components/ui/StatusToggle';
import { getCounties } from '@/lib/liberiaGeographicData';

export default function FarmersPage() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [search, setSearch] = useState('');
  const [countyFilter, setCountyFilter] = useState('All');
  const [coopFilter, setCoopFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Farmer | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [f, c] = await Promise.all([getFarmers(), getCooperatives()]);
        setFarmers(f);
        setCooperatives(c);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleToggleStatus = async (farmer: Farmer, newStatus: 'active' | 'disabled') => {
    setUpdatingId(farmer.id);
    try {
      const ok = await updateFarmerStatus(farmer.id, newStatus);
      if (ok) {
        setFarmers((prev) =>
          prev.map((f) => (f.id === farmer.id ? { ...f, status: newStatus } : f))
        );
        setFeedback({
          type: 'success',
          message: `Farmer "${farmer.full_name}" account successfully ${
            newStatus === 'disabled' ? 'disabled' : 'enabled'
          }.`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: `Failed to update status for ${farmer.full_name}. Please try again.`,
        });
      }
    } catch (e: any) {
      setFeedback({
        type: 'error',
        message: e?.message || 'An error occurred while updating status.',
      });
    } finally {
      setUpdatingId(null);
      setConfirmTarget(null);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const filteredFarmers = farmers.filter((farmer) => {
    const matchesSearch =
      farmer.full_name.toLowerCase().includes(search.toLowerCase()) ||
      farmer.farmer_id_code.toLowerCase().includes(search.toLowerCase()) ||
      farmer.community.toLowerCase().includes(search.toLowerCase());
    const matchesCounty = countyFilter === 'All' || farmer.county.toLowerCase() === countyFilter.toLowerCase();
    const matchesCoop = coopFilter === 'All' || farmer.cooperative_id === coopFilter;
    const isFarmerDisabled = farmer.status === 'disabled';
    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'active' ? !isFarmerDisabled : isFarmerDisabled);
    return matchesSearch && matchesCounty && matchesCoop && matchesStatus;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Farmer Directory & Profiles
            </h1>
            <p className="text-sm text-slate-500">
              Manage registered smallholders, cooperative affiliations, and national farmer passport credentials.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            <Link
              href="/farmers/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#15803D] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#14532D]"
            >
              <Plus className="h-3.5 w-3.5" />
              Register Farmer
            </Link>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`flex items-center justify-between rounded-xl border p-4 text-xs font-semibold ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-700" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by farmer name, ID code (e.g. FARM-LR-0082), community..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-slate-50 py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#15803D] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#15803D] focus:outline-none"
            >
              <option value="All">All Status</option>
              <option value="active">Active Accounts</option>
              <option value="disabled">Disabled Accounts</option>
            </select>

            <select
              value={countyFilter}
              onChange={(e) => setCountyFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#15803D] focus:outline-none"
            >
              <option value="All">All Counties (15)</option>
              {getCounties().map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={coopFilter}
              onChange={(e) => setCoopFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#15803D] focus:outline-none"
            >
              <option value="All">All Cooperatives</option>
              {cooperatives.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Farmer Table */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E2E8F0] bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Farmer Details</th>
                  <th className="py-3.5 px-4">Farmer ID Code</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Cooperative</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Registered Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Loading farmer directory...
                    </td>
                  </tr>
                ) : filteredFarmers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-700">No Farmers Found</p>
                      <p className="text-xs text-slate-400">Try adjusting your search criteria or register a new farmer.</p>
                    </td>
                  </tr>
                ) : (
                  filteredFarmers.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-full font-bold text-xs ${
                              f.status === 'disabled'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-[#DCFCE7] text-[#15803D]'
                            }`}
                          >
                            {f.full_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{f.full_name}</div>
                            <div className="text-slate-400 text-[11px]">{f.gender || 'Smallholder'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-[#14532D] bg-[#DCFCE7] px-2 py-0.5 rounded text-[11px]">
                          {f.farmer_id_code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>{f.community}, {f.district}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 pl-5">{f.county} County</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 text-slate-700">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{f.phone_number}</span>
                        </div>
                        {f.email && <div className="text-[11px] text-slate-400">{f.email}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        {f.cooperative ? (
                          <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-medium text-[11px]">
                            <Building2 className="h-3 w-3" />
                            {f.cooperative.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">Independent</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <StatusToggle
                            checked={f.status !== 'disabled'}
                            onChange={() => {
                              if (f.status === 'disabled') {
                                handleToggleStatus(f, 'active');
                              } else {
                                setConfirmTarget(f);
                              }
                            }}
                            disabled={updatingId === f.id}
                            size="sm"
                            ariaLabel={f.status === 'disabled' ? 'Enable farmer account' : 'Disable farmer account'}
                          />
                          <span
                            className={`text-[11px] font-bold ${
                              f.status === 'disabled' ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            {f.status === 'disabled' ? 'Disabled' : 'Active'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {formatDate(f.created_at)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/farmers/${f.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-semibold text-[#15803D] hover:bg-[#DCFCE7] transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Profile
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#E2E8F0] bg-slate-50 px-4 py-3 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {filteredFarmers.length} of {farmers.length} registered farmers</span>
            <span>Verified Liberian Agricultural Registry</span>
          </div>
        </div>

        {/* Confirmation Modal for Disabling */}
        {confirmTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-rose-100 p-2 text-rose-600 shrink-0">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Disable Farmer Account</h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Are you sure you want to disable the account for{' '}
                    <strong className="text-slate-900">{confirmTarget.full_name}</strong> ({confirmTarget.farmer_id_code})?
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Once disabled, this farmer will not be able to log in to CropCapture or submit harvest batches until re-enabled by an administrator.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  onClick={() => setConfirmTarget(null)}
                  disabled={updatingId === confirmTarget.id}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleToggleStatus(confirmTarget, 'disabled')}
                  disabled={updatingId === confirmTarget.id}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 shadow-sm transition disabled:opacity-50"
                >
                  {updatingId === confirmTarget.id ? 'Disabling...' : 'Confirm Disable'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
