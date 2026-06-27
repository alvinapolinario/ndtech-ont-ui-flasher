'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function FirmwareTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/firmware/${id}`;
  const tabs = [
    { href: base, label: 'Details' },
    { href: `${base}/analysis`, label: 'Analysis' },
    { href: `${base}/assets`, label: 'Asset Browser' },
    { href: `${base}/branding`, label: 'Apply Branding' },
    { href: `${base}/preview`, label: 'Preview' },
    { href: `${base}/reports`, label: 'Reports' },
  ];

  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-ndtech-line">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition ${
              active
                ? 'border-ndtech-blue text-ndtech-blue'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
