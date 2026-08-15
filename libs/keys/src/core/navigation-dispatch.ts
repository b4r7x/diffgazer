import { eventMatchesParsedHotkey, parseHotkey } from "../dom/hotkey.js";

const VERTICAL_UP_KEYS = ["ArrowUp"] as const;
const VERTICAL_DOWN_KEYS = ["ArrowDown"] as const;
const HORIZONTAL_UP_KEYS = ["ArrowLeft"] as const;
const HORIZONTAL_DOWN_KEYS = ["ArrowRight"] as const;

/** Returns the first configured hotkey string that matches the keyboard event. */
export function matchConfiguredHotkey(
  event: globalThis.KeyboardEvent,
  keys: readonly string[],
): string | null {
  for (const hotkey of keys) {
    if (eventMatchesParsedHotkey(event, parseHotkey(hotkey))) {
      return hotkey;
    }
  }
  return null;
}

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
    /** Passing `elements` keeps the Home/End scan on the caller's single DOM query. */
    focusIndex: (index: number, knownElements?: HTMLElement[]) => boolean;
    handleSelect?: (event: globalThis.KeyboardEvent) => void;
    handleEnter?: (event: globalThis.KeyboardEvent) => void;
    elements: HTMLElement[];
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
      for (let index = 0; index < ctx.elements.length; index += 1) {
        if (ctx.focusIndex(index, ctx.elements)) break;
      }
      return true;
    case "End":
      for (let index = ctx.elements.length - 1; index >= 0; index -= 1) {
        if (ctx.focusIndex(index, ctx.elements)) break;
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
