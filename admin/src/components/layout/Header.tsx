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
  HelpCircle,
  ExternalLink,
  CheckCircle2,
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
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-4 md:px-8">
      {/* Left: Mobile trigger & Global Search */}
      <div className="flex items-center gap-4">
        {onOpenMobile && (
          <button
            onClick={onOpenMobile}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="relative hidden w-72 md:block">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search farmers, farms, batches..."
            className="w-full rounded-lg border border-[#E2E8F0] bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-[#15803D] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#15803D]"
          />
        </div>
      </div>

      {/* Right: Actions, Notifications & User menu */}
      <div className="flex items-center gap-3">
        {/* Environment Badge */}
        <div className="hidden items-center gap-1.5 rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-bold text-[#14532D] sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#15803D]" />
          Liberia National Registry
        </div>

        {/* Notifications Icon Button */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="View notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#15803D]" />
            </span>
          </button>

          {/* Notifications Dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-lg shadow-slate-200/50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">System Notifications</span>
                <span className="text-[10px] text-emerald-700 font-semibold">All Read</span>
              </div>
              <div className="py-2 space-y-2 text-xs">
                <div className="rounded-lg p-2 bg-slate-50">
                  <div className="font-semibold text-slate-800">Batch Inspection Approved</div>
                  <div className="text-slate-500 text-[11px]">Batch CRP-2026-RICE-000001 verified Grade A by Inspector J. Kollie</div>
                </div>
                <div className="rounded-lg p-2 bg-slate-50">
                  <div className="font-semibold text-slate-800">Mobile Sync Received</div>
                  <div className="text-slate-500 text-[11px]">Farmer S. Cooper logged new field weeding activity from Nimba County</div>
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
            className="flex items-center gap-2.5 rounded-lg border border-[#E2E8F0] p-1.5 hover:bg-slate-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#15803D] font-bold text-white text-xs">
              AD
            </div>
            <div className="hidden text-left sm:block">
              <div className="text-xs font-bold text-slate-800">Administrator</div>
              <div className="text-[10px] text-slate-500">Super Admin</div>
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[#E2E8F0] bg-white py-1.5 shadow-lg shadow-slate-200/50">
              <div className="border-b border-slate-100 px-4 py-2">
                <p className="text-xs font-bold text-slate-900">Administrator</p>
                <p className="text-[11px] text-slate-500">admin@cropcapture.app</p>
                <div className="mt-1 inline-flex rounded bg-[#DCFCE7] px-1.5 py-0.5 text-[9px] font-bold text-[#14532D]">
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
