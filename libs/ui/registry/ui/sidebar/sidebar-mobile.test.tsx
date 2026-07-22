import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { requireValue } from "../../testing/assertions";
import { Sidebar } from "./index";

describe("Sidebar mobile sheet", () => {
  const originalMatchMedia = window.matchMedia;

  function stubMatchMedia(isMobile: boolean) {
    let matches = isMobile;
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const mql = {
      get matches() {
        return matches;
      },
      media: "(max-width: 1023px)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.add(listener);
      }),
      removeEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.delete(listener);
      }),
      dispatchEvent: vi.fn(),
    } as MediaQueryList;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(mql),
    });
    return {
      setMobile(next: boolean) {
        matches = next;
        const event = new Event("change");
        for (const listener of listeners) {
          if (typeof listener === "function") listener(event);
          else listener.handleEvent(event);
        }
      },
    };
  }

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  it("renders the Dialog sheet branch when the viewport matches the mobile breakpoint", () => {
    stubMatchMedia(true);
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it.each([
    ["uncontrolled", { defaultState: "rail" as const }],
    ["controlled", { state: "rail" as const }],
  ])("presents a %s rail state as an open mobile sidebar", (_mode, providerProps) => {
    stubMatchMedia(true);
    render(
      <Sidebar.Provider {...providerProps}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">
              <Sidebar.ItemLabel>Item label</Sidebar.ItemLabel>
            </Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      "open",
    );
    expect(screen.getByText("Item label")).toBeInTheDocument();
  });

  it("restores a desktop rail presentation after a mobile resize", () => {
    const viewport = stubMatchMedia(false);
    render(
      <Sidebar.Provider defaultState="rail">
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      "rail",
    );

    act(() => viewport.setMobile(true));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      "open",
    );

    act(() => viewport.setMobile(false));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      "rail",
    );
  });

  it("toggles every visible mobile state through hidden and back to open", async () => {
    const user = userEvent.setup();
    stubMatchMedia(true);
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

    await user.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      "open",
    );
  });

  it("uses the mobile visible-hidden transition for Cmd+B", () => {
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
    expect(onStateChange).toHaveBeenLastCalledWith("hidden");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true }));
    });
    expect(onStateChange).toHaveBeenLastCalledWith("open");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("requests hidden from a controlled mobile rail without exposing rail presentation", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    stubMatchMedia(true);
    render(
      <Sidebar.Provider state="rail" onStateChange={onStateChange}>
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
      "open",
    );
    await user.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(onStateChange).toHaveBeenCalledWith("hidden");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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

  it("renders inline navigation on mobile when embedded is true", () => {
    stubMatchMedia(true);
    render(
      <Sidebar.Provider>
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
  });

  it("subscribes to the sidebar owner window and cleans up the exact media query", () => {
    stubMatchMedia(false);
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

    expect(rendered.getByRole("dialog")).toBeInTheDocument();
    expect(frameMatchMedia).toHaveBeenCalledTimes(1);
    expect(window.matchMedia).not.toHaveBeenCalled();
    expect(addEventListener).toHaveBeenCalledTimes(1);

    act(() => {
      matches = false;
      for (const listener of listeners) {
        if (typeof listener === "function") listener(new Event("change"));
        else listener.handleEvent(new Event("change"));
      }
    });

    expect(rendered.queryByRole("dialog")).not.toBeInTheDocument();
    expect(rendered.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();

    rendered.unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", addEventListener.mock.calls[0]?.[1]);
    expect(listeners).toHaveLength(0);
    iframe.remove();
  });

  it("has no a11y violations", async () => {
    stubMatchMedia(true);
    const { container } = render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
