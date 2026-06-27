'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { SystemStatus } from '@/lib/types';
import { PageHeader, Spinner } from '@/components/ui';
import { SafetyBanner } from '@/components/SafetyBanner';

export default function SettingsPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<SystemStatus>('/system/status').then(setStatus).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings & Environment" subtitle="External tool availability and safety configuration." />
      <SafetyBanner />

      {error && <div className="card border-red-500/40 text-red-300">{error}</div>}
      {!status && !error && <Spinner />}

      {status && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold uppercase text-slate-400">Mode</h3>
            <dl className="space-y-2 text-sm">
              <Row label="Live analysis possible" value={status.liveAnalysisPossible ? 'Yes' : 'No (mock mode)'} />
              <Row label="Tool runtime" value={status.usingWslBridge ? 'WSL bridge' : status.liveAnalysisPossible ? 'Native' : 'Mock'} />
              <Row label="Mock mode forced" value={status.mockModeForced ? 'Yes' : 'No'} />
              <Row label="Repack execution" value={status.allowRepackExecution ? 'Enabled' : 'Disabled (safe default)'} />
              <Row label="Storage root" value={status.storageRoot} mono />
            </dl>
          </div>

          <div className="card">
            <h3 className="mb-3 text-sm font-semibold uppercase text-slate-400">External tools</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {status.tools.map((t) => (
                <div
                  key={t.tool}
                  className="flex items-center justify-between rounded border border-ndtech-line px-3 py-2 text-sm"
                >
                  <span className="font-mono">{t.tool}</span>
                  {t.available ? (
                    <span className="text-green-300">
                      ✓{t.via === 'wsl' && <span className="ml-1 text-[10px] text-cyan-300">WSL</span>}
                    </span>
                  ) : (
                    <span className="text-red-400">✗</span>
                  )}
                </div>
              ))}
            </div>
            {status.missing.length > 0 && (
              <p className="mt-3 text-xs text-amber-300">
                Missing: {status.missing.join(', ')}. Install them on Ubuntu with{' '}
                <code>sudo apt install binwalk squashfs-tools file binutils bsdmainutils p7zip-full gzip xz-utils</code>.
                The tool falls back to clearly-labelled mock output meanwhile.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className={`text-right text-slate-200 ${mono ? 'break-all font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
