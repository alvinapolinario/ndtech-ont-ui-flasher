'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Firmware, AnalysisResult, Workspace, SystemStatus } from '@/lib/types';
import { FirmwareTabs } from '@/components/FirmwareTabs';
import { PageHeader, StatusBadge, MockBadge, Spinner, formatBytes } from '@/components/ui';

export default function FirmwareDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [firmware, setFirmware] = useState<Firmware | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [fw, an, ws] = await Promise.all([
      api.get<Firmware>(`/firmware/${id}`),
      api.get<AnalysisResult | null>(`/firmware/${id}/analysis`),
      api.get<Workspace | null>(`/firmware/${id}/workspace`),
    ]);
    setFirmware(fw);
    setAnalysis(an);
    setWorkspace(ws);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
    api.get<SystemStatus>('/system/status').then(setStatus).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function runAnalysis() {
    setBusy('analysis');
    setError(null);
    try {
      await api.post(`/firmware/${id}/analyze`);
      await load();
      router.push(`/firmware/${id}/analysis`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed.');
    } finally {
      setBusy(null);
    }
  }

  async function createWorkspace() {
    setBusy('workspace');
    setError(null);
    try {
      await api.post(`/firmware/${id}/workspace`);
      await load();
      router.push(`/firmware/${id}/assets`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed.');
    } finally {
      setBusy(null);
    }
  }

  // One-click: analyze (if needed) -> extract -> open the UI preview.
  async function extractAndPreview() {
    setBusy('pipeline');
    setError(null);
    try {
      if (!analysis) await api.post(`/firmware/${id}/analyze`);
      await api.post(`/firmware/${id}/workspace`);
      router.push(`/firmware/${id}/preview`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pipeline failed.');
      setBusy(null);
    }
  }

  if (!firmware) return <Spinner label="Loading firmware…" />;

  const hasWebRoot = workspace ? (workspace.webRootCandidates?.length ?? 0) > 0 : false;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={firmware.originalName}
        subtitle="Firmware details and pipeline actions."
        actions={
          <div className="flex items-center gap-3">
            <MockBadge isMock={firmware.isMock} />
            {hasWebRoot ? (
              <button className="btn-primary" onClick={() => router.push(`/firmware/${id}/preview`)}>
                Open UI Preview
              </button>
            ) : (
              <button className="btn-primary" onClick={extractAndPreview} disabled={busy !== null}>
                {busy === 'pipeline' ? 'Processing…' : 'Extract & Preview UI'}
              </button>
            )}
          </div>
        }
      />
      <FirmwareTabs id={id} />

      {status && !status.liveAnalysisPossible && (
        <div className="card mb-4 border-amber-500/40 bg-amber-500/10 text-sm text-amber-200">
          <strong>Demo UI mode.</strong> The Linux extraction tools aren&apos;t available, so
          extraction produces a bundled <em>sample</em> Huawei-style UI rather than this
          firmware&apos;s real web pages. Install the tools (WSL bridge) to preview the actual
          firmware UI — see <span className="font-mono">docs/WSL-SETUP.md</span>.
        </div>
      )}

      {error && <div className="card mb-4 border-red-500/40 text-red-300">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold uppercase text-slate-400">Metadata</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Original name" value={firmware.originalName} />
            <Row label="Stored as" value={firmware.filename} />
            <Row label="Size" value={formatBytes(firmware.sizeBytes)} />
            <Row label="SHA-256" value={firmware.sha256} mono />
            <Row label="Uploaded" value={new Date(firmware.createdAt).toLocaleString()} />
            {firmware.notes && <Row label="Notes" value={firmware.notes} />}
          </dl>
        </div>

        <div className="card space-y-4">
          <h3 className="text-sm font-semibold uppercase text-slate-400">Pipeline</h3>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">1. Analysis (binwalk)</div>
              <div className="text-xs text-slate-400">
                {analysis ? <StatusBadge status={analysis.status} /> : 'Not run yet'}
              </div>
            </div>
            <button className="btn-secondary" onClick={runAnalysis} disabled={busy !== null}>
              {busy === 'analysis' ? 'Running…' : analysis ? 'Re-run' : 'Run analysis'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">2. Extraction workspace</div>
              <div className="text-xs text-slate-400">
                {workspace ? <StatusBadge status={workspace.status} /> : 'Not created yet'}
              </div>
            </div>
            <button className="btn-secondary" onClick={createWorkspace} disabled={busy !== null}>
              {busy === 'workspace' ? 'Extracting…' : workspace ? 'Re-extract' : 'Extract'}
            </button>
          </div>

          {workspace && (workspace.webRootCandidates?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-ndtech-line bg-black/30 p-3 text-xs">
              <div className="mb-1 text-slate-400">Detected web-root candidates:</div>
              <ul className="space-y-1 font-mono text-green-300">
                {workspace.webRootCandidates.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {workspace && workspace.status === 'failed' && workspace.error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs">
              <div className="mb-1 font-semibold text-red-300">Extraction failed</div>
              <pre className="whitespace-pre-wrap break-words font-mono text-red-200/90">
                {workspace.error}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className={`text-right ${mono ? 'break-all font-mono text-xs' : ''} text-slate-200`}>
        {value}
      </dd>
    </div>
  );
}
