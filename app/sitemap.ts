import type { MetadataRoute } from 'next';
import { ROUTED, SITE_URL } from '@/lib/pages';
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTED.filter(p => !p.robots.includes('noindex'))
    .map(p => ({ url: SITE_URL + (p.path === '/' ? '' : p.path), lastModified }));   // matches the canonical Next renders for each page
}
