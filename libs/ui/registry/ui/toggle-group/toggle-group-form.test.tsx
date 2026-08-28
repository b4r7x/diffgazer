import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ToggleGroup } from "./index";
import { getForm } from "./toggle-group-test-utils";

describe("ToggleGroup form participation", () => {
  it("participates in form data by name and resets to defaultValue", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Test form">
        <ToggleGroup label="Options" name="option" defaultValue="a" onChange={onChange}>
          <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
          <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        </ToggleGroup>
      </form>,
    );
    const form = getForm();

    expect(new FormData(form).get("option")).toBe("a");
    await user.click(screen.getByRole("radio", { name: /beta/i }));
    expect(new FormData(form).get("option")).toBe("b");
    expect(onChange).toHaveBeenCalledOnce();

    form.reset();
    await waitFor(() => expect(new FormData(form).get("option")).toBe("a"));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("keeps a single ToggleGroup activation newer than a same-task form reset", async () => {
    render(
      <form aria-label="Test form">
        <ToggleGroup label="Options" name="option" defaultValue="a">
          <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
          <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        </ToggleGroup>
      </form>,
    );
    const form = getForm();

    form.reset();
    // fireEvent retained: activation must remain in the reset task before its microtask can flush.
    fireEvent.click(screen.getByRole("radio", { name: /beta/i }));
    await Promise.resolve();

    expect(new FormData(form).get("option")).toBe("b");
  });

  it.each([
    "single",
    "multiple",
  ] as const)("applies a %s ToggleGroup reset before a later activation", async (mode) => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        {mode === "single" ? (
          <ToggleGroup label="Options" name="option" defaultValue="a">
            <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
            <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
          </ToggleGroup>
        ) : (
          <ToggleGroup label="Options" selectionMode="multiple" defaultValue={["a"]}>
            <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
            <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
          </ToggleGroup>
        )}
      </form>,
    );
    const role = mode === "single" ? "radio" : "button";
    const selectedAttribute = mode === "single" ? "aria-checked" : "aria-pressed";
    const alpha = screen.getByRole(role, { name: /alpha/i });
    const beta = screen.getByRole(role, { name: /beta/i });
    const form = getForm();

    await user.click(beta);
    expect(beta).toHaveAttribute(selectedAttribute, "true");

    form.reset();
    await waitFor(() => expect(alpha).toHaveAttribute(selectedAttribute, "true"));
    expect(beta).toHaveAttribute(selectedAttribute, "false");

    await user.click(beta);
    expect(beta).toHaveAttribute(selectedAttribute, "true");
    expect(alpha).toHaveAttribute(selectedAttribute, mode === "single" ? "false" : "true");
  });

  it("omits form data when disabled or deselected", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <form aria-label="Test form">
        <ToggleGroup label="Options" name="option" defaultValue="a" disabled>
          <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        </ToggleGroup>
      </form>,
    );
    expect(new FormData(getForm()).has("option")).toBe(false);

    rerender(
      <form aria-label="Test form">
        <ToggleGroup label="Options" name="option" defaultValue="a" allowDeselect>
          <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        </ToggleGroup>
      </form>,
    );
    await user.click(screen.getByRole("button", { name: /alpha/i }));
    expect(new FormData(getForm()).has("option")).toBe(false);
  });

  it("retains a disabled selected value without submitting it", async () => {
    function FormGroup({ itemDisabled }: { itemDisabled: boolean }) {
      return (
        <form aria-label="Test form">
          <ToggleGroup label="Options" name="option" value="a">
            <ToggleGroup.Item value="a" disabled={itemDisabled}>
              Alpha
            </ToggleGroup.Item>
            <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
          </ToggleGroup>
        </form>
      );
    }

    const { rerender } = render(<FormGroup itemDisabled={false} />);
    const form = getForm();
    expect(new FormData(form).get("option")).toBe("a");

    rerender(<FormGroup itemDisabled />);

    await waitFor(() => expect(new FormData(form).has("option")).toBe(false));
    expect(screen.getByRole("radio", { name: /alpha/i })).toHaveAttribute("aria-checked", "true");

    rerender(<FormGroup itemDisabled={false} />);
    await waitFor(() => expect(new FormData(form).get("option")).toBe("a"));
  });

  it("submits the selected value when its item has a hidden ancestor", async () => {
    render(
      <form aria-label="Test form">
        <ToggleGroup label="Options" name="option" defaultValue="a">
          <div hidden>
            <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
          </div>
          <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        </ToggleGroup>
      </form>,
    );

    const form = getForm();
    await waitFor(() => expect(new FormData(form).get("option")).toBe("a"));
  });

  it("does not disable the SSR-seeded single-mode hidden input", () => {
    const markup = renderToString(
      <form aria-label="Test form">
        <ToggleGroup label="Options" name="option" defaultValue="a">
          <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
          <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        </ToggleGroup>
      </form>,
    );
    const container = document.createElement("div");
    container.innerHTML = markup;

    const form = container.querySelector<HTMLFormElement>("form");
    const input = container.querySelector<HTMLInputElement>('input[type="hidden"]');
    if (!form || !input) throw new Error("Expected SSR form and hidden input");

    expect(input).not.toBeDisabled();
    expect(new FormData(form).get("option")).toBe("a");
  });

  it("resets uncontrolled multiple values silently", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Test form">
        <ToggleGroup
          label="Options"
          selectionMode="multiple"
          defaultValue={["a"]}
          onChange={onChange}
        >
          <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
          <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        </ToggleGroup>
      </form>,
    );
    const form = getForm();
    const alpha = screen.getByRole("button", { name: /alpha/i });
    const beta = screen.getByRole("button", { name: /beta/i });

    await user.click(alpha);
    await user.click(beta);
    expect(alpha).toHaveAttribute("aria-pressed", "false");
    expect(beta).toHaveAttribute("aria-pressed", "true");
    expect(onChange).toHaveBeenCalledTimes(2);

    form.reset();
    await waitFor(() => expect(alpha).toHaveAttribute("aria-pressed", "true"));
    expect(beta).toHaveAttribute("aria-pressed", "false");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("keeps a multiple ToggleGroup activation newer than a same-task form reset", async () => {
    render(
      <form aria-label="Test form">
        <ToggleGroup label="Options" selectionMode="multiple" defaultValue={["a"]}>
          <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
          <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        </ToggleGroup>
      </form>,
    );
    const form = getForm();

    form.reset();
    // fireEvent retained: activation must remain in the reset task before its microtask can flush.
    fireEvent.click(screen.getByRole("button", { name: /beta/i }));
    await Promise.resolve();

    expect(screen.getByRole("button", { name: /alpha/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /beta/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not render a hidden input in multiple mode", () => {
    const { container } = render(
      <ToggleGroup label="Options" selectionMode="multiple" name="severities" defaultValue={["a"]}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
      </ToggleGroup>,
    );

    // querySelector retained: hidden input has no accessible role; structural assertion is the contract (asserting absence by negative role query is impossible)
    expect(container.querySelector('input[type="hidden"]')).toBeNull();
  });
});
