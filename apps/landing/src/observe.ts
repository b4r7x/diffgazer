import type { Cleanup } from "./util";

export function observeOnce(target: Element, onEnter: () => void, threshold = 0.5): Cleanup {
  if (typeof IntersectionObserver === "undefined") {
    onEnter();
    return () => {};
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        observer.disconnect();
        onEnter();
      }
    },
    { threshold },
  );
  observer.observe(target);
  return () => observer.disconnect();
}

export function observeEach(
  targets: Iterable<Element>,
  onEnter: (target: Element) => void,
  options: { threshold?: number; once?: boolean } = {},
): Cleanup {
  const { threshold = 0.5, once = false } = options;
  if (typeof IntersectionObserver === "undefined") {
    for (const target of targets) onEnter(target);
    return () => {};
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        onEnter(entry.target);
        if (once) observer.unobserve(entry.target);
      }
    },
    { threshold },
  );
  for (const target of targets) observer.observe(target);
  return () => observer.disconnect();
}
