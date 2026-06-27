import React from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/15 text-green-300',
  extracted: 'bg-green-500/15 text-green-300',
  running: 'bg-blue-500/15 text-blue-300',
  extracting: 'bg-blue-500/15 text-blue-300',
  pending: 'bg-slate-500/15 text-slate-300',
  created: 'bg-slate-500/15 text-slate-300',
  queued: 'bg-slate-500/15 text-slate-300',
  failed: 'bg-red-500/15 text-red-300',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-slate-500/15 text-slate-300';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function MockBadge({ isMock }: { isMock: boolean }) {
  if (!isMock) return null;
  return <span className="badge bg-purple-500/15 text-purple-300">mock</span>;
}

export function Terminal({ text }: { text: string }) {
  return <pre className="terminal whitespace-pre-wrap">{text || '(no output)'}</pre>;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-ndtech-line p-8 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-600 border-t-ndtech-blue" />
      {label ?? 'Loading…'}
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}
