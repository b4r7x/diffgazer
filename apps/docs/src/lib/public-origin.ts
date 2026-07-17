export const DEFAULT_PUBLIC_ORIGIN = "https://docs.b4r7.dev";
const INVALID_PUBLIC_ORIGIN = "VITE_PUBLIC_ORIGIN must be an absolute HTTP(S) origin";

/** Resolves deployment configuration to a canonical HTTP(S) origin without a trailing slash. */
export function resolvePublicOrigin(configuredOrigin?: string): string {
  if (configuredOrigin === undefined) return DEFAULT_PUBLIC_ORIGIN;

  const raw = configuredOrigin.trim();
  if (!/^https?:\/\/[^/?#]+(?:[/?#]|$)/i.test(raw)) {
    throw new Error(INVALID_PUBLIC_ORIGIN);
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(INVALID_PUBLIC_ORIGIN);
  }

  const hasOnlyTrailingSlashes = /^\/*$/.test(url.pathname);
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.hostname.length === 0 ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    !hasOnlyTrailingSlashes ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error(INVALID_PUBLIC_ORIGIN);
  }

  return url.origin;
}
