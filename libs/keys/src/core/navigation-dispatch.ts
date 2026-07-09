const VERTICAL_UP_KEYS = ["ArrowUp"] as const;
const VERTICAL_DOWN_KEYS = ["ArrowDown"] as const;
const HORIZONTAL_UP_KEYS = ["ArrowLeft"] as const;
const HORIZONTAL_DOWN_KEYS = ["ArrowRight"] as const;

/** Resolves default previous/next keys for a vertical or horizontal list. */
export function resolveDirectionKeys(
  orientation: "vertical" | "horizontal",
  upKeys?: readonly string[],
  downKeys?: readonly string[],
): { resolvedUpKeys: readonly string[]; resolvedDownKeys: readonly string[] } {
  return {
    resolvedUpKeys: upKeys ?? (orientation === "vertical" ? VERTICAL_UP_KEYS : HORIZONTAL_UP_KEYS),
    resolvedDownKeys:
      downKeys ?? (orientation === "vertical" ? VERTICAL_DOWN_KEYS : HORIZONTAL_DOWN_KEYS),
  };
}

/**
 * Dispatches one navigation key to movement, edge, and activation callbacks.
 * Returns whether the key was handled.
 */
export function dispatchNavigationKey(
  key: string,
  ctx: {
    resolvedUpKeys: readonly string[];
    resolvedDownKeys: readonly string[];
    move: (dir: 1 | -1) => void;
    focusIndex: (index: number) => boolean;
    handleSelect?: (event: globalThis.KeyboardEvent) => void;
    handleEnter?: (event: globalThis.KeyboardEvent) => void;
    total: number;
    nativeEvent: globalThis.KeyboardEvent;
  },
): boolean {
  if (ctx.resolvedUpKeys.includes(key)) {
    ctx.move(-1);
    return true;
  }

  if (ctx.resolvedDownKeys.includes(key)) {
    ctx.move(1);
    return true;
  }

  switch (key) {
    case "Home":
      // Step forward so a native-disabled first item is skipped, matching arrow stepping.
      for (let index = 0; index < ctx.total; index += 1) {
        if (ctx.focusIndex(index)) break;
      }
      return true;
    case "End":
      for (let index = ctx.total - 1; index >= 0; index -= 1) {
        if (ctx.focusIndex(index)) break;
      }
      return true;
    case "Enter":
      if (!ctx.handleEnter) return false;
      ctx.handleEnter(ctx.nativeEvent);
      return true;
    case " ":
      if (!ctx.handleSelect) return false;
      ctx.handleSelect(ctx.nativeEvent);
      return true;
  }

  return false;
}
