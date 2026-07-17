function foldSearchValue(value: string): string {
  return value.normalize("NFC").toUpperCase().normalize("NFC");
}

/** Locale-independent Unicode substring search using NFC normalization and uppercase expansion. */
export function matchesSearch(value: string, query: string): boolean {
  return foldSearchValue(value).includes(foldSearchValue(query));
}
