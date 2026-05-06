import type { RefObject, Ref, RefCallback } from "react";

function assignRef<T>(ref: Ref<T>, element: T | null): void {
  if (typeof ref === "function") {
    ref(element);
    return;
  }

  (ref as RefObject<T | null>).current = element;
}

export function composeRefs<T>(
  ...refs: Array<Ref<T> | null | undefined>
): RefCallback<T> {
  return (element: T | null) => {
    const cleanups: Array<() => void> = [];
    const callbackRefs: Array<RefCallback<T>> = [];
    const objectRefs: Array<RefObject<T | null>> = [];

    for (const ref of refs) {
      if (typeof ref === "function") {
        const result = ref(element);
        if (typeof result === "function") {
          cleanups.push(result);
        } else if (element !== null) {
          callbackRefs.push(ref);
        }
      } else if (ref != null) {
        const objectRef = ref as RefObject<T | null>;
        objectRef.current = element;
        objectRefs.push(objectRef);
      }
    }

    if (objectRefs.length === 0 && callbackRefs.length === 0) {
      if (cleanups.length === 0) return;
      if (cleanups.length === 1) return cleanups[0];
    }

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
      for (const ref of callbackRefs) {
        ref(null);
      }
      for (const ref of objectRefs) {
        assignRef(ref, null);
      }
    };
  };
}
