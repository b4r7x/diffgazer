export function resolveDirectionKeys(
  orientation: "vertical" | "horizontal",
  upKeys?: string[],
  downKeys?: string[],
): { resolvedUpKeys: string[]; resolvedDownKeys: string[] } {
  return {
    resolvedUpKeys: upKeys ?? (orientation === "vertical" ? ["ArrowUp"] : ["ArrowLeft"]),
    resolvedDownKeys: downKeys ?? (orientation === "vertical" ? ["ArrowDown"] : ["ArrowRight"]),
  };
}

export function dispatchNavigationKey(
  key: string,
  ctx: {
    resolvedUpKeys: string[];
    resolvedDownKeys: string[];
    move: (dir: 1 | -1) => void;
    focusIndex: (i: number) => void;
    handleSelect?: (event: KeyboardEvent) => void;
    handleEnter?: (event: KeyboardEvent) => void;
    total: number;
    nativeEvent: KeyboardEvent;
  },
): boolean {
  if (ctx.resolvedUpKeys.includes(key)) { ctx.move(-1); return true; }
  if (ctx.resolvedDownKeys.includes(key)) { ctx.move(1); return true; }
  switch (key) {
    case "Home": ctx.focusIndex(0); return true;
    case "End": {
      if (ctx.total > 0) ctx.focusIndex(ctx.total - 1);
      return true;
    }
    case "Enter": ctx.handleEnter?.(ctx.nativeEvent); return true;
    case " ": ctx.handleSelect?.(ctx.nativeEvent); return true;
  }
  return false;
}
