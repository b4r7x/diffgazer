// Non-CSP response headers, applied to every docs route via Nitro routeRules.
// The Content-Security-Policy is emitted per request from server.ts so each
// response can carry the request's CSP nonce (no 'unsafe-inline'); see
// buildDocsContentSecurityPolicy.
export const DOCS_BASE_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()",
  // HTML carries ETag + Last-Modified but must revalidate: container-replacing
  // deploys drop the content-hashed /assets chunks that stale HTML still names,
  // so without this browsers serve heuristically-fresh HTML that 404s on load.
  // The more specific /assets/** immutable rule still wins for hashed assets.
  "Cache-Control": "public, max-age=0, must-revalidate",
} satisfies Record<string, string>;

// script-src carries the per-request nonce (TanStack Start stamps it on every
// SSR-injected inline script via router.options.ssr.nonce), so 'unsafe-inline'
// is gone. Fonts are self-hosted, so the former Google Fonts allowances are
// dropped. style-src keeps 'unsafe-inline' for the styles Tailwind/Start inline.
export function buildDocsContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
