'use client';

import React, { useState } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  Radio,
  Clock,
  Filter,
  CheckCheck,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';

interface SystemNotification {
  id: string;
  type: 'inspection' | 'warning' | 'sync' | 'farmer';
  title: string;
  message: string;
  timestamp: string;
  county: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: SystemNotification[] = [
  {
    id: 'n-01',
    type: 'inspection',
    title: 'New Inspection Request: Lot #CRP-2026-COCO-000003',
    message: 'Cooperative "Lofa Cocoa & Coffee Growers Federation" submitted 3,200 kg of Cocoa for grading.',
    timestamp: '12 minutes ago',
    county: 'Lofa',
    read: false,
  },
  {
    id: 'n-02',
    type: 'warning',
    title: 'Moisture Threshold Exceeded (14.2%)',
    message: 'Batch #CRP-2026-RICE-000002 failed moisture tolerance standard (< 13.0% required). Reconditioning mandated.',
    timestamp: '1 hour ago',
    county: 'Bong',
    read: false,
  },
  {
    id: 'n-03',
    type: 'sync',
    title: 'Field Node Offline Sync Completed',
    message: 'Extension Officer David Kamara synchronized 18 offline farm records from Voinjama remote zones.',
    timestamp: '3 hours ago',
    county: 'Lofa',
    read: false,
  },
  {
    id: 'n-04',
    type: 'farmer',
    title: 'Farmer Registration Verified: Emmanuel Flomo',
    message: 'Biometric and cadastral boundary verification completed for 8.5 acre paddy in Sanniquellie.',
    timestamp: '5 hours ago',
    county: 'Nimba',
    read: true,
  },
  {
    id: 'n-05',
    type: 'inspection',
    title: 'Grade A Quality Certificate Dispatched',
    message: 'Digital export traceability pass generated for 4,500 kg Suakoko 8 Rice (Batch #CRP-2026-RICE-000001).',
    timestamp: '1 day ago',
    county: 'Nimba',
    read: true,
  },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<SystemNotification[]>(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'inspection' | 'warning' | 'sync'>('all');

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const filtered = notifications.filter((n) => filter === 'all' || n.type === filter);

  const getIcon = (type: string) => {
    switch (type) {
      case 'inspection':
        return <Package className="h-5 w-5 text-blue-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-rose-600" />;
      case 'sync':
        return <Radio className="h-5 w-5 text-purple-600" />;
      default:
        return <CheckCircle2 className="h-5 w-5 text-[#15803D]" />;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
              Notifications & Critical Event Alerts
            </h1>
            <p className="text-sm text-[#64748B]">
              Live operational feed of inspection submissions, sync batches, and agronomic threshold warnings.
            </p>
          </div>
          <button
            onClick={markAllAsRead}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#1E293B] shadow-sm hover:bg-slate-50 transition-colors"
          >
            <CheckCheck className="h-4 w-4 text-[#15803D]" />
            Mark All as Read
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-[#E2E8F0] pb-2 text-xs font-semibold">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              filter === 'all' ? 'bg-[#15803D] text-white' : 'text-[#64748B] hover:bg-slate-100'
            }`}
          >
            All Alerts ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('inspection')}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              filter === 'inspection' ? 'bg-[#15803D] text-white' : 'text-[#64748B] hover:bg-slate-100'
            }`}
          >
            Inspections
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              filter === 'warning' ? 'bg-[#15803D] text-white' : 'text-[#64748B] hover:bg-slate-100'
            }`}
          >
            Quality Warnings
          </button>
          <button
            onClick={() => setFilter('sync')}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              filter === 'sync' ? 'bg-[#15803D] text-white' : 'text-[#64748B] hover:bg-slate-100'
            }`}
          >
            Offline Field Syncs
          </button>
        </div>

        {/* Notification List */}
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => markAsRead(item.id)}
              className={`flex items-start gap-4 rounded-2xl border p-4 transition-all cursor-pointer ${
                item.read
                  ? 'border-[#E2E8F0] bg-white text-[#64748B]'
                  : 'border-emerald-200 bg-[#DCFCE7]/20 shadow-sm'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  item.read ? 'bg-slate-100' : 'bg-white shadow-sm'
                }`}
              >
                {getIcon(item.type)}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className={`text-xs font-bold ${item.read ? 'text-[#1E293B]' : 'text-[#052E16]'}`}>
                    {item.title}
                  </h2>
                  <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                    <Clock className="h-3 w-3" />
                    {item.timestamp}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#64748B] leading-relaxed">{item.message}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                    County: {item.county}
                  </span>
                  {!item.read && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
