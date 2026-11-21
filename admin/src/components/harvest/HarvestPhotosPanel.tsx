'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';

interface Photo { id: string; tag: string; sizeBytes: number | null; createdAt: string; url: string | null }

/**
 * Photos the farmer added to this harvest, as buyers see them. An administrator can remove a photo that
 * breaks the rules; a written reason is required and the removal is logged (who, which photo, when, why).
 */
export function HarvestPhotosPanel({ harvestId }: { harvestId: string }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/harvest-photos?harvest_id=${encodeURIComponent(harvestId)}`, { cache: 'no-store' });
    if (res.ok) {
      setPhotos((await res.json()).photos);
      setMessage(null);
    } else {
      setPhotos([]);
      setMessage(res.status === 401 || res.status === 403 ? 'Sign in as an administrator to see these photos.' : 'The photos could not be loaded.');
    }
  }, [harvestId]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    const res = await fetch(`/api/harvest-photos/${id}/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      setRemoving(null);
      setReason('');
      await load();
    } else {
      setMessage(res.status === 400 ? 'Write the reason for removing this photo (at least 3 letters).' : 'The photo could not be removed.');
    }
  };

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold text-[#1E293B]">
        <Camera className="h-4 w-4 text-[#15803D]" />
        Harvest photos
      </h2>
      <p className="mt-1 text-xs text-[#64748B]">
        Added by the farmer. Buyers see these when they scan the QR code. Remove a photo only if it breaks the rules; the removal is logged.
      </p>
      {message ? (
        <p role="status" className="mt-3 text-xs font-semibold text-amber-700">
          {message}
        </p>
      ) : null}
      {photos && photos.length === 0 && !message ? <p className="mt-4 text-xs text-[#64748B]">No photos added yet.</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {(photos || []).map((p) => (
          <div key={p.id}>
            {p.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.url} alt={`Harvest photo (${p.tag})`} loading="lazy" className="aspect-square w-full rounded-xl bg-slate-100 object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-slate-100 text-xs text-[#64748B]">Not available</div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold capitalize text-emerald-800">{p.tag}</span>
              <button
                type="button"
                onClick={() => setRemoving(removing === p.id ? null : p.id)}
                className="inline-flex min-h-[44px] items-center gap-1 text-xs font-bold text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
            {removing === p.id ? (
              <div className="mt-1 space-y-2">
                <label htmlFor={`reason-${p.id}`} className="block text-xs font-semibold text-[#1E293B]">
                  Reason (required)
                </label>
                <textarea
                  id={`reason-${p.id}`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={300}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                />
                <button type="button" onClick={() => remove(p.id)} className="min-h-[44px] rounded-lg bg-red-700 px-4 text-xs font-bold text-white">
                  Confirm removal
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
