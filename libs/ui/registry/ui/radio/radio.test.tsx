import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { expectFieldInvalid, expectResetClearsInvalid } from "../../testing/form-behavior";
import { Field } from "../field/index";
import { Radio, RadioGroup, type RadioGroupItemProps } from "./index";
import type { RadioGroupProps } from "./radio-group";

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
    expectFieldInvalid(radio, /field help.*field error.*local help/i);
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

describe("RadioGroup", () => {
  it.each([
    { defaultValue: "blue", expected: "Blue", label: "default-selected item" },
    { defaultValue: undefined, expected: "Blue", label: "first enabled fallback" },
  ])("renders the $label as the only server Tab stop", ({ defaultValue, expected }) => {
    const markup = renderToString(
      <RadioGroup label="Colors" defaultValue={defaultValue}>
        <RadioGroup.Item value="red" label="Red" disabled />
        <RadioGroup.Item value="blue" label="Blue" />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>,
    );
    const container = document.createElement("div");
    container.innerHTML = markup;
    const radios = within(container).getAllByRole("radio");
    const tabbable = radios.filter((radio) => radio.getAttribute("tabindex") === "0");

    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveTextContent(expected);
  });

  it("keeps a visible radio as the only Tab stop when the selected item is CSS-hidden", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <style>{`.css-hidden-radio { display: none; }`}</style>
        <button type="button">Before</button>
        <RadioGroup label="Colors" value="red">
          <div className="css-hidden-radio">
            <RadioGroup.Item value="red" label="Red" />
          </div>
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
        <button type="button">After</button>
      </>,
    );
    const red = container.querySelector<HTMLElement>('[role="radio"][data-value="red"]');
    const blue = screen.getByRole("radio", { name: "Blue" });
    if (!red) throw new Error("Expected CSS-hidden red radio");

    await waitFor(() => {
      expect(red).toHaveAttribute("tabindex", "-1");
      expect(blue).toHaveAttribute("tabindex", "0");
    });

    screen.getByRole("button", { name: "Before" }).focus();
    await user.tab();
    expect(blue).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();

    await user.tab({ shift: true });
    expect(blue).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
  });

  it("resyncs the RadioGroup Tab target when an ancestor class changes visibility", async () => {
    function VisibilityGroup({ hideSelected }: { hideSelected: boolean }) {
      return (
        <>
          <style>{`.css-hidden-radio { display: none; }`}</style>
          <RadioGroup label="Colors" value="red">
            <div className={hideSelected ? "css-hidden-radio" : undefined}>
              <RadioGroup.Item value="red" label="Red" />
            </div>
            <RadioGroup.Item value="blue" label="Blue" />
          </RadioGroup>
        </>
      );
    }

    const { rerender } = render(<VisibilityGroup hideSelected={false} />);
    const red = screen.getByRole("radio", { name: "Red" });
    const blue = screen.getByRole("radio", { name: "Blue" });
    expect(red).toHaveAttribute("tabindex", "0");
    expect(blue).toHaveAttribute("tabindex", "-1");

    rerender(<VisibilityGroup hideSelected />);
    await waitFor(() => {
      expect(red).toHaveAttribute("tabindex", "-1");
      expect(blue).toHaveAttribute("tabindex", "0");
    });

    rerender(<VisibilityGroup hideSelected={false} />);
    await waitFor(() => {
      expect(red).toHaveAttribute("tabindex", "0");
      expect(blue).toHaveAttribute("tabindex", "-1");
    });
  });

  it("submits the item value when its DOM id is different", () => {
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" defaultValue="ocean" label="Colors">
          <RadioGroup.Item id="blue-control" value="ocean" label="Blue" />
          <RadioGroup.Item id="red-control" value="sunset" label="Red" />
        </RadioGroup>
      </form>,
    );

    expect(screen.getByRole("radio", { name: "Blue" })).toHaveAttribute("id", "blue-control");
    expect(new FormData(getForm()).get("color")).toBe("ocean");
  });

  it("does not dev-warn when selecting a registered item", async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(
      <RadioGroup label="Colors" onChange={vi.fn()}>
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );
    await user.click(screen.getByRole("radio", { name: /blue/i }));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("supports direct namespaced items with custom label UI", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label={<span>Red</span>} description={<span>Warm</span>} />
        <RadioGroup.Item value="blue" label={<span>Blue</span>} />
      </RadioGroup>,
    );

    await user.click(screen.getByRole("radio", { name: /blue/i }));

    expect(onChange).toHaveBeenCalledWith("blue");
    expect(screen.getByText("Warm")).toBeInTheDocument();
  });

  it("selects a value on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );
    await user.click(screen.getByText("Blue"));
    expect(onChange).toHaveBeenCalledWith("blue");
  });

  it("renders the group label visibly and names the group with aria-labelledby", () => {
    render(
      <RadioGroup label="Colors">
        <RadioGroup.Item value="red" label="Red" />
      </RadioGroup>,
    );

    const label = screen.getByText("Colors");
    const group = screen.getByRole("radiogroup", { name: "Colors" });
    expect(label).toBeVisible();
    expect(group).toHaveAttribute("aria-labelledby", label.id);
    expect(group).not.toHaveAttribute("aria-label");
  });

  it("uses an explicit aria-label instead of the visible group label", () => {
    render(
      <RadioGroup label="Visible colors" aria-label="Color choices">
        <RadioGroup.Item value="red" label="Red" />
      </RadioGroup>,
    );

    expect(screen.getByText("Visible colors")).toBeVisible();
    const group = screen.getByRole("radiogroup", { name: "Color choices" });
    expect(group).toHaveAttribute("aria-label", "Color choices");
    expect(group).not.toHaveAttribute("aria-labelledby");
    expect(screen.queryByRole("radiogroup", { name: "Visible colors" })).not.toBeInTheDocument();
  });

  it("preserves Field invalid and description wiring on the group", () => {
    render(
      <Field invalid>
        <Field.Label>Colors</Field.Label>
        <Field.Control>
          <RadioGroup>
            <RadioGroup.Item value="red" label="Red" />
          </RadioGroup>
        </Field.Control>
        <Field.Error>Select a color.</Field.Error>
      </Field>,
    );

    const group = screen.getByRole("radiogroup", { name: "Colors" });
    expectFieldInvalid(group, "Select a color.");
  });

  it("does not select disabled items", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" disabled />
      </RadioGroup>,
    );
    await user.click(screen.getByText("Blue"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not move keyboard highlight on mouse hover", async () => {
    const user = userEvent.setup();
    const onHighlight = vi.fn();
    render(
      <RadioGroup label="Colors" highlighted="red" onHighlightChange={onHighlight}>
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    await user.hover(screen.getByRole("radio", { name: /blue/i }));

    expect(onHighlight).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: /red/i })).toHaveAttribute("data-highlighted");
    expect(screen.getByRole("radio", { name: /blue/i })).not.toHaveAttribute("data-highlighted");
  });

  it("wraps across enabled radios, skips disabled items, and maps navigation keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onNavigate = vi.fn();
    render(
      <RadioGroup label="Colors" onChange={onChange} onNavigate={onNavigate}>
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" disabled />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>,
    );

    const red = screen.getByRole("radio", { name: /red/i });
    const blue = screen.getByRole("radio", { name: /blue/i });
    const green = screen.getByRole("radio", { name: /green/i });

    red.focus();
    await user.keyboard("{ArrowDown}");
    expect(green).toHaveFocus();
    expect(green).toHaveAttribute("aria-checked", "true");
    expect(onChange).toHaveBeenLastCalledWith("green");
    expect(onNavigate).toHaveBeenLastCalledWith("green", "next");

    await user.keyboard("{ArrowDown}");
    expect(red).toHaveFocus();
    expect(onNavigate).toHaveBeenLastCalledWith("red", "next");

    await user.keyboard("{ArrowUp}");
    expect(green).toHaveFocus();
    expect(onNavigate).toHaveBeenLastCalledWith("green", "previous");

    await user.keyboard("{Home}");
    expect(red).toHaveFocus();
    expect(onNavigate).toHaveBeenLastCalledWith("red", "first");

    await user.keyboard("{End}");
    expect(green).toHaveFocus();
    expect(onNavigate).toHaveBeenLastCalledWith("green", "last");

    await user.keyboard("{ArrowLeft}");
    expect(red).toHaveFocus();
    expect(onNavigate).toHaveBeenLastCalledWith("red", "previous");

    await user.keyboard("{ArrowRight}");
    expect(green).toHaveFocus();
    expect(onNavigate).toHaveBeenLastCalledWith("green", "next");
    expect(blue).not.toHaveFocus();
    expect(blue).toHaveAttribute("aria-checked", "false");
  });

  it("lets a consumer onKeyDown handler suppress the built-in arrow navigation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onKeyDown = vi.fn((event: ReactKeyboardEvent) => event.preventDefault());
    render(
      <RadioGroup label="Colors" defaultValue="red" onChange={onChange} onKeyDown={onKeyDown}>
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    const red = screen.getByRole("radio", { name: /red/i });
    red.focus();
    await user.keyboard("{ArrowDown}");

    expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: "ArrowDown" }));
    expect(red).toHaveFocus();
    expect(red).toHaveAttribute("aria-checked", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports non-wrapping keyboard boundaries without moving focus", async () => {
    const user = userEvent.setup();
    const onNavigationBoundaryReached = vi.fn();
    render(
      <RadioGroup
        label="Colors"
        defaultValue="red"
        wrap={false}
        onNavigationBoundaryReached={onNavigationBoundaryReached}
      >
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    const red = screen.getByRole("radio", { name: /red/i });
    const blue = screen.getByRole("radio", { name: /blue/i });

    red.focus();
    await user.keyboard("{ArrowUp}");
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith(
      "previous",
      expect.any(KeyboardEvent),
      "ArrowUp",
    );
    expect(red).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith(
      "previous",
      expect.any(KeyboardEvent),
      "ArrowLeft",
    );
    expect(red).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(blue).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith(
      "next",
      expect.any(KeyboardEvent),
      "ArrowDown",
    );
    expect(blue).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith(
      "next",
      expect.any(KeyboardEvent),
      "ArrowRight",
    );
    expect(blue).toHaveFocus();
  });

  it("keeps arrow navigation scoped away from nested radio groups", async () => {
    const user = userEvent.setup();
    const onOuterChange = vi.fn();
    const onInnerChange = vi.fn();
    render(
      <RadioGroup label="Outer" onChange={onOuterChange}>
        <RadioGroup.Item value="outer-a" label="Outer A" />
        <RadioGroup label="Inner" onChange={onInnerChange}>
          <RadioGroup.Item value="inner-a" label="Inner A" />
        </RadioGroup>
        <RadioGroup.Item value="outer-b" label="Outer B" />
      </RadioGroup>,
    );

    screen.getByRole("radio", { name: /outer a/i }).focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: /outer b/i })).toHaveFocus();
    expect(onOuterChange).toHaveBeenCalledWith("outer-b");
    expect(onInnerChange).not.toHaveBeenCalled();
  });

  it("does not handle arrow events bubbling from a nested group with suspended keyboard navigation", async () => {
    const user = userEvent.setup();
    const onOuterChange = vi.fn();
    const onInnerChange = vi.fn();
    render(
      <RadioGroup label="Outer" onChange={onOuterChange}>
        <RadioGroup.Item value="outer-a" label="Outer A" />
        <RadioGroup label="Inner" onChange={onInnerChange} keyboardNavigation={false}>
          <RadioGroup.Item value="inner-a" label="Inner A" />
        </RadioGroup>
        <RadioGroup.Item value="outer-b" label="Outer B" />
      </RadioGroup>,
    );

    screen.getByRole("radio", { name: /inner a/i }).focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: /inner a/i })).toHaveFocus();
    expect(onOuterChange).not.toHaveBeenCalled();
    expect(onInnerChange).not.toHaveBeenCalled();
  });

  it("keeps the highlighted item tabbable during manual activation", () => {
    render(
      <RadioGroup label="Colors" value="red" highlighted="blue" activationMode="manual">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    const red = screen.getByRole("radio", { name: /red/i });
    const blue = screen.getByRole("radio", { name: /blue/i });
    expect(red).toHaveAttribute("aria-checked", "true");
    expect(red).toHaveAttribute("tabindex", "-1");
    expect(blue).toHaveAttribute("tabindex", "0");
    expect(blue).toHaveAttribute("data-highlighted");
  });

  it("respects controlled value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup value="red" onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );
    await user.click(screen.getByText("Blue"));
    expect(onChange).toHaveBeenCalledWith("blue");
    expect(screen.getAllByRole("radio")[0]).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("radio")[1]).toHaveAttribute("aria-checked", "false");
  });

  it("keeps explicit value undefined controlled instead of adopting internal selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup value={undefined} onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    await user.click(screen.getByText("Blue"));

    expect(onChange).toHaveBeenCalledWith("blue");
    expect(screen.getAllByRole("radio")[0]).toHaveAttribute("aria-checked", "false");
    expect(screen.getAllByRole("radio")[1]).toHaveAttribute("aria-checked", "false");
  });

  it("has no a11y violations (unselected and selected)", async () => {
    const { container, unmount } = render(
      <RadioGroup label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );
    expect(await axe(container)).toHaveNoViolations();
    unmount();

    const { container: selectedContainer } = render(
      <RadioGroup label="Colors" defaultValue="red">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );
    expect(screen.getByRole("radio", { name: "Red" })).toHaveAttribute("aria-checked", "true");
    expect(await axe(selectedContainer)).toHaveNoViolations();
  });

  it("uses native aria-labelledby for the group name", () => {
    render(
      <>
        <h2 id="choice-label">Choice set</h2>
        <RadioGroup aria-labelledby="choice-label">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </>,
    );

    expect(screen.getByRole("radiogroup", { name: "Choice set" })).toHaveAttribute(
      "aria-labelledby",
      "choice-label",
    );
  });

  it("moves selection with ArrowDown", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>,
    );
    const red = screen.getByRole("radio", { name: /red/i });
    const blue = screen.getByRole("radio", { name: /blue/i });

    red.focus();
    await user.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith("blue");
    expect(blue).toHaveFocus();
    expect(blue).toHaveAttribute("aria-checked", "true");
  });

  it("can suspend keyboard navigation without disabling items", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup onChange={onChange} label="Colors" keyboardNavigation={false}>
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    const red = screen.getByRole("radio", { name: /red/i });
    const blue = screen.getByRole("radio", { name: /blue/i });
    expect(red).toHaveAttribute("tabindex", "0");
    expect(blue).toHaveAttribute("tabindex", "0");

    red.focus();
    await user.keyboard("{ArrowDown}");
    expect(onChange).not.toHaveBeenCalled();
    expect(red).toHaveFocus();

    await user.tab();
    expect(blue).toHaveFocus();

    await user.click(blue);
    expect(onChange).toHaveBeenCalledWith("blue");
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-disabled");
  });

  it("commits the focused value with Enter during manual activation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onEnter = vi.fn();
    render(
      <RadioGroup
        label="Colors"
        defaultValue="red"
        onChange={onChange}
        onEnter={onEnter}
        activationMode="manual"
      >
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    screen.getByRole("radio", { name: /red/i }).focus();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onEnter).toHaveBeenCalledWith("blue", expect.objectContaining({ key: "Enter" }));
    expect(onChange).toHaveBeenCalledWith("blue");
    expect(screen.getByRole("radio", { name: /blue/i })).toHaveAttribute("aria-checked", "true");
  });

  it("can separate keyboard navigation from value changes during manual activation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onNavigate = vi.fn();
    const onHighlight = vi.fn();
    render(
      <RadioGroup
        label="Colors"
        value="red"
        onChange={onChange}
        onNavigate={onNavigate}
        onHighlightChange={onHighlight}
        activationMode="manual"
      >
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    const red = screen.getByRole("radio", { name: /red/i });
    const blue = screen.getByRole("radio", { name: /blue/i });

    red.focus();
    await user.keyboard("{ArrowDown}");

    expect(blue).toHaveFocus();
    expect(red).toHaveAttribute("tabindex", "-1");
    expect(blue).toHaveAttribute("tabindex", "0");
    expect(red).toHaveAttribute("aria-checked", "true");
    expect(blue).toHaveAttribute("aria-checked", "false");
    expect(onHighlight).toHaveBeenCalledWith("blue");
    expect(onNavigate).toHaveBeenCalledWith("blue", "next");
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith("blue");
  });

  it("focuses the highlighted item when autofocus is enabled", async () => {
    render(
      <RadioGroup label="Colors" value="red" highlighted="blue" activationMode="manual" autoFocus>
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    await waitFor(() => expect(screen.getByRole("radio", { name: /blue/i })).toHaveFocus());
    expect(screen.getByRole("radio", { name: /red/i })).toHaveAttribute("aria-checked", "true");
  });

  it("resets uncontrolled group value with native form reset", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" defaultValue="red" onChange={onChange} label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );

    await user.click(screen.getByRole("radio", { name: /blue/i }));
    const form = getForm();
    expect(new FormData(form).get("color")).toBe("blue");
    expect(onChange).toHaveBeenCalledOnce();

    form.reset();
    await waitFor(() => expect(new FormData(form).get("color")).toBe("red"));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("keeps a RadioGroup activation newer than a same-task form reset", async () => {
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" defaultValue="red" label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );
    const form = getForm();

    form.reset();
    // fireEvent retained: activation must remain in the reset task before its microtask can flush.
    fireEvent.click(screen.getByRole("radio", { name: /blue/i }));
    await Promise.resolve();

    expect(new FormData(form).get("color")).toBe("blue");
  });

  it("applies a RadioGroup reset before a later activation", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" defaultValue="red" label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );
    const blue = screen.getByRole("radio", { name: /blue/i });
    const form = getForm();

    await user.click(blue);
    expect(new FormData(form).get("color")).toBe("blue");

    form.reset();
    await waitFor(() => expect(new FormData(form).get("color")).toBe("red"));
    expect(blue).toHaveAttribute("aria-checked", "false");

    await user.click(blue);
    expect(blue).toHaveAttribute("aria-checked", "true");
    expect(new FormData(form).get("color")).toBe("blue");
  });

  it("clears the group's aria-invalid on native form reset after a failed submit", async () => {
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" required label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );

    await expectResetClearsInvalid(getForm(), screen.getByRole("radiogroup", { name: "Colors" }));
  });

  it("marks required groups and routes native validation to a visible radio", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" required label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );

    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-required", "true");
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toHaveAttribute("aria-required");
    }
    expect(screen.getAllByRole("radio")).toHaveLength(2);

    const form = getForm();
    expect(form.reportValidity()).toBe(false);
    expect(screen.getByRole("radio", { name: /red/i })).toHaveFocus();
    await waitFor(() => expectFieldInvalid(screen.getByRole("radiogroup")));
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toHaveAttribute("aria-invalid");
    }

    await user.click(screen.getByRole("radio", { name: /blue/i }));
    expect(form.checkValidity()).toBe(true);
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-invalid");
    expect(new FormData(form).get("color")).toBe("blue");
  });

  it("does not satisfy required validation with a stale controlled value", async () => {
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" required label="Colors" value="missing">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );

    const form = getForm();
    expect(form.checkValidity()).toBe(false);
    expect(new FormData(form).has("color")).toBe(false);

    expect(form.reportValidity()).toBe(false);
    expect(screen.getByRole("radio", { name: /red/i })).toHaveFocus();
    await waitFor(() => expectFieldInvalid(screen.getByRole("radiogroup")));
  });

  it("validates required groups with items rendered through wrapper components", () => {
    function WrappedBlue() {
      return <RadioGroup.Item value="blue" label="Blue" />;
    }

    render(
      <form aria-label="Test form">
        <RadioGroup name="color" required label="Colors" value="blue">
          <WrappedBlue />
        </RadioGroup>
      </form>,
    );

    const form = getForm();
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("color")).toBe("blue");
  });

  it("validates required unnamed groups without contributing FormData", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <RadioGroup required label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );

    const form = getForm();
    expect(form.reportValidity()).toBe(false);
    expect(screen.getByRole("radio", { name: /red/i })).toHaveFocus();
    await waitFor(() => expectFieldInvalid(screen.getByRole("radiogroup")));
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toHaveAttribute("aria-invalid");
    }
    expect(new FormData(form).entries().next().done).toBe(true);

    await user.click(screen.getByRole("radio", { name: /blue/i }));
    expect(form.checkValidity()).toBe(true);
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-invalid");
    expect(new FormData(form).entries().next().done).toBe(true);
  });

  it.each([
    { label: "named", name: "color" },
    { label: "unnamed", name: undefined },
  ])("exempts an all-disabled $label required group from validation", async ({ name }) => {
    function RequiredGroup({ allDisabled }: { allDisabled: boolean }) {
      return (
        <form aria-label="Test form">
          <button type="button">Before group</button>
          <RadioGroup {...(name ? { name } : {})} required label="Colors">
            <RadioGroup.Item value="red" label="Red" disabled={allDisabled} />
            <RadioGroup.Item value="blue" label="Blue" disabled={allDisabled} />
          </RadioGroup>
        </form>
      );
    }

    const { rerender } = render(<RequiredGroup allDisabled={false} />);
    const form = getForm();
    const group = screen.getByRole("radiogroup", { name: "Colors" });
    expect(form.reportValidity()).toBe(false);
    await waitFor(() => expectFieldInvalid(group));

    rerender(<RequiredGroup allDisabled />);

    await waitFor(() => expect(group).not.toHaveAttribute("aria-required"));
    expect(group).not.toHaveAttribute("aria-invalid");
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).has("color")).toBe(false);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-disabled", "true");
      expect(radio).toHaveAttribute("tabindex", "-1");
    }

    const before = screen.getByRole("button", { name: "Before group" });
    before.focus();
    expect(form.reportValidity()).toBe(true);
    expect(before).toHaveFocus();
  });

  it("does not call the public value callback with undefined on native reset", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" onChange={onChange} label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );

    await user.click(screen.getByRole("radio", { name: /blue/i }));
    expect(onChange).toHaveBeenCalledWith("blue");

    const form = getForm();
    form.reset();

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /blue/i })).toHaveAttribute("aria-checked", "false"),
    );
    // call-count IS the contract: native form reset must NOT fire onChange (count stays at 1 from the explicit click; a reset-triggered onChange with undefined would be a regression)
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("RadioGroup types", () => {
  it("narrows value/onChange to the supplied literal union", () => {
    type Narrow = RadioGroupProps<"sm" | "md" | "lg">;

    expectTypeOf<Narrow["value"]>().toEqualTypeOf<"sm" | "md" | "lg" | undefined>();
    expectTypeOf<Narrow["defaultValue"]>().toEqualTypeOf<"sm" | "md" | "lg" | undefined>();
    expectTypeOf<NonNullable<Narrow["onChange"]>>()
      .parameter(0)
      .toEqualTypeOf<"sm" | "md" | "lg">();
  });

  it("rejects RadioGroupItem values outside the literal union", () => {
    expectTypeOf<"xl">().not.toMatchTypeOf<RadioGroupItemProps<"sm" | "md" | "lg">["value"]>();
    expectTypeOf<"sm">().toMatchTypeOf<RadioGroupItemProps<"sm" | "md" | "lg">["value"]>();
  });

  it("keeps the loose default contract when no generic is supplied", () => {
    expectTypeOf<RadioGroupProps["value"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<RadioGroupItemProps["value"]>().toEqualTypeOf<string>();
  });
});
