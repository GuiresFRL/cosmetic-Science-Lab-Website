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
| `redirects.json` | 288 permanent (HTTP 301) redirects from the old flat `.html` addresses, loaded in `next.config.mjs` |
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

## Product-problem reports (/report-a-problem)

Consumers report reactions, contamination, labelling problems or suspected fakes. Guires CSL is not a regulator; the page links to the official channel in each country.

| Path | What it does |
|---|---|
| `app/api/report/route.ts` | `POST /api/report`: validates the form (required fields, consent, up to 3 images of 5 MB), emails the report (photos attached) to `MAIL_TO` over SMTP, and returns a reference such as `CSL-RPT-20261003-A1B2C3`. No database is used. |

Before launch:
1. Set the SMTP variables in `.env.example` (`SMTP_USER`, `SMTP_PASS`, `MAIL_TO`, etc.) in your host's environment settings.
2. Reports can contain health data (special-category data under GDPR): restrict who can read the receiving mailbox, set a retention period and update the privacy notice to cover this form.
3. Agree a triage procedure: where Guires CSL is the Responsible Person or US agent, serious cases must be reported to the authority (EU/UK: without delay; US MoCRA: within 15 business days). Track each case from the report email.
