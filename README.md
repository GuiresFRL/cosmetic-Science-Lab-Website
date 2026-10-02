# Cosmetic Science Lab — Next.js site

Next.js (App Router) build of cosmeticsciencelab.com. Every page, URL, title, description, canonical, hreflang, Open Graph tag and JSON-LD block matches the audited static build.

## Run

```bash
npm install
npm run build
npm run start      # http://localhost:3000
```

## How it is organised

| Path | What it does |
|---|---|
| `content/manifest.json` | One entry per page: URL, title, description, keywords, robots, canonical, hreflang, Open Graph and JSON-LD |
| `content/pages/*.html` | The body HTML of each page (navigation, content and footer) |
| `app/[[...slug]]/page.tsx` | Serves every URL in the manifest; `dynamicParams = false`, so any other URL returns HTTP 404 |
| `app/not-found.tsx` | The branded 404 page (real 404 status) |
| `app/sitemap.ts`, `app/robots.ts` | `/sitemap.xml` and `/robots.txt`, generated from the manifest (noindex pages excluded) |
| `redirects.json` | 287 permanent (HTTP 301) redirects from the old flat `.html` addresses, loaded in `next.config.mjs` |
| `public/` | `styles.css`, `site.js`, `search-index.json`, images and downloads |

## URL structure (frozen)

- `/` home · `/about` `/careers` `/contact` `/faq` `/process` `/quality` `/evidence` `/startups` `/partners` `/suppliers` `/privacy` `/terms`
- `/services/<service>` and `/services/ingredient-application-science/<audience>`
- `/sectors/<sector>` · `/applications/<application>` · `/markets/<market>`
- `/insights/<article>` · `/ingredients/<ingredient>` · `/case-studies/<case>`
- `/guides/<guide>` · `/guides/glossary/<term>` · `/bioscience/<area>`
- Lowercase, hyphenated, no trailing slash, no `.html`.

## Editing a page

Edit the matching file in `content/pages/` (body) and its entry in `content/manifest.json` (metadata). To add a page, add both and it is picked up by the route, the sitemap and the build automatically.

## Before launch

- Forms post to the endpoints set in the page HTML (`data-endpoint`); connect them to your form handler or CRM.
- Replace any image still marked for licensing (see image notes in the hand-over).
- Submit `https://www.cosmeticsciencelab.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
