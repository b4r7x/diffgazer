/** Case-insensitive substring search using the host locale. */
export function matchesSearch(value: string, query: string): boolean {
  return !query || value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}
