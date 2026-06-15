import { randomBytes } from "node:crypto";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { runWithRequestNonce } from "./lib/request-nonce";
import { buildDocsContentSecurityPolicy, DOCS_BASE_SECURITY_HEADERS } from "./security-headers";

export default createServerEntry({
  async fetch(request) {
    // One nonce per request: getRouter() reads it (via the csp-nonce bridge) and
    // stamps it on every SSR-injected inline script, and the response CSP carries
    // the matching 'nonce-…' so those scripts run without 'unsafe-inline'.
    const nonce = randomBytes(16).toString("base64");
    const response = await runWithRequestNonce(nonce, () => handler.fetch(request));
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(DOCS_BASE_SECURITY_HEADERS)) {
      headers.set(key, value);
    }
    headers.set("Content-Security-Policy", buildDocsContentSecurityPolicy(nonce));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
});
