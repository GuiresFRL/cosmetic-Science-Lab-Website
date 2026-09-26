// Regenerates the "source" HTML export folder (Downloads/cosmetic-science-lab-site)
// FROM the live Next.js site, so source and site agree. Direction is the
// opposite of build-seo.mjs: this reads the running app and writes flat/nested
// static HTML files, not the other way around.
//
// Run with: node tools/export-source-from-site.mjs   (requires the dev server running)

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const BASE = 'http://localhost:3000';
const OUT_DIR = 'C:/Users/user/Downloads/cosmetic-science-lab-site';

// route (relative to app/, '' = home) -> output file (relative to OUT_DIR)
function findRoutes(dir, base, out) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) {
      findRoutes(path.join(dir, f.name), base ? base + '/' + f.name : f.name, out);
    } else if (f.name === 'page.tsx') {
      out.push(base);
    }
  }
}
const routes = [];
findRoutes('app', '', routes);
// home route is '' (from app/page.tsx) -> normalize
const routeList = routes.map((r) => (r === 'page.tsx' ? '' : r));

// Old flat files that are now superseded by a nested path (to delete).
const STALE_FILES = [
  'acne-oil-control.html', 'anti-ageing.html', 'brightening.html', 'dandruff-scalp.html',
  'hair-growth.html', 'hydration-barrier.html', 'hyperpigmentation.html', 'microbiome-friendly.html',
  'sensitive-skin.html', 'sun-protection.html',
  'evidence.html', 'partners.html', 'process.html', 'quality.html', 'startups.html', 'suppliers.html',
  'insights-dermatologically-tested.html', 'insights-mocra.html', 'insights-recall-hand-sanitiser-methanol.html',
  'insights-sunscreen-filters.html', 'insights-uae-cosmeceuticals.html', 'insights-us-skin-trends.html',
  'insights-zinc-pyrithione.html',
  'market-anz.html', 'market-asean.html', 'market-ca.html', 'market-eu.html', 'market-gcc.html',
  'market-in.html', 'market-uk.html', 'market-us.html',
  'baby-care.html', 'body-care.html', 'clean-natural.html', 'colour-cosmetics.html', 'hair-care.html',
  'halal-cosmetics.html', 'mens-grooming.html', 'oral-care.html', 'personal-care.html', 'skin-care.html',
  'sun-care.html',
  'claims-clinical.html', 'formulation.html', 'manufacturing.html', 'product-development.html',
  'regulatory.html', 'testing.html',
];

function outFileFor(route) {
  if (route === '') return 'index.html';
  return route + '.html';
}

function cleanRenderedHtml(html) {
  html = html.replace(/^<!DOCTYPE html>/i, '');
  const $ = cheerio.load(html, { xmlMode: false });
  // Strip Next.js runtime: chunk scripts, RSC payload pushes, preload/module links, nonces.
  $('script').each((_, el) => {
    const type = $(el).attr('type');
    if (type === 'application/ld+json') return; // keep structured data
    $(el).remove();
  });
  $('link[rel="preload"], link[rel="modulepreload"], link[rel="prefetch"]').remove();
  $('[nonce]').removeAttr('nonce');
  $('body').removeAttr('style'); // next sometimes sets no-flash inline styles
  // Remove Next dev-only attributes if present
  $('*').removeAttr('data-next-hide-fouc');
  // Drop empty Suspense-boundary wrapper divs and React streaming markers ($/ /$ comments)
  $('div[hidden=""]').each((_, el) => {
    if ($(el).children().length === 0 && $(el).text().trim() === '') $(el).remove();
  });
  $('*')
    .contents()
    .filter((_, n) => n.type === 'comment' && /^\/?\$/.test(n.data))
    .remove();
  return $;
}

let written = 0;
for (const route of routeList) {
  const url = `${BASE}/${route}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`FAILED ${url}: ${res.status}`);
    continue;
  }
  const html = await res.text();
  const $ = cleanRenderedHtml(html);
  const outPath = path.join(OUT_DIR, outFileFor(route));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, '<!DOCTYPE html>\n' + $.html());
  written++;
}
console.log(`Wrote ${written}/${routeList.length} pages.`);

// Remove stale flat files superseded by nested paths.
let removed = 0;
for (const f of STALE_FILES) {
  const p = path.join(OUT_DIR, f);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    removed++;
  }
}
console.log(`Removed ${removed} stale flat files.`);

// Sync styles.css from the live globals.css.
fs.copyFileSync('app/globals.css', path.join(OUT_DIR, 'styles.css'));
console.log('Synced styles.css from app/globals.css');

// Sync images.
const imgOut = path.join(OUT_DIR, 'images');
fs.mkdirSync(imgOut, { recursive: true });
let imgCount = 0;
for (const f of fs.readdirSync('public/images')) {
  fs.copyFileSync(path.join('public/images', f), path.join(imgOut, f));
  imgCount++;
}
console.log(`Synced ${imgCount} images.`);
