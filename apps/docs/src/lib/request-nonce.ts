import { AsyncLocalStorage } from "node:async_hooks";
import { setRequestNonceReader } from "./csp-nonce";

// Server-only per-request CSP nonce. server.ts runs each request inside this
// store; getRouter() reads the current nonce through the universal csp-nonce
// bridge (kept free of node:async_hooks so the client bundle stays clean) and
// passes it to router.options.ssr.nonce, stamping every SSR-injected inline
// script — including the per-request hydration bootstrap a content hash cannot
// cover (its dehydrated payload carries request-time timestamps).
const nonceStorage = new AsyncLocalStorage<string>();

setRequestNonceReader(() => nonceStorage.getStore());

export function runWithRequestNonce<T>(nonce: string, run: () => T): T {
  return nonceStorage.run(nonce, run);
}
