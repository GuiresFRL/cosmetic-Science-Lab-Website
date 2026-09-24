// One-shot generator: reads the source single-file SPA HTML and emits a
// Next.js App Router project (globals.css, Nav/Footer components, and one
// route per `data-page`) into ../app and ../public.
//
// Run with: node tools/build.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { nodesToJsx } from './jsx-serializer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE = 'C:/Users/user/Downloads/cosmetic-science-lab-all-pages (1).html';
const APP_DIR = path.join(ROOT, 'app');
const PUBLIC_IMAGES = path.join(ROOT, 'public', 'images');

let src = fs.readFileSync(SOURCE, 'utf8');

// ---------------------------------------------------------------------------
// 1. Pull the two embedded base64 images out to real files under /public,
//    and replace their data: URIs in the source text with short paths.
// ---------------------------------------------------------------------------
fs.mkdirSync(PUBLIC_IMAGES, { recursive: true });

function extractBase64Once(regex, outFile, publicPath) {
  const m = regex.exec(src);
  if (!m) throw new Error('Expected to find base64 asset matching ' + regex);
  const buf = Buffer.from(m[1], 'base64');
  fs.writeFileSync(outFile, buf);
  src = src.slice(0, m.index) + publicPath + src.slice(m.index + m[0].length);
  console.log(`Extracted ${outFile} (${buf.length} bytes)`);
}

// guires logo appears twice (light + dark variant), identical bytes each time.
extractBase64Once(
  /data:image\/png;base64,([A-Za-z0-9+/=]+)/,
  path.join(PUBLIC_IMAGES, 'guires-logo.png'),
  '/images/guires-logo.png'
);
extractBase64Once(
  /data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/,
  path.join(PUBLIC_IMAGES, 'hero.jpg'),
  '/images/hero.jpg'
);
extractBase64Once(
  /data:image\/png;base64,([A-Za-z0-9+/=]+)/,
  path.join(PUBLIC_IMAGES, 'guires-logo-2.png'),
  '/images/guires-logo.png'
);
// guires-logo-2.png is a duplicate of guires-logo.png (same bytes); drop the
// second file and just point both usages at the same path.
fs.rmSync(path.join(PUBLIC_IMAGES, 'guires-logo-2.png'), { force: true });

// ---------------------------------------------------------------------------
// 2. Build the slug set (every data-page value) and rewrite in-app links
//    from hash-routing (#slug, #slug.anchor) to real paths (/slug, /slug#anchor).
// ---------------------------------------------------------------------------
const slugSet = new Set();
{
  const re = /data-page="([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) slugSet.add(m[1]);
}
console.log(`Found ${slugSet.size} pages:`, [...slugSet].join(', '));

src = src.replace(/href="#([^"]*)"/g, (whole, inner) => {
  if (inner === '') return whole; // href="#" placeholder, leave as-is
  let slug = inner;
  let anchor = '';
  const dot = inner.indexOf('.');
  if (dot !== -1) {
    slug = inner.slice(0, dot);
    anchor = inner.slice(dot + 1);
  }
  if (!slugSet.has(slug)) return whole; // in-page anchor, not a page link
  const base = slug === 'home' ? '/' : `/${slug}`;
  const target = anchor ? `${base === '/' ? '' : base}#${anchor}` : base;
  return `href="${target}"`;
});

// ---------------------------------------------------------------------------
// 3. Extract the <style> block verbatim into app/globals.css.
// ---------------------------------------------------------------------------
{
  const styleMatch = /<style>([\s\S]*?)<\/style>/.exec(src);
  if (!styleMatch) throw new Error('style block not found');
  fs.writeFileSync(path.join(APP_DIR, 'globals.css'), styleMatch[1].trimStart() + '\n');
  console.log('Wrote app/globals.css');
}

// ---------------------------------------------------------------------------
// 4. Parse the full document and grab nav / footer / page fragments.
// ---------------------------------------------------------------------------
const $ = cheerio.load(src, { xmlMode: false });

function fragmentJsx(nodes) {
  return nodesToJsx(nodes.get ? nodes.get() : nodes);
}

// -- Nav ----------------------------------------------------------------
const navEl = $('nav.nav')[0];
if (!navEl) throw new Error('nav.nav not found');
const navResult = nodesToJsx([navEl]);
if (navResult.needsClient) throw new Error('nav requires client handling — update generator');

// -- Footer (includes #consent banner nested inside it) -----------------
const footerEl = $('footer')[0];
if (!footerEl) throw new Error('footer not found');
const footerResult = nodesToJsx([footerEl]);
if (footerResult.needsClient) throw new Error('footer requires client handling — update generator');

// -- Pages ----------------------------------------------------------------
const pages = [];
$('div.page').each((_, el) => {
  const dataPage = el.attribs['data-page'];
  const dataTitle = el.attribs['data-title'];
  pages.push({ slug: dataPage, title: dataTitle, children: el.children });
});
console.log(`Extracted ${pages.length} page blocks`);

fs.writeFileSync(
  path.join(__dirname, '.extracted-pages.json'),
  JSON.stringify(pages.map((p) => ({ slug: p.slug, title: p.title })), null, 2)
);

// ---------------------------------------------------------------------------
// 5. Write components/Nav.tsx and components/Footer.tsx
// ---------------------------------------------------------------------------
const COMPONENTS_DIR = path.join(ROOT, 'components');
fs.mkdirSync(COMPONENTS_DIR, { recursive: true });

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
console.log('Wrote components/Nav.tsx, components/Footer.tsx');

// ---------------------------------------------------------------------------
// 6. Write one route per page.
// ---------------------------------------------------------------------------
function routeDirFor(slug) {
  if (slug === 'home') return APP_DIR;
  if (slug === '404') return null; // handled as app/not-found.tsx
  return path.join(APP_DIR, slug);
}

const results = [];

for (const page of pages) {
  const { jsx, needsClient, needsCssVarCast } = nodesToJsx(page.children);
  const dir = routeDirFor(page.slug);
  results.push({ slug: page.slug, needsClient });

  if (page.slug === '404') {
    fs.writeFileSync(
      path.join(APP_DIR, 'not-found.tsx'),
      (needsClient ? "'use client';\n\n" : '') +
        cssImport(needsCssVarCast) +
        `export const metadata = { title: ${JSON.stringify(page.title)} };\n\n` +
        `export default function NotFound() {\n  return (\n    ${jsx}\n  );\n}\n`
    );
    continue;
  }

  fs.mkdirSync(dir, { recursive: true });

  if (needsClient) {
    fs.writeFileSync(
      path.join(dir, 'content.tsx'),
      `'use client';\n\n${cssImport(needsCssVarCast)}export default function Content() {\n  return (\n    ${jsx}\n  );\n}\n`
    );
    fs.writeFileSync(
      path.join(dir, 'page.tsx'),
      `import Content from './content';\n\n` +
        `export const metadata = { title: ${JSON.stringify(page.title)} };\n\n` +
        `export default function Page() {\n  return <Content />;\n}\n`
    );
  } else {
    fs.writeFileSync(
      path.join(dir, 'page.tsx'),
      cssImport(needsCssVarCast) +
        `export const metadata = { title: ${JSON.stringify(page.title)} };\n\n` +
        `export default function Page() {\n  return (\n    ${jsx}\n  );\n}\n`
    );
  }
}

console.log('\nPages needing client components:', results.filter((r) => r.needsClient).map((r) => r.slug).join(', '));
console.log('\nDone. Generated', results.length, 'page routes.');
