"use client";

import { type Ref, useCallback } from "react";
import { composeRefs } from "@/lib/compose-refs";

/**
 * Cached companion to {@link composeRefs}. Returns a `RefCallback` whose
 * identity is stable across renders as long as the passed refs are stable, so
 * React does not detach/re-attach the underlying refs every commit (React 19
 * runs ref cleanup on identity change). Use this at component call sites instead
 * of calling `composeRefs(...)` inline during render.
 */
export function useComposedRefs<T>(...refs: Array<Ref<T> | null | undefined>) {
  // refs is a fresh array each render; spreading it into the deps keeps the
  // memo keyed on the individual ref identities, not the array wrapper.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are the spread refs themselves.
  return useCallback(composeRefs(...refs), refs);
}
