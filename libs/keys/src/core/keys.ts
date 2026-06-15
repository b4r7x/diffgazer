import type { ValidateHotkey } from "../dom/hotkey.js";
import type { KeyHandler } from "./normalize-key-input.js";

/**
 * Builds a key-handler map from several hotkey strings that share one handler.
 * Useful with the key-map overload of `useKey`.
 */
export function keys<const Hotkeys extends readonly string[]>(
  hotkeys: { [K in keyof Hotkeys]: ValidateHotkey<Hotkeys[K]> },
  handler: KeyHandler,
): Record<string, KeyHandler> {
  return Object.fromEntries(hotkeys.map((key) => [key, handler]));
}
