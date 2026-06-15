import { matchesSearch } from "@/lib/search";
import type { SelectOptionMetadata } from "./select-context";

/** Returns visible enabled option entries. */
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

/** Options for get visible enabled. */
export function getVisibleEnabledOptions(
  options: ReadonlyMap<string, SelectOptionMetadata>,
  searchQuery: string,
): string[] {
  return getVisibleEnabledOptionEntries(options, searchQuery).map(([itemValue]) => itemValue);
}
