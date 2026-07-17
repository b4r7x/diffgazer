export function resolveApiEndpoint(value: string | undefined, fallback: string): string {
  const endpoint = value?.trim() || fallback;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("VITE_API_URL must be a valid HTTP(S) URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VITE_API_URL must use HTTP or HTTPS.");
  }

  return endpoint;
}
