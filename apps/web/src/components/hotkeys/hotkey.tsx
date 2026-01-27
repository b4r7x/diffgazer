"use client";

import { useHotkey } from "./use-hotkey";
import type { HotkeyOptions } from "./types";

type HotkeyProps = HotkeyOptions;

export function Hotkey({
  keys,
  onPress,
  description,
  scope,
  enabled,
  preventDefault,
}: HotkeyProps) {
  useHotkey(keys, onPress, { description, scope, enabled, preventDefault });
  return null;
}
