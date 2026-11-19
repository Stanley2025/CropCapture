'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  MapPin,
  Sprout,
  CalendarDays,
  ClipboardList,
  Coins,
  PackageCheck,
  ShieldCheck,
  UserCheck,
  Compass,
  Navigation,
  Building2,
  BarChart3,
  Map,
  UserCog,
  KeyRound,
  Bell,
  ScrollText,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Leaf,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CropCaptureLogo } from '@/components/brand/Logo';


interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAVIGATION_SECTIONS: NavSection[] = [
  {
    title: 'OVERVIEW',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'AGRICULTURE',
    items: [
      { title: 'Farmers', href: '/farmers', icon: Users },
      { title: 'Farms', href: '/farms', icon: MapPin },
      { title: 'Crops & Seasons', href: '/crops', icon: Sprout },
      { title: 'Farm Records', href: '/farm-records', icon: ClipboardList },
      { title: 'Inputs & Expenses', href: '/inputs', icon: Coins },
      { title: 'Harvests', href: '/harvests', icon: PackageCheck, badge: 'Live' },
    ],
  },
  {
    title: 'QUALITY & FIELD OPERATIONS',
    items: [
      { title: 'Quality Management', href: '/quality', icon: ShieldCheck },
      { title: 'Inspection Assignments', href: '/quality/assignments', icon: UserCheck },
      { title: 'Extension Officers', href: '/extension-officers', icon: Compass },
      { title: 'Field Visits', href: '/field-visits', icon: Navigation },
    ],
  },
  {
    title: 'ORGANIZATIONS',
    items: [
      { title: 'Cooperatives', href: '/cooperatives', icon: Building2 },
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      { title: 'Reports & Analytics', href: '/reports', icon: BarChart3 },
      { title: 'Geographic Maps', href: '/maps', icon: Map },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { title: 'User Management', href: '/users', icon: UserCog },
      { title: 'Roles & Permissions', href: '/roles', icon: KeyRound },
      { title: 'Notifications', href: '/notifications', icon: Bell },
      { title: 'Audit Logs', href: '/audit-logs', icon: ScrollText },
      { title: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export function Sidebar({ mobileOpen, onCloseMobile }: { mobileOpen?: boolean; onCloseMobile?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#E2E8F0] bg-white transition-transform duration-200 lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-[#E2E8F0] px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <CropCaptureLogo iconClassName="h-8 w-8 text-[#15803D]" />
          </Link>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Scrollable Nav Items */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <nav className="space-y-6">
            {NAVIGATION_SECTIONS.map((section) => (
              <div key={section.title}>
                <div className="px-3 pb-1.5 text-[11px] font-bold tracking-wider text-slate-400">
                  {section.title}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onCloseMobile}
                        className={cn(
                          'group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-[#DCFCE7] text-[#14532D] font-semibold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            className={cn(
                              'h-4 w-4 transition-colors',
                              isActive ? 'text-[#15803D]' : 'text-slate-400 group-hover:text-slate-600'
                            )}
                          />
                          <span>{item.title}</span>
                        </div>
                        {item.badge && (
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                              isActive
                                ? 'bg-[#15803D] text-white'
                                : 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom System Status */}
        <div className="border-t border-[#E2E8F0] p-4 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-700">Supabase Connected</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            PostgreSQL • Mobile Sync Active
          </p>
        </div>
      </aside>
    </>
  );
}
