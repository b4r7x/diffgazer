// Universal-safe accessor for the per-request CSP nonce. The server publishes a
// reader on globalThis (see server.ts); getRouter() reads through here so the
// universal router.tsx never imports node:async_hooks (which breaks the client
// bundle). On the client there is no reader, so this returns undefined.
const NONCE_READER_KEY = "__DOCS_CSP_NONCE_READER__";

type NonceReader = () => string | undefined;

type NonceGlobal = typeof globalThis & {
  [NONCE_READER_KEY]?: NonceReader;
};

export function setRequestNonceReader(reader: NonceReader): void {
  (globalThis as NonceGlobal)[NONCE_READER_KEY] = reader;
}

export function getRequestNonce(): string | undefined {
  return (globalThis as NonceGlobal)[NONCE_READER_KEY]?.();
}
