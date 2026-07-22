import { isSelectableElementSkipped } from "@/lib/selectable-collection";

export function moveStepFocus(
  list: HTMLOListElement | null,
  next: (count: number, current: number) => number,
): boolean {
  if (!list) return false;
  const triggers = Array.from(list.querySelectorAll<HTMLButtonElement>("[data-step-id]")).filter(
    (el) =>
      el.getAttribute("aria-disabled") !== "true" &&
      !el.disabled &&
      !isSelectableElementSkipped(el),
  );
  if (triggers.length === 0) return false;
  const activeElement = list.ownerDocument.activeElement;
  const ButtonCtor = list.ownerDocument.defaultView?.HTMLButtonElement;
  const currentIndex =
    ButtonCtor && activeElement instanceof ButtonCtor ? triggers.indexOf(activeElement) : -1;
  const nextIndex = next(triggers.length, currentIndex);
  const target = triggers[nextIndex];
  if (!target) return false;
  if (target !== activeElement) target.focus();
  return list.ownerDocument.activeElement === target;
}

export function handleStepListNavigationKey(
  event: Pick<KeyboardEvent, "key" | "preventDefault">,
  list: HTMLOListElement | null,
  target: HTMLElement | null,
): void {
  if (!target?.hasAttribute("data-step-id")) return;

  switch (event.key) {
    case "ArrowDown":
    case "ArrowRight":
      if (moveStepFocus(list, (count, current) => (current === -1 ? 0 : (current + 1) % count))) {
        event.preventDefault();
      }
      return;
    case "ArrowUp":
    case "ArrowLeft":
      if (
        moveStepFocus(list, (count, current) =>
          current === -1 ? count - 1 : (current - 1 + count) % count,
        )
      ) {
        event.preventDefault();
      }
      return;
    case "Home":
      if (moveStepFocus(list, () => 0)) event.preventDefault();
      return;
    case "End":
      if (moveStepFocus(list, (count) => count - 1)) event.preventDefault();
      return;
  }
}
