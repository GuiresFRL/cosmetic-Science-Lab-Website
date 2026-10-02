import type { Metadata } from 'next';
import { pageHtml } from '@/lib/pages';
export const metadata: Metadata = { title: { absolute: 'Page not found · Cosmetic Science Lab' }, robots: { index: false, follow: false } };
export default function NotFound() {
  return <div className="page-root" dangerouslySetInnerHTML={{ __html: pageHtml('404') }} />;
}
