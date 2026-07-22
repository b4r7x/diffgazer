import {
  composedContains,
  getComposedEventTarget,
  getDeepActiveElement,
  isHTMLElement,
  isHTMLInputElement,
} from "../dom/element-guards.js";
import {
  documentOrder,
  getComposedChildren,
  getFocusableElements,
  getTabbableElements,
  isFocusable,
} from "../dom/focusable.js";

interface TrapEntry {
  container: HTMLElement;
  ownerDocument: Document;
  resolveInitialFocus: () => HTMLElement;
  lastFocused: HTMLElement;
  handleKeyDown: (event: KeyboardEvent) => void;
  handleFocusIn: (event: FocusEvent) => void;
  observer: MutationObserver;
  observedTargets: Set<Node>;
  suspended: boolean;
}

export interface CreateFocusTrapControllerOptions {
  container: HTMLElement;
  resolveInitialFocus: () => HTMLElement;
  MutationObserverCtor: typeof MutationObserver;
}

export interface FocusTrapReleaseResult {
  hasOuterTrap: boolean;
}

export interface FocusTrapController {
  activate: () => void;
  release: () => FocusTrapReleaseResult;
}

const trapStacks = new WeakMap<Document, TrapEntry[]>();

const TRAP_MUTATION_OPTIONS = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: [
    "disabled",
    "hidden",
    "open",
    "tabindex",
    "aria-hidden",
    "inert",
    "style",
    "class",
  ],
} as const satisfies MutationObserverInit;

function getOpenShadowRoots(container: HTMLElement): ShadowRoot[] {
  const roots: ShadowRoot[] = [];
  const visit = (element: Element) => {
    if (element.shadowRoot) roots.push(element.shadowRoot);
    for (const child of getComposedChildren(element)) visit(child);
  };
  visit(container);
  return roots;
}

function observeNewTrapTargets(entry: TrapEntry): void {
  const targets: Node[] = [entry.container, ...getOpenShadowRoots(entry.container)];
  for (const target of targets) {
    if (entry.observedTargets.has(target)) continue;
    entry.observer.observe(target, TRAP_MUTATION_OPTIONS);
    entry.observedTargets.add(target);
  }
}

function disconnectTrapObserver(entry: TrapEntry): void {
  entry.observer.disconnect();
  entry.observedTargets.clear();
}

function getTrapStack(ownerDocument: Document): TrapEntry[] {
  let stack = trapStacks.get(ownerDocument);
  if (!stack) {
    stack = [];
    trapStacks.set(ownerDocument, stack);
  }
  return stack;
}

function armEntry(entry: TrapEntry): void {
  if (!entry.suspended) return;
  entry.ownerDocument.addEventListener("keydown", entry.handleKeyDown, true);
  entry.ownerDocument.addEventListener("focusin", entry.handleFocusIn, true);
  observeNewTrapTargets(entry);
  entry.suspended = false;
}

function suspendEntry(entry: TrapEntry): void {
  if (entry.suspended) return;
  entry.ownerDocument.removeEventListener("keydown", entry.handleKeyDown, true);
  entry.ownerDocument.removeEventListener("focusin", entry.handleFocusIn, true);
  disconnectTrapObserver(entry);
  entry.suspended = true;
}

function resumeEntry(entry: TrapEntry): void {
  armEntry(entry);
  const target =
    composedContains(entry.container, entry.lastFocused) &&
    entry.lastFocused.isConnected &&
    isFocusable(entry.lastFocused)
      ? entry.lastFocused
      : entry.resolveInitialFocus();
  target.focus();
}

function shouldInsertBefore(incoming: TrapEntry, existing: TrapEntry): boolean {
  return (
    incoming.container !== existing.container &&
    composedContains(incoming.container, existing.container)
  );
}

function pushTrap(entry: TrapEntry): boolean {
  const stack = getTrapStack(entry.ownerDocument);
  const previousTop = stack.at(-1);
  const insertIndex = stack.findIndex((existing) => shouldInsertBefore(entry, existing));
  if (insertIndex === -1) stack.push(entry);
  else stack.splice(insertIndex, 0, entry);

  const nextTop = stack.at(-1);
  if (previousTop && previousTop !== nextTop) suspendEntry(previousTop);
  return nextTop === entry;
}

function removeTrap(entry: TrapEntry): void {
  const stack = getTrapStack(entry.ownerDocument);
  const index = stack.indexOf(entry);
  if (index < 0) return;
  const wasTop = index === stack.length - 1;
  stack.splice(index, 1);
  if (wasTop) {
    const newTop = stack.at(-1);
    if (newTop) resumeEntry(newTop);
  }
}

function isInsideContainer(
  container: HTMLElement,
  target: EventTarget | null,
): target is HTMLElement {
  return isHTMLElement(target) && composedContains(container, target);
}

function getTabbableFromAnchor(
  tabbableEls: [HTMLElement, ...HTMLElement[]],
  activeElement: HTMLElement,
  shiftKey: boolean,
): HTMLElement {
  const firstTabbable = tabbableEls[0];
  const documentOrderEls = [...tabbableEls].sort(documentOrder);
  if (shiftKey) {
    for (let index = documentOrderEls.length - 1; index >= 0; index -= 1) {
      const candidate = documentOrderEls[index];
      if (candidate && documentOrder(candidate, activeElement) < 0) return candidate;
    }
    return documentOrderEls.at(-1) ?? firstTabbable;
  }

  for (const candidate of documentOrderEls) {
    if (documentOrder(activeElement, candidate) < 0) return candidate;
  }
  return documentOrderEls[0] ?? firstTabbable;
}

function hasExcludedCheckedRadioPeer(container: HTMLElement, element: HTMLElement): boolean {
  if (!isHTMLInputElement(element) || element.type !== "radio" || element.name === "") return false;
  const root = element.getRootNode();
  return getFocusableElements(container).some(
    (candidate) =>
      candidate !== element &&
      isHTMLInputElement(candidate) &&
      candidate.type === "radio" &&
      candidate.name === element.name &&
      candidate.form === element.form &&
      candidate.getRootNode() === root &&
      candidate.checked &&
      candidate.tabIndex < 0,
  );
}

export function createFocusTrapController(
  options: CreateFocusTrapControllerOptions,
): FocusTrapController {
  const { container, resolveInitialFocus, MutationObserverCtor } = options;
  const ownerDocument = container.ownerDocument;

  const hadTabIndex = container.hasAttribute("tabindex");
  const originalTabIndex = container.getAttribute("tabindex");
  if (!hadTabIndex) container.setAttribute("tabindex", "-1");

  let lastFocused: HTMLElement = container;
  let entry: TrapEntry | null = null;
  let activated = false;

  const recapture = () => {
    const target =
      composedContains(container, lastFocused) &&
      lastFocused.isConnected &&
      isFocusable(lastFocused)
        ? lastFocused
        : resolveInitialFocus();
    target.focus();
  };

  const handleFocusIn = (event: FocusEvent) => {
    const target = getComposedEventTarget(event);
    if (isInsideContainer(container, target)) {
      lastFocused = target;
      if (entry) {
        entry.lastFocused = target;
        if (!entry.suspended) observeNewTrapTargets(entry);
      }
      return;
    }
    recapture();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;

    if (entry && !entry.suspended) observeNewTrapTargets(entry);
    const focusableEls = getTabbableElements(container);
    if (focusableEls.length === 0) {
      event.preventDefault();
      if (getDeepActiveElement(ownerDocument) !== container) container.focus();
      return;
    }

    const first = focusableEls[0];
    const last = focusableEls[focusableEls.length - 1];
    const activeElement = getDeepActiveElement(ownerDocument);

    if (!isInsideContainer(container, activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
      return;
    }

    if (!focusableEls.includes(activeElement)) {
      event.preventDefault();
      getTabbableFromAnchor(
        focusableEls as [HTMLElement, ...HTMLElement[]],
        activeElement,
        event.shiftKey,
      ).focus();
      return;
    }

    const activeIndex = focusableEls.indexOf(activeElement);
    const adjacent = focusableEls[activeIndex + (event.shiftKey ? -1 : 1)];
    if (adjacent && hasExcludedCheckedRadioPeer(container, adjacent)) {
      event.preventDefault();
      adjacent.focus();
      return;
    }

    if (event.shiftKey) {
      if (activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
    } else {
      if (activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  const observer = new MutationObserverCtor(() => {
    if (entry && !entry.suspended) observeNewTrapTargets(entry);
    if (
      lastFocused.isConnected &&
      composedContains(container, lastFocused) &&
      isFocusable(lastFocused)
    )
      return;
    recapture();
  });

  const trapEntry: TrapEntry = {
    container,
    ownerDocument,
    resolveInitialFocus,
    lastFocused,
    handleKeyDown,
    handleFocusIn,
    observer,
    observedTargets: new Set(),
    suspended: true,
  };
  entry = trapEntry;

  return {
    activate: () => {
      if (activated) return;
      activated = true;

      const isTopTrap = pushTrap(trapEntry);

      if (isTopTrap) {
        armEntry(trapEntry);
        if (!isInsideContainer(container, getDeepActiveElement(ownerDocument))) {
          resolveInitialFocus().focus();
        }
        const activeElement = getDeepActiveElement(ownerDocument);
        lastFocused = isInsideContainer(container, activeElement)
          ? activeElement
          : resolveInitialFocus();
        trapEntry.lastFocused = lastFocused;
      } else {
        const activeElement = getDeepActiveElement(ownerDocument);
        if (isInsideContainer(container, activeElement)) {
          lastFocused = activeElement;
          trapEntry.lastFocused = lastFocused;
        }
      }
    },
    release: () => {
      if (!activated) {
        return { hasOuterTrap: getTrapStack(ownerDocument).length > 0 };
      }
      activated = false;

      ownerDocument.removeEventListener("keydown", handleKeyDown, true);
      ownerDocument.removeEventListener("focusin", handleFocusIn, true);
      disconnectTrapObserver(trapEntry);

      removeTrap(trapEntry);
      entry = null;

      if (!hadTabIndex) {
        container.removeAttribute("tabindex");
      } else if (originalTabIndex !== null) {
        container.setAttribute("tabindex", originalTabIndex);
      }

      return { hasOuterTrap: getTrapStack(ownerDocument).length > 0 };
    },
  };
}
