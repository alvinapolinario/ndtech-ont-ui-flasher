'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Firmware } from '@/lib/types';
import { SafetyBanner } from '@/components/SafetyBanner';
import { PageHeader, formatBytes } from '@/components/ui';

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [autoPreview, setAutoPreview] = useState(true);
  const [busy, setBusy] = useState<false | 'upload' | 'process'>(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return setError('Select a firmware .bin file.');
    if (!authorized) return setError('You must confirm you are authorized to modify this firmware.');

    const form = new FormData();
    form.append('firmware', file);
    if (notes) form.append('notes', notes);

    setBusy('upload');
    try {
      const fw = await api.post<Firmware>('/firmware', form);

      if (autoPreview) {
        // Run analyze -> extract, then jump straight to the UI preview.
        setBusy('process');
        await api.post(`/firmware/${fw.id}/analyze`);
        await api.post(`/firmware/${fw.id}/workspace`);
        router.push(`/firmware/${fw.id}/preview`);
      } else {
        router.push(`/firmware/${fw.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Upload Firmware" subtitle="Only upload images you own or are authorized to modify." />
      <SafetyBanner>
        <strong>Authorization required.</strong> Upload firmware only for{' '}
        <strong>spare/test ONT devices you own</strong>. Modifying ISP-provided
        equipment may violate your contract and local law. The original file is
        stored unmodified and hashed (SHA-256).
      </SafetyBanner>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label className="label">Firmware file (.bin)</label>
          <input
            type="file"
            accept=".bin,.img,.fw,application/octet-stream"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="input file:mr-3 file:rounded file:border-0 file:bg-ndtech-blue file:px-3 file:py-1 file:text-white"
          />
          {file && (
            <p className="mt-1 text-xs text-slate-400">
              {file.name} · {formatBytes(file.size)}
            </p>
          )}
        </div>

        <div>
          <label className="label">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="input"
            placeholder="e.g. spare HG8145V5 V2, hardware rev, source of image…"
          />
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
            className="mt-1"
          />
          I confirm this firmware is for a device I own or am authorized to modify,
          and I understand modified firmware may brick the device.
        </label>

        <label className="flex items-start gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={autoPreview}
            onChange={(e) => setAutoPreview(e.target.checked)}
            className="mt-1"
          />
          After upload, automatically analyze + extract and open the UI preview.
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button type="submit" className="btn-primary" disabled={busy !== false}>
          {busy === 'upload'
            ? 'Uploading…'
            : busy === 'process'
              ? 'Analyzing & extracting…'
              : autoPreview
                ? 'Upload & Preview UI'
                : 'Upload & Hash'}
        </button>
      </form>
    </div>
  );
}
