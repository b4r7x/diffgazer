import { useEffectEvent } from "react";
import {
  useNavigationCore,
  type UseNavigationOptions,
} from "./use-navigation.js";
import { useKey } from "./use-key.js";
import { keys } from "../utils/keys.js";
import { resolveDirectionKeys, dispatchNavigationKey } from "../internal/navigation-dispatch.js";

export interface UseScopedNavigationOptions extends UseNavigationOptions {
  requireFocusWithin?: boolean;
}

export interface UseScopedNavigationReturn {
  highlighted: string | null;
  isHighlighted: (value: string) => boolean;
  highlight: (value: string) => void;
}

export function useScopedNavigation(options: UseScopedNavigationOptions): UseScopedNavigationReturn {
  const {
    enabled = true,
    preventDefault = true,
    requireFocusWithin = false,
    orientation = "vertical",
    upKeys,
    downKeys,
    containerRef,
  } = options;

  const { resolvedUpKeys, resolvedDownKeys } = resolveDirectionKeys(orientation, upKeys, downKeys);

  const { highlighted, isHighlighted, highlight, move, focusIndex, handleSelect, handleEnter, getElements } =
    useNavigationCore(options);

  const dispatch = useEffectEvent((key: string, nativeEvent: globalThis.KeyboardEvent) => {
    dispatchNavigationKey(key, {
      resolvedUpKeys,
      resolvedDownKeys,
      move,
      focusIndex,
      handleSelect: (e) => handleSelect(e),
      handleEnter: (e) => handleEnter(e),
      total: getElements().length,
      nativeEvent,
    });
  });

  useKey(
    {
      ...keys(resolvedUpKeys, (e) => dispatch(e.key, e)),
      ...keys(resolvedDownKeys, (e) => dispatch(e.key, e)),
      Home: (e) => dispatch("Home", e),
      End: (e) => dispatch("End", e),
      Enter: (e) => dispatch("Enter", e),
      " ": (e) => dispatch(" ", e),
    },
    {
      enabled,
      preventDefault,
      targetRef: containerRef,
      requireFocusWithin,
    },
  );

  return { highlighted, isHighlighted, highlight };
}
