import fs from 'node:fs';
import path from 'node:path';
import manifest from '@/content/manifest.json';

export type PageEntry = {
  path: string; slug: string[]; key: string; title: string; description: string | null; keywords: string | null; robots: string;
  canonical: string | null; languages: Record<string, string>;
  og: { type: string; title: string | null; description: string | null; url: string | null; image: string | null; locale: string | null; siteName: string | null; publishedTime: string | null; section: string | null };
  jsonld: unknown[];
};
export const PAGES = manifest as PageEntry[];
export const SITE_URL = 'https://www.cosmeticsciencelab.com';
// pages served by the catch-all route (404 is rendered by app/not-found.tsx)
export const ROUTED = PAGES.filter(p => p.path !== '/404');
export function findPage(slug: string[] | undefined): PageEntry | undefined {
  const p = '/' + (slug ?? []).join('/');
  return ROUTED.find(x => x.path === p);
}
export function pageHtml(key: string): string {
  return fs.readFileSync(path.join(process.cwd(), 'content', 'pages', key + '.html'), 'utf8');
}
