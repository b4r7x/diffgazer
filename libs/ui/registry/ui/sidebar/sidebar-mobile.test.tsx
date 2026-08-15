import { requireValue } from "@diffgazer/core/testing/assertions";
import { stubMatchMedia } from "@diffgazer/core/testing/match-media";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Sidebar } from "./index";

/**
 * The sheet is a modal <dialog>, so anything rendered outside it is unreachable
 * behind the top layer in a real browser. Touch dismissal is a press on the
 * backdrop: a pointerdown/click pair whose coordinates fall outside the dialog rect.
 */
function pressSheetBackdrop(sheet: HTMLElement) {
  vi.spyOn(sheet, "getBoundingClientRect").mockReturnValue({
    x: 100,
    y: 0,
    width: 320,
    height: 800,
    top: 0,
    right: 420,
    bottom: 800,
    left: 100,
    toJSON() {},
  });

  // fireEvent retained: pointerdown/click coordinate pair asserts backdrop hit-testing outside the dialog rect.
  fireEvent.pointerDown(sheet, { clientX: 10, clientY: 10 });
  // fireEvent retained: pointerdown/click coordinate pair asserts backdrop hit-testing outside the dialog rect.
  fireEvent.click(sheet, { clientX: 10, clientY: 10 });
}

describe("Sidebar mobile sheet", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  it("mounts closed on mobile with the default provider state", () => {
    const onStateChange = vi.fn();
    stubMatchMedia(true);
    render(
      <Sidebar.Provider onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("opens the sheet from the trigger and closes it on a backdrop press", async () => {
    const user = userEvent.setup();
    stubMatchMedia(true);
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
        <Sidebar.Trigger>Toggle</Sidebar.Trigger>
      </Sidebar.Provider>,
    );

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      "open",
    );
    expect(screen.getByRole("button", { name: "Close navigation" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    pressSheetBackdrop(screen.getByRole("dialog"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("renders no dialog close icon over the sheet header", async () => {
    const user = userEvent.setup();
    stubMatchMedia(true);
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Header>~/ui/docs</Sidebar.Header>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
        <Sidebar.Trigger>Toggle</Sidebar.Trigger>
      </Sidebar.Provider>,
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    // The sheet opts out of the dialog's default [x]: it is a drawer dismissed
    // by Esc or an outside tap, and the button would absolute-position itself
    // over the top-right corner the sheet gives to header content.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close dialog" })).not.toBeInTheDocument();
  });

  it.each([
    ["open" as const],
    ["rail" as const],
  ])("keeps the sheet closed when a desktop %s state flips to mobile", async (defaultState) => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const viewport = stubMatchMedia(false);
    render(
      <Sidebar.Provider defaultState={defaultState} onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
        <Sidebar.Trigger>Toggle</Sidebar.Trigger>
      </Sidebar.Provider>,
    );

    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      defaultState,
    );

    act(() => viewport.setMatches(true));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("opens the sheet on the first Cmd+B after a fresh mobile mount", () => {
    const onStateChange = vi.fn();
    stubMatchMedia(true);
    render(
      <Sidebar.Provider defaultState="rail" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true }));
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("never writes the provider state when entering, opening, or closing the sheet", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    stubMatchMedia(true);
    render(
      <Sidebar.Provider defaultState="rail" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
        <Sidebar.Trigger>Toggle</Sidebar.Trigger>
      </Sidebar.Provider>,
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    const dialog = screen.getByRole("dialog");

    // fireEvent retained: native <dialog> cancel event has no user-event equivalent
    fireEvent(dialog, new Event("cancel", { bubbles: false }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // A cookie-backed consumer mirrors every onStateChange write, so a phone
    // visit must not emit one at all or it overwrites the desktop preference.
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("renders inline navigation on mobile when embedded is true and never writes state", () => {
    const onStateChange = vi.fn();
    stubMatchMedia(true);
    render(
      <Sidebar.Provider onStateChange={onStateChange}>
        <Sidebar embedded>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Item" })).toBeInTheDocument();
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("opens the sheet from a controlled state that a parent never changes", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    stubMatchMedia(true);

    // `state` controls the desktop presentation only; a parent pinning "rail"
    // and ignoring every callback must not be able to make the sheet
    // unopenable while the trigger claims it is expanded.
    // The in-sheet trigger is the only one a modal <dialog> leaves clickable
    // while the sheet is open, so it owns the toggle-close assertion here.
    render(
      <Sidebar.Provider state="rail" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Header>
            <Sidebar.Trigger>Toggle</Sidebar.Trigger>
          </Sidebar.Header>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
        <Sidebar.Trigger>Toggle</Sidebar.Trigger>
      </Sidebar.Provider>,
    );

    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    const sheet = screen.getByRole("dialog");
    const sheetTrigger = within(sheet).getByRole("button", { name: "Close navigation" });
    expect(sheetTrigger).toHaveAttribute("aria-expanded", "true");

    await user.click(sheetTrigger);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("restores a desktop rail presentation after a mobile resize", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const viewport = stubMatchMedia(false);
    render(
      <Sidebar.Provider defaultState="rail" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
        <Sidebar.Trigger>Toggle</Sidebar.Trigger>
      </Sidebar.Provider>,
    );

    act(() => viewport.setMatches(true));
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    act(() => viewport.setMatches(false));

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toHaveAttribute("data-state", "rail");
    expect(nav).not.toHaveAttribute("aria-hidden");
    expect(nav).not.toHaveAttribute("inert");
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("returns to a closed sheet after a desktop round trip", async () => {
    const user = userEvent.setup();
    const viewport = stubMatchMedia(true);
    render(
      <Sidebar.Provider defaultState="rail">
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
        <Sidebar.Trigger>Toggle</Sidebar.Trigger>
      </Sidebar.Provider>,
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    act(() => viewport.setMatches(false));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      "rail",
    );

    act(() => viewport.setMatches(true));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open navigation" })).toBeInTheDocument();
  });

  it("keeps the sheet body interactive when the provider sits at hidden", async () => {
    const user = userEvent.setup();
    stubMatchMedia(true);
    render(
      <Sidebar.Provider defaultState="hidden">
        <Sidebar>
          <Sidebar.Content data-testid="sheet-content">
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
        <Sidebar.Trigger>Toggle</Sidebar.Trigger>
      </Sidebar.Provider>,
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    // "hidden" describes the desktop layout, so it must not follow the nav into
    // the sheet and take the open sheet's own body out of the a11y tree.
    const content = screen.getByTestId("sheet-content");
    expect(content).not.toHaveAttribute("aria-hidden");
    expect(content).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Item" })).toBeInTheDocument();
  });

  it("renders the plain nav (no Dialog) on desktop viewports", () => {
    stubMatchMedia(false);
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  });

  it("subscribes to the sidebar owner window and cleans up the exact media query", () => {
    stubMatchMedia(false);
    // Spy on the stubbed top-level matchMedia so "the sidebar asked its own
    // document, never this window" stays assertable below.
    const topLevelMatchMedia = vi.spyOn(window, "matchMedia");
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const frameDocument = requireValue(iframe.contentDocument, "iframe document");
    const frameWindow = requireValue(iframe.contentWindow, "iframe window");
    const dialogPrototype = Object.getPrototypeOf(
      frameDocument.createElement("dialog"),
    ) as HTMLDialogElement;
    Object.defineProperties(dialogPrototype, {
      showModal: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.setAttribute("open", "");
        },
      },
      close: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.removeAttribute("open");
        },
      },
    });
    let matches = true;
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const addEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "change") listeners.add(listener);
    });
    const removeEventListener = vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "change") listeners.delete(listener);
      },
    );
    const mediaQueryList = {
      get matches() {
        return matches;
      },
      media: "(max-width: 1023px)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener,
      removeEventListener,
      dispatchEvent: vi.fn(),
    } as MediaQueryList;
    const frameMatchMedia = vi.fn(() => mediaQueryList);
    Object.defineProperty(frameWindow, "matchMedia", {
      configurable: true,
      writable: true,
      value: frameMatchMedia,
    });

    const rendered = render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Frame item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
      { baseElement: frameDocument.body, container: frameDocument.body },
    );

    // The frame reports mobile, so the sheet branch is active — and the sheet's
    // own open state starts closed instead of trapping focus on load.
    expect(rendered.queryByRole("dialog")).not.toBeInTheDocument();
    expect(frameMatchMedia).toHaveBeenCalledTimes(1);
    expect(topLevelMatchMedia).not.toHaveBeenCalled();
    expect(addEventListener).toHaveBeenCalledTimes(1);

    act(() => {
      matches = false;
      for (const listener of listeners) {
        if (typeof listener === "function") listener(new Event("change"));
        else listener.handleEvent(new Event("change"));
      }
    });

    // Back on desktop the inline nav renders at the untouched provider default.
    expect(rendered.queryByRole("dialog")).not.toBeInTheDocument();
    expect(rendered.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      "open",
    );

    rendered.unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", addEventListener.mock.calls[0]?.[1]);
    expect(listeners).toHaveLength(0);
    iframe.remove();
  });

  it("has no a11y violations with the sheet open", async () => {
    const user = userEvent.setup();
    stubMatchMedia(true);
    const { container } = render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
        <Sidebar.Trigger>Toggle</Sidebar.Trigger>
      </Sidebar.Provider>,
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("SidebarContent overflow", () => {
  it("hides horizontal overflow on the scroller", () => {
    render(
      <Sidebar embedded>
        <Sidebar.Content data-testid="sidebar-content">
          <Sidebar.Item as="button">Item</Sidebar.Item>
        </Sidebar.Content>
      </Sidebar>,
    );

    // Public styling contract (fix-spec-b1 SEED-02B): the scroller authors both
    // axes explicitly so a one-axis `overflow-y-auto` cannot compute overflow-x
    // to `auto` and pan the sheet horizontally. jsdom cannot compute layout, so
    // the class token is the assertable contract.
    expect(screen.getByTestId("sidebar-content")).toHaveClass("overflow-x-hidden");
  });
});
