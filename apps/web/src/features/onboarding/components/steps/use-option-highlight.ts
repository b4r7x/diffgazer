import { useState } from "react";

function getAvailableOption(
  value: string | null | undefined,
  ids: readonly string[],
): string | null {
  if (value && ids.includes(value)) return value;
  return null;
}

function getOptionHighlight(
  highlighted: string | null,
  selected: string | null | undefined,
  ids: readonly string[],
): string | null {
  return getAvailableOption(highlighted, ids)
    ?? getAvailableOption(selected, ids)
    ?? ids[0]
    ?? null;
}

export function useOptionHighlight(
  selected: string | null | undefined,
  ids: readonly string[],
) {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  return {
    highlighted: getOptionHighlight(highlighted, selected, ids),
    setHighlighted: (value: string) => {
      setHighlighted(getAvailableOption(value, ids));
    },
  };
}
