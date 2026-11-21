'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Users,
  BookOpen,
  Leaf,
  FileText,
  Coins,
  ShieldCheck,
  ClipboardCheck,
  Compass,
  MapPin,
  BarChart2,
  Map,
  Key,
  Bell,
  Menu,
  SunMedium,
  CloudSun,
  X,
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
    title: 'Overview',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutGrid },
    ],
  },
  {
    title: 'Agriculture',
    items: [
      { title: 'Farmers', href: '/farmers', icon: Users },
      { title: 'Farms', href: '/farms', icon: BookOpen },
      { title: 'Crops & seasons', href: '/crops', icon: Leaf },
      { title: 'Farm records', href: '/farm-records', icon: FileText },
      { title: 'Inputs & expenses', href: '/inputs', icon: Coins },
      { title: 'Harvests', href: '/harvests', icon: Leaf, badge: 'Live' },
      { title: 'Weather & alerts', href: '/weather-alerts', icon: CloudSun, badge: 'Liberia' },
    ],
  },
  {
    title: 'Quality and field work',
    items: [
      { title: 'Quality management', href: '/quality', icon: ShieldCheck },
      { title: 'Inspection assignments', href: '/quality/assignments', icon: ClipboardCheck },
      { title: 'Extension officers', href: '/extension-officers', icon: Compass },
      { title: 'Field visits', href: '/field-visits', icon: MapPin },
    ],
  },
  {
    title: 'Organizations',
    items: [
      { title: 'Cooperatives', href: '/cooperatives', icon: Users },
    ],
  },
  {
    title: 'Insights',
    items: [
      { title: 'Reports & analytics', href: '/reports', icon: BarChart2 },
      { title: 'Geographic maps', href: '/maps', icon: Map },
    ],
  },
  {
    title: 'System',
    items: [
      { title: 'User management', href: '/users', icon: Users },
      { title: 'Roles & permissions', href: '/roles', icon: Key },
      { title: 'Notifications', href: '/notifications', icon: Bell },
      { title: 'Audit logs', href: '/audit-logs', icon: Menu },
      { title: 'Settings', href: '/settings', icon: SunMedium },
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
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0A1C14] text-[#A6C0B2] transition-transform duration-200 lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-5 pt-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <CropCaptureLogo
              iconClassName="h-7 w-7 text-[#B4E544]"
              light={true}
              subtitle="Admin console"
            />
          </Link>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="rounded-md p-1.5 text-emerald-400 hover:bg-[#163A26] lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Scrollable Nav Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin scrollbar-thumb-[#163A26]">
          <nav className="space-y-5">
            {NAVIGATION_SECTIONS.map((section) => (
              <div key={section.title}>
                <div className="px-3 pb-1.5 text-[11px] font-medium text-[#5B806C]">
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
                        prefetch={true}
                        onClick={onCloseMobile}
                        className={cn(
                          'group flex items-center justify-between rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                          isActive
                            ? 'bg-[#163A26] text-[#B4E544] font-semibold'
                            : 'text-[#9DB5A6] hover:bg-[#122A1E] hover:text-white'
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={cn(
                              'h-4 w-4 transition-colors',
                              isActive ? 'text-[#B4E544]' : 'text-[#85A391] group-hover:text-white'
                            )}
                          />
                          <span>{item.title}</span>
                        </div>
                        {item.badge && (
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight',
                              isActive
                                ? 'bg-[#B4E544] text-[#0A1C14]'
                                : 'bg-[#B4E544] text-[#0A1C14]'
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
        <div className="p-4 pt-3 border-t border-[#142F20]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#B4E544]" />
            <span className="text-xs font-medium text-[#C2DDD0]">Database connected</span>
          </div>
          <p className="mt-0.5 pl-4 text-[11px] text-[#638371]">
            Mobile sync active
          </p>
        </div>
      </aside>
    </>
  );
}
