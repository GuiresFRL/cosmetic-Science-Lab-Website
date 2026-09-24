import type { Metadata } from 'next';
import Content from './content';

export const metadata: Metadata = { "title": "Template: Inside the Lab article · Cosmetic Science Lab", "description": "Article template for the Inside the Lab category of Cosmetic Science Lab Insights: structure, media slots and writer notes.", "keywords": "Template, Inside the Lab article, cosmetic product development, Cosmetic Science Lab", "authors": [{ "name": "Cosmetic Science Lab" }], "robots": "noindex, follow", "alternates": { "canonical": "https://www.cosmeticsciencelab.com/tpl-inside-the-lab", "languages": { "en": "https://www.cosmeticsciencelab.com/tpl-inside-the-lab", "x-default": "https://www.cosmeticsciencelab.com/tpl-inside-the-lab" } }, "openGraph": { "type": "website", "siteName": "Cosmetic Science Lab", "title": "Template: Inside the Lab article · Cosmetic Science Lab", "description": "Article template for the Inside the Lab category of Cosmetic Science Lab Insights: structure, media slots and writer notes.", "url": "https://www.cosmeticsciencelab.com/tpl-inside-the-lab", "locale": "en_GB", "images": [{ "url": "https://www.cosmeticsciencelab.com/images/og-image.png", "width": 1200, "height": 630 }] }, "twitter": { "card": "summary_large_image", "title": "Template: Inside the Lab article · Cosmetic Science Lab", "description": "Article template for the Inside the Lab category of Cosmetic Science Lab Insights: structure, media slots and writer notes.", "images": ["https://www.cosmeticsciencelab.com/images/og-image.png"] } };

export default function Page() {
  return <Content />;
}
