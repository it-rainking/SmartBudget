import type { NextConfig } from "next";
import { createHash } from "crypto";
import { themeScript } from "./src/lib/themeScript";

// Allow only this exact inline script (the theme-flash-prevention snippet in
// layout.tsx) instead of blanket 'unsafe-inline', so any future accidental
// or injected inline <script> is still blocked by the CSP.
const themeScriptHash = `'sha256-${createHash('sha256').update(themeScript, 'utf8').digest('base64')}'`

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
      `script-src 'self' ${themeScriptHash}`,
      // style-src still needs 'unsafe-inline': several pages use dynamic
      // inline `style` attributes (progress bar widths, category colors)
      // whose values can't be known ahead of time for a hash/nonce allowlist.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://*.supabase.co https://api.resend.com https://api.anthropic.com",
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
