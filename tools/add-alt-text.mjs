// Fills in real alt text for the ~294 decorative-marked (alt="") images added
// by the site redesign, using nearby on-page text as the source (headings,
// captions, tags) so nothing is invented — only content already on the page.
//
// Run with: node tools/add-alt-text.mjs

import fs from 'node:fs';
import path from 'node:path';

function walk(dir, out) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (f.name.endsWith('.tsx')) out.push(p);
  }
}
const files = [];
walk('app', files);

// Negative lookbehind excludes attribute values like href={"..."} / src={"..."} —
// only bare {"..."} JSX text-node children (never preceded by `=`) are text content.
const JSX_STR = /(?<!=)\{"((?:[^"\\]|\\.)*)"\}/g;
function extractJsxText(fragment) {
  let out = '';
  let m;
  JSX_STR.lastIndex = 0;
  while ((m = JSX_STR.exec(fragment))) {
    try {
      out += JSON.parse('"' + m[1] + '"');
    } catch {
      out += m[1];
    }
  }
  return out.trim();
}

function firstTag(str, tag, from = 0) {
  const openRe = new RegExp(`<${tag}\\b[^>]*>`, 'g');
  openRe.lastIndex = from;
  const openM = openRe.exec(str);
  if (!openM) return null;
  const closeIdx = str.indexOf(`</${tag}>`, openM.index);
  if (closeIdx === -1) return null;
  return { start: openM.index, end: closeIdx + tag.length + 3, inner: str.slice(openM.index + openM[0].length, closeIdx) };
}

// Last <tag>...</tag> whose closing tag ends at or before `uptoIdx` in `str`.
function lastTagBefore(str, tag, uptoIdx) {
  const closeTag = `</${tag}>`;
  const closeIdx = str.lastIndexOf(closeTag, uptoIdx);
  if (closeIdx === -1) return null;
  const openRe = new RegExp(`<${tag}\\b[^>]*>`, 'g');
  let openM, last = null;
  while ((openM = openRe.exec(str)) && openM.index < closeIdx) last = openM;
  if (!last) return null;
  return { start: last.index, end: closeIdx + closeTag.length, inner: str.slice(last.index + last[0].length, closeIdx) };
}

const imgRe = /<img\b[^>]*alt=\{""\}[^>]*\/>/g;

let totalFixed = 0;
const unresolved = [];

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  const edits = [];
  imgRe.lastIndex = 0;
  let m;
  while ((m = imgRe.exec(src))) {
    const tag = m[0];
    const idx = m.index;
    const before = src.slice(Math.max(0, idx - 160), idx);
    const clsMatch = before.match(/className=\{"([^"]*)"\}[^<]*$/);
    const cls = clsMatch ? clsMatch[1] : '';
    const window = src.slice(m.index + tag.length, m.index + tag.length + 3000);
    const backWindow = src.slice(Math.max(0, m.index - 3000), m.index);

    let alt = null;
    if (cls === 'sec-hero') {
      const h1 = firstTag(window, 'h1');
      if (h1) alt = extractJsxText(h1.inner);
    } else if (cls === 'pillar-img') {
      const h3 = firstTag(window, 'h3');
      if (h3) {
        const eyebrow = firstTag(window, 'p');
        const eyebrowText = eyebrow && window.slice(0, eyebrow.start).match(/className=\{"eyebrow"\}[^<]*$/)
          ? extractJsxText(eyebrow.inner)
          : null;
        const heading = extractJsxText(h3.inner);
        alt = eyebrowText && eyebrowText !== heading ? `${eyebrowText}: ${heading}` : heading;
      }
    } else if (cls === 'concept-img') {
      const span = firstTag(window, 'span');
      const h3 = firstTag(window, 'h3');
      if (h3) {
        const tagText = span ? extractJsxText(span.inner) : null;
        const heading = extractJsxText(h3.inner);
        alt = tagText && tagText !== heading ? `${tagText}: ${heading}` : heading;
      }
    } else if (cls === 'ins-img') {
      const h3 = firstTag(window, 'h3');
      const b = firstTag(window, 'b');
      if (h3) {
        alt = extractJsxText(h3.inner);
      } else if (b && b.start < 20) {
        // tight: <b> immediately follows (related-article card pattern)
        alt = extractJsxText(b.inner);
      } else {
        // loose/none: this is the article's own featured image; use its own <h1>
        const h1 = lastTagBefore(backWindow, 'h1', backWindow.length);
        if (h1) alt = extractJsxText(h1.inner);
      }
    } else if (cls === 'clin-media') {
      const span = firstTag(window, 'span');
      if (span) alt = extractJsxText(span.inner);
    }

    if (!alt) {
      unresolved.push({ file, cls, tag: tag.slice(0, 120) });
      continue;
    }
    const newTag = tag.replace('alt={""}', `alt={${JSON.stringify(alt)}}`);
    edits.push({ idx, end: idx + tag.length, newTag });
  }

  if (edits.length === 0) continue;
  // apply edits back-to-front so indices stay valid
  edits.sort((a, b) => b.idx - a.idx);
  for (const e of edits) {
    src = src.slice(0, e.idx) + e.newTag + src.slice(e.end);
  }
  fs.writeFileSync(file, src);
  totalFixed += edits.length;
}

console.log(`Filled alt text for ${totalFixed} images.`);
if (unresolved.length) {
  console.log(`\n${unresolved.length} could not be resolved automatically:`);
  unresolved.forEach((u) => console.log(u.file, '|', u.cls, '|', u.tag));
}
