'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Search,
  Menu,
  LogOut,
  User,
  Shield,
} from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export function Header({ onOpenMobile }: { onOpenMobile?: () => void }) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.error('Sign out error:', e);
    } finally {
      document.cookie = 'agritrack_admin_session=; path=/; max-age=0;';
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between bg-[#F7F5EE] px-4 md:px-8">
      {/* Left: Mobile trigger & Global Search */}
      <div className="flex items-center gap-3">
        {onOpenMobile && (
          <button
            onClick={onOpenMobile}
            className="rounded-lg p-2 text-slate-600 hover:bg-[#EDE8DC] lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="relative hidden w-72 sm:block md:w-96">
          <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search farmers, farms, batches"
            className="w-full rounded-full bg-[#EAE6DB] border-0 py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#15803D]"
          />
        </div>
      </div>

      {/* Right: Registry pill, Notifications & User profile */}
      <div className="flex items-center gap-4">
        {/* Environment Badge */}
        <div className="hidden items-center rounded-full bg-[#E5F2DC] border border-[#CDE3BF] px-3.5 py-1.5 text-xs font-semibold text-[#1C3822] sm:flex">
          Liberia National Registry
        </div>

        {/* Notifications Icon Button */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative rounded-full p-2 text-slate-700 hover:bg-[#EDE8DC]"
            aria-label="View notifications"
          >
            <Bell className="h-4 w-4" />
          </button>

          {/* Notifications Dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-[#EDE8DC] bg-white p-3.5 shadow-lg shadow-black/5 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">System Notifications</span>
                <span className="text-[10px] text-[#15803D] font-semibold">All Read</span>
              </div>
              <div className="py-2 space-y-2 text-xs">
                <div className="rounded-xl p-2.5 bg-slate-50">
                  <div className="font-semibold text-slate-800">Batch Inspection Approved</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Batch CRP-2026-RICE-000001 verified Grade A by Inspector J. Kollie
                  </div>
                </div>
                <div className="rounded-xl p-2.5 bg-slate-50">
                  <div className="font-semibold text-slate-800">Mobile Sync Received</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Farmer S. Cooper logged new field weeding activity from Nimba County
                  </div>
                </div>
              </div>
              <Link
                href="/notifications"
                onClick={() => setNotificationsOpen(false)}
                className="block text-center pt-2 text-xs font-semibold text-[#15803D] hover:underline"
              >
                View all notifications →
              </Link>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 text-left p-1 rounded-xl hover:bg-[#EDE8DC] transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0A1C14] font-bold text-white text-xs border border-[#163A26]">
              AD
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-bold leading-tight text-slate-900">Administrator</div>
              <div className="text-[10px] leading-tight text-slate-500">Super Admin</div>
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#EDE8DC] bg-white py-2 shadow-lg shadow-black/5 z-50">
              <div className="border-b border-slate-100 px-4 py-2">
                <p className="text-xs font-bold text-slate-900">Administrator</p>
                <p className="text-[11px] text-slate-500">admin@farmtori.app</p>
                <div className="mt-1 inline-flex rounded bg-[#E5F2DC] px-1.5 py-0.5 text-[9px] font-bold text-[#1C3822]">
                  SUPER ADMIN
                </div>
              </div>

              <div className="py-1 text-xs">
                <Link
                  href="/users"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  <User className="h-4 w-4 text-slate-400" />
                  Account Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  <Shield className="h-4 w-4 text-slate-400" />
                  Security & Audit
                </Link>
              </div>

              <div className="border-t border-slate-100 pt-1">
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
