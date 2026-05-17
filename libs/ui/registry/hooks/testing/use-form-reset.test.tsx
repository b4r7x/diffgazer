import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useFormReset } from "../use-form-reset";

function ResettableInput({
  defaultValue,
  enabled = true,
  onReset,
  insideForm = true,
}: {
  defaultValue: string;
  enabled?: boolean;
  onReset?: (value: string) => void;
  insideForm?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  useFormReset(ref, defaultValue, (nextValue) => {
    onReset?.(nextValue);
    setValue(nextValue);
  }, enabled);

  const input = (
    <input
      ref={ref}
      aria-label="Name"
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
    />
  );

  return insideForm ? <form aria-label="Profile">{input}</form> : input;
}

function MovableResettableInput({
  defaultValue,
  formName,
  onReset,
}: {
  defaultValue: string;
  formName: "A" | "B";
  onReset?: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  useFormReset(ref, defaultValue, (nextValue) => {
    onReset?.(nextValue);
    setValue(nextValue);
  });

  const input = (
    <input
      ref={ref}
      aria-label="Name"
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
    />
  );

  return (
    <>
      <form aria-label="Profile A">{formName === "A" ? input : null}</form>
      <form aria-label="Profile B">{formName === "B" ? input : null}</form>
    </>
  );
}

describe("useFormReset", () => {
  it("does not reset when disabled", async () => {
    const onReset = vi.fn();
    render(<ResettableInput defaultValue="initial" enabled={false} onReset={onReset} />);

    const input = screen.getByRole("textbox", { name: /name/i });
    await userEvent.clear(input);
    await userEvent.type(input, "changed");

    screen.getByRole("form", { name: /profile/i }).dispatchEvent(new Event("reset", { bubbles: true }));

    expect(input).toHaveValue("changed");
    expect(onReset).not.toHaveBeenCalled();
  });

  it("does nothing when no parent form exists", async () => {
    const onReset = vi.fn();
    render(<ResettableInput defaultValue="initial" insideForm={false} onReset={onReset} />);

    const input = screen.getByRole("textbox", { name: /name/i });
    await userEvent.clear(input);
    await userEvent.type(input, "changed");

    input.dispatchEvent(new Event("reset", { bubbles: true }));

    expect(input).toHaveValue("changed");
    expect(onReset).not.toHaveBeenCalled();
  });

  it("removes the reset listener on unmount", () => {
    const onReset = vi.fn();
    const { unmount } = render(<ResettableInput defaultValue="initial" onReset={onReset} />);
    const form = screen.getByRole("form", { name: /profile/i });

    unmount();
    form.dispatchEvent(new Event("reset", { bubbles: true }));

    expect(onReset).not.toHaveBeenCalled();
  });

  it("uses the latest reset value", async () => {
    const onReset = vi.fn();
    const { rerender } = render(<ResettableInput defaultValue="initial" onReset={onReset} />);

    rerender(<ResettableInput defaultValue="updated" onReset={onReset} />);
    screen.getByRole("form", { name: /profile/i }).dispatchEvent(new Event("reset", { bubbles: true }));

    await waitFor(() => expect(screen.getByRole("textbox", { name: /name/i })).toHaveValue("updated"));
    expect(onReset).toHaveBeenCalledWith("updated");
  });

  it("does not accumulate reset listeners across rerenders", async () => {
    const onReset = vi.fn();
    const { rerender } = render(<ResettableInput defaultValue="initial" onReset={onReset} />);

    rerender(<ResettableInput defaultValue="updated" onReset={onReset} />);
    rerender(<ResettableInput defaultValue="updated" onReset={onReset} />);
    screen.getByRole("form", { name: /profile/i }).dispatchEvent(new Event("reset", { bubbles: true }));

    await waitFor(() => expect(onReset).toHaveBeenCalledOnce());
    expect(onReset).toHaveBeenCalledWith("updated");
  });

  it("resubscribes when the control moves to another form", async () => {
    const onReset = vi.fn();
    const { rerender } = render(<MovableResettableInput defaultValue="initial" formName="A" onReset={onReset} />);
    const formA = screen.getByRole("form", { name: /profile a/i });
    const input = screen.getByRole("textbox", { name: /name/i });

    await userEvent.clear(input);
    await userEvent.type(input, "changed");

    rerender(<MovableResettableInput defaultValue="next" formName="B" onReset={onReset} />);

    formA.dispatchEvent(new Event("reset", { bubbles: true }));
    expect(screen.getByRole("textbox", { name: /name/i })).toHaveValue("changed");
    expect(onReset).not.toHaveBeenCalled();

    screen.getByRole("form", { name: /profile b/i }).dispatchEvent(new Event("reset", { bubbles: true }));

    await waitFor(() => expect(screen.getByRole("textbox", { name: /name/i })).toHaveValue("next"));
    expect(onReset).toHaveBeenCalledWith("next");
  });

  it("cleans up when disabled after being enabled", () => {
    const onReset = vi.fn();
    const { rerender } = render(<ResettableInput defaultValue="initial" onReset={onReset} />);
    const form = screen.getByRole("form", { name: /profile/i });

    rerender(<ResettableInput defaultValue="initial" enabled={false} onReset={onReset} />);
    form.dispatchEvent(new Event("reset", { bubbles: true }));

    expect(onReset).not.toHaveBeenCalled();
  });

  it("skips reset when the consumer's own handler calls preventDefault", async () => {
    const onReset = vi.fn();
    function Cancelable() {
      const ref = useRef<HTMLInputElement>(null);
      const [value, setValue] = useState("initial");
      useFormReset(ref, "initial", (nextValue) => {
        onReset(nextValue);
        setValue(nextValue);
      });
      return (
        <form aria-label="Profile" onReset={(event) => event.preventDefault()}>
          <input
            ref={ref}
            aria-label="Name"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
          />
        </form>
      );
    }
    render(<Cancelable />);
    const input = screen.getByRole("textbox", { name: /name/i });

    await userEvent.clear(input);
    await userEvent.type(input, "changed");

    screen
      .getByRole("form", { name: /profile/i })
      .dispatchEvent(new Event("reset", { bubbles: true, cancelable: true }));

    await Promise.resolve();
    expect(onReset).not.toHaveBeenCalled();
    expect(input).toHaveValue("changed");
  });

  it("does not churn the reset listener across rerenders with stable props", () => {
    const addSpy = vi.spyOn(HTMLFormElement.prototype, "addEventListener");
    const removeSpy = vi.spyOn(HTMLFormElement.prototype, "removeEventListener");
    try {
      const { rerender, unmount } = render(<ResettableInput defaultValue="initial" />);
      for (let i = 0; i < 10; i += 1) {
        rerender(<ResettableInput defaultValue="initial" />);
      }

      const resetAdds = addSpy.mock.calls.filter(([type]) => type === "reset");
      const resetRemoves = removeSpy.mock.calls.filter(([type]) => type === "reset");
      expect(resetAdds).toHaveLength(1);
      expect(resetRemoves).toHaveLength(0);

      unmount();
      const resetRemovesAfterUnmount = removeSpy.mock.calls.filter(([type]) => type === "reset");
      expect(resetRemovesAfterUnmount).toHaveLength(1);
    } finally {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    }
  });
});
