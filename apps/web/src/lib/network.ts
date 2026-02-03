export function getDefaultApiUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://127.0.0.1:3000";
}
