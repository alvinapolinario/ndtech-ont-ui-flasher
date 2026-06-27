'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Firmware, SystemStatus } from '@/lib/types';
import { SafetyBanner } from '@/components/SafetyBanner';
import { PageHeader, StatusBadge, MockBadge, Spinner, EmptyState, formatBytes } from '@/components/ui';

export default function DashboardPage() {
  const [firmware, setFirmware] = useState<Firmware[] | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get<Firmware[]>('/firmware'), api.get<SystemStatus>('/system/status')])
      .then(([fw, st]) => {
        setFirmware(fw);
        setStatus(st);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        subtitle="Customize the web UI branding of firmware you own — safely."
        actions={
          <Link href="/upload" className="btn-primary">
            ↥ Upload Firmware
          </Link>
        }
      />
      <SafetyBanner />

      {error && (
        <div className="card mb-6 border-red-500/40 text-red-300">
          Could not reach the API ({error}). Is it running on{' '}
          <code>{process.env.NEXT_PUBLIC_API_URL}</code>?
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-xs uppercase text-slate-400">Firmware images</div>
          <div className="mt-1 text-3xl font-bold text-white">{firmware?.length ?? '—'}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-slate-400">Analysis mode</div>
          <div className="mt-1 text-lg font-semibold">
            {status ? (
              status.liveAnalysisPossible ? (
                <span className="text-green-300">Live (binwalk available)</span>
              ) : (
                <span className="text-purple-300">Mock / demo</span>
              )
            ) : (
              '—'
            )}
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-slate-400">Repack execution</div>
          <div className="mt-1 text-lg font-semibold">
            {status ? (
              status.allowRepackExecution ? (
                <span className="text-amber-300">Enabled</span>
              ) : (
                <span className="text-slate-300">Disabled (safe)</span>
              )
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Firmware
      </h2>
      {!firmware && !error && <Spinner label="Loading firmware…" />}
      {firmware && firmware.length === 0 && (
        <EmptyState message="No firmware yet. Upload an image you are authorized to modify to get started." />
      )}
      {firmware && firmware.length > 0 && (
        <div className="grid gap-3">
          {firmware.map((fw) => (
            <Link
              key={fw.id}
              href={`/firmware/${fw.id}`}
              className="card flex items-center justify-between transition hover:border-ndtech-blue"
            >
              <div>
                <div className="flex items-center gap-2 font-medium text-white">
                  {fw.originalName} <MockBadge isMock={fw.isMock} />
                </div>
                <div className="mt-1 font-mono text-xs text-slate-400">
                  {fw.sha256.slice(0, 24)}… · {formatBytes(fw.sizeBytes)}
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                {new Date(fw.createdAt).toLocaleString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
