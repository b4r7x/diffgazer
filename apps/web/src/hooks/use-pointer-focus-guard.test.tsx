import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type RefObject, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { usePointerFocusGuard } from "@/hooks/use-pointer-focus-guard";

function Guard({ sinkRef }: { sinkRef: RefObject<HTMLElement | null> }) {
  usePointerFocusGuard(sinkRef);
  return null;
}

function GuardHarness({ guarded = true }: { guarded?: boolean }) {
  const sinkRef = useRef<HTMLElement>(null);

  return (
    <>
      {guarded ? <Guard sinkRef={sinkRef} /> : null}
      {/* biome-ignore lint/a11y/useValidAnchor: mirrors the app's real skip link (components/layout/global.tsx) so the guard's interactive-target exemption and sink recovery run against the shape they ship against; preventDefault only stops jsdom hash navigation. */}
      <a
        href="#sink"
        onClick={(event) => {
          event.preventDefault();
          sinkRef.current?.focus();
        }}
      >
        Skip to main content
      </a>
      <main ref={sinkRef} id="sink" tabIndex={-1}>
        <div role="listbox" tabIndex={0} aria-label="Runs">
          <div role="option" tabIndex={-1} aria-selected={false}>
            Roving option
          </div>
        </div>
        <button type="button" tabIndex={-1}>
          Roving action
        </button>
        <button type="button">Open review</button>
        <label htmlFor="notes">Notes</label>
        <input id="notes" type="text" />
        <p>dead space</p>
        <div>scroll pane</div>
      </main>
    </>
  );
}

describe("usePointerFocusGuard", () => {
  it("keeps focus on the active widget when a click lands on dead space", async () => {
    const user = userEvent.setup();
    render(<GuardHarness />);
    const listbox = screen.getByRole("listbox", { name: "Runs" });
    // Focus must never leave and return either: a blur would blink pane chrome.
    const onBlur = vi.fn();
    listbox.addEventListener("blur", onBlur);

    listbox.focus();
    await user.click(screen.getByText("dead space"));

    expect(onBlur).not.toHaveBeenCalled();
    expect(listbox).toHaveFocus();
  });

  it("leaves focus with a control the user actually clicked", async () => {
    const user = userEvent.setup();
    render(<GuardHarness />);
    const button = screen.getByRole("button", { name: "Open review" });

    screen.getByRole("listbox", { name: "Runs" }).focus();
    await user.click(button);

    expect(button).toHaveFocus();
  });

  it("leaves focus with a roving control, whose negative tabindex is not a focus park", async () => {
    const user = userEvent.setup();
    render(<GuardHarness />);
    const listbox = screen.getByRole("listbox", { name: "Runs" });

    listbox.focus();
    const option = screen.getByRole("option", { name: "Roving option" });
    await user.click(option);
    expect(option).toHaveFocus();

    listbox.focus();
    const action = screen.getByRole("button", { name: "Roving action" });
    await user.click(action);
    expect(action).toHaveFocus();
  });

  it("lets a label click focus its control", async () => {
    const user = userEvent.setup();
    render(<GuardHarness />);

    screen.getByRole("listbox", { name: "Runs" }).focus();
    await user.click(screen.getByText("Notes"));

    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("lets the skip link move focus to the sink", async () => {
    const user = userEvent.setup();
    render(<GuardHarness />);

    screen.getByRole("listbox", { name: "Runs" }).focus();
    await user.click(screen.getByRole("link", { name: "Skip to main content" }));

    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("never touches programmatic focus of the sink", () => {
    render(<GuardHarness />);
    const sink = screen.getByRole("main");

    screen.getByRole("listbox", { name: "Runs" }).focus();
    sink.focus();

    expect(sink).toHaveFocus();
  });

  it("pulls focus back from a parked sink on the next dead-space press", async () => {
    const user = userEvent.setup();
    render(<GuardHarness />);
    const listbox = screen.getByRole("listbox", { name: "Runs" });

    listbox.focus();
    screen.getByRole("main").focus();
    await user.click(screen.getByText("dead space"));

    expect(listbox).toHaveFocus();
  });

  it("leaves focus alone when nothing held it before the gesture", async () => {
    const user = userEvent.setup();
    render(<GuardHarness />);

    await user.click(screen.getByText("dead space"));

    expect(screen.getByRole("listbox", { name: "Runs" })).not.toHaveFocus();
  });

  // jsdom does no layout, so the scroll box and the pointer position are the
  // only way to exercise the gutter branch; offsetX/Y are read-only accessors.
  it("leaves the whole scrollbar gutter of a bordered pane draggable", () => {
    render(<GuardHarness />);
    const pane = screen.getByText("scroll pane");
    for (const [metric, value] of Object.entries({
      clientLeft: 2,
      clientTop: 2,
      clientWidth: 100,
      clientHeight: 100,
      scrollWidth: 100,
      scrollHeight: 400,
    })) {
      Object.defineProperty(pane, metric, { value, configurable: true });
    }

    const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    // The gutter's first pixel: padding-box x === clientWidth, border excluded.
    Object.defineProperty(press, "offsetX", { value: 100 });
    Object.defineProperty(press, "offsetY", { value: 40 });
    pane.dispatchEvent(press);

    expect(press.defaultPrevented).toBe(false);
  });

  it("stops guarding once the hook owner unmounts", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<GuardHarness />);
    const listbox = screen.getByRole("listbox", { name: "Runs" });

    listbox.focus();
    rerender(<GuardHarness guarded={false} />);
    await user.click(screen.getByText("dead space"));

    expect(listbox).not.toHaveFocus();
  });
});
