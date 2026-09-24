// Exports an Excel workbook listing every page's SEO meta tags (title,
// description, keywords, robots, canonical, OG, Twitter) sourced from the
// same multi-file export used by tools/build-seo.mjs.
//
// Run with: node tools/export-seo-excel.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = 'C:/Users/user/Downloads/cosmetic-science-lab-site';
const OUT_FILE = path.join(ROOT, 'seo-meta-tags.xlsx');

function slugFor(file) {
  const raw = file.replace(/\.html$/, '');
  if (raw === 'index') return '/';
  return `/${raw}`;
}

const files = fs
  .readdirSync(SOURCE_DIR)
  .filter((f) => f.endsWith('.html'))
  .sort();

const rows = [];

for (const file of files) {
  const raw = fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8');
  const $ = cheerio.load(raw, { xmlMode: false });

  const title = $('title').text().trim();
  const description = $('meta[name="description"]').attr('content') || '';
  const keywords = $('meta[name="keywords"]').attr('content') || '';
  const robots = $('meta[name="robots"]').attr('content') || '';
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const ogDescription = $('meta[property="og:description"]').attr('content') || '';
  const ogUrl = $('meta[property="og:url"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  const twitterCard = $('meta[name="twitter:card"]').attr('content') || '';
  const twitterTitle = $('meta[name="twitter:title"]').attr('content') || '';
  const twitterDescription = $('meta[name="twitter:description"]').attr('content') || '';
  const twitterImage = $('meta[name="twitter:image"]').attr('content') || '';
  const hasJsonLd = $('script[type="application/ld+json"]').length > 0 ? 'Yes' : 'No';

  rows.push({
    'Source File': file,
    'Route': slugFor(file),
    'Title': title,
    'Title Length': title.length,
    'Meta Description': description,
    'Description Length': description.length,
    'Keywords': keywords,
    'Robots': robots,
    'Canonical URL': canonical,
    'OG Title': ogTitle,
    'OG Description': ogDescription,
    'OG URL': ogUrl,
    'OG Image': ogImage,
    'Twitter Card': twitterCard,
    'Twitter Title': twitterTitle,
    'Twitter Description': twitterDescription,
    'Twitter Image': twitterImage,
    'Has JSON-LD': hasJsonLd,
  });
}

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(rows);

// Reasonable column widths.
ws['!cols'] = [
  { wch: 30 }, // Source File
  { wch: 22 }, // Route
  { wch: 45 }, // Title
  { wch: 12 }, // Title Length
  { wch: 55 }, // Meta Description
  { wch: 16 }, // Description Length
  { wch: 35 }, // Keywords
  { wch: 14 }, // Robots
  { wch: 45 }, // Canonical URL
  { wch: 35 }, // OG Title
  { wch: 45 }, // OG Description
  { wch: 45 }, // OG URL
  { wch: 35 }, // OG Image
  { wch: 16 }, // Twitter Card
  { wch: 35 }, // Twitter Title
  { wch: 45 }, // Twitter Description
  { wch: 35 }, // Twitter Image
  { wch: 12 }, // Has JSON-LD
];

XLSX.utils.book_append_sheet(wb, ws, 'SEO Meta Tags');
XLSX.writeFile(wb, OUT_FILE);

console.log(`Wrote ${OUT_FILE} with ${rows.length} rows.`);
