import redirects from './redirects.json' with { type: 'json' };
/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: false,          // frozen URL structure: no trailing slash
  poweredByHeader: false,
  async redirects() { return redirects; },   // 301s from the old flat .html addresses
  // Pre-launch: block indexing everywhere (HTML, images, PDFs). Remove this block when going live.
  async headers() { return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]; },
};
export default nextConfig;
