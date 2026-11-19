'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  Terminal,
  Clock,
  Layers,
  ChevronDown,
  ChevronRight,
  User,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getAuditLogs } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { AuditLog } from '@/types/database';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('All');
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getAuditLogs();
        setLogs(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(search.toLowerCase()) ||
      (log.ip_address && log.ip_address.includes(search));
    const matchesAction = filterAction === 'All' || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const exportAuditCSV = () => {
    const headers = ['Audit ID', 'Timestamp', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'Payload Details'];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.created_at,
      l.action,
      l.entity_type,
      l.entity_id || '',
      l.ip_address || '',
      JSON.stringify(l.details || {}).replace(/"/g, '""'),
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => `"${e.join('","')}"`)].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `agritrack_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
              System Audit Logs & Cryptographic Integrity Trail
            </h1>
            <p className="text-sm text-[#64748B]">
              Immutable record of administrative transactions, grading decisions, boundary modifications, and security events.
            </p>
          </div>
          <button
            onClick={exportAuditCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-xs font-semibold text-[#1E293B] shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4 text-[#15803D]" />
            Export Audit Trail (CSV)
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search by action, entity ID, or IP address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 pl-9 pr-4 text-xs text-[#1E293B] placeholder-[#64748B] focus:border-[#15803D] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#15803D]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#64748B]" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-medium text-[#1E293B] focus:border-[#15803D] focus:outline-none"
            >
              <option value="All">All Audit Actions</option>
              <option value="HARVEST_APPROVED">HARVEST_APPROVED</option>
              <option value="INSPECTOR_ASSIGNED">INSPECTOR_ASSIGNED</option>
              <option value="FARM_REGISTERED">FARM_REGISTERED</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B]">
                <tr>
                  <th className="w-10 px-4 py-3.5"></th>
                  <th className="px-4 py-3.5 font-semibold">Timestamp</th>
                  <th className="px-4 py-3.5 font-semibold">Action Triggered</th>
                  <th className="px-4 py-3.5 font-semibold">Target Entity</th>
                  <th className="px-4 py-3.5 font-semibold">Entity ID</th>
                  <th className="px-4 py-3.5 font-semibold">Client IP</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-[#64748B]">
                      Loading cryptographic log entries...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-[#64748B]">
                      No audit events found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          onClick={() => toggleExpand(log.id)}
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3.5 text-center text-slate-400">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] text-[#64748B]">
                            {formatDate(log.created_at)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-800 border border-slate-200">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-medium text-[#1E293B]">
                            {log.entity_type}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] text-[#64748B]">
                            {log.entity_id ? log.entity_id.substring(0, 16) + '...' : '—'}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] text-[#64748B]">
                            {log.ip_address || '127.0.0.1'}
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-[#15803D]">
                            {isExpanded ? 'Hide Payload' : 'View Payload'}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-900 text-emerald-400 font-mono text-xs">
                            <td colSpan={7} className="p-4">
                              <div className="flex items-center gap-2 text-slate-400 text-[11px] mb-2">
                                <Terminal className="h-3.5 w-3.5" />
                                <span>Cryptographic Snapshot Payload JSON (Audit Ref: {log.id})</span>
                              </div>
                              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-[11px] text-emerald-400">
                                {JSON.stringify(log.details || {}, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
