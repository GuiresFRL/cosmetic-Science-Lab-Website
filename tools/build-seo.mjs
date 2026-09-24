// Rebuilds every route's page.tsx (and Nav/Footer) from the richer multi-file
// export at C:/Users/user/Downloads/cosmetic-science-lab-site, which carries
// full per-page SEO <head> metadata (title, description, OG/Twitter tags,
// canonical, JSON-LD) that the original single-file source lacked.
//
// Body content between </nav> and <footer> is otherwise the same design as
// before, so this reuses the same HTML->JSX serializer.
//
// Run with: node tools/build-seo.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { nodesToJsx } from './jsx-serializer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = 'C:/Users/user/Downloads/cosmetic-science-lab-site';
const APP_DIR = path.join(ROOT, 'app');
const COMPONENTS_DIR = path.join(ROOT, 'components');
const PUBLIC_IMAGES = path.join(ROOT, 'public', 'images');
const SITE_ORIGIN = 'https://www.cosmeticsciencelab.com';

fs.mkdirSync(PUBLIC_IMAGES, { recursive: true });

// ---------------------------------------------------------------------------
// Copy real image assets referenced by <head> (logo, OG image) alongside the
// ones already extracted from the base64 source (hero.jpg, guires-logo.png).
// ---------------------------------------------------------------------------
for (const name of ['logo.svg', 'logo.png', 'og-image.png', 'guires-logo.png', 'hero.jpg']) {
  const src = path.join(SOURCE_DIR, 'images', name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(PUBLIC_IMAGES, name));
    console.log('Copied public/images/' + name);
  }
}

// ---------------------------------------------------------------------------
// Rewrite `slug.html` -> `/slug` (and bare `index.html` -> `/`) everywhere:
// href attributes, canonical/OG URLs, and inside the raw JSON-LD text.
// ---------------------------------------------------------------------------
function rewriteHtmlLinks(raw) {
  return raw
    // absolute URLs: https://www.cosmeticsciencelab.com/slug.html -> .../slug
    .replace(/(https?:\/\/www\.cosmeticsciencelab\.com)\/index\.html(#[^"'\s)]*)?/g, (_, origin, anchor) => `${origin}/${anchor || ''}`)
    .replace(/(https?:\/\/www\.cosmeticsciencelab\.com)\/([a-zA-Z0-9_-]+)\.html(#[^"'\s)]*)?/g, (_, origin, slug, anchor) => `${origin}/${slug}${anchor || ''}`)
    // bare relative links: "index.html" / "slug.html" / "slug.html#anchor"
    .replace(/(["'(])index\.html(#[^"')]*)?(["')])/g, (_, open, anchor, close) => `${open}/${anchor || ''}${close}`)
    .replace(/(["'(])([a-zA-Z0-9_-]+)\.html(#[^"')]*)?(["')])/g, (_, open, slug, anchor, close) => `${open}/${slug}${anchor || ''}${close}`)
    // relative image refs inside inline style url(...): url('images/x.jpg') -> url('/images/x.jpg')
    // (relative to the document when inlined in the original single-file source, but relative to
    // the compiled CSS chunk's own path once bundled by Next.js, which 404s without a leading slash)
    .replace(/url\((["']?)(?!\/|https?:|data:)images\//g, 'url($1/images/');
}

function tsLiteral(v) {
  if (v === null || v === undefined) return 'undefined';
  if (Array.isArray(v)) return `[${v.map(tsLiteral).join(', ')}]`;
  if (typeof v === 'object') {
    const entries = Object.entries(v).filter(([, val]) => val !== undefined && val !== '');
    return `{ ${entries.map(([k, val]) => `${JSON.stringify(k)}: ${tsLiteral(val)}`).join(', ')} }`;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

function routeDirFor(slug) {
  if (slug === 'home') return APP_DIR;
  if (slug === '404') return null;
  return path.join(APP_DIR, slug);
}

// ---------------------------------------------------------------------------
// Pass 1: Nav + Footer, sourced from index.html (shared across every page).
// ---------------------------------------------------------------------------
{
  const raw = rewriteHtmlLinks(fs.readFileSync(path.join(SOURCE_DIR, 'index.html'), 'utf8'));
  const $ = cheerio.load(raw, { xmlMode: false });
  const navEl = $('nav.nav')[0];
  const footerEl = $('footer')[0];
  if (!navEl || !footerEl) throw new Error('nav/footer not found in index.html');

  const navResult = nodesToJsx([navEl]);
  const footerResult = nodesToJsx([footerEl]);
  if (navResult.needsClient || footerResult.needsClient) throw new Error('nav/footer unexpectedly need client handling');

  function cssImport(needsCssVarCast) {
    return needsCssVarCast ? "import type { CSSProperties } from 'react';\n\n" : '';
  }

  fs.writeFileSync(
    path.join(COMPONENTS_DIR, 'Nav.tsx'),
    `${cssImport(navResult.needsCssVarCast)}export default function Nav() {\n  return (\n    ${navResult.jsx}\n  );\n}\n`
  );
  fs.writeFileSync(
    path.join(COMPONENTS_DIR, 'Footer.tsx'),
    `${cssImport(footerResult.needsCssVarCast)}export default function Footer() {\n  return (\n    ${footerResult.jsx}\n  );\n}\n`
  );
  console.log('Wrote components/Nav.tsx, components/Footer.tsx (from index.html)');
}

// ---------------------------------------------------------------------------
// Pass 2: every page's <head> metadata + body content.
// ---------------------------------------------------------------------------
const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.endsWith('.html'));
const results = [];

for (const file of files) {
  const slugRaw = file.replace(/\.html$/, '');
  const slug = slugRaw === 'index' ? 'home' : slugRaw;

  const raw = rewriteHtmlLinks(fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8'));
  const $ = cheerio.load(raw, { xmlMode: false });

  const title = $('title').text();
  const description = $('meta[name="description"]').attr('content') || '';
  const keywords = $('meta[name="keywords"]').attr('content') || '';
  const robots = $('meta[name="robots"]').attr('content') || 'index, follow';
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const ogTitle = $('meta[property="og:title"]').attr('content') || title;
  const ogDescription = $('meta[property="og:description"]').attr('content') || description;
  const ogUrl = $('meta[property="og:url"]').attr('content') || canonical;
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  const ogImageWidth = $('meta[property="og:image:width"]').attr('content');
  const ogImageHeight = $('meta[property="og:image:height"]').attr('content');
  const ogLocale = $('meta[property="og:locale"]').attr('content') || 'en_GB';
  const twitterCard = $('meta[name="twitter:card"]').attr('content') || 'summary_large_image';
  const twitterTitle = $('meta[name="twitter:title"]').attr('content') || ogTitle;
  const twitterDescription = $('meta[name="twitter:description"]').attr('content') || ogDescription;
  const twitterImage = $('meta[name="twitter:image"]').attr('content') || ogImage;
  const jsonLd = $('script[type="application/ld+json"]').first().html();

  const metadataObj = {
    title,
    description,
    keywords,
    authors: [{ name: 'Cosmetic Science Lab' }],
    robots,
    alternates: {
      canonical,
      languages: { en: canonical, 'x-default': canonical },
    },
    openGraph: {
      type: 'website',
      siteName: 'Cosmetic Science Lab',
      title: ogTitle,
      description: ogDescription,
      url: ogUrl,
      locale: ogLocale,
      images: ogImage ? [{ url: ogImage, width: Number(ogImageWidth) || undefined, height: Number(ogImageHeight) || undefined }] : undefined,
    },
    twitter: {
      card: twitterCard,
      title: twitterTitle,
      description: twitterDescription,
      images: twitterImage ? [twitterImage] : undefined,
    },
  };

  // Body: everything between </nav> and <footer>.
  const bodyChildren = [];
  let inBody = false;
  $('body')
    .children()
    .each((_, el) => {
      if (el.tagName === 'nav' && (el.attribs.class || '').includes('nav')) {
        inBody = true;
        return;
      }
      if (el.tagName === 'footer') {
        inBody = false;
        return;
      }
      if (inBody) bodyChildren.push(el);
    });
  if (bodyChildren.length === 0) throw new Error(`No body content extracted for ${file}`);

  const { jsx, needsClient, needsCssVarCast } = nodesToJsx(bodyChildren);
  results.push({ slug, needsClient });

  const metadataSrc = `export const metadata: Metadata = ${tsLiteral(metadataObj)};\n\n`;
  const ldScript = jsonLd
    ? `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ${JSON.stringify(jsonLd)} }} />`
    : '';
  const bodyJsx = `<>\n      ${ldScript}\n      ${jsx}\n    </>`;
  const cssImportLine = needsCssVarCast ? "import type { CSSProperties } from 'react';\n" : '';
  const metaTypeImport = "import type { Metadata } from 'next';\n";

  if (slug === '404') {
    fs.writeFileSync(
      path.join(APP_DIR, 'not-found.tsx'),
      (needsClient ? "'use client';\n\n" : '') +
        metaTypeImport +
        cssImportLine +
        '\n' +
        metadataSrc +
        `export default function NotFound() {\n  return (\n    ${bodyJsx}\n  );\n}\n`
    );
    continue;
  }

  const dir = routeDirFor(slug);
  fs.mkdirSync(dir, { recursive: true });

  if (needsClient) {
    fs.writeFileSync(
      path.join(dir, 'content.tsx'),
      `'use client';\n\n${cssImportLine}export default function Content() {\n  return (\n    ${bodyJsx}\n  );\n}\n`
    );
    fs.writeFileSync(
      path.join(dir, 'page.tsx'),
      metaTypeImport + `import Content from './content';\n\n` + metadataSrc + `export default function Page() {\n  return <Content />;\n}\n`
    );
  } else {
    fs.writeFileSync(
      path.join(dir, 'page.tsx'),
      metaTypeImport + cssImportLine + '\n' + metadataSrc + `export default function Page() {\n  return (\n    ${bodyJsx}\n  );\n}\n`
    );
  }
}

console.log(`\nProcessed ${results.length} pages.`);
console.log('Client-component pages:', results.filter((r) => r.needsClient).map((r) => r.slug).join(', '));
