"use client";

import { useEffect, useRef } from "react";
import { useKeyboardContext } from "./use-keyboard-context";

export function useScope(name: string) {
  const { activeScope, setScope } = useKeyboardContext();
  const prevScopeRef = useRef<string | null>(null);

  useEffect(() => {
    prevScopeRef.current = activeScope;
    setScope(name);
    return () => setScope(prevScopeRef.current);
  }, [name, setScope]);
}
