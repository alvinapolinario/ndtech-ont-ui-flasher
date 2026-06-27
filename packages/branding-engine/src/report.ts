/**
 * Patch report generation (HTML). The HTML is self-contained so it can be opened
 * directly or printed to PDF by the browser.
 */
import type { BrandingProfile, Patch, Firmware } from '@ndtech/shared';
import { SAFETY_NOTICE } from '@ndtech/shared';

function escapeHtml(s: string | null): string {
  if (s == null) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface PatchReportInput {
  firmware: Pick<Firmware, 'originalName' | 'sha256' | 'sizeBytes'>;
  profile: Pick<BrandingProfile, 'name' | 'companyName' | 'productName'> | null;
  patches: Pick<Patch, 'assetRelativePath' | 'kind' | 'oldText' | 'newText' | 'description'>[];
  generatedAt?: string;
}

export function generatePatchReportHtml(input: PatchReportInput): string {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const rows = input.patches
    .map(
      (p) => `
      <tr>
        <td><code>${escapeHtml(p.assetRelativePath)}</code></td>
        <td><span class="badge badge-${escapeHtml(p.kind)}">${escapeHtml(p.kind)}</span></td>
        <td><pre>${escapeHtml(p.oldText) || '<em>(binary / n/a)</em>'}</pre></td>
        <td><pre>${escapeHtml(p.newText) || '<em>(binary / n/a)</em>'}</pre></td>
        <td>${escapeHtml(p.description)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>NDTECH Patch Report — ${escapeHtml(input.firmware.originalName)}</title>
<style>
  body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;color:#0f172a;background:#f8fafc;}
  .wrap{max-width:1000px;margin:0 auto;padding:32px;}
  h1{color:#1e66f5;margin-bottom:4px;}
  .meta{color:#475569;font-size:14px;margin-bottom:24px;}
  .notice{background:#fef9c3;border:1px solid #fde047;padding:12px 16px;border-radius:8px;margin-bottom:24px;font-size:13px;}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);}
  th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:13px;}
  th{background:#1e293b;color:#fff;}
  pre{margin:0;white-space:pre-wrap;word-break:break-word;font-size:12px;}
  code{background:#f1f5f9;padding:2px 4px;border-radius:4px;}
  .badge{padding:2px 8px;border-radius:999px;color:#fff;font-size:11px;}
  .badge-text{background:#2563eb;}.badge-css{background:#7c3aed;}
  .badge-image{background:#16a34a;}.badge-favicon{background:#0891b2;}
  .empty{padding:24px;text-align:center;color:#64748b;}
</style>
</head>
<body>
  <div class="wrap">
    <h1>NDTECH Patch Report</h1>
    <div class="meta">
      Firmware: <strong>${escapeHtml(input.firmware.originalName)}</strong><br/>
      SHA-256: <code>${escapeHtml(input.firmware.sha256)}</code><br/>
      Size: ${input.firmware.sizeBytes.toLocaleString()} bytes<br/>
      Profile: <strong>${escapeHtml(input.profile?.name ?? 'n/a')}</strong>
      ${input.profile ? `(${escapeHtml(input.profile.companyName)} — ${escapeHtml(input.profile.productName)})` : ''}<br/>
      Generated: ${escapeHtml(generatedAt)}
    </div>
    <div class="notice"><strong>Safety:</strong> ${escapeHtml(SAFETY_NOTICE)}</div>
    ${
      input.patches.length === 0
        ? '<div class="empty">No changes were recorded for this workspace.</div>'
        : `<table>
        <thead><tr><th>Asset</th><th>Kind</th><th>Old</th><th>New</th><th>Description</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    }
  </div>
</body>
</html>`;
}
