import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Fiscus Tap – Pagos Físicos Apple-grade',
  description: 'Infraestructura de cobro y pago físico a un toque para comercios y personas',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Fiscus Tap',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#fbfbfd',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Fiscus Tap" />
        <link rel="apple-touch-icon" href="/apple-icon" />
      </head>
      <body className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] antialiased selection:bg-[#0071e3]/10 selection:text-[#0071e3]">
        {children}
      </body>
    </html>
  );
}
