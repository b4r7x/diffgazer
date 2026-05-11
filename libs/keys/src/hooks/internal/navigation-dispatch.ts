const VERTICAL_UP_KEYS = ["ArrowUp"] as const;
const VERTICAL_DOWN_KEYS = ["ArrowDown"] as const;
const HORIZONTAL_UP_KEYS = ["ArrowLeft"] as const;
const HORIZONTAL_DOWN_KEYS = ["ArrowRight"] as const;

export function resolveDirectionKeys(
  orientation: "vertical" | "horizontal",
  upKeys?: readonly string[],
  downKeys?: readonly string[],
): { resolvedUpKeys: readonly string[]; resolvedDownKeys: readonly string[] } {
  return {
    resolvedUpKeys: upKeys ?? (orientation === "vertical" ? VERTICAL_UP_KEYS : HORIZONTAL_UP_KEYS),
    resolvedDownKeys: downKeys ?? (orientation === "vertical" ? VERTICAL_DOWN_KEYS : HORIZONTAL_DOWN_KEYS),
  };
}

export function dispatchNavigationKey(
  key: string,
  ctx: {
    resolvedUpKeys: readonly string[];
    resolvedDownKeys: readonly string[];
    move: (dir: 1 | -1) => void;
    focusIndex: (index: number) => void;
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
      ctx.focusIndex(0);
      return true;
    case "End": {
      if (ctx.total > 0) ctx.focusIndex(ctx.total - 1);
      return true;
    }
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
