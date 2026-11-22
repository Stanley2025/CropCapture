import { AdminLayout } from '@/components/layout/AdminLayout';
import { countyText as T } from '@/lib/counties/en';

/** Shown while the county numbers load: grey blocks where the cards, the bars and the table will be. */
export default function Loading() {
  return (
    <AdminLayout>
      <div className="space-y-6 pt-4" role="status" aria-live="polite" aria-label={T.loading}>
        <span className="sr-only">{T.loading}</span>
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[#E2E8F0]" />
        <div className="h-20 animate-pulse rounded-2xl bg-[#E2E8F0]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#E2E8F0]" />)}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-[#E2E8F0]" />
      </div>
    </AdminLayout>
  );
}
