"use client";

import { useEffect } from "react";

import { useHotkeyContext } from "./hotkey-context";
import type { HotkeyOptions } from "./types";

export function useHotkey(
  keys: string,
  onPress: (event: KeyboardEvent) => void,
  options: Omit<HotkeyOptions, "keys" | "onPress"> = {}
) {
  const { register } = useHotkeyContext();

  useEffect(() => {
    return register({
      keys,
      onPress,
      ...options,
    });
  }, [register, keys, onPress, options.enabled, options.scope, options.description, options.preventDefault]);
}
