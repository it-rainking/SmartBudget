import type { NextConfig } from "next";

// frameAncestors: 'none' per l'app; 'self' solo per gli strumenti statici in
// public/tools/, che l'app incorpora in un iframe dallo stesso dominio.
const buildSecurityHeaders = (frameAncestors: "'none'" | "'self'") => [
  { key: 'X-Frame-Options', value: frameAncestors === "'self'" ? 'SAMEORIGIN' : 'DENY' },
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
      `frame-ancestors ${frameAncestors}`,
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  // yahoo-finance2 ships un dynamic import verso i propri file di test (usati
  // solo per il suo dev harness Deno) che il bundler prova a risolvere in
  // build anche se non viene mai eseguito: escluso dal bundling, resta un
  // require Node normale a runtime (dove quel percorso non viene chiamato).
  serverExternalPackages: ['yahoo-finance2'],
  async headers() {
    return [
      { source: '/((?!tools/).*)', headers: buildSecurityHeaders("'none'") },
      { source: '/tools/:path*', headers: buildSecurityHeaders("'self'") },
    ]
  },
};

export default nextConfig;
