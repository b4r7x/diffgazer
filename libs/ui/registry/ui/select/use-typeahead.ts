"use client";

import { useTypeaheadBuffer } from "@/hooks/use-typeahead-buffer";
import { typeaheadSearch } from "@/lib/typeahead";
import type { SelectOptionMetadata } from "./select-context";
import { getVisibleEnabledOptionEntries } from "./visible-options";

interface UseSelectTypeaheadOptions {
  options: ReadonlyMap<string, SelectOptionMetadata>;
  searchQuery: string;
  highlighted: string | null;
  setHighlighted: (value: string) => void;
}

export function useSelectTypeahead({
  options,
  searchQuery,
  highlighted,
  setHighlighted,
}: UseSelectTypeaheadOptions) {
  const readTypeaheadQuery = useTypeaheadBuffer();

  return function handleTypeahead(key: string): void {
    const query = readTypeaheadQuery(key);
    if (query === null) return;

    const visibleOptions = getVisibleEnabledOptionEntries(options, searchQuery);
    if (visibleOptions.length === 0) return;

    const currentIndex =
      highlighted === null
        ? -1
        : visibleOptions.findIndex(([itemValue]) => itemValue === highlighted);

    const match = typeaheadSearch({
      items: visibleOptions,
      query,
      currentIndex,
      getLabel: ([, option]) => option.label,
    });

    if (match) setHighlighted(match[0]);
  };
}
