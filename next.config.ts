import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // 'unsafe-inline' is required: the Next.js App Router streams its
      // bootstrap/flight data as per-request inline <script> tags that can't
      // be allowlisted by hash. Note that hashes and 'unsafe-inline' can't be
      // combined — when a hash is present browsers ignore 'unsafe-inline',
      // which is exactly what blanked every client-rendered page before.
      // A hash-free policy keeps external scripts restricted to 'self'.
      "script-src 'self' 'unsafe-inline'",
      // style-src still needs 'unsafe-inline': several pages use dynamic
      // inline `style` attributes (progress bar widths, category colors)
      // whose values can't be known ahead of time for a hash/nonce allowlist.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://api.anthropic.com",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
};

export default nextConfig;
