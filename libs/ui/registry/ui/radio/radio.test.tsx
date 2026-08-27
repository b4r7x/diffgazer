import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { expectFieldInvalid, expectResetClearsInvalid } from "../../testing/form-behavior";
import { Checkbox } from "../checkbox/index";
import { Field } from "../field/index";
import { Radio } from "./index";

/** Visible indicator glyph of a selectable control (the aria-hidden cell before the label). */
function readGlyph(control: HTMLElement): string {
  const indicator = control.querySelector('[aria-hidden="true"]');
  if (indicator === null) throw new Error("Expected an indicator glyph");
  return indicator.textContent ?? "";
}

function getForm(): HTMLFormElement {
  const form = screen.getByRole("form", { name: "Test form" });
  if (!(form instanceof HTMLFormElement)) throw new Error("Expected form test element");
  return form;
}

describe("Radio", () => {
  it("emits data-slot and data-state styling hooks", () => {
    const { rerender } = render(<Radio checked={false} label="A" />);
    const control = screen.getByRole("radio");
    expect(control).toHaveAttribute("data-slot", "radio");
    expect(control).toHaveAttribute("data-state", "unchecked");
    rerender(<Radio checked label="A" />);
    expect(control).toHaveAttribute("data-state", "checked");
    rerender(<Radio checked disabled label="A" />);
    expect(control).toHaveAttribute("data-disabled", "");
  });

  it("draws every glyph in the same three-character column as Checkbox", () => {
    // One glyph column for the whole family: a mixed checkbox/radio form has a single label
    // left edge, which the padded five-character bullet used to break by 2ch.
    for (const variant of ["x", "bullet"] as const) {
      for (const checked of [true, false] as const) {
        const { unmount } = render(<Radio checked={checked} variant={variant} label="A" />);
        expect(readGlyph(screen.getByRole("radio"))).toHaveLength(3);
        unmount();
      }
    }

    render(
      <>
        <Radio checked variant="bullet" label="Radio" />
        <Checkbox checked label="Checkbox" />
      </>,
    );
    expect(readGlyph(screen.getByRole("radio"))).toHaveLength(
      readGlyph(screen.getByRole("checkbox")).length,
    );
  });

  it("splits the glyph into chrome and mark without changing its visible text", () => {
    const { rerender } = render(<Radio checked variant="bullet" label="A" />);
    const indicator = screen
      .getByRole("radio", { name: "A" })
      .querySelector('[aria-hidden="true"]');
    expect(indicator).toHaveTextContent("[●]");
    expect(indicator?.querySelectorAll("span")).toHaveLength(3);

    rerender(<Radio checked={false} variant="x" label="A" />);
    expect(screen.getByRole("radio", { name: "A" })).toHaveTextContent("[ ]");
  });

  it("does not toggle off on second click (radio stays selected)", async () => {
    const user = userEvent.setup();
    render(<Radio defaultChecked label="Option A" />);
    const radio = screen.getByRole("radio");
    expect(radio).toHaveAttribute("aria-checked", "true");
    await user.click(radio);
    expect(radio).toHaveAttribute("aria-checked", "true");
  });

  it("does not select when disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClick = vi.fn();
    render(<Radio disabled onChange={onChange} onClick={onClick} label="Option A" />);
    await user.click(screen.getByRole("radio"));
    expect(onChange).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("Tab moves focus away from a click-focused disabled radio", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Radio disabled label="Option A" />
        <button type="button">Next</button>
      </>,
    );
    const radio = screen.getByRole("radio", { name: /option a/i });

    await user.click(radio);
    radio.focus();
    expect(radio).toHaveFocus();

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    radio.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);

    await user.tab();
    expect(screen.getByRole("button", { name: /next/i })).toHaveFocus();
  });

  it("works in uncontrolled mode with defaultChecked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Radio defaultChecked={false} onChange={onChange} label="Option A" />);
    const radio = screen.getByRole("radio");
    expect(radio).toHaveAttribute("aria-checked", "false");
    await user.click(radio);
    expect(radio).toHaveAttribute("aria-checked", "true");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("respects controlled value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Radio checked={false} onChange={onChange} label="Option A" />);
    await user.click(screen.getByRole("radio"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("radio")).toHaveAttribute("aria-checked", "false");
  });

  it("selects on Space key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Radio onChange={onChange} label="Option A" />);
    screen.getByRole("radio").focus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  // touch-target contract: pointer-coarse hit-area is the public contract; jsdom
  // cannot measure layout.
  it("row reserves a 44px coarse-pointer touch target", () => {
    render(<Radio label="Option A" />);
    expect(screen.getByRole("radio", { name: /option a/i })).toHaveClass("pointer-coarse:min-h-11");
  });

  it("has no a11y violations (standalone)", async () => {
    const { container } = render(<Radio label="Option A" aria-label="Option A" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("composes Field label and description ids with local label and description", () => {
    render(
      <Field invalid>
        <Field.Label>Payment method</Field.Label>
        <Field.Control>
          <Radio label="Card" description="Local help" />
        </Field.Control>
        <Field.Description>Field help</Field.Description>
        <Field.Error>Field error</Field.Error>
      </Field>,
    );

    const radio = screen.getByRole("radio", { name: /payment method.*card/i });
    expectFieldInvalid(radio, /field error.*field help.*local help/i);
  });

  it("submits a meaningful default value and resets uncontrolled state", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Test form">
        <Radio name="choice" defaultChecked={false} onChange={onChange} label="Option A" />
      </form>,
    );

    await user.click(screen.getByRole("radio"));
    const form = getForm();
    expect(new FormData(form).get("choice")).toBe("on");
    expect(onChange).toHaveBeenCalledOnce();

    form.reset();
    await waitFor(() => expect(new FormData(form).has("choice")).toBe(false));
    expect(screen.getByRole("radio")).toHaveAttribute("aria-checked", "false");
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("keeps a Radio activation newer than a same-task form reset", async () => {
    render(
      <form aria-label="Test form">
        <Radio name="choice" label="Option A" />
      </form>,
    );
    const radio = screen.getByRole("radio");
    const form = getForm();

    form.reset();
    // fireEvent retained: activation must remain in the reset task before its microtask can flush.
    fireEvent.click(radio);
    await Promise.resolve();

    expect(radio).toHaveAttribute("aria-checked", "true");
    expect(new FormData(form).get("choice")).toBe("on");
  });

  it("applies a Radio reset before a later activation", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <Radio name="choice" label="Option A" />
      </form>,
    );
    const radio = screen.getByRole("radio");
    const form = getForm();

    await user.click(radio);
    expect(new FormData(form).get("choice")).toBe("on");

    form.reset();
    await waitFor(() => expect(new FormData(form).has("choice")).toBe(false));
    expect(radio).toHaveAttribute("aria-checked", "false");

    await user.click(radio);
    expect(radio).toHaveAttribute("aria-checked", "true");
    expect(new FormData(form).get("choice")).toBe("on");
  });

  it("keeps custom and empty submitted values aligned with data-value", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <Radio name="choice" value="custom" label="Custom" />
        <Radio name="choice" value="" label="Empty" />
      </form>,
    );

    const custom = screen.getByRole("radio", { name: /custom/i });
    const empty = screen.getByRole("radio", { name: /empty/i });

    expect(custom).toHaveAttribute("data-value", "custom");
    expect(empty).toHaveAttribute("data-value", "");

    await user.click(custom);
    expect(new FormData(getForm()).get("choice")).toBe("custom");

    await user.click(empty);
    expect(new FormData(getForm()).get("choice")).toBe("");
  });

  it("focuses the visible radio when native required validation fails", async () => {
    render(
      <form aria-label="Test form">
        <Radio name="choice" required label="Option A" />
      </form>,
    );

    const form = getForm();
    const radio = screen.getByRole("radio", { name: /option a/i });

    expect(form.reportValidity()).toBe(false);
    expect(radio).toHaveFocus();
    await waitFor(() => expectFieldInvalid(radio));
  });

  it("clears aria-invalid on native form reset after a failed submit", async () => {
    render(
      <form aria-label="Test form">
        <Radio name="choice" required label="Option A" />
      </form>,
    );

    await expectResetClearsInvalid(getForm(), screen.getByRole("radio", { name: /option a/i }));
  });

  it("keeps the hidden form-mirror input out of the a11y tree with no aria-label", () => {
    const { container } = render(<Radio name="choice" required label="Option A" />);
    const mirror = container.querySelector('input[type="radio"]');
    expect(mirror).toHaveAttribute("aria-hidden", "true");
    expect(mirror).not.toHaveAttribute("aria-label");
  });

  it("validates required unnamed radios without contributing FormData", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <Radio required label="Option A" />
      </form>,
    );

    const form = getForm();
    const radio = screen.getByRole("radio", { name: /option a/i });

    expect(form.reportValidity()).toBe(false);
    expect(radio).toHaveFocus();
    await waitFor(() => expectFieldInvalid(radio));
    expect(new FormData(form).entries().next().done).toBe(true);

    await user.click(radio);
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).entries().next().done).toBe(true);
  });

  it("keeps standalone radios with the same name mutually exclusive", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <Radio name="size" value="small" label="Small" />
        <Radio name="size" value="large" label="Large" />
      </form>,
    );
    const small = screen.getByRole("radio", { name: /small/i });
    const large = screen.getByRole("radio", { name: /large/i });
    const form = getForm();

    await user.click(small);
    expect(small).toHaveAttribute("aria-checked", "true");
    expect(large).toHaveAttribute("aria-checked", "false");
    expect(new FormData(form).get("size")).toBe("small");

    await user.click(large);
    expect(small).toHaveAttribute("aria-checked", "false");
    expect(large).toHaveAttribute("aria-checked", "true");
    expect(new FormData(form).get("size")).toBe("large");
  });

  it("keeps same-name standalone radios independent across shadow roots", async () => {
    const user = userEvent.setup();
    const firstHost = document.createElement("div");
    const secondHost = document.createElement("div");
    document.body.append(firstHost, secondHost);
    const firstMount = document.createElement("div");
    const secondMount = document.createElement("div");
    firstHost.attachShadow({ mode: "open" }).append(firstMount);
    secondHost.attachShadow({ mode: "open" }).append(secondMount);

    render(<Radio name="size" value="small" label="Small" />, { container: firstMount });
    render(<Radio name="size" value="large" label="Large" />, { container: secondMount });
    const small = within(firstMount).getByRole("radio", { name: "Small" });
    const large = within(secondMount).getByRole("radio", { name: "Large" });

    await user.click(small);
    await user.click(large);

    expect(small).toHaveAttribute("aria-checked", "true");
    expect(large).toHaveAttribute("aria-checked", "true");
    firstHost.remove();
    secondHost.remove();
  });

  it("keeps same-name standalone radios exclusive within one shadow root", async () => {
    const user = userEvent.setup();
    const host = document.createElement("div");
    document.body.append(host);
    const mountPoint = document.createElement("div");
    host.attachShadow({ mode: "open" }).append(mountPoint);

    render(
      <form>
        <Radio name="size" value="small" label="Small" />
        <Radio name="size" value="large" label="Large" />
      </form>,
      { container: mountPoint },
    );
    const small = within(mountPoint).getByRole("radio", { name: "Small" });
    const large = within(mountPoint).getByRole("radio", { name: "Large" });

    await user.click(small);
    await user.click(large);

    expect(small).toHaveAttribute("aria-checked", "false");
    expect(large).toHaveAttribute("aria-checked", "true");
    host.remove();
  });

  it("normalizes same-name default selections to one checked standalone radio", async () => {
    render(
      <form aria-label="Test form">
        <Radio name="size" value="small" defaultChecked label="Small" />
        <Radio name="size" value="large" defaultChecked label="Large" />
      </form>,
    );

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /small/i })).toHaveAttribute(
        "aria-checked",
        "false",
      );
      expect(screen.getByRole("radio", { name: /large/i })).toHaveAttribute("aria-checked", "true");
    });
    expect(new FormData(getForm()).get("size")).toBe("large");
  });

  it("unchecks uncontrolled same-name radios when a controlled radio becomes checked", async () => {
    const user = userEvent.setup();
    function MixedRadios() {
      const [smallChecked, setSmallChecked] = useState(false);

      return (
        <form aria-label="Test form">
          <Radio
            name="size"
            value="small"
            checked={smallChecked}
            onChange={() => setSmallChecked(true)}
            label="Small"
          />
          <Radio name="size" value="large" defaultChecked label="Large" />
          <button type="button" onClick={() => setSmallChecked(true)}>
            Choose small
          </button>
        </form>
      );
    }

    render(<MixedRadios />);

    await user.click(screen.getByRole("button", { name: /choose small/i }));

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /small/i })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: /large/i })).toHaveAttribute(
        "aria-checked",
        "false",
      );
    });
  });

  it("lets an uncontrolled peer uncheck a cooperative controlled radio", async () => {
    const user = userEvent.setup();
    const onSmallChange = vi.fn();

    function MixedRadios() {
      const [smallChecked, setSmallChecked] = useState(true);

      return (
        <form aria-label="Test form">
          <Radio
            name="size"
            value="small"
            checked={smallChecked}
            onChange={(next) => {
              onSmallChange(next);
              setSmallChecked(next);
            }}
            label="Small"
          />
          <Radio name="size" value="large" label="Large" />
        </form>
      );
    }

    render(<MixedRadios />);
    await user.click(screen.getByRole("radio", { name: /large/i }));

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /small/i })).toHaveAttribute(
        "aria-checked",
        "false",
      );
      expect(screen.getByRole("radio", { name: /large/i })).toHaveAttribute("aria-checked", "true");
    });
    expect(onSmallChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(new FormData(getForm()).get("size")).toBe("large");
  });

  it("unchecks an uncontrolled peer when a controlled radio is clicked", async () => {
    const user = userEvent.setup();
    const onLargeChange = vi.fn();

    function MixedRadios() {
      const [largeChecked, setLargeChecked] = useState(false);

      return (
        <form aria-label="Test form">
          <Radio name="size" value="small" defaultChecked label="Small" />
          <Radio
            name="size"
            value="large"
            checked={largeChecked}
            onChange={(next) => {
              onLargeChange(next);
              setLargeChecked(next);
            }}
            label="Large"
          />
        </form>
      );
    }

    render(<MixedRadios />);
    await user.click(screen.getByRole("radio", { name: /large/i }));

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /small/i })).toHaveAttribute(
        "aria-checked",
        "false",
      );
      expect(screen.getByRole("radio", { name: /large/i })).toHaveAttribute("aria-checked", "true");
    });
    expect(onLargeChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(new FormData(getForm()).get("size")).toBe("large");
  });

  it("keeps controlled state when its parent refuses a peer uncheck request", async () => {
    const user = userEvent.setup();
    const onSmallChange = vi.fn();

    render(
      <form aria-label="Test form">
        <Radio name="size" value="small" checked onChange={onSmallChange} label="Small" />
        <Radio name="size" value="large" label="Large" />
      </form>,
    );

    await user.click(screen.getByRole("radio", { name: /large/i }));

    await waitFor(() => expect(onSmallChange).toHaveBeenCalledExactlyOnceWith(false));
    expect(screen.getByRole("radio", { name: /small/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /large/i })).toHaveAttribute("aria-checked", "true");
    expect(new FormData(getForm()).get("size")).toBe("large");
  });

  it("passes native root props and composes root handlers", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <Radio
        label="Option A"
        data-source="external"
        style={{ maxWidth: "16px" }}
        onClick={onClick}
        onKeyDown={onKeyDown}
      />,
    );

    const radio = screen.getByRole("radio", { name: /option a/i });
    await user.click(radio);
    radio.focus();
    await user.keyboard(" ");

    // onClick/onKeyDown are native event callbacks with no semantic value;
    // the contract here is that the consumer's handlers compose and fire.
    expect(onClick).toHaveBeenCalledOnce();
    expect(onKeyDown).toHaveBeenCalled();
    expect(radio).toHaveAttribute("data-source", "external");
    expect(radio).toHaveStyle({ maxWidth: "16px" });
  });

  it("lets consumer click handlers prevent the built-in selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Radio label="Option A" onChange={onChange} onClick={(event) => event.preventDefault()} />,
    );

    await user.click(screen.getByRole("radio", { name: /option a/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: /option a/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("lets consumer keyboard handlers prevent the built-in Space selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Radio label="Option A" onChange={onChange} onKeyDown={(event) => event.preventDefault()} />,
    );

    screen.getByRole("radio", { name: /option a/i }).focus();
    await user.keyboard(" ");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: /option a/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});
