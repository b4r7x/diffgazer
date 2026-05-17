/**
 * Case-insensitive substring match using the host environment's default locale.
 *
 * Uses `String.prototype.toLocaleLowerCase()` so locale-sensitive characters
 * (e.g. Turkish dotted/dotless I) lowercase consistently. Pass a locale tag to
 * `toLocaleLowerCase` directly at the call site if a non-default locale is
 * required; this helper accepts the runtime default.
 */
export function matchesSearch(value: string, query: string): boolean {
  return !query || value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}
