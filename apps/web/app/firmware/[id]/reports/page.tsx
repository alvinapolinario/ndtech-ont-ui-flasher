'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, urls } from '@/lib/api';
import type { Workspace, RepackReport, ExportJob, ExportKind } from '@/lib/types';
import { FirmwareTabs } from '@/components/FirmwareTabs';
import { SafetyBanner } from '@/components/SafetyBanner';
import { PageHeader, Spinner, EmptyState, StatusBadge } from '@/components/ui';

const EXPORT_KINDS: { kind: ExportKind; label: string }[] = [
  { kind: 'profile-json', label: 'Branding profile JSON' },
  { kind: 'modified-assets', label: 'Modified web assets (ZIP)' },
  { kind: 'patch-report', label: 'Patch report (HTML)' },
  { kind: 'repacked-rootfs-candidate', label: 'Repacked rootfs candidate (ZIP)' },
  { kind: 'full-workspace-zip', label: 'Full workspace (ZIP)' },
];

export default function ReportsPage() {
  const { id } = useParams<{ id: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [repack, setRepack] = useState<RepackReport | null>(null);
  const [exports, setExports] = useState<ExportJob[]>([]);
  const [includeOriginal, setIncludeOriginal] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshExports() {
    setExports(await api.get<ExportJob[]>(`/firmware/${id}/exports`));
  }

  useEffect(() => {
    (async () => {
      const ws = await api.get<Workspace | null>(`/firmware/${id}/workspace`);
      setWorkspace(ws);
      if (ws) setRepack(await api.get<RepackReport>(`/workspaces/${ws.id}/repack`));
      await refreshExports();
    })().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function runExport(kind: ExportKind) {
    setBusy(kind);
    try {
      await api.post(`/firmware/${id}/exports`, {
        kind,
        includeOriginalFirmware: kind === 'full-workspace-zip' ? includeOriginal : false,
      });
      await refreshExports();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Reports & Export" subtitle="Patch report, repack feasibility, and export bundles." />
      <FirmwareTabs id={id} />

      {loading && <Spinner />}
      {!loading && !workspace && <EmptyState message="No workspace yet. Extract the firmware first." />}

      {workspace && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold uppercase text-slate-400">Patch report</h3>
            <a className="btn-secondary" href={urls.report(workspace.id)} target="_blank" rel="noreferrer">
              Open patch report (HTML) ↗
            </a>
            <iframe
              title="report"
              src={urls.report(workspace.id)}
              className="mt-4 h-80 w-full rounded border border-ndtech-line bg-white"
            />
          </div>

          {repack && (
            <div className="card">
              <h3 className="mb-3 text-sm font-semibold uppercase text-slate-400">Repack feasibility</h3>
              <SafetyBanner>
                <strong>Repacking is not performed automatically.</strong> The command
                below is a <strong>suggestion only</strong>. Repacking & flashing can
                brick the device.
              </SafetyBanner>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <Info label="Rootfs type" value={repack.rootfsType} />
                <Info label="Compression" value={repack.compression ?? 'unknown'} />
                <Info label="Block size" value={repack.blockSizeBytes ? `${repack.blockSizeBytes} bytes` : 'unknown'} />
                <Info label="Feasible" value={repack.feasible ? 'Yes (with caveats)' : 'No'} />
                <Info label="Execution allowed" value={repack.executionAllowed ? 'Enabled' : 'Disabled (safe)'} />
              </div>

              {repack.suggestedCommand && (
                <div className="mt-3">
                  <div className="label">Suggested command (NOT executed)</div>
                  <pre className="terminal text-amber-200">{repack.suggestedCommand}</pre>
                </div>
              )}

              {repack.risks.length > 0 && (
                <div className="mt-3 text-sm text-amber-200">
                  <div className="mb-1 font-semibold">Risks</div>
                  <ul className="list-disc space-y-1 pl-5">
                    {repack.risks.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {repack.notes.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-400">
                  {repack.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="card">
            <h3 className="mb-3 text-sm font-semibold uppercase text-slate-400">Export</h3>
            <label className="mb-3 flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={includeOriginal} onChange={(e) => setIncludeOriginal(e.target.checked)} />
              Include original firmware in full-workspace ZIP (off by default)
            </label>
            <div className="flex flex-wrap gap-2">
              {EXPORT_KINDS.map((e) => (
                <button key={e.kind} className="btn-secondary" disabled={busy !== null} onClick={() => runExport(e.kind)}>
                  {busy === e.kind ? 'Exporting…' : e.label}
                </button>
              ))}
            </div>

            {exports.length > 0 && (
              <div className="mt-4 space-y-2">
                {exports.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded border border-ndtech-line px-3 py-2 text-xs">
                    <span className="font-mono">{e.kind}</span>
                    <span className="flex items-center gap-3">
                      <StatusBadge status={e.status} />
                      {e.outputPath && <span className="font-mono text-slate-400">{e.outputPath}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-ndtech-line bg-black/20 px-3 py-2">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="text-slate-200">{value}</div>
    </div>
  );
}
