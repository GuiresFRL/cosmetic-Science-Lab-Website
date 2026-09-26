import type { Metadata } from 'next';
import Content from './content';

export const metadata: Metadata = { "title": "Template: Launch Guides article · Cosmetic Science Lab", "description": "Article template for the Launch Guides category of Cosmetic Science Lab Insights: structure, media slots and writer notes.", "keywords": "Template, Launch Guides article, cosmetic product development, Cosmetic Science Lab", "authors": [{ "name": "Cosmetic Science Lab" }], "robots": "noindex, nofollow", "alternates": { "canonical": "https://www.cosmeticsciencelab.com/tpl-launch-guides", "languages": { "en": "https://www.cosmeticsciencelab.com/tpl-launch-guides", "x-default": "https://www.cosmeticsciencelab.com/tpl-launch-guides" } }, "openGraph": { "type": "website", "siteName": "Cosmetic Science Lab", "title": "Template: Launch Guides article · Cosmetic Science Lab", "description": "Article template for the Launch Guides category of Cosmetic Science Lab Insights: structure, media slots and writer notes.", "url": "https://www.cosmeticsciencelab.com/tpl-launch-guides", "locale": "en_GB", "images": [{ "url": "https://www.cosmeticsciencelab.com/images/og-image.png", "width": 1200, "height": 630 }] }, "twitter": { "card": "summary_large_image", "title": "Template: Launch Guides article · Cosmetic Science Lab", "description": "Article template for the Launch Guides category of Cosmetic Science Lab Insights: structure, media slots and writer notes.", "images": ["https://www.cosmeticsciencelab.com/images/og-image.png"] } };

export default function Page() {
  return <Content />;
}
