/**
 * The reduced-motion answer is `instant`, not `auto`: `auto` defers to whatever
 * `scroll-behavior` the stylesheet set, which is the animation the reader asked
 * not to see. The query reads the element's own document so a scroll inside a
 * docs demo iframe honours that frame's media state.
 */
export function scrollBehaviorFor(element: Element): ScrollBehavior {
  const view = element.ownerDocument.defaultView;
  const prefersReducedMotion = view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return prefersReducedMotion ? "instant" : "smooth";
}
