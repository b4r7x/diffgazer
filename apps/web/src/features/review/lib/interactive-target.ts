// Matches natively-actionable targets: links, buttons, form controls, and the
// ARIA button/checkbox/radio/tab/contenteditable widgets. Keyboard handlers use
// it to bail so the browser activates the element instead of hijacking the key.
// Focusable scroll containers are intentionally not matched — they have no native
// activation and the review screens advertise their own whole-screen shortcuts.
const INTERACTIVE_TARGET_SELECTOR =
  'a, button, input, textarea, select, [role="button"], [role="checkbox"], [role="radio"], [role="tab"], [contenteditable="true"]';

// `Element`, not `HTMLElement`: an event landing on an <svg> icon inside a button
// still has to resolve to that button.
export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(INTERACTIVE_TARGET_SELECTOR));
}
