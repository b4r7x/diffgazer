import { matchesSearch } from "@/lib/search";
import type { SelectOptionMetadata } from "./select-context";

export function getVisibleEnabledOptionEntries(
  options: ReadonlyMap<string, SelectOptionMetadata>,
  searchQuery: string,
): Array<[string, SelectOptionMetadata]> {
  const entries: Array<[string, SelectOptionMetadata]> = [];
  for (const [itemValue, option] of options) {
    if (!option.disabled && matchesSearch(option.label, searchQuery)) {
      entries.push([itemValue, option]);
    }
  }
  return entries;
}

/** Values of options that match the search query and are not disabled. */
export function getVisibleEnabledOptions(
  options: ReadonlyMap<string, SelectOptionMetadata>,
  searchQuery: string,
): string[] {
  return getVisibleEnabledOptionEntries(options, searchQuery).map(([itemValue]) => itemValue);
}
