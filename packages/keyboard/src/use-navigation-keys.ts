import type { RefObject } from "react";
import { useKey } from "./use-key";

// Inline interface — no import from @stargazer/ui (avoids circular dep)
interface NavigableHandle {
  focusNext: () => void;
  focusPrevious: () => void;
  focusFirst: () => void;
  focusLast: () => void;
  selectFocused: () => void;
}

interface UseNavigationKeysOptions {
  enabled?: boolean;
}

export function useNavigationKeys(
  ref: RefObject<NavigableHandle | null>,
  options?: UseNavigationKeysOptions
) {
  const opts = { enabled: options?.enabled ?? true };
  useKey("ArrowUp", () => ref.current?.focusPrevious(), opts);
  useKey("ArrowDown", () => ref.current?.focusNext(), opts);
  useKey("Home", () => ref.current?.focusFirst(), opts);
  useKey("End", () => ref.current?.focusLast(), opts);
  useKey("Enter", () => ref.current?.selectFocused(), opts);
  useKey(" ", () => ref.current?.selectFocused(), opts);
}
