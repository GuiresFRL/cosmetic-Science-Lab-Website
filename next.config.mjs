import redirects from './redirects.json' with { type: 'json' };
/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: false,          // frozen URL structure: no trailing slash
  poweredByHeader: false,
  async redirects() { return redirects; },   // 301s from the old flat .html addresses
};
export default nextConfig;
