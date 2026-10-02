import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ROUTED, findPage, pageHtml, SITE_NOINDEX } from '@/lib/pages';

export const dynamicParams = false;           // only the frozen URLs exist; anything else is a real 404
export function generateStaticParams() { return ROUTED.map(p => ({ slug: p.slug })); }

type Props = { params: Promise<{ slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = findPage((await params).slug);
  if (!p) return {};
  const [index, follow] = p.robots.split(',').map(s => s.trim());
  const open = !SITE_NOINDEX;                   // pre-launch: every page is noindex, nofollow
  return {
    title: { absolute: p.title },
    description: p.description ?? undefined,
    keywords: p.keywords ?? undefined,
    robots: { index: open && index !== 'noindex', follow: open && follow !== 'nofollow' },
    alternates: { canonical: p.canonical ?? undefined, languages: p.languages },
    openGraph: {
      type: p.og.type === 'article' ? 'article' : 'website',
      title: p.og.title ?? p.title, description: p.og.description ?? undefined, url: p.og.url ?? undefined,
      siteName: p.og.siteName ?? undefined, locale: p.og.locale ?? undefined,
      images: p.og.image ? [{ url: p.og.image, width: 1200, height: 630 }] : undefined,
      ...(p.og.type === 'article' ? { publishedTime: p.og.publishedTime ?? undefined, section: p.og.section ?? undefined } : {}),
    },
    twitter: { card: 'summary_large_image', title: p.og.title ?? p.title, description: p.og.description ?? undefined, images: p.og.image ? [p.og.image] : undefined },
  };
}

export default async function Page({ params }: Props) {
  const p = findPage((await params).slug);
  if (!p) notFound();
  return (
    <>
      {p.jsonld.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}
      <div className="page-root" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: pageHtml(p.key) }} />
    </>
  );
}
