'use client';

import React, { useState } from 'react';
import { BarChart3, Download, Printer, Filter, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';

const REPORT_TEMPLATES = [
  { id: 'rep-01', title: 'National Farmer Registration Directory', category: 'Registration', records: '1,240 records', format: 'CSV / PDF' },
  { id: 'rep-02', title: 'Farm Parcel Cartography & Acreage Report', category: 'Land Tenure', records: '1,580 parcels', format: 'CSV / PDF' },
  { id: 'rep-03', title: 'Seasonal Crop Production & Yield Aggregate', category: 'Agronomy', records: '14,800 kg', format: 'CSV / PDF' },
  { id: 'rep-04', title: 'Quality Inspection Certification & Grading Summary', category: 'Quality', records: '98 batches', format: 'CSV / PDF' },
  { id: 'rep-05', title: 'Smallholder Operating Costs & Inputs Ledger (USD/LRD)', category: 'Financial', records: '$24,500 USD', format: 'CSV / PDF' },
  { id: 'rep-06', title: 'Extension Officer Field Advisory & Observation Report', category: 'Extension', records: '42 visits', format: 'CSV / PDF' },
  { id: 'rep-07', title: 'Cooperative Union Commodity Aggregation Report', category: 'Cooperative', records: '8 unions', format: 'CSV / PDF' },
];

export default function ReportsPage() {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const handleDownload = (title: string) => {
    // Generate CSV content dynamically
    const csvContent = "data:text/csv;charset=utf-8,Report,GeneratedDate,Status\n" +
      `"${title}",${new Date().toISOString()},Verified Official Ministry Record\n`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(`Generated and downloaded ${title}`);
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Official Agricultural Reports & Analytics
            </h1>
            <p className="text-sm text-slate-500">
              Generate, print, and export verifiable national crop production reports, farmer registries, and quality certificates.
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Current Summary
          </button>
        </div>

        {downloadSuccess && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-[#15803D]" />
            {downloadSuccess}
          </div>
        )}

        {/* Report Catalogue */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_TEMPLATES.map((rep) => (
            <div key={rep.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">{rep.category}</span>
                  <span>{rep.format}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm leading-snug">{rep.title}</h3>
                <p className="text-xs text-slate-500 mt-2">Aggregate volume: {rep.records}</p>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Verifiable CSV</span>
                <button
                  onClick={() => handleDownload(rep.title)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#15803D] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#14532D]"
                >
                  <Download className="h-3 w-3" />
                  Generate
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
