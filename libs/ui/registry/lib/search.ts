export function matchesSearch(value: string, query: string): boolean {
  return !query || value.toLowerCase().includes(query.toLowerCase());
}
