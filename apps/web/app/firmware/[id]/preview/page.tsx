'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, urls } from '@/lib/api';
import type { Asset, Workspace, AssetContent } from '@/lib/types';
import { FirmwareTabs } from '@/components/FirmwareTabs';
import { PageHeader, Spinner, EmptyState } from '@/components/ui';

/** Resolve a relative href/src against a base directory, collapsing ./ and ../ */
function resolveRelative(baseDir: string, ref: string): string {
  const parts = (baseDir ? baseDir.split('/') : []).concat(ref.split('/'));
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

const SKIP_REF = /^(https?:|data:|blob:|mailto:|tel:|#|\/\/|javascript:)/i;

/**
 * Rewrite relative asset references (img/src, link/href, source/src) in the
 * previewed HTML to absolute API raw-asset URLs, so images and stylesheets load
 * inside the sandboxed preview iframe instead of 404-ing against the web app.
 */
function rewriteHtmlAssets(html: string, selected: Asset, assets: Asset[]): string {
  if (typeof window === 'undefined') return html;

  const byPath = new Map<string, Asset>();
  const byBase = new Map<string, Asset>();
  for (const a of assets) {
    byPath.set(a.relativePath, a);
    const base = a.relativePath.split('/').pop();
    if (base) byBase.set(base, a);
  }

  const baseDir = selected.relativePath.split('/').slice(0, -1).join('/');

  const findAsset = (ref: string): Asset | undefined => {
    const clean = ref.split('?')[0]!.split('#')[0]!;
    if (!clean) return undefined;
    const resolved = resolveRelative(baseDir, clean.replace(/^\//, ''));
    return byPath.get(resolved) ?? byBase.get(clean.split('/').pop() ?? clean);
  };

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return html;
  }

  const rewriteAttr = (selector: string, attr: string) => {
    doc.querySelectorAll(selector).forEach((el) => {
      const val = el.getAttribute(attr);
      if (!val || SKIP_REF.test(val)) return;
      const asset = findAsset(val);
      if (asset) el.setAttribute(attr, urls.assetRaw(asset.id));
    });
  };

  rewriteAttr('img[src]', 'src');
  rewriteAttr('source[src]', 'src');
  rewriteAttr('input[type="image"][src]', 'src');
  rewriteAttr('link[href]', 'href');

  return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
}

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [content, setContent] = useState<AssetContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ws = await api.get<Workspace | null>(`/firmware/${id}/workspace`);
      setWorkspace(ws);
      if (ws) {
        const all = await api.get<Asset[]>(`/workspaces/${ws.id}/assets`);
        const previewable = all.filter((a) => ['html', 'css', 'js', 'image', 'favicon'].includes(a.kind));
        setAssets(previewable);
        const firstHtml = previewable.find((a) => a.kind === 'html') ?? previewable[0] ?? null;
        setSelected(firstHtml);
      }
    })().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!selected) return;
    setContent(null);
    if (selected.kind === 'image' || selected.kind === 'favicon') return;
    api.get<AssetContent>(`/assets/${selected.id}/content`).then(setContent);
  }, [selected]);

  const previewHtml = useMemo(() => {
    if (!content?.text || !selected || selected.kind !== 'html') return null;
    return rewriteHtmlAssets(content.text, selected, assets);
  }, [content, selected, assets]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Preview" subtitle="Before/after view of readable web assets." />
      <FirmwareTabs id={id} />

      {loading && <Spinner />}
      {!loading && !workspace && <EmptyState message="No workspace yet. Extract the firmware first." />}

      {workspace?.isMock && (
        <div className="card mb-4 border-amber-500/40 bg-amber-500/10 text-sm text-amber-200">
          <strong>Sample UI.</strong> These pages are a bundled demo (the Linux extraction tools
          weren&apos;t available), so this is <em>not</em> the uploaded firmware&apos;s real web UI.
          Enable the WSL bridge (<span className="font-mono">docs/WSL-SETUP.md</span>) and re-extract
          to preview the actual firmware UI.
        </div>
      )}

      {workspace && (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="card max-h-[70vh] overflow-auto">
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">Assets</h3>
            {assets.length === 0 && <EmptyState message="No previewable assets." />}
            <ul className="space-y-1">
              {assets.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => setSelected(a)}
                    className={`w-full truncate rounded px-2 py-1 text-left font-mono text-xs ${
                      selected?.id === a.id ? 'bg-ndtech-blue/20 text-ndtech-blue' : 'text-slate-300 hover:bg-ndtech-line/60'
                    }`}
                  >
                    {a.relativePath}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            {!selected && <EmptyState message="Select an asset to preview." />}

            {selected && (selected.kind === 'image' || selected.kind === 'favicon') && (
              <div className="text-center">
                <div className="mb-3 font-mono text-xs text-slate-400">{selected.relativePath}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urls.assetRaw(selected.id)}
                  alt={selected.relativePath}
                  className="mx-auto max-h-[60vh] rounded border border-ndtech-line bg-white p-4"
                />
              </div>
            )}

            {selected && !(selected.kind === 'image' || selected.kind === 'favicon') && (
              <>
                <div className="mb-3 font-mono text-xs text-slate-400">{selected.relativePath}</div>
                {!content && <Spinner label="Reading asset…" />}
                {content?.warning && (
                  <div className="mb-3 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                    {content.warning}
                  </div>
                )}
                {content?.text != null && selected.kind === 'html' && (
                  <iframe
                    title="preview"
                    sandbox=""
                    srcDoc={previewHtml ?? content.text}
                    className="h-[60vh] w-full rounded border border-ndtech-line bg-white"
                  />
                )}
                {content?.text != null && selected.kind !== 'html' && (
                  <pre className="terminal max-h-[60vh] whitespace-pre-wrap text-slate-200">{content.text}</pre>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
