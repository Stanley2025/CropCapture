'use client';

import { AlertTriangle } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { countyText as T } from '@/lib/counties/en';

/** Shown if the page itself fails. "Try again" loads the page once more. */
export default function CountiesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <AdminLayout>
      <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div>
          <h2 className="text-base font-bold text-[#1E293B]">{T.errorTitle}</h2>
          <p className="mt-1 text-sm text-[#475569]">{T.errorBody}</p>
          <button type="button" onClick={() => reset()} className="mt-3 min-h-[44px] rounded-xl bg-[#0A1C14] px-4 text-sm font-semibold text-white">
            {T.retry}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
