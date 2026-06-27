'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Dashboard', icon: '▦' },
  { href: '/upload', label: 'Upload Firmware', icon: '↥' },
  { href: '/profiles', label: 'Branding Profiles', icon: '✦' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-ndtech-line bg-ndtech-panel">
      <div className="border-b border-ndtech-line px-5 py-5">
        <div className="text-lg font-bold tracking-tight text-white">
          ND<span className="text-ndtech-blue">TECH</span>
        </div>
        <div className="text-xs text-slate-400">ONT Web UI Customizer</div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? 'bg-ndtech-blue/15 text-ndtech-blue'
                  : 'text-slate-300 hover:bg-ndtech-line/60 hover:text-white'
              }`}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-ndtech-line p-4 text-[11px] leading-relaxed text-slate-500">
        Analysis &amp; asset customization only. Use a spare ONT and keep your
        original firmware.
      </div>
    </aside>
  );
}
