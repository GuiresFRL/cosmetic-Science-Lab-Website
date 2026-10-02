import type { Metadata, Viewport } from 'next';
import { SITE_URL } from '@/lib/pages';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  authors: [{ name: 'Cosmetic Science Lab' }],
  icons: { icon: [{ url: '/images/logo.svg', type: 'image/svg+xml' }, { url: '/images/logo.png', type: 'image/png' }], apple: '/images/logo.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#1B1130' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        {children}
        {/* Site behaviour (menus, filters, search, animations). All links are plain <a> tags, so every page loads fresh and this runs once per page. */}
        <script src="/site.js" defer />
      </body>
    </html>
  );
}
