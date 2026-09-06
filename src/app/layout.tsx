import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PWAProvider } from '@/components/pwa/PWAProvider';
import Navbar from '@/components/layout/Navbar';
import MobileNav from '@/components/layout/MobileNav';

export const metadata: Metadata = {
  title: 'fam-kit | Gemini AI Family Organizer',
  description: 'Shared family command center with categorized grocery lists, weekly meal planning, calendar, and Gemini multimodal AI assistant.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'fam-kit',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
        <PWAProvider>
          <Navbar />
          <main className="flex-1 pb-20 md:pb-8 flex flex-col">{children}</main>
          <MobileNav />
        </PWAProvider>
      </body>
    </html>
  );
}
