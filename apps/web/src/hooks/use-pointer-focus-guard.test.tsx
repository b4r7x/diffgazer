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
