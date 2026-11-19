'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  X,
  MoreVertical,
  UserPlus,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getProfiles } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Profile, UserRole } from '@/types/database';

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'agricultural_admin' as UserRole,
    county: 'Montserrado',
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getProfiles();
        setUsers(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: Profile = {
      id: `p-${Date.now()}`,
      full_name: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      role: formData.role,
      county: formData.county,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setUsers([newUser, ...users]);
    setInviteSuccess(true);
    setTimeout(() => {
      setInviteSuccess(false);
      setShowInviteModal(false);
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        role: 'agricultural_admin',
        county: 'Montserrado',
      });
    }, 1500);
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
      (u.phone && u.phone.includes(search));
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">Super Admin</span>;
      case 'agricultural_admin':
        return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-[#15803D] border border-emerald-200">Agricultural Admin</span>;
      case 'quality_inspector':
        return <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">Quality Inspector</span>;
      case 'extension_officer':
        return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">Extension Officer</span>;
      case 'cooperative_manager':
        return <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-800 border border-cyan-200">Co-op Manager</span>;
      default:
        return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{role}</span>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
              Administrative & Field Staff Users
            </h1>
            <p className="text-sm text-[#64748B]">
              Manage authorized personnel, role permissions, and administrative access privileges.
            </p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#15803D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#14532D] transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Invite System User
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search by staff name, email, or telephone number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 pl-9 pr-4 text-xs text-[#1E293B] placeholder-[#64748B] focus:border-[#15803D] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#15803D]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#64748B]" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-medium text-[#1E293B] focus:border-[#15803D] focus:outline-none"
            >
              <option value="All">All System Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="agricultural_admin">Agricultural Admin</option>
              <option value="quality_inspector">Quality Inspector</option>
              <option value="extension_officer">Extension Officer</option>
              <option value="cooperative_manager">Cooperative Manager</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B]">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">User Details</th>
                  <th className="px-6 py-3.5 font-semibold">System Role</th>
                  <th className="px-6 py-3.5 font-semibold">Assigned County</th>
                  <th className="px-6 py-3.5 font-semibold">Contact Info</th>
                  <th className="px-6 py-3.5 font-semibold">Status</th>
                  <th className="px-6 py-3.5 font-semibold">Registered</th>
                  <th className="px-6 py-3.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-[#64748B]">
                      Loading system accounts...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-[#64748B]">
                      No system users matched the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 font-bold text-[#15803D]">
                            {user.full_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-[#1E293B]">{user.full_name}</div>
                            <div className="text-[11px] text-[#64748B]">{user.email || 'No email registered'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                      <td className="px-6 py-4 font-medium text-[#1E293B]">
                        {user.county || 'National HQ (All)'}
                      </td>
                      <td className="px-6 py-4 text-[#64748B]">
                        <div className="flex flex-col gap-0.5">
                          <span>{user.phone || '—'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[#64748B]">{formatDate(user.created_at)}</td>
                      <td className="px-6 py-4">
                        <button className="text-xs font-semibold text-[#15803D] hover:underline">
                          Edit Access
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Invite User */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-[#1E293B]">Invite Staff / Administrator</h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {inviteSuccess ? (
                <div className="my-8 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-[#15803D] animate-bounce" />
                  <p className="mt-2 text-sm font-bold text-[#1E293B]">User Invited Successfully!</p>
                  <p className="text-xs text-[#64748B]">Invitation email dispatched with setup instructions.</p>
                </div>
              ) : (
                <form onSubmit={handleInviteSubmit} className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-[#1E293B]">Full Name</label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="e.g. Marie Dennis"
                      className="mt-1 w-full rounded-xl border border-[#E2E8F0] p-2.5 text-xs text-[#1E293B] focus:border-[#15803D] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#1E293B]">Official Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. mdennis@agritrack.gov.lr"
                      className="mt-1 w-full rounded-xl border border-[#E2E8F0] p-2.5 text-xs text-[#1E293B] focus:border-[#15803D] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#1E293B]">Phone Number</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+231-77-..."
                      className="mt-1 w-full rounded-xl border border-[#E2E8F0] p-2.5 text-xs text-[#1E293B] focus:border-[#15803D] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#1E293B]">Assigned Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                      className="mt-1 w-full rounded-xl border border-[#E2E8F0] p-2.5 text-xs text-[#1E293B] focus:border-[#15803D] focus:outline-none"
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="agricultural_admin">Agricultural Administrator</option>
                      <option value="quality_inspector">Quality Inspector</option>
                      <option value="extension_officer">Extension Officer</option>
                      <option value="cooperative_manager">Cooperative Manager</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#1E293B]">Operating County</label>
                    <select
                      value={formData.county}
                      onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-[#E2E8F0] p-2.5 text-xs text-[#1E293B] focus:border-[#15803D] focus:outline-none"
                    >
                      <option value="Montserrado">Montserrado</option>
                      <option value="Nimba">Nimba</option>
                      <option value="Bong">Bong</option>
                      <option value="Lofa">Lofa</option>
                      <option value="Margibi">Margibi</option>
                      <option value="Grand Bassa">Grand Bassa</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-[#15803D] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#14532D]"
                    >
                      Send Official Invite
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
