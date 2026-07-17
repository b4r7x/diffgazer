import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { labelDoc } from "../../component-docs/label";
import { Input } from "../input/index";
import { Label } from "./index";

describe("Label", () => {
  it("labels and focuses an external control through htmlFor", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" />
      </>,
    );

    await user.click(screen.getByText("Email"));

    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("labels a wrapped control without adding the required marker to its accessible name", () => {
    render(
      <Label label="Name" required>
        <Input />
      </Label>,
    );

    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
  });

  it("forwards mousedown from wrapped inputs and buttons", async () => {
    const user = userEvent.setup();
    const onMouseDown = vi.fn();
    render(
      <Label label="Actions" onMouseDown={onMouseDown}>
        <Input aria-label="Name" />
        <button type="button">Clear</button>
      </Label>,
    );

    await user.click(screen.getByRole("textbox", { name: "Name" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(onMouseDown).toHaveBeenCalledTimes(2);
  });

  it("honors consumer preventDefault for wrapped controls", () => {
    const onMouseDown = vi.fn();
    render(
      <Label
        label="Name"
        onMouseDown={(event) => {
          onMouseDown();
          event.preventDefault();
        }}
      >
        <Input />
      </Label>,
    );
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true, detail: 2 });

    // fireEvent retained: a custom MouseEvent exposes defaultPrevented after Label handles it.
    fireEvent(screen.getByRole("textbox", { name: "Name" }), event);

    expect(onMouseDown).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not prevent multi-click mousedown from wrapped inputs and buttons", () => {
    const onMouseDown = vi.fn();
    render(
      <Label label="Actions" onMouseDown={onMouseDown}>
        <Input aria-label="Name" />
        <button type="button">Clear</button>
      </Label>,
    );
    const inputEvent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      detail: 2,
    });
    const buttonEvent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      detail: 2,
    });

    // fireEvent retained: custom multi-click events expose Label's default-prevention behavior.
    fireEvent(screen.getByRole("textbox", { name: "Name" }), inputEvent);
    fireEvent(screen.getByRole("button", { name: "Clear" }), buttonEvent);

    expect(onMouseDown).toHaveBeenCalledTimes(2);
    expect(inputEvent.defaultPrevented).toBe(false);
    expect(buttonEvent.defaultPrevented).toBe(false);
  });

  it("leaves multi-click handling on a wrapped control native in a foreign realm", () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument;
    const frameWindow = iframe.contentWindow;
    if (!frameDocument || !frameWindow) throw new Error("Expected an iframe document and window");
    const container = frameDocument.createElement("div");
    frameDocument.body.append(container);
    const onMouseDown = vi.fn();
    const rendered = render(
      <Label label="Name" onMouseDown={onMouseDown}>
        <Input />
      </Label>,
      { container },
    );
    const event = frameDocument.createEvent("MouseEvent");
    event.initMouseEvent(
      "mousedown",
      true,
      true,
      frameWindow,
      2,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      0,
      null,
    );

    // fireEvent retained: the foreign-realm MouseEvent proves the guard uses the label's realm.
    fireEvent(within(container).getByRole("textbox", { name: "Name" }), event);

    expect(onMouseDown).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(false);
    rendered.unmount();
    iframe.remove();
  });

  it("prevents multi-click selection on label text after notifying the consumer", () => {
    const defaultPreventedAtConsumer: boolean[] = [];
    render(
      <Label
        htmlFor="double-click-input"
        onMouseDown={(event) => defaultPreventedAtConsumer.push(event.defaultPrevented)}
      >
        Project name
      </Label>,
    );
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true, detail: 2 });

    // fireEvent retained: a custom MouseEvent exposes defaultPrevented after Label handles it.
    fireEvent(screen.getByText("Project name"), event);

    expect(defaultPreventedAtConsumer).toEqual([false]);
    expect(event.defaultPrevented).toBe(true);
  });

  it("advertises automatic disabled ownership only for wrapper mode", () => {
    render(
      <>
        <Label label="Wrapped">
          <Input disabled />
        </Label>
        <Label htmlFor="standalone" className="manual-disabled">
          Standalone
        </Label>
        <Input id="standalone" disabled />
      </>,
    );

    const disabledNote = labelDoc.notes?.find((note) => note.title === "Disabled State");
    const wrapperLabel = screen.getByText("Wrapped").closest("label");
    const standaloneLabel = screen.getByText("Standalone");
    const wrappedControl = screen.getByRole("textbox", { name: "Wrapped" });
    const standaloneControl = screen.getByRole("textbox", { name: "Standalone" });

    expect(disabledNote?.content).toContain(
      "Wrapper mode automatically dims when it contains a disabled form control.",
    );
    expect(disabledNote?.content).toContain("Standalone mode does not inspect sibling controls");
    expect(disabledNote?.content).not.toContain("peer-disabled");
    expect(wrapperLabel).toContainElement(wrappedControl);
    expect(standaloneLabel).not.toContainElement(standaloneControl);
    expect(standaloneLabel).toHaveClass("manual-disabled");
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <Label label="Name" required>
        <Input />
      </Label>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
