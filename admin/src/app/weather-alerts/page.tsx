'use client';

import React, { useState } from 'react';
import {
  CloudRain,
  Wind,
  Sun,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Clock,
  Send,
  RefreshCw,
  Search,
  Filter,
  Check,
} from 'lucide-react';

interface DeliveryLogItem {
  id: string;
  alertType: 'heavy_rain' | 'strong_wind' | 'dry_spell' | 'harvest_advice';
  recipientName: string;
  recipientPhone: string;
  county: string;
  district: string;
  channel: 'SMS (Orange Liberia)' | 'In-App' | 'Push Notification';
  messageBody: string;
  charCount: number;
  status: 'Delivered' | 'Simulated' | 'Pending' | 'Failed';
  sentAt: string;
}

const INITIAL_LOGS: DeliveryLogItem[] = [
  {
    id: 'log-001',
    alertType: 'heavy_rain',
    recipientName: 'Joseph Flomo',
    recipientPhone: '+231-77-654-3210',
    county: 'Nimba',
    district: 'Gbehley',
    channel: 'SMS (Orange Liberia)',
    messageBody: 'CropCapture: Heavy rain expected tomorrow (~30mm, 80% chance) in Gbehley, Nimba. Harvest & dry rice today. Cover stored paddy.',
    charCount: 126,
    status: 'Delivered',
    sentAt: '2026-11-21 09:30:14',
  },
  {
    id: 'log-002',
    alertType: 'heavy_rain',
    recipientName: 'Emmanuel Gaye',
    recipientPhone: '+231-77-889-1122',
    county: 'Nimba',
    district: 'Sanniquellie-Mahn',
    channel: 'SMS (Orange Liberia)',
    messageBody: 'CropCapture: Heavy rain expected tomorrow (~28mm, 75% chance) in Sanniquellie. Harvest & dry rice today. Clear drains around plots.',
    charCount: 132,
    status: 'Delivered',
    sentAt: '2026-11-21 09:30:18',
  },
  {
    id: 'log-003',
    alertType: 'harvest_advice',
    recipientName: 'Korto Kollie',
    recipientPhone: '+231-88-234-5678',
    county: 'Bong',
    district: 'Jorquelleh',
    channel: 'SMS (Orange Liberia)',
    messageBody: 'CropCapture: Good drying weather for the next 2 days in Jorquelleh. Spread & turn cocoa beans today before rain returns.',
    charCount: 120,
    status: 'Delivered',
    sentAt: '2026-11-21 07:15:02',
  },
  {
    id: 'log-004',
    alertType: 'dry_spell',
    recipientName: 'Ma Musu Cooper',
    recipientPhone: '+231-77-112-9988',
    county: 'Lofa',
    district: 'Foya',
    channel: 'SMS (Orange Liberia)',
    messageBody: 'CropCapture: No rain expected for 7 days in Foya, Lofa. Water young seedlings in the morning. Mulch beds to retain soil moisture.',
    charCount: 127,
    status: 'Delivered',
    sentAt: '2026-11-19 14:00:22',
  },
  {
    id: 'log-005',
    alertType: 'strong_wind',
    recipientName: 'Hawa Vannie',
    recipientPhone: '+231-88-990-4411',
    county: 'Grand Cape Mount',
    district: 'Robertsport',
    channel: 'SMS (Orange Liberia)',
    messageBody: 'CropCapture: Strong winds (~42 km/h) expected in Robertsport. Secure drying mats, tie down roofing and check animal shelters.',
    charCount: 126,
    status: 'Delivered',
    sentAt: '2026-11-18 11:45:10',
  },
];

export default function WeatherAlertsAdminPage() {
  const [logs, setLogs] = useState<DeliveryLogItem[]>(INITIAL_LOGS);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [testSimulating, setTestSimulating] = useState(false);

  const filteredLogs = logs.filter((item) => {
    const matchesSearch =
      item.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.county.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.recipientPhone.includes(searchTerm);

    const matchesType = filterType === 'all' || item.alertType === filterType;
    return matchesSearch && matchesType;
  });

  const triggerTestAlert = () => {
    setTestSimulating(true);
    setTimeout(() => {
      const newLog: DeliveryLogItem = {
        id: `log-${Date.now()}`,
        alertType: 'heavy_rain',
        recipientName: 'Test Farmer (Gbehley)',
        recipientPhone: '+231-77-000-1234',
        county: 'Nimba',
        district: 'Gbehley',
        channel: 'SMS (Orange Liberia)',
        messageBody: 'CropCapture: Heavy rain expected tomorrow (~32mm, 80% chance) in Gbehley, Nimba. Harvest & dry rice today. Cover paddy.',
        charCount: 121,
        status: 'Delivered',
        sentAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };
      setLogs([newLog, ...logs]);
      setTestSimulating(false);
    }, 800);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Weather Monitoring & Alert Audit
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            District weather forecasting, threshold triggers, and Orange Liberia SMS delivery logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={triggerTestAlert}
            disabled={testSimulating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 text-white rounded-lg text-sm font-semibold hover:bg-emerald-900 transition-colors shadow-sm disabled:opacity-50"
          >
            {testSimulating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Simulate Alert & SMS
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Alerts Dispatched</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CloudRain className="w-5 h-5 text-emerald-800" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">{logs.length + 18}</span>
            <span className="text-xs text-emerald-600 ml-2 font-medium">100% within cooldown</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Orange Liberia SMS</span>
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">{logs.length}</span>
            <span className="text-xs text-gray-500 ml-2">All &le; 160 characters</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Monitored Districts</span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Sun className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">127</span>
            <span className="text-xs text-gray-500 ml-2">Across all 15 counties</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Cache Schedule</span>
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">4 Hours</span>
            <span className="text-xs text-purple-600 ml-2 font-medium">Per district (cached)</span>
          </div>
        </div>
      </div>

      {/* Configured Rules Overview Banner */}
      <div className="bg-emerald-950 text-white rounded-xl p-5 border border-emerald-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Active Weather Alert Rules (Liberia Defaults)
            </span>
            <h3 className="text-base font-semibold text-white mt-1">
              Configured in <code className="text-emerald-300">src/config/weatherAlertRules.ts</code>
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded bg-emerald-900 text-emerald-200 font-medium">
              Heavy rain: &ge; 70% &amp; &ge; 25mm
            </span>
            <span className="px-2.5 py-1 rounded bg-emerald-900 text-emerald-200 font-medium">
              Strong wind: &ge; 35 km/h
            </span>
            <span className="px-2.5 py-1 rounded bg-emerald-900 text-emerald-200 font-medium">
              Dry spell: 7 days &lt; 2.5mm
            </span>
            <span className="px-2.5 py-1 rounded bg-emerald-900 text-emerald-200 font-medium">
              Cooldown: 24h
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by farmer name, district, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
          >
            <option value="all">All Alert Types</option>
            <option value="heavy_rain">Heavy Rain</option>
            <option value="strong_wind">Strong Wind</option>
            <option value="dry_spell">Dry Spell</option>
            <option value="harvest_advice">Harvest-Day Advice</option>
          </select>
        </div>
      </div>

      {/* Delivery Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
            Alert Delivery &amp; SMS Transmission Audit
          </h2>
          <span className="text-xs text-gray-500">Showing {filteredLogs.length} transmissions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Recipient &amp; Farm</th>
                <th className="px-6 py-3">Alert Type</th>
                <th className="px-6 py-3">Message Body</th>
                <th className="px-6 py-3">Chars</th>
                <th className="px-6 py-3">Channel</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                    {item.sentAt}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{item.recipientName}</div>
                    <div className="text-xs text-gray-400">
                      {item.district}, {item.county} &middot; {item.recipientPhone}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        item.alertType === 'heavy_rain'
                          ? 'bg-blue-100 text-blue-800'
                          : item.alertType === 'strong_wind'
                          ? 'bg-yellow-100 text-yellow-800'
                          : item.alertType === 'dry_spell'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {item.alertType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 max-w-md">
                    <p className="text-xs text-gray-700 leading-relaxed font-sans bg-gray-50 p-2 rounded border border-gray-100">
                      &ldquo;{item.messageBody}&rdquo;
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {item.charCount}/160
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 font-medium">
                    {item.channel}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                      <Check className="w-3 h-3 text-emerald-600" />
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
