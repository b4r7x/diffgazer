import type { RefObject, Ref, RefCallback } from "react";

export function composeRefs<T>(
  ...refs: Array<Ref<T> | null | undefined>
): RefCallback<T> {
  return (element: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(element);
      } else if (ref != null) {
        (ref as RefObject<T | null>).current = element;
      }
    }
  };
}
