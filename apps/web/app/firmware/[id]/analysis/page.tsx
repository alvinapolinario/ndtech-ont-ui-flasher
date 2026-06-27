'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { AnalysisResult } from '@/lib/types';
import { FirmwareTabs } from '@/components/FirmwareTabs';
import { PageHeader, StatusBadge, MockBadge, Spinner, EmptyState, Terminal } from '@/components/ui';

const KIND_COLORS: Record<string, string> = {
  squashfs: 'bg-green-500/15 text-green-300',
  rootfs: 'bg-green-500/15 text-green-300',
  kernel: 'bg-blue-500/15 text-blue-300',
  bootloader: 'bg-amber-500/15 text-amber-300',
  jffs2: 'bg-purple-500/15 text-purple-300',
  cramfs: 'bg-purple-500/15 text-purple-300',
};

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AnalysisResult | null>(`/firmware/${id}/analysis`)
      .then(setAnalysis)
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Analysis Results" subtitle="Read-only binwalk signature scan — nothing is modified." />
      <FirmwareTabs id={id} />

      {loading && <Spinner />}
      {!loading && !analysis && (
        <EmptyState message="No analysis yet. Go to Details and run the binwalk analysis." />
      )}

      {analysis && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <StatusBadge status={analysis.status} />
            <MockBadge isMock={analysis.isMock} />
            <span className="text-xs text-slate-500">
              {new Date(analysis.createdAt).toLocaleString()}
            </span>
          </div>

          {analysis.error && (
            <div className="card border-red-500/40 text-red-300">{analysis.error}</div>
          )}

          <div className="card">
            <h3 className="mb-3 text-sm font-semibold uppercase text-slate-400">
              Detected partitions ({analysis.partitions.length})
            </h3>
            {analysis.partitions.length === 0 ? (
              <EmptyState message="No recognizable partitions detected." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2">Kind</th>
                      <th>Offset</th>
                      <th>Size</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.partitions.map((p, i) => (
                      <tr key={i} className="border-t border-ndtech-line">
                        <td className="py-2">
                          <span className={`badge ${KIND_COLORS[p.kind] ?? 'bg-slate-500/15 text-slate-300'}`}>
                            {p.kind}
                          </span>
                        </td>
                        <td className="font-mono text-xs">0x{p.offset.toString(16)}</td>
                        <td className="font-mono text-xs">{p.size ?? '—'}</td>
                        <td className="text-slate-300">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {analysis.fileOutput && (
            <div className="card">
              <h3 className="mb-3 text-sm font-semibold uppercase text-slate-400">file(1) output</h3>
              <Terminal text={analysis.fileOutput} />
            </div>
          )}

          <div className="card">
            <h3 className="mb-3 text-sm font-semibold uppercase text-slate-400">binwalk output</h3>
            <Terminal text={analysis.binwalkOutput} />
          </div>
        </div>
      )}
    </div>
  );
}
