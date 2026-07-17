"use client";

import { type Ref, useMemo, useRef } from "react";
import { composeRefs } from "@/lib/compose-refs";

/**
 * Cached companion to {@link composeRefs}. Returns a `RefCallback` whose
 * identity is stable across renders as long as the passed refs are stable, so
 * React does not detach/re-attach the underlying refs every commit (React 19
 * runs ref cleanup on identity change). Use this at component call sites instead
 * of calling `composeRefs(...)` inline during render.
 */
export function useComposedRefs<T>(...refs: Array<Ref<T> | null | undefined>) {
  const cachedRefs = useRef(refs);
  const refsChanged =
    cachedRefs.current.length !== refs.length ||
    cachedRefs.current.some((ref, index) => !Object.is(ref, refs[index]));

  if (refsChanged) cachedRefs.current = refs;

  const stableRefs = cachedRefs.current;
  return useMemo(() => composeRefs(...stableRefs), [stableRefs]);
}
