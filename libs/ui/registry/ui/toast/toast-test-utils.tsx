import { act, configure, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { dismiss, remove, useToastStore } from "./toast-store";

// The Toaster's persistent polite live region duplicates visible toast
// text for screen readers, so text queries ignore it like script/style.
const DEFAULT_IGNORE = "script, style";
const TOAST_IGNORE = `${DEFAULT_IGNORE}, [data-slot="toast-announcer"], [data-slot="toast-announcer"] *`;

function StoreReader({ onRead }: { onRead: (ids: string[]) => void }) {
  const { toasts } = useToastStore();
  onRead(toasts.map((t) => t.id));
  return null;
}

function cleanupStore() {
  let ids: string[] = [];
  const { unmount } = render(
    <StoreReader
      onRead={(v) => {
        ids = v;
      }}
    />,
  );
  unmount();
  for (const id of ids) {
    dismiss(id);
    remove(id);
  }
}

/** Focuses "Page control", presses the hotkey, and asserts the region took focus. */
export function inspectRegionViaHotkey(): { pageControl: HTMLElement; region: HTMLElement } {
  const pageControl = screen.getByRole("button", { name: "Page control" });
  const region = screen.getByRole("region", { name: "Notifications" });
  act(() => {
    pageControl.focus();
  });
  act(() => {
    pageControl.dispatchEvent(
      new KeyboardEvent("keydown", { key: "F8", bubbles: true, cancelable: true }),
    );
  });
  expect(region).toHaveFocus();
  return { pageControl, region };
}

interface PopoverStub {
  getOpenCount: () => number;
  getShowCalls: () => number;
  restore: () => void;
}

// jsdom implements no popover / showPopover / hidePopover / :popover-open, so
// stub them to exercise the Toaster's supporting-browser branch. Every other
// test covers the non-supporting branch.
export function installPopoverStub(): PopoverStub {
  const Proto = HTMLElement.prototype;
  const popoverDesc = Object.getOwnPropertyDescriptor(Proto, "popover");
  const showDesc = Object.getOwnPropertyDescriptor(Proto, "showPopover");
  const hideDesc = Object.getOwnPropertyDescriptor(Proto, "hidePopover");
  const matchesDesc = Object.getOwnPropertyDescriptor(Proto, "matches");
  const originalMatches = Proto.matches;
  let openCount = 0;
  let showCalls = 0;
  Object.defineProperty(Proto, "popover", {
    configurable: true,
    get(this: HTMLElement) {
      return this.getAttribute("popover");
    },
    set(this: HTMLElement, v: string | null) {
      if (v == null) this.removeAttribute("popover");
      else this.setAttribute("popover", v);
    },
  });
  Object.defineProperty(Proto, "showPopover", {
    configurable: true,
    writable: true,
    value(this: HTMLElement) {
      openCount++;
      showCalls++;
      this.setAttribute("data-popover-open", "");
    },
  });
  Object.defineProperty(Proto, "hidePopover", {
    configurable: true,
    writable: true,
    value(this: HTMLElement) {
      openCount--;
      this.removeAttribute("data-popover-open");
    },
  });
  Object.defineProperty(Proto, "matches", {
    configurable: true,
    writable: true,
    value(this: HTMLElement, selector: string) {
      if (selector === ":popover-open") return this.hasAttribute("data-popover-open");
      return originalMatches.call(this, selector);
    },
  });

  return {
    getOpenCount: () => openCount,
    getShowCalls: () => showCalls,
    restore() {
      if (popoverDesc) Object.defineProperty(Proto, "popover", popoverDesc);
      else Reflect.deleteProperty(Proto, "popover");
      if (showDesc) Object.defineProperty(Proto, "showPopover", showDesc);
      else Reflect.deleteProperty(Proto, "showPopover");
      if (hideDesc) Object.defineProperty(Proto, "hidePopover", hideDesc);
      else Reflect.deleteProperty(Proto, "hidePopover");
      if (matchesDesc) Object.defineProperty(Proto, "matches", matchesDesc);
      else Reflect.deleteProperty(Proto, "matches");
    },
  };
}

/**
 * Vitest fixture: fake timers, the announcer-ignoring text-query config, a
 * visible document, and a store drained between cases. Call from inside a
 * `describe`; the hooks are scoped to it.
 */
export function applyToastTestEnvironment(): void {
  beforeEach(() => {
    vi.useFakeTimers();
    configure({ defaultIgnore: TOAST_IGNORE });
    Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true });
  });

  afterEach(() => {
    cleanupStore();
    configure({ defaultIgnore: DEFAULT_IGNORE });
    vi.useRealTimers();
  });
}
