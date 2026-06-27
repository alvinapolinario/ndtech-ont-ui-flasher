'use client';

import { useEffect, useRef, useState } from 'react';
import { api, urls, uploadProfileAsset } from '@/lib/api';
import type { BrandingProfile } from '@/lib/types';
import { PageHeader, Spinner, EmptyState } from '@/components/ui';

const BLANK = {
  name: '',
  companyName: 'NDTECH I.T. Services',
  productName: 'NDTECH Fiber Gateway',
  supportText: 'For support, contact NDTECH technical support.',
  website: 'https://ndtech.com.ph',
  footerText: 'Powered by NDTECH I.T. Services',
  primaryColor: '#1e66f5',
  secondaryColor: '#16a34a',
  loginTitle: 'NDTECH Fiber Gateway',
  dashboardTitle: 'NDTECH Fiber Gateway',
};

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<BrandingProfile[] | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped after each upload so <img> URLs bust the browser cache.
  const [assetVersion, setAssetVersion] = useState(0);

  async function load() {
    setProfiles(await api.get<BrandingProfile[]>('/profiles'));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/profiles', form);
      setForm({ ...BLANK });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.del(`/profiles/${id}`).catch((e) => setError(e.message));
    await load();
  }
  async function makeDefault(id: string) {
    await api.put(`/profiles/${id}`, { isDefault: true }).catch((e) => setError(e.message));
    await load();
  }
  async function exportJson(id: string) {
    const r = await api.get<{ path: string }>(`/profiles/${id}/export`).catch(() => null);
    if (r) alert(`Exported to:\n${r.path}`);
  }
  async function uploadAsset(id: string, kind: 'logo' | 'favicon', file: File) {
    setError(null);
    try {
      await uploadProfileAsset(id, kind, file);
      await load();
      setAssetVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${kind} upload failed.`);
    }
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Branding Profiles" subtitle="Reusable NDTECH branding presets applied to extracted web assets." />

      {error && <div className="card mb-4 border-red-500/40 text-red-300">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {!profiles && <Spinner />}
          {profiles && profiles.length === 0 && <EmptyState message="No profiles yet." />}
          <div className="grid gap-3">
            {profiles?.map((p) => (
              <div key={p.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-white">
                      {p.name}
                      {p.isDefault && <span className="badge bg-green-500/15 text-green-300">default</span>}
                    </div>
                    <div className="text-sm text-slate-400">
                      {p.companyName} · {p.productName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{p.footerText}</div>
                  </div>
                  <div className="flex gap-2">
                    <span className="h-6 w-6 rounded border border-ndtech-line" style={{ background: p.primaryColor }} title={p.primaryColor} />
                    <span className="h-6 w-6 rounded border border-ndtech-line" style={{ background: p.secondaryColor }} title={p.secondaryColor} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-6 border-t border-ndtech-line pt-4">
                  <AssetUploader
                    label="Logo"
                    hasAsset={Boolean(p.logoPath)}
                    src={`${urls.profileLogo(p.id)}?v=${assetVersion}`}
                    accept="image/png,image/gif,image/jpeg,image/svg+xml"
                    hint="PNG/GIF/JPG/SVG"
                    onPick={(file) => uploadAsset(p.id, 'logo', file)}
                  />
                  <AssetUploader
                    label="Favicon"
                    hasAsset={Boolean(p.faviconPath)}
                    src={`${urls.profileFavicon(p.id)}?v=${assetVersion}`}
                    accept="image/x-icon,image/png,.ico"
                    hint=".ico/.png"
                    onPick={(file) => uploadAsset(p.id, 'favicon', file)}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {!p.isDefault && (
                    <button className="btn-secondary !py-1 !text-xs" onClick={() => makeDefault(p.id)}>
                      Set default
                    </button>
                  )}
                  <button className="btn-secondary !py-1 !text-xs" onClick={() => exportJson(p.id)}>
                    Export JSON
                  </button>
                  {!p.isDefault && (
                    <button className="btn-danger !py-1 !text-xs" onClick={() => remove(p.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={create} className="card h-fit space-y-3">
          <h3 className="text-sm font-semibold uppercase text-slate-400">New profile</h3>
          <Field label="Profile name" value={form.name} onChange={(v) => set('name', v)} required />
          <Field label="Company name" value={form.companyName} onChange={(v) => set('companyName', v)} />
          <Field label="Product name" value={form.productName} onChange={(v) => set('productName', v)} />
          <Field label="Footer text" value={form.footerText} onChange={(v) => set('footerText', v)} />
          <Field label="Website" value={form.website} onChange={(v) => set('website', v)} />
          <Field label="Login title" value={form.loginTitle} onChange={(v) => set('loginTitle', v)} />
          <Field label="Dashboard title" value={form.dashboardTitle} onChange={(v) => set('dashboardTitle', v)} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Primary</label>
              <input type="color" value={form.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} className="h-10 w-full rounded border border-ndtech-line bg-ndtech-ink" />
            </div>
            <div>
              <label className="label">Secondary</label>
              <input type="color" value={form.secondaryColor} onChange={(e) => set('secondaryColor', e.target.value)} className="h-10 w-full rounded border border-ndtech-line bg-ndtech-ink" />
            </div>
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Creating…' : 'Create profile'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={value} required={required} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function AssetUploader({
  label,
  hasAsset,
  src,
  accept,
  hint,
  onPick,
}: {
  label: string;
  hasAsset: boolean;
  src: string;
  accept: string;
  hint: string;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await onPick(file);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded border border-ndtech-line bg-white/90">
        {hasAsset ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`${label} preview`} className="max-h-12 max-w-12 object-contain" />
        ) : (
          <span className="text-[10px] text-slate-500">none</span>
        )}
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-300">{label}</div>
        <button
          type="button"
          className="btn-secondary !py-1 !text-xs"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Uploading…' : hasAsset ? 'Replace' : 'Upload'}
        </button>
        <div className="mt-0.5 text-[10px] text-slate-500">{hint}</div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0] ?? undefined)}
      />
    </div>
  );
}
