'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { BrandingProfile, Workspace, ApplyBrandingResult, Patch } from '@/lib/types';
import { FirmwareTabs } from '@/components/FirmwareTabs';
import { SafetyBanner } from '@/components/SafetyBanner';
import { PageHeader, Spinner, EmptyState } from '@/components/ui';

export default function ApplyBrandingPage() {
  const { id } = useParams<{ id: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [selected, setSelected] = useState('');
  const [patches, setPatches] = useState<Patch[] | null>(null);
  const [result, setResult] = useState<ApplyBrandingResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [ws, profs] = await Promise.all([
        api.get<Workspace | null>(`/firmware/${id}/workspace`),
        api.get<BrandingProfile[]>(`/profiles`),
      ]);
      setWorkspace(ws);
      setProfiles(profs);
      setSelected(profs.find((p) => p.isDefault)?.id ?? profs[0]?.id ?? '');
      if (ws) setPatches(await api.get<Patch[]>(`/workspaces/${ws.id}/patches`));
    })()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function apply() {
    if (!workspace || !selected) return;
    setBusy('apply');
    setError(null);
    try {
      const r = await api.post<ApplyBrandingResult>(`/workspaces/${workspace.id}/branding`, {
        profileId: selected,
      });
      setResult(r);
      setPatches(r.patches);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed.');
    } finally {
      setBusy(null);
    }
  }

  async function revert() {
    if (!workspace) return;
    setBusy('revert');
    setError(null);
    try {
      await api.post(`/workspaces/${workspace.id}/revert`);
      setResult(null);
      setPatches([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revert failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Apply Branding" subtitle="Replace visible labels, colors, logo & favicon. Backups are automatic." />
      <FirmwareTabs id={id} />
      <SafetyBanner>
        <strong>Reversible:</strong> Every modified file is backed up as{' '}
        <code>&lt;file&gt;.ndtech-backup</code> before changes. Use{' '}
        <strong>Revert</strong> to restore originals. Only visible web-UI assets
        are touched — no behaviour, signatures, or accounts.
      </SafetyBanner>

      {loading && <Spinner />}
      {!loading && !workspace && (
        <EmptyState message="No workspace yet. Extract the firmware first (Details tab)." />
      )}

      {workspace && (
        <div className="space-y-6">
          <div className="card flex flex-wrap items-end gap-4">
            <div className="min-w-[240px] flex-1">
              <label className="label">Branding profile</label>
              <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.productName}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-primary" onClick={apply} disabled={busy !== null || !selected}>
              {busy === 'apply' ? 'Applying…' : 'Apply branding'}
            </button>
            <button className="btn-secondary" onClick={revert} disabled={busy !== null}>
              {busy === 'revert' ? 'Reverting…' : 'Revert to originals'}
            </button>
          </div>

          {error && <div className="card border-red-500/40 text-red-300">{error}</div>}

          {result && result.warnings.length > 0 && (
            <div className="card border-amber-500/40 text-amber-200">
              <div className="mb-1 font-semibold">Warnings</div>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <h3 className="mb-3 text-sm font-semibold uppercase text-slate-400">
              Patch report {patches ? `(${patches.length} changes)` : ''}
            </h3>
            {!patches || patches.length === 0 ? (
              <EmptyState message="No changes recorded yet. Apply a profile to generate the patch report." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2">Asset</th>
                      <th>Kind</th>
                      <th>Old</th>
                      <th>New</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patches.map((p) => (
                      <tr key={p.id} className="border-t border-ndtech-line align-top">
                        <td className="py-2 font-mono text-xs">{p.assetRelativePath}</td>
                        <td><span className="badge bg-blue-500/15 text-blue-300">{p.kind}</span></td>
                        <td className="max-w-[180px] truncate font-mono text-xs text-slate-400">{p.oldText ?? '—'}</td>
                        <td className="max-w-[180px] truncate font-mono text-xs text-green-300">{p.newText ?? '—'}</td>
                        <td className="text-xs text-slate-300">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
