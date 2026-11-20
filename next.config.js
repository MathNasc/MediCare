/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const DEV_ASSET_PREFIX = '/_dev_v2';

const nextConfig = {
  ...(process.env.NEXT_STANDALONE === 'true' ? { output: 'standalone' } : {}),
  ...(!isProd ? { assetPrefix: DEV_ASSET_PREFIX } : {}),
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://medicare-cuidador.duckdns.org',
  },
  compiler: {
    removeConsole: isProd ? { exclude: ['error', 'warn'] } : false,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },
  async redirects() {
    return [
      {
        source: '/login',
        destination: '/cuidador',
        permanent: false,
      },
      {
        source: '/home',
        destination: '/',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: !isProd
        ? [
            {
              source: `${DEV_ASSET_PREFIX}/_next/:path*`,
              destination: '/_next/:path*',
            },
          ]
        : [],
      afterFiles: [
        {
          source: '/rest/v1/:path*',
          destination: '/api/rest/v1/:path*',
        },
        {
          source: '/auth/v1/:path*',
          destination: '/api/auth/v1/:path*',
        },
      ],
    };
  },
  async headers() {
    const staticCacheValue = isProd
      ? 'public, max-age=31536000, immutable'
      : 'no-store, must-revalidate';

    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type',  value: 'application/javascript; charset=utf-8' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type',  value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type',  value: 'application/json' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: staticCacheValue },
        ],
      },
      {
        source: `${DEV_ASSET_PREFIX}/_next/static/:path*`,
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
      {
        source: '/((?!_next/static|_dev_v2/_next/static|sw\\.js).*)',
        headers: [
          { key: 'Cache-Control',          value: 'no-cache, no-store, must-revalidate' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection',       value: '1; mode=block' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
