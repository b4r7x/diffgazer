"use client";

import { useId, useLayoutEffect } from "react";
import { useKeyboardRegistryContext } from "../context/keyboard-context.js";

export interface UseScopeOptions {
  enabled?: boolean;
}

/**
 * Activate a named keyboard scope while the component is mounted.
 *
 * Scopes form a stack: any `useKey` registration that omits its own `scope`
 * binds to the topmost active scope. Passing `null` (or `enabled: false`)
 * leaves the parent scope active.
 *
 * @example
 * ```tsx
 * function ConfirmDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
 *   useScope("dialog", { enabled: open });
 *   useKey("Escape", onClose);
 *   useKey("Enter", () => onClose());
 *   return open ? <DialogContent>...</DialogContent> : null;
 * }
 * ```
 *
 * @returns The active scope name, or `null` when disabled.
 */
export function useScope(name: string | null, options: UseScopeOptions = {}): string | null {
  const { enabled = true } = options;
  const { pushScope } = useKeyboardRegistryContext();
  const order = useId();

  useLayoutEffect(() => {
    if (!enabled || name === null) return;
    return pushScope(name, order);
  }, [pushScope, name, enabled, order]);

  return enabled && name !== null ? name : null;
}
