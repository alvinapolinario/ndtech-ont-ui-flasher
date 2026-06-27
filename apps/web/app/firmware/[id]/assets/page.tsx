'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Asset, Workspace } from '@/lib/types';
import { FirmwareTabs } from '@/components/FirmwareTabs';
import { PageHeader, MockBadge, Spinner, EmptyState, formatBytes } from '@/components/ui';

const KIND_COLORS: Record<string, string> = {
  html: 'bg-orange-500/15 text-orange-300',
  css: 'bg-purple-500/15 text-purple-300',
  js: 'bg-yellow-500/15 text-yellow-300',
  image: 'bg-green-500/15 text-green-300',
  favicon: 'bg-cyan-500/15 text-cyan-300',
  language: 'bg-blue-500/15 text-blue-300',
  other: 'bg-slate-500/15 text-slate-300',
};

export default function AssetBrowserPage() {
  const { id } = useParams<{ id: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ws = await api.get<Workspace | null>(`/firmware/${id}/workspace`);
      setWorkspace(ws);
      if (ws) setAssets(await api.get<Asset[]>(`/workspaces/${ws.id}/assets`));
    })().finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Asset Browser" subtitle="Web-UI files detected in the extracted firmware." />
      <FirmwareTabs id={id} />

      {loading && <Spinner />}
      {!loading && !workspace && (
        <EmptyState message="No workspace yet. Go to Details and extract the firmware first." />
      )}

      {workspace && workspace.status === 'failed' && (
        <div className="card mb-4 border-red-500/40 bg-red-500/10 text-sm text-red-200">
          <div className="mb-1 font-semibold">Extraction failed</div>
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-red-200/90">
            {workspace.error ?? 'Unknown error.'}
          </pre>
        </div>
      )}

      {workspace && assets && (
        <>
          <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
            <MockBadge isMock={workspace.isMock} />
            <span>{assets.length} assets detected</span>
            <span>· {assets.filter((a) => a.containsBrandText).length} contain vendor branding text</span>
          </div>

          {assets.length === 0 ? (
            <EmptyState message="No brandable web assets (HTML/CSS/JS/images) were found in the extracted files. The firmware extracted, but its web UI may live in a filesystem that wasn't unpacked (e.g. a SquashFS needing sasquatch). See docs/TROUBLESHOOTING.md." />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Path</th>
                    <th>Kind</th>
                    <th>Size</th>
                    <th>Brand text</th>
                    <th>Web root</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id} className="border-t border-ndtech-line">
                      <td className="py-2 font-mono text-xs text-slate-200">{a.relativePath}</td>
                      <td>
                        <span className={`badge ${KIND_COLORS[a.kind] ?? KIND_COLORS.other}`}>
                          {a.kind}
                        </span>
                      </td>
                      <td className="text-xs text-slate-400">{formatBytes(a.sizeBytes)}</td>
                      <td>{a.containsBrandText ? <span className="text-amber-300">yes</span> : <span className="text-slate-600">—</span>}</td>
                      <td>{a.isWebRootCandidate ? <span className="text-green-300">✓</span> : <span className="text-slate-600">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
