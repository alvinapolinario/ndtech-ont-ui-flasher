import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'NDTECH ONT Web UI Customizer',
  description:
    'Safe, analysis-only branding customizer for owned/spare Huawei EchoLife HG8145V5 V2 ONT firmware.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex">
          <Sidebar />
          <main className="h-screen flex-1 overflow-auto px-8 py-7">{children}</main>
        </div>
      </body>
    </html>
  );
}
