"use client";

import { useEffect } from "react";
import { useKeyboardContext } from "./use-keyboard-context";

export function useScope(name: string) {
  const { pushScope } = useKeyboardContext();

  useEffect(() => pushScope(name), [name, pushScope]);
}
